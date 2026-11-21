import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { PDF_SIGNED_URL_TTL_SECONDS, PDF_STORAGE_BUCKET } from '../config'
import { supabase } from '../supabase'
import type { Composer, Instrument, Piece, PieceLink, PiecePatch, PieceScore, PracticeLog, TeachingMaterial } from '../supabase'
import { countPdfPages } from '../lib/pdf'
import { backupFileName, buildBackup, downloadBlob, materialFileName, scoreFileName } from '../lib/backup'
import { createZip } from '../lib/zip'
import type { ZipEntry } from '../lib/zip'
import { todayISO } from '../lib/dates'
import { confirmDelete } from '../lib/confirmDelete'
import { detectLinkType, safeUrl } from '../lib/links'
import { VIEWS, sortPieces } from '../lib/sorting'
import type { MissingDataFilter, SortKey, TableKey, View } from '../lib/sorting'
import { statusOf } from '../lib/status'
import { DEFAULT_USER_SETTINGS } from '../lib/userSettings'
import type { UserSettings } from '../lib/userSettings'

export type Toast = { id: number; message: string; kind: 'error' | 'info'; undo?: () => void }
export type Panel = 'composer' | 'piece' | null
export type Preview = { id: string; pieceId: string | null; title: string; url: string | null; pages: number | null; error: string | null }
export type BrowseScore = { pieceId: string; scoreId: string }
export const TABLE_COLUMNS = ['composer', 'instruments', 'tags', 'status', 'difficulty', 'rating', 'pages', 'practiced'] as const
export type TableColumnId = (typeof TABLE_COLUMNS)[number]
export type Library = ReturnType<typeof useLibrary>

/** Scores (PDFs) of a piece, in order. */
export const scoresOf = (p: Piece): PieceScore[] => p.scores ?? []

/** Distinct keys across a piece's scores. */
export const keysOf = (p: Piece): string[] =>
  [...new Set(scoresOf(p).map((s) => s.musical_key).filter((k): k is string => Boolean(k)))]

/** The score opened by default (the first one). */
export const primaryScore = (p: Piece): PieceScore | null => scoresOf(p)[0] ?? null

/** Recompute the read-only piece fields that are derived from its scores. */
const withScores = (p: Piece, scores: PieceScore[]): Piece => ({
  ...p,
  scores,
  instruments: [...new Set(scores.flatMap((s) => s.tags.filter((tag): tag is Instrument => tag === 'piano' || tag === 'guitar')))],
  musical_key: scores.find((s) => s.musical_key)?.musical_key ?? null,
  pdf_path: scores[0]?.pdf_path ?? null,
  pdf_pages: scores.reduce((total, s) => total + (s.pdf_pages ?? 0), 0) || null,
})

