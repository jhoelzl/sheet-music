import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { PDF_SIGNED_URL_TTL_SECONDS, PDF_STORAGE_BUCKET } from '../config'
import { supabase } from '../supabase'
import type { Composer, Instrument, Piece, PieceLink, PracticeLog } from '../supabase'
import { countPdfPages } from '../lib/pdf'
import { todayISO } from '../lib/dates'
import { detectLinkType, safeUrl } from '../lib/links'
import { VIEWS, sortPieces } from '../lib/sorting'
import type { SortKey, TableKey, View } from '../lib/sorting'
import { statusOf } from '../lib/status'

export type Toast = { id: number; message: string; kind: 'error' | 'info'; undo?: () => void }
export type Panel = 'composer' | 'piece' | null
export type Preview = { title: string; url: string; pages: number | null }
export const TABLE_COLUMNS = ['composer', 'instruments', 'tags', 'status', 'difficulty', 'rating', 'pages', 'practiced'] as const
export type TableColumnId = (typeof TABLE_COLUMNS)[number]
export type Library = ReturnType<typeof useLibrary>

/** All library state, data loading, mutations and derived data. */
export function useLibrary() {
  const [composers, setComposers] = useState<Composer[]>([])
  const [pieces, setPieces] = useState<Piece[]>([])
  const [logs, setLogs] = useState<PracticeLog[]>([])
  const [toasts, setToasts] = useState<Toast[]>([])
  const [preview, setPreview] = useState<Preview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [sort, setSort] = useState<SortKey>('title')
  const [view, setViewState] = useState<View>(() => {
    const v = localStorage.getItem('sm:view')
    return VIEWS.some((x) => x.value === v) ? (v as View) : 'grouped'
  })
  const setView = (v: View) => { setViewState(v); localStorage.setItem('sm:view', v) }
  const [tableCompact, setTableCompactState] = useState<boolean>(() => localStorage.getItem('sm:table-compact') === '1')
  const setTableCompact = (next: boolean) => {
    setTableCompactState(next)
    localStorage.setItem('sm:table-compact', next ? '1' : '0')
  }
  const [tableHiddenColumns, setTableHiddenColumns] = useState<TableColumnId[]>(() => {
    const raw = localStorage.getItem('sm:table-hidden-columns')
    if (!raw) return []
    try {
      const ids = JSON.parse(raw)
      return Array.isArray(ids) ? ids.filter((id): id is TableColumnId => TABLE_COLUMNS.includes(id as TableColumnId)) : []
    } catch {
      return []
    }
  })
  const toggleTableColumn = (id: TableColumnId) => {
    setTableHiddenColumns((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      localStorage.setItem('sm:table-hidden-columns', JSON.stringify(next))
      return next
    })
  }
  const resetTableColumns = () => {
    setTableHiddenColumns([])
    localStorage.setItem('sm:table-hidden-columns', '[]')
  }
  const [tableSort, setTableSort] = useState<{ key: TableKey; dir: 1 | -1 }>({ key: 'title', dir: 1 })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftTitle, setDraftTitle] = useState('')
  const [editingComposerId, setEditingComposerId] = useState<string | null>(null)
  const [draftComposer, setDraftComposer] = useState('')
  const [openLink, setOpenLink] = useState<string | null>(null)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())
  const [countFailed, setCountFailed] = useState<Set<string>>(new Set())
  const [countingPageIds, setCountingPageIds] = useState<Set<string>>(new Set())
  const toastSeq = useRef(0)
  const deleteTimers = useRef(new Map<string, number>())
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [instrumentFilter, setInstrumentFilter] = useState<'all' | Instrument>('all')
  const [newInstruments, setNewInstruments] = useState<Instrument[]>(['piano'])
  const [newTags, setNewTags] = useState<string[]>([])
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [composerName, setComposerName] = useState('')
  const [title, setTitle] = useState('')
  const [composerId, setComposerId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [panel, setPanel] = useState<Panel>(null)

  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  const notify = useCallback((message: string, kind: Toast['kind'] = 'error', undo?: () => void) => {
    const id = ++toastSeq.current
    setToasts((t) => [...t, { id, message, kind, undo }])
    window.setTimeout(() => dismissToast(id), undo ? 6000 : 5000)
    return id
  }, [dismissToast])

  const load = useCallback(async () => {
    const c = await supabase.from('sm_composers').select('*').order('name')
    const p = await supabase.from('sm_pieces').select('*').order('title')
    if (c.error || p.error) notify((c.error ?? p.error)!.message)
    setComposers(c.data ?? [])
    setPieces(p.data ?? [])
    // Missing table (migration 0010 not run yet) just leaves the calendar empty.
    const l = await supabase.from('sm_practice_log').select('id, piece_id, practiced_on').order('practiced_on', { ascending: false }).limit(5000)
    setLogs(l.data ?? [])
  }, [notify])

  useEffect(() => { void load() }, [load])

  const run = async (op: PromiseLike<{ error: { message: string } | null }>) => {
    const { error } = await op
    if (error) notify(error.message)
    await load()
    return !error
  }

  const addComposer = (e: FormEvent) => {
    e.preventDefault()
    void run(supabase.from('sm_composers').insert({ name: composerName.trim() })).then(() => { setComposerName(''); setPanel(null) })
  }

  const addPiece = async (e: FormEvent) => {
    e.preventDefault()
    const { data: { user } } = await supabase.auth.getUser()
    let pdf_path: string | null = null
    let pdf_pages: number | null = null
    if (file && user) {
      pdf_pages = await countPdfPages(file)
      pdf_path = `${user.id}/${crypto.randomUUID()}.pdf`
      const up = await supabase.storage.from(PDF_STORAGE_BUCKET).upload(pdf_path, file, { contentType: 'application/pdf' })
      if (up.error) { notify(`Upload failed: ${up.error.message}`); return }
    }
    const ok = await run(supabase.from('sm_pieces').insert({ title: title.trim(), composer_id: composerId, pdf_path, ...(pdf_pages ? { pdf_pages } : {}), instruments: newInstruments, ...(newTags.length ? { tags: newTags } : {}) }))
    if (!ok) return
    setTitle(''); setFile(null); setNewInstruments(['piano']); setNewTags([]); setPanel(null)
  }

  const practicedToday = new Set(logs.filter((l) => l.practiced_on === todayISO()).map((l) => l.piece_id))

  const togglePracticed = async (p: Piece) => {
    const today = todayISO()
    const existing = logs.find((l) => l.piece_id === p.id && l.practiced_on === today)
    const sync = (dates: string[]) => supabase.from('sm_pieces').update({ last_practiced: dates.sort().pop() ?? null }).eq('id', p.id)
    const others = logs.filter((l) => l.piece_id === p.id && l.practiced_on !== today).map((l) => l.practiced_on)
    if (existing) {
      const ok = await run(supabase.from('sm_practice_log').delete().eq('id', existing.id))
      if (ok) await sync(others)
    } else {
      const ok = await run(supabase.from('sm_practice_log').insert({ piece_id: p.id, practiced_on: today }))
      if (ok) {
        await sync([...others, today])
        notify(`Logged practice: ${p.title}`, 'info')
      }
    }
    await load()
  }

  const update = (p: Piece, patch: Partial<Piece>) =>
    void run(supabase.from('sm_pieces').update(patch).eq('id', p.id))

  // Hide the piece right away and only delete it for real once the undo window has passed.
  const remove = (p: Piece) => {
    setHiddenIds((h) => new Set(h).add(p.id))
    const unhide = () => setHiddenIds((h) => { const n = new Set(h); n.delete(p.id); return n })
    const toastId = notify(`Deleted "${p.title}"`, 'info', () => {
      window.clearTimeout(deleteTimers.current.get(p.id))
      deleteTimers.current.delete(p.id)
      unhide()
      dismissToast(toastId)
    })
    deleteTimers.current.set(p.id, window.setTimeout(() => {
      deleteTimers.current.delete(p.id)
      void (async () => {
        if (p.pdf_path) await supabase.storage.from(PDF_STORAGE_BUCKET).remove([p.pdf_path])
        await run(supabase.from('sm_pieces').delete().eq('id', p.id))
        unhide()
      })()
    }, 6000))
  }

  const startEdit = (p: Piece) => { setEditingId(p.id); setDraftTitle(p.title) }
  const commitEdit = (p: Piece) => {
    if (editingId !== p.id) return
    setEditingId(null)
    const next = draftTitle.trim()
    if (!next) { notify('Title cannot be empty.'); return }
    if (next !== p.title) update(p, { title: next })
  }

  const addLink = (p: Piece, raw: string) => {
    const value = raw.trim()
    if (!value) { setOpenLink(null); return }
    const url = safeUrl(value)
    if (!url) { notify('Please enter a valid http(s) link.'); return }
    const links = p.links ?? []
    if (links.some((l) => l.url === url)) { notify('This link is already added.'); return }
    update(p, { links: [...links, { type: detectLinkType(url), url }] })
    setOpenLink(null)
  }
  const removeLink = (p: Piece, link: PieceLink) =>
    update(p, { links: (p.links ?? []).filter((l) => l.url !== link.url) })

  const attachPdf = async (p: Piece, f: File) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUploadingId(p.id)
    const pdf_pages = await countPdfPages(f)
    const pdf_path = `${user.id}/${crypto.randomUUID()}.pdf`
    const up = await supabase.storage.from(PDF_STORAGE_BUCKET).upload(pdf_path, f, { contentType: 'application/pdf' })
    if (up.error) {
      notify(`Upload failed: ${up.error.message}`)
    } else {
      const ok = await run(supabase.from('sm_pieces').update({ pdf_path, ...(pdf_pages ? { pdf_pages } : {}) }).eq('id', p.id))
      if (!ok) await supabase.storage.from(PDF_STORAGE_BUCKET).remove([pdf_path])
    }
    setUploadingId(null)
  }

  // Hide the composer (and their pieces) right away and only delete once the undo window has passed.
  const removeComposer = (c: Composer) => {
    const key = `composer:${c.id}`
    const count = pieces.filter((p) => p.composer_id === c.id).length
    setHiddenIds((h) => new Set(h).add(key))
    const unhide = () => setHiddenIds((h) => { const n = new Set(h); n.delete(key); return n })
    const toastId = notify(`Deleted "${c.name}"${count ? ` and ${count} ${count === 1 ? 'piece' : 'pieces'}` : ''}`, 'info', () => {
      window.clearTimeout(deleteTimers.current.get(key))
      deleteTimers.current.delete(key)
      unhide()
      dismissToast(toastId)
    })
    const paths = pieces.filter((p) => p.composer_id === c.id && p.pdf_path).map((p) => p.pdf_path!)
    deleteTimers.current.set(key, window.setTimeout(() => {
      deleteTimers.current.delete(key)
      void (async () => {
        if (paths.length) await supabase.storage.from(PDF_STORAGE_BUCKET).remove(paths)
        await run(supabase.from('sm_composers').delete().eq('id', c.id))
        unhide()
      })()
    }, 6000))
  }

  const startEditComposer = (c: Composer) => { setEditingComposerId(c.id); setDraftComposer(c.name) }
  const commitComposerEdit = (c: Composer) => {
    if (editingComposerId !== c.id) return
    setEditingComposerId(null)
    const next = draftComposer.trim()
    if (!next) { notify('Composer name cannot be empty.'); return }
    if (next !== c.name) void run(supabase.from('sm_composers').update({ name: next }).eq('id', c.id))
  }

  const openPdf = async (p: Piece) => {
    if (!p.pdf_path || previewLoading) return
    let pages = p.pdf_pages ?? null
    if (pages == null && !countFailed.has(p.id)) {
      setCountingPageIds((prev) => new Set(prev).add(p.id))
      const { data } = await supabase.storage.from(PDF_STORAGE_BUCKET).download(p.pdf_path)
      pages = data ? await countPdfPages(data) : null
      setCountingPageIds((prev) => {
        const next = new Set(prev)
        next.delete(p.id)
        return next
      })
      if (pages) {
        await supabase.from('sm_pieces').update({ pdf_pages: pages }).eq('id', p.id)
        setPieces((prev) => prev.map((x) => (x.id === p.id ? { ...x, pdf_pages: pages } : x)))
      } else {
        setCountFailed((prev) => new Set(prev).add(p.id))
      }
    }
    setPreviewLoading(true)
    const { data, error } = await supabase.storage.from(PDF_STORAGE_BUCKET).createSignedUrl(p.pdf_path, PDF_SIGNED_URL_TTL_SECONDS)
    setPreviewLoading(false)
    if (error) notify(error.message)
    else setPreview({ title: p.title, url: data.signedUrl, pages })
  }

  useEffect(() => {
    if (!preview) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPreview(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [preview])

  const terms = search.toLowerCase().split(/\s+/).filter(Boolean)
  const visible = pieces.filter((p) => {
    if (hiddenIds.has(p.id)) return false
    const cn = composers.find((c) => c.id === p.composer_id)?.name ?? ''
    if (terms.length) {
      const haystack = `${p.title} ${cn} ${p.notes ?? ''} ${p.instruments.join(' ')} ${(p.tags ?? []).join(' ')}`.toLowerCase()
      if (!terms.every((t) => haystack.includes(t))) return false
    }
    if (instrumentFilter !== 'all' && !p.instruments.includes(instrumentFilter)) return false
    if (tagFilter && !(p.tags ?? []).includes(tagFilter)) return false
    switch (filter) {
      case 'can_play': return p.play_progress === 100
      case 'cannot_play': return p.play_progress === 0
      case 'learned': return p.play_progress > 0 && p.play_progress < 100
      case 'hard': return (p.difficulty ?? 0) >= 4
      default: return true
    }
  })
  const allTags = [...new Set([...pieces.flatMap((p) => p.tags ?? []), ...(tagFilter ? [tagFilter] : [])])].sort()
  const filtering = Boolean(search) || filter !== 'all' || instrumentFilter !== 'all' || Boolean(tagFilter)
  const composerNameOf = (id: string) => composers.find((c) => c.id === id)?.name ?? ''
  const tableRows = [...visible].sort((a, b) => {
    const val = (p: Piece): string | number => {
      switch (tableSort.key) {
        case 'composer': return composerNameOf(p.composer_id).toLowerCase()
        case 'status': return statusOf(p)
        case 'difficulty': return p.difficulty ?? -1
        case 'rating': return p.rating ?? -1
        case 'pages': return p.pdf_pages ?? -1
        case 'practiced': return p.last_practiced ?? ''
        default: return p.title.toLowerCase()
      }
    }
    const x = val(a), y = val(b)
    const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))
    return c * tableSort.dir || a.title.localeCompare(b.title)
  })
  const sortBy = (key: TableKey) =>
    setTableSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === 'title' || key === 'composer' ? 1 : -1 }))
  const flat = sortPieces(visible, sort)
  const noMatches = composers.length > 0 && visible.length === 0

  const clearFilters = () => { setSearch(''); setFilter('all'); setInstrumentFilter('all'); setTagFilter(null) }

  return {
    // data
    composers, pieces, logs, toasts, preview, visible, flat, tableRows, allTags, practicedToday, countFailed, countingPageIds,
    // ui state
    sort, setSort, view, setView, tableCompact, setTableCompact, tableHiddenColumns, toggleTableColumn, resetTableColumns, tableSort, sortBy, panel, setPanel, openLink, setOpenLink, uploadingId, hiddenIds,
    editingId, setEditingId, draftTitle, setDraftTitle, editingComposerId, setEditingComposerId, draftComposer, setDraftComposer,
    search, setSearch, filter, setFilter, instrumentFilter, setInstrumentFilter, tagFilter, setTagFilter,
    filtering, noMatches, clearFilters, composerNameOf,
    // new-item form state
    composerName, setComposerName, title, setTitle, composerId, setComposerId, setFile, newInstruments, setNewInstruments, newTags, setNewTags,
    // actions
    dismissToast, setPreview, addComposer, addPiece, togglePracticed, update, remove, startEdit, commitEdit,
    addLink, removeLink, attachPdf, removeComposer, startEditComposer, commitComposerEdit, openPdf,
  }
}