/** All library state, data loading, mutations and derived data. */
export function useLibrary(defaults: UserSettings = DEFAULT_USER_SETTINGS, userId?: string) {
  const viewStorageKey = userId ? `sm:view:${userId}` : 'sm:view'
  const [composers, setComposers] = useState<Composer[]>([])
  const [composersLoaded, setComposersLoaded] = useState(false)
  const [pieces, setPieces] = useState<Piece[]>([])
  const [logs, setLogs] = useState<PracticeLog[]>([])
  const [toasts, setToasts] = useState<Toast[]>([])
  const [preview, setPreview] = useState<Preview | null>(null)
  const [browseScores, setBrowseScores] = useState<BrowseScore[] | null>(null)
  const [browseMaterials, setBrowseMaterials] = useState<TeachingMaterial[] | null>(null)
  const previewRequest = useRef(0)
  const [sort, setSort] = useState<SortKey>(defaults.library_sort)
  const [view, setViewState] = useState<View>(() => {
    if (defaults.library_view !== 'remember') return defaults.library_view
    const v = localStorage.getItem(viewStorageKey) ?? localStorage.getItem('sm:view')
    return VIEWS.some((x) => x.value === v) ? (v as View) : 'list'
  })
  const setView = (v: View) => { setViewState(v); localStorage.setItem(viewStorageKey, v) }
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
  const [tableSort, setTableSort] = useState<{ key: TableKey; dir: 1 | -1 }>({
    key: defaults.library_sort, dir: defaults.library_sort === 'title' ? 1 : -1,
  })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftTitle, setDraftTitle] = useState('')
  const [editingComposerId, setEditingComposerId] = useState<string | null>(null)
  const [draftComposer, setDraftComposer] = useState('')
  const [openLink, setOpenLink] = useState<string | null>(null)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [savingScoreIds, setSavingScoreIds] = useState<Set<string>>(new Set())
  const savingScores = useRef(new Set<string>())
  const [backingUp, setBackingUp] = useState(false)
  const backingUpRef = useRef(false)
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())
  const toastSeq = useRef(0)
  const deleteTimers = useRef(new Map<string, number>())
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<string>(defaults.library_filter)
  const [missingDataFilter, setMissingDataFilter] = useState<MissingDataFilter>('all')
  const [instrumentFilter, setInstrumentFilter] = useState<'all' | Instrument>(defaults.library_instrument)
  const [newScoreTags, setNewScoreTags] = useState<string[]>(['piano'])
  const [newComposerIds, setNewComposerIds] = useState<string[]>([])
  const [newTags, setNewTags] = useState<string[]>([])
  const [newSubtitle, setNewSubtitle] = useState('')
  const [newMusicalKey, setNewMusicalKey] = useState('')
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [composerName, setComposerName] = useState('')
  const [composerSaving, setComposerSaving] = useState(false)
  const composerSavingRef = useRef(false)
  const [title, setTitle] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [pieceSaving, setPieceSaving] = useState(false)
  const pieceSavingRef = useRef(false)
  const [panel, setPanel] = useState<Panel>(null)

  const applyDefaults = (next: UserSettings, previous: UserSettings) => {
    if (next.library_view !== previous.library_view && next.library_view !== 'remember') setView(next.library_view)
    if (next.library_sort !== previous.library_sort) {
      setSort(next.library_sort)
      setTableSort({ key: next.library_sort, dir: next.library_sort === 'title' ? 1 : -1 })
    }
    if (next.library_filter !== previous.library_filter) setFilter(next.library_filter)
    if (next.library_instrument !== previous.library_instrument) setInstrumentFilter(next.library_instrument)
  }

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
    const pc = await supabase.from('sm_piece_composers').select('piece_id, composer_id, position').order('position')
    const sc = await supabase.from('sm_piece_scores').select('id, piece_id, pdf_path, pdf_pages, musical_key, instrument, lead_sheet, tags, position').order('position')
    if (c.error || p.error || pc.error || sc.error) notify((c.error ?? p.error ?? pc.error ?? sc.error)!.message)
    setComposersLoaded(!c.error)
    setComposers(c.data ?? [])
    const composerIdsByPiece = new Map<string, string[]>()
    for (const link of pc.data ?? []) {
      const ids = composerIdsByPiece.get(link.piece_id) ?? []
      ids.push(link.composer_id)
      composerIdsByPiece.set(link.piece_id, ids)
    }
    const scoresByPiece = new Map<string, PieceScore[]>()
    for (const score of (sc.data ?? []) as PieceScore[]) {
      const list = scoresByPiece.get(score.piece_id) ?? []
      list.push(score)
      scoresByPiece.set(score.piece_id, list)
    }
    setPieces((p.data ?? []).map((piece) => {
      const composerIds = composerIdsByPiece.get(piece.id) ?? []
      return withScores({ ...piece, composer_ids: [piece.composer_id, ...composerIds.filter((id) => id !== piece.composer_id)] }, scoresByPiece.get(piece.id) ?? [])
    }))
    // Missing table (migration 0010 not run yet) just leaves the calendar empty.
    const l = await supabase.from('sm_practice_log').select('id, piece_id, practiced_on').order('practiced_on', { ascending: false }).limit(5000)
    setLogs(l.data ?? [])
  }, [notify])

  useEffect(() => { void load() }, [load])

  const run = async (op: PromiseLike<{ error: { message: string; code?: string } | null }>) => {
    const { error } = await op
    if (error) notify(error.code === '23505' && error.message.includes('sm_composers_name_user_unique')
      ? 'A composer with this name already exists.'
      : error.message)
    await load()
    return !error
  }

  const duplicateComposer = (name: string, exceptId?: string) =>
    composers.some((c) => c.id !== exceptId && c.name.trim().toLowerCase() === name.trim().toLowerCase())

  const composerIdsOf = (p: Piece) => p.composer_ids?.length ? p.composer_ids : [p.composer_id]

  const addComposer = async (e: FormEvent) => {
    e.preventDefault()
    if (!composersLoaded) { notify('Composers could not be loaded. Please try again.'); return }
    const name = composerName.trim()
    if (!name) { notify('Composer name cannot be empty.'); return }
    if (duplicateComposer(name)) { notify('A composer with this name already exists.'); return }
    if (composerSavingRef.current) return
    composerSavingRef.current = true
    setComposerSaving(true)
    try {
      if (await run(supabase.from('sm_composers').insert({ name }))) {
        setComposerName('')
        setPanel(null)
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not add composer.')
    } finally {
      composerSavingRef.current = false
      setComposerSaving(false)
    }
  }

  /** Upload the add-form's optional PDF and store it as the piece's first score. */
  const saveNewScore = async (pieceId: string): Promise<{ error: string | null }> => {
    if (!file) return { error: null }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'You must be signed in to upload a score.' }
    const pdf_pages = await countPdfPages(file)
    const pdf_path = `${user.id}/${crypto.randomUUID()}.pdf`
    const up = await supabase.storage.from(PDF_STORAGE_BUCKET).upload(pdf_path, file, { contentType: 'application/pdf' })
    if (up.error) return { error: up.error.message }
    const { error } = await supabase.from('sm_piece_scores').insert({
      piece_id: pieceId,
      pdf_path,
      pdf_pages,
      musical_key: newMusicalKey.trim() || null,
      tags: newScoreTags,
      position: 0,
    })
    if (error) {
      await supabase.storage.from(PDF_STORAGE_BUCKET).remove([pdf_path])
      return { error: error.message }
    }
    return { error: null }
  }

  const addPiece = async (e: FormEvent) => {
    e.preventDefault()
    if (!newComposerIds.length) { notify('Select at least one composer.'); return }
    if (pieceSavingRef.current) return
    pieceSavingRef.current = true
    setPieceSaving(true)
    try {
      const { data, error } = await supabase.from('sm_pieces').insert({
        title: title.trim(),
        subtitle: newSubtitle.trim() || null,
        composer_id: newComposerIds[0],
        ...(newTags.length ? { tags: newTags } : {}),
      }).select('id').single()
      if (error || !data) {
        notify(error?.message ?? 'Could not add piece.')
        return
      }
      const { error: linkError } = await supabase.from('sm_piece_composers').insert(
        newComposerIds.map((composer_id, position) => ({ piece_id: data.id, composer_id, position })),
      )
      const { error: scoreError } = await saveNewScore(data.id)
      await load()
      // The piece exists now, so always reset the form even if a child insert failed;
      // otherwise a second submit would create a duplicate.
      setTitle(''); setNewSubtitle(''); setNewMusicalKey(''); setNewComposerIds([]); setFile(null); setNewScoreTags(['piano']); setNewTags([]); setPanel(null)
      if (linkError) notify(`Piece saved, but its composer list could not be saved: ${linkError.message}`)
      else if (scoreError) notify(`Piece saved, but its score could not be saved: ${scoreError}`)
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not add piece.')
    } finally {
      pieceSavingRef.current = false
      setPieceSaving(false)
    }
  }

  const practicedToday = new Set(logs.filter((l) => l.practiced_on === todayISO()).map((l) => l.piece_id))
  const practicingRef = useRef(new Set<string>())

  const togglePracticed = async (p: Piece) => {
    if (practicingRef.current.has(p.id)) return
    practicingRef.current.add(p.id)
    try {
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
    } finally {
      practicingRef.current.delete(p.id)
    }
  }

  const update = (p: Piece, patch: PiecePatch) => {
    setPieces((current) => current.map((piece) => piece.id === p.id ? { ...piece, ...patch } : piece))
    void run(supabase.from('sm_pieces').update(patch).eq('id', p.id))
  }

  const setPieceComposers = async (p: Piece, selectedIds: string[]) => {
    const nextIds = [...new Set(selectedIds)]
    if (!nextIds.length) { notify('A piece must have at least one composer.'); return }
    const previousIds = composerIdsOf(p)
    if (nextIds.length === previousIds.length && nextIds.every((id) => previousIds.includes(id))) return

    const primaryId = nextIds[0]
    if (primaryId !== p.composer_id) {
      const { error } = await supabase.from('sm_pieces').update({ composer_id: primaryId }).eq('id', p.id)
      if (error) { notify(error.message); await load(); return }
    }

    const added = nextIds.filter((id) => !previousIds.includes(id))
    const removed = previousIds.filter((id) => !nextIds.includes(id))
    if (added.length) {
      const { error } = await supabase.from('sm_piece_composers').insert(
        added.map((composer_id) => ({ piece_id: p.id, composer_id, position: nextIds.indexOf(composer_id) })),
      )
      if (error) { notify(error.message); await load(); return }
    }
    for (const [position, composer_id] of nextIds.entries()) {
      if (previousIds.includes(composer_id) && previousIds.indexOf(composer_id) !== position) {
        const { error } = await supabase.from('sm_piece_composers').update({ position }).eq('piece_id', p.id).eq('composer_id', composer_id)
        if (error) { notify(error.message); await load(); return }
      }
    }
    if (removed.length) {
      const { error } = await supabase.from('sm_piece_composers').delete().eq('piece_id', p.id).in('composer_id', removed)
      if (error) { notify(error.message); await load(); return }
    }
    await load()
  }

  // Hide the piece right away and only delete it for real once the undo window has passed.
  const remove = (p: Piece) => {
    if (!confirmDelete(`"${p.title}" from your library`, 'Its scores, practice history, and links to lessons and setlists will also be deleted.')) return
    setHiddenIds((h) => new Set(h).add(p.id))
    const unhide = () => setHiddenIds((h) => { const n = new Set(h); n.delete(p.id); return n })
    const toastId = notify(`Deleted "${p.title}" from your library`, 'info', () => {
      window.clearTimeout(deleteTimers.current.get(p.id))
      deleteTimers.current.delete(p.id)
      unhide()
      dismissToast(toastId)
    })
    deleteTimers.current.set(p.id, window.setTimeout(() => {
      deleteTimers.current.delete(p.id)
      void (async () => {
        const paths = scoresOf(p).map((score) => score.pdf_path)
        if (paths.length) await supabase.storage.from(PDF_STORAGE_BUCKET).remove(paths)
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
  const removeLink = (p: Piece, link: PieceLink) => {
    if (!confirmDelete(`this link from "${p.title}"`)) return
    update(p, { links: (p.links ?? []).filter((l) => l.url !== link.url) })
  }

  /** Upload a PDF and add it as a new score of the piece. */
  const addScore = async (p: Piece, f: File, musical_key: string | null, tags: string[]) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUploadingId(p.id)
    const pdf_pages = await countPdfPages(f)
    const pdf_path = `${user.id}/${crypto.randomUUID()}.pdf`
    const up = await supabase.storage.from(PDF_STORAGE_BUCKET).upload(pdf_path, f, { contentType: 'application/pdf' })
    if (up.error) {
      notify(`Upload failed: ${up.error.message}`)
    } else {
      const position = scoresOf(p).reduce((max, score) => Math.max(max, score.position), -1) + 1
      const ok = await run(supabase.from('sm_piece_scores').insert({ piece_id: p.id, pdf_path, pdf_pages, musical_key, tags, position }))
      if (!ok) await supabase.storage.from(PDF_STORAGE_BUCKET).remove([pdf_path])
    }
    setUploadingId(null)
  }

  /** Change a score's key or tags. */
  const updateScore = (p: Piece, score: PieceScore, patch: Partial<Pick<PieceScore, 'musical_key' | 'tags'>>) => {
    if (savingScores.current.has(score.id)) return
    savingScores.current.add(score.id)
    setSavingScoreIds((ids) => new Set(ids).add(score.id))
    setPieces((current) => current.map((piece) => piece.id === p.id
      ? withScores(piece, scoresOf(piece).map((s) => s.id === score.id ? { ...s, ...patch } : s))
      : piece))
    void (async () => {
      try {
        await run(supabase.from('sm_piece_scores').update(patch).eq('id', score.id))
      } catch (error) {
        notify(error instanceof Error ? error.message : 'Could not save the score.')
        await load()
      } finally {
        savingScores.current.delete(score.id)
        setSavingScoreIds((ids) => { const next = new Set(ids); next.delete(score.id); return next })
      }
    })()
  }

  const removeScore = (p: Piece, score: PieceScore) => {
    if (!confirmDelete(`this score for "${p.title}"`, 'Its PDF will also be deleted. Setlists using it will no longer reference it.')) return
    void (async () => {
      const ok = await run(supabase.from('sm_piece_scores').delete().eq('id', score.id))
      if (ok) await supabase.storage.from(PDF_STORAGE_BUCKET).remove([score.pdf_path])
    })()
  }

  // Hide the composer (and their pieces) right away and only delete once the undo window has passed.
  const removeComposer = (c: Composer) => {
    const key = `composer:${c.id}`
    const related = pieces.filter((p) => composerIdsOf(p).includes(c.id))
    const count = related.filter((p) => composerIdsOf(p).length === 1).length
    if (!confirmDelete(`composer "${c.name}"`, `${count} ${count === 1 ? 'piece' : 'pieces'} with no other composer and their scores will also be deleted. Shared pieces will be kept.`)) return
    setHiddenIds((h) => new Set(h).add(key))
    const unhide = () => setHiddenIds((h) => { const n = new Set(h); n.delete(key); return n })
    const toastId = notify(`Deleted "${c.name}"${count ? ` and ${count} ${count === 1 ? 'piece' : 'pieces'}` : ''}`, 'info', () => {
      window.clearTimeout(deleteTimers.current.get(key))
      deleteTimers.current.delete(key)
      unhide()
      dismissToast(toastId)
    })
    const paths = related.filter((p) => composerIdsOf(p).length === 1).flatMap((p) => scoresOf(p).map((score) => score.pdf_path))
    deleteTimers.current.set(key, window.setTimeout(() => {
      deleteTimers.current.delete(key)
      void (async () => {
        for (const piece of related.filter((p) => composerIdsOf(p).length > 1 && p.composer_id === c.id)) {
          const replacement = composerIdsOf(piece).find((id) => id !== c.id)!
          const { error } = await supabase.from('sm_pieces').update({ composer_id: replacement }).eq('id', piece.id)
          if (error) {
            notify(error.message)
            await load()
            unhide()
            return
          }
        }
        if (paths.length) await supabase.storage.from(PDF_STORAGE_BUCKET).remove(paths)
        const { error } = await supabase.from('sm_composers').delete().eq('id', c.id)
        if (error) notify(error.message)
        await load()
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
    if (duplicateComposer(next, c.id)) { notify('A composer with this name already exists.'); return }
    if (next !== c.name) void run(supabase.from('sm_composers').update({ name: next }).eq('id', c.id))
  }

  const openStoredPdf = async (id: string, pieceId: string | null, title: string, path: string, pages: number | null) => {
    const request = ++previewRequest.current
    setPreview({ id, pieceId, title, url: null, pages, error: null })
    try {
      const { data, error } = await supabase.storage.from(PDF_STORAGE_BUCKET).createSignedUrl(path, PDF_SIGNED_URL_TTL_SECONDS)
      if (request !== previewRequest.current) return
      if (error) throw error
      setPreview((current) => current && { ...current, url: data.signedUrl })
    } catch (error) {
      if (request !== previewRequest.current) return
      setPreview((current) => current && { ...current, error: error instanceof Error ? error.message : 'Could not open this PDF.' })
    }
  }

  const openPdf = async (p: Piece, score: PieceScore | null = primaryScore(p)) => {
    setBrowseScores(null)
    setBrowseMaterials(null)
    if (score) await openStoredPdf(score.id, p.id, p.title, score.pdf_path, score.pdf_pages ?? null)
  }
  const openBrowsePdf = (p: Piece, score: PieceScore) =>
    openStoredPdf(score.id, p.id, p.title, score.pdf_path, score.pdf_pages ?? null)
  const openBrowseMaterialPdf = (material: TeachingMaterial) =>
    openStoredPdf(material.id, null, material.title, material.pdf_path, null)
  const openMaterialPdf = (material: TeachingMaterial, selection?: TeachingMaterial[]) => {
    setBrowseScores(null)
    setBrowseMaterials(selection ?? null)
    return openBrowseMaterialPdf(material)
  }

  const closePdf = () => {
    previewRequest.current++
    setBrowseScores(null)
    setBrowseMaterials(null)
    setPreview(null)
  }

  /** Signed URL for one score, for views that host the PDF themselves (live mode). */
  const pdfUrl = useCallback(async (score: PieceScore) => {
    const { data, error } = await supabase.storage.from(PDF_STORAGE_BUCKET).createSignedUrl(score.pdf_path, PDF_SIGNED_URL_TTL_SECONDS)
    if (error) throw error
    return data.signedUrl
  }, [])

  const recordPdfPages = async (scoreId: string, pages: number) => {
    setPreview((current) => current?.id === scoreId ? { ...current, pages } : current)
    const score = pieces.flatMap((piece) => scoresOf(piece)).find((item) => item.id === scoreId)
    if (!score || score.pdf_pages === pages) return
    try {
      const { error } = await supabase.from('sm_piece_scores').update({ pdf_pages: pages }).eq('id', scoreId)
      if (error) throw error
      setPieces((current) => current.map((piece) => withScores(piece, scoresOf(piece).map((s) => s.id === scoreId ? { ...s, pdf_pages: pages } : s))))
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not save the PDF page count.')
    }
  }

  const recordMaterialPdfPages = (materialId: string, pages: number) => {
    setPreview((current) => current?.pieceId === null && current.id === materialId ? { ...current, pages } : current)
  }

  /** Download every table plus every score PDF as a single zip. */
  const backup = async () => {
    if (backingUpRef.current) return
    backingUpRef.current = true
    setBackingUp(true)
    notify('Preparing your backup…', 'info')
    try {
      const [composersResult, piecesResult, linksResult, scoresResult, setlistsResult, entriesResult, logResult, lessonGroupsResult, lessonsResult, materialsResult, lessonPiecesResult, lessonMaterialsResult, settingsResult] = await Promise.all([
        supabase.from('sm_composers').select('*'),
        supabase.from('sm_pieces').select('*'),
        supabase.from('sm_piece_composers').select('*'),
        supabase.from('sm_piece_scores').select('*'),
        supabase.from('sm_setlists').select('*'),
        supabase.from('sm_setlist_pieces').select('*'),
        supabase.from('sm_practice_log').select('*'),
        supabase.from('sm_lesson_groups').select('*'),
        supabase.from('sm_lessons').select('*'),
        supabase.from('sm_teaching_materials').select('*'),
        supabase.from('sm_lesson_pieces').select('*'),
        supabase.from('sm_lesson_materials').select('*'),
        supabase.from('sm_user_settings').select('*'),
      ])
      const results = [composersResult, piecesResult, linksResult, scoresResult, setlistsResult, entriesResult, logResult, lessonGroupsResult, lessonsResult, materialsResult, lessonPiecesResult, lessonMaterialsResult]
      const failed = results.find((result) => result.error)
      if (failed) throw failed.error
      if (settingsResult.error) notify(`Could not include your settings in the backup: ${settingsResult.error.message}`)
      const scores = (scoresResult.data ?? []) as PieceScore[]
      const materials = (materialsResult.data ?? []) as TeachingMaterial[]
      const titles = new Map(((piecesResult.data ?? []) as { id: string; title: string }[]).map((piece) => [piece.id, piece.title]))
      const payload = buildBackup({
        composers: composersResult.data ?? [],
        pieces: piecesResult.data ?? [],
        piece_composers: linksResult.data ?? [],
        scores,
        setlists: setlistsResult.data ?? [],
        setlist_pieces: entriesResult.data ?? [],
        practice_log: logResult.data ?? [],
        lesson_groups: lessonGroupsResult.data ?? [],
        lessons: lessonsResult.data ?? [],
        teaching_materials: materials,
        lesson_pieces: lessonPiecesResult.data ?? [],
        lesson_materials: lessonMaterialsResult.data ?? [],
        user_settings: settingsResult.error ? null : settingsResult.data ?? [],
      })
      const files: ZipEntry[] = [{ name: 'data.json', data: new TextEncoder().encode(JSON.stringify(payload, null, 2)) }]
      let missing = 0
      for (const score of scores) {
        const { data: blob, error } = await supabase.storage.from(PDF_STORAGE_BUCKET).download(score.pdf_path)
        if (error || !blob) { missing++; continue }
        files.push({ name: scoreFileName(score, titles.get(score.piece_id)), data: new Uint8Array(await blob.arrayBuffer()) })
      }
      for (const material of materials) {
        const { data: blob, error } = await supabase.storage.from(PDF_STORAGE_BUCKET).download(material.pdf_path)
        if (error || !blob) { missing++; continue }
        files.push({ name: materialFileName(material), data: new Uint8Array(await blob.arrayBuffer()) })
      }
      downloadBlob(createZip(files), backupFileName())
      notify(missing ? `Backup downloaded, but ${missing} PDF${missing === 1 ? '' : 's'} could not be included.` : 'Backup downloaded.', 'info')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not create the backup.')
    } finally {
      backingUpRef.current = false
      setBackingUp(false)
    }
  }

  const composerNameOf = (id: string) => composers.find((c) => c.id === id)?.name ?? ''
  const composerNamesOf = (p: Piece) => composerIdsOf(p).map(composerNameOf).filter(Boolean).join(', ')
  const normalizeSearch = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const terms = normalizeSearch(search).split(/\s+/).filter(Boolean)
  const visible = pieces.filter((p) => {
    if (hiddenIds.has(p.id)) return false
    if (terms.length) {
      const haystack = normalizeSearch([p.title, p.subtitle, ...keysOf(p), composerNamesOf(p), p.notes, ...p.instruments, ...scoresOf(p).flatMap((score) => score.tags), ...(p.tags ?? [])].filter(Boolean).join(' '))
      if (!terms.every((t) => haystack.includes(t))) return false
    }
    if (instrumentFilter !== 'all' && !p.instruments.includes(instrumentFilter)) return false
    if (tagFilter && !(p.tags ?? []).includes(tagFilter) && !scoresOf(p).some((score) => score.tags.includes(tagFilter))) return false
    const scores = scoresOf(p)
    if (missingDataFilter === 'links' && (p.links ?? []).some((link) =>
      (link.type === 'youtube' || link.type === 'spotify') && safeUrl(link.url))) return false
    if (missingDataFilter === 'scores' && scores.length > 0) return false
    if (missingDataFilter === 'key' && !scores.some((score) => !score.musical_key?.trim())) return false
    if (missingDataFilter === 'tags' && !scores.some((score) => score.tags.length === 0)) return false
    switch (filter) {
      case 'can_play': return p.play_progress === 100
      case 'cannot_play': return p.play_progress === 0
      case 'learned': return p.play_progress > 0 && p.play_progress < 100
      case 'hard': return (p.difficulty ?? 0) >= 4
      default: return true
    }
  })
  const allTags = [...new Set(pieces.flatMap((p) => p.tags ?? []))].sort()
  const allScoreTags = [...new Set(pieces.flatMap((p) => scoresOf(p).flatMap((score) => score.tags)))].sort()
  const filterTags = [...new Set([...allTags, ...allScoreTags, ...(tagFilter ? [tagFilter] : [])])].sort()
  const filtering = Boolean(search) || filter !== 'all' || missingDataFilter !== 'all' || instrumentFilter !== 'all' || Boolean(tagFilter)
  const tableRows = [...visible].sort((a, b) => {
    const val = (p: Piece): string | number => {
      switch (tableSort.key) {
        case 'composer': return composerNamesOf(p).toLowerCase()
        case 'status': return statusOf(p)
        case 'difficulty': return p.difficulty ?? -1
        case 'rating': return p.rating ?? -1
        case 'pages': return p.pdf_pages ?? -1
        case 'practiced': return p.last_practiced ?? ''
        case 'recent': return p.created_at ?? ''
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

  const startScoreBrowse = () => {
    const ordered = view === 'table' ? tableRows : flat
    const items = ordered.flatMap((piece) => scoresOf(piece).map((score) => ({ piece, score })))
    const first = items[0]
    if (!first) { notify('No scores in the current selection.', 'info'); return }
    setBrowseMaterials(null)
    setBrowseScores(items.map(({ piece, score }) => ({ pieceId: piece.id, scoreId: score.id })))
    void openBrowsePdf(first.piece, first.score)
  }

  const clearFilters = () => { setSearch(''); setFilter('all'); setMissingDataFilter('all'); setInstrumentFilter('all'); setTagFilter(null) }

  return {
    // data
    composers, pieces, logs, toasts, preview, browseScores, browseMaterials, visible, flat, tableRows, allTags, allScoreTags, filterTags, practicedToday,
    // ui state
    sort, setSort, view, setView, tableCompact, setTableCompact, tableHiddenColumns, toggleTableColumn, resetTableColumns, tableSort, sortBy, panel, setPanel, openLink, setOpenLink, uploadingId, savingScoreIds, hiddenIds,
    editingId, setEditingId, draftTitle, setDraftTitle, editingComposerId, setEditingComposerId, draftComposer, setDraftComposer,
    search, setSearch, filter, setFilter, missingDataFilter, setMissingDataFilter, instrumentFilter, setInstrumentFilter, tagFilter, setTagFilter,
    filtering, noMatches, clearFilters, applyDefaults, composerNameOf, composerIdsOf, composerNamesOf,
    // new-item form state
    composerName, setComposerName, composerSaving, composersLoaded, title, setTitle, newSubtitle, setNewSubtitle, newMusicalKey, setNewMusicalKey, newComposerIds, setNewComposerIds, file, setFile, newScoreTags, setNewScoreTags, newTags, setNewTags, pieceSaving,
    // actions
    dismissToast, closePdf, pdfUrl, openMaterialPdf, openBrowseMaterialPdf, openBrowsePdf, startScoreBrowse, recordPdfPages, recordMaterialPdfPages, addComposer, addPiece, togglePracticed, update, setPieceComposers, remove, startEdit, commitEdit,
    addLink, removeLink, addScore, updateScore, removeScore, removeComposer, startEditComposer, commitComposerEdit, openPdf,
    scoresOf, keysOf, primaryScore, backup, backingUp,
  }
}
