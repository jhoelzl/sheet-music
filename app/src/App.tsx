import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Composer, Instrument, LinkType, Piece, PieceLink, PracticeLog } from './supabase'
import './App.css'

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const submit = async (signUp: boolean) => {
    const creds = { email, password }
    const { error } = signUp
      ? await supabase.auth.signUp(creds)
      : await supabase.auth.signInWithPassword(creds)
    setError(error?.message ?? (signUp ? 'Check your email if confirmation is required.' : ''))
  }
  return (
    <div className="auth-wrap">
      <form className="panel auth-card" onSubmit={(e) => { e.preventDefault(); void submit(false) }}>
        <div className="auth-head">
          <div>
            <h2>Welcome back</h2>
            <p>Sign in to your personal music library.</p>
          </div>
        </div>
        <label>Email<input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label>Password<input type="password" placeholder="Your password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        <button className="btn primary" type="submit">Sign in</button>
        <button className="link" type="button" onClick={() => void submit(true)}>Create an account</button>
        {error && <p className="error">{error}</p>}
      </form>
    </div>
  )
}

const FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'can_play', label: 'Can fully play (100%)' },
  { value: 'learned', label: 'In progress (25–75%)' },
  { value: 'cannot_play', label: "Can't play yet (0%)" },
  { value: 'hard', label: 'Hard (4+)' },
]

const INSTRUMENTS: { value: Instrument; label: string; icon: string }[] = [
  { value: 'piano', label: 'Piano', icon: '🎹' },
  { value: 'guitar', label: 'Guitar', icon: '🎸' },
]

function toggleInstrument(current: Instrument[], i: Instrument): Instrument[] {
  const next = current.includes(i) ? current.filter((x) => x !== i) : [...current, i]
  return next.length ? next : current
}

const MAX_TAGS = 20
const MAX_TAG_LENGTH = 24

function normalizeTag(raw: string): string {
  return raw.trim().replace(/^#+/, '').replace(/\s+/g, ' ').toLowerCase().slice(0, MAX_TAG_LENGTH).trim()
}

function TagInput({ tags, suggestions, label, onChange }: { tags: string[]; suggestions: string[]; label: string; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState('')
  const listId = useId()
  const add = (raw: string) => {
    const t = normalizeTag(raw)
    setDraft('')
    if (t && !tags.includes(t) && tags.length < MAX_TAGS) onChange([...tags, t])
  }
  return (
    <div className="tag-input" role="group" aria-label={label}>
      {tags.map((t) => (
        <span className="tag" key={t}>
          #{t}
          <button type="button" className="tag-remove" aria-label={`Remove tag ${t}`} onClick={() => onChange(tags.filter((x) => x !== t))}>{CloseIcon}</button>
        </span>
      ))}
      <input list={listId} aria-label="Add tag" placeholder={tags.length ? 'Add tag…' : '+ Tag (e.g. recital)'} maxLength={MAX_TAG_LENGTH} value={draft}
        onChange={(e) => {
          const v = e.target.value
          if (v.includes(',')) { v.split(',').forEach((part, i, all) => { if (i < all.length - 1) add(part); else setDraft(part) }) } else setDraft(v)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); add(draft) }
          else if (e.key === 'Backspace' && !draft && tags.length) onChange(tags.slice(0, -1))
        }}
        onBlur={() => { if (draft.trim()) add(draft) }} />
      <datalist id={listId}>{suggestions.filter((s) => !tags.includes(s)).map((s) => <option key={s} value={s} />)}</datalist>
    </div>
  )
}

async function countPdfPages(blob: Blob): Promise<number | null> {
  try {
    const { PDFDocument } = await import('pdf-lib')
    const doc = await PDFDocument.load(await blob.arrayBuffer(), { ignoreEncryption: true })
    return doc.getPageCount() || null
  } catch {
    return null
  }
}

type Status = 0 | 25 | 50 | 75 | 100

const STATUSES: { value: Status; label: string; short: string }[] = [
  { value: 0, label: "Can't play yet (0%)", short: '0%' },
  { value: 25, label: 'Just started (25%)', short: '25%' },
  { value: 50, label: 'Can partly play (50%)', short: '50%' },
  { value: 75, label: 'Almost there (75%)', short: '75%' },
  { value: 100, label: 'Can fully play (100%)', short: '100%' },
]

function statusOf(p: Piece): Status {
  return (STATUSES.find((s) => s.value === p.play_progress)?.value ?? 0) as Status
}

function statusPatch(s: Status): Partial<Piece> {
  return { play_progress: s }
}

type SortKey = 'title' | 'rating' | 'difficulty' | 'recent'

const SORTS: { value: SortKey; label: string }[] = [
  { value: 'title', label: 'Title' },
  { value: 'rating', label: 'Rating (best first)' },
  { value: 'difficulty', label: 'Difficulty (hardest first)' },
  { value: 'recent', label: 'Recently added' },
]

type View = 'grouped' | 'table' | 'grid' | 'board'
const VIEWS: { value: View; label: string }[] = [
  { value: 'grouped', label: 'Grouped' },
  { value: 'table', label: 'Table' },
  { value: 'grid', label: 'Grid' },
  { value: 'board', label: 'Board' },
]
type TableKey = 'title' | 'composer' | 'status' | 'difficulty' | 'rating' | 'pages' | 'practiced'

function sortPieces(list: Piece[], key: SortKey): Piece[] {
  const byTitle = (a: Piece, b: Piece) => a.title.localeCompare(b.title)
  const byNumber = (get: (p: Piece) => number | null) => (a: Piece, b: Piece) =>
    (get(b) ?? -1) - (get(a) ?? -1) || byTitle(a, b)
  const cmp = {
    title: byTitle,
    rating: byNumber((p) => p.rating),
    difficulty: byNumber((p) => p.difficulty),
    recent: (a: Piece, b: Piece) => (b.created_at ?? '').localeCompare(a.created_at ?? '') || byTitle(a, b),
  }[key]
  return [...list].sort(cmp)
}

// Only http(s) links are allowed; bare hosts get https:// prepended.
function safeUrl(value: string | null | undefined): string | null {
  const v = value?.trim()
  if (!v) return null
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`
  try {
    const u = new URL(candidate)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null
  } catch {
    return null
  }
}

function todayISO(): string {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}

function practicedText(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const now = new Date()
  const days = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - new Date(y, m - 1, d).getTime()) / 86400000)
  const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'} ago`
  if (days <= 0) return 'Practiced today'
  if (days === 1) return 'Practiced yesterday'
  if (days < 30) return `Practiced ${plural(days, 'day')}`
  if (days < 365) return `Practiced ${plural(Math.floor(days / 30), 'month')}`
  return `Practiced ${plural(Math.floor(days / 365), 'year')}`
}

function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const WEEKS = 26

function PracticeCalendar({ logs, pieces, composers }: { logs: PracticeLog[]; pieces: Piece[]; composers: Composer[] }) {
  const [selected, setSelected] = useState<string | null>(null)
  const byDay = new Map<string, string[]>()
  for (const l of logs) byDay.set(l.practiced_on, [...(byDay.get(l.practiced_on) ?? []), l.piece_id])

  const todayStr = todayISO()
  const [ty, tm, td] = todayStr.split('-').map(Number)
  const today = new Date(ty, tm - 1, td)
  const mondayOffset = (today.getDay() + 6) % 7
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - mondayOffset - (WEEKS - 1) * 7)
  const weeks = Array.from({ length: WEEKS }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + d)))

  // The streak survives until the end of today, so it still counts when today has no entry yet.
  let streak = 0
  const cursor = new Date(today)
  if (!byDay.has(todayStr)) cursor.setDate(cursor.getDate() - 1)
  while (byDay.has(isoOf(cursor))) { streak++; cursor.setDate(cursor.getDate() - 1) }

  // Longest run of consecutive practice days across the whole log.
  let bestStreak = 0
  let run = 0
  let prev: number | null = null
  for (const iso of [...byDay.keys()].sort()) {
    const [y, m, d] = iso.split('-').map(Number)
    const t = Date.UTC(y, m - 1, d)
    run = prev !== null && t - prev === 86400000 ? run + 1 : 1
    prev = t
    bestStreak = Math.max(bestStreak, run)
  }
  bestStreak = Math.max(bestStreak, streak)

  const weekTotals = (w: Date[]) => {
    const ids = w.flatMap((d) => byDay.get(isoOf(d)) ?? [])
    return { days: w.filter((d) => byDay.has(isoOf(d))).length, sessions: ids.length }
  }
  const thisWeek = weekTotals(weeks[WEEKS - 1])
  const lastWeek = weekTotals(weeks[WEEKS - 2])
  const weekDelta = thisWeek.sessions - lastWeek.sessions
  const todayCount = byDay.get(todayStr)?.length ?? 0
  const level = (n: number) => (n === 0 ? 0 : n === 1 ? 1 : n <= 3 ? 2 : n <= 5 ? 3 : 4)
  const dayLabel = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  }
  const monthLabels = weeks.map((w, i) => {
    const monthStart = w.find((d) => d.getDate() === 1)
    return i === 0 ? (weeks[1].some((d) => d.getDate() === 1) ? '' : w[0].toLocaleDateString(undefined, { month: 'short' })) : monthStart ? monthStart.toLocaleDateString(undefined, { month: 'short' }) : ''
  })
  const selectedPieces = selected ? (byDay.get(selected) ?? []).map((id) => pieces.find((p) => p.id === id)).filter((p): p is Piece => !!p) : []

  return (
    <section className="panel practice-cal" aria-label="Practice calendar">
      <div className="cal-head">
        <div className="cal-stats">
          <div><strong>{streak}</strong><span>day streak 🔥 · best {bestStreak}</span></div>
          <div><strong>{todayCount}</strong><span>{todayCount === 1 ? 'piece' : 'pieces'} today</span></div>
          <div><strong>{thisWeek.sessions}</strong><span>
            {thisWeek.sessions === 1 ? 'practice' : 'practices'} this week · {thisWeek.days}/7 days
            {weekDelta !== 0 && <em className={weekDelta > 0 ? 'up' : 'down'}> {weekDelta > 0 ? '▲' : '▼'} {Math.abs(weekDelta)} vs last week</em>}
          </span></div>
        </div>
      </div>
      <div className="cal-scroll">
        <div className="cal-months" style={{ gridTemplateColumns: `repeat(${WEEKS}, 14px)` }}>
          {monthLabels.map((m, i) => <span key={i}>{m}</span>)}
        </div>
        <div className="cal-grid" style={{ gridTemplateColumns: `repeat(${WEEKS}, 14px)` }}>
          {weeks.map((w, wi) => (
            <div className="cal-col" key={wi}>
              {w.map((d) => {
                const iso = isoOf(d)
                const n = byDay.get(iso)?.length ?? 0
                if (d > today) return <span className="cal-cell future" key={iso} />
                return (
                  <button
                    key={iso}
                    type="button"
                    className={`cal-cell l${level(n)}${iso === todayStr ? ' today' : ''}${iso === selected ? ' sel' : ''}`}
                    title={`${dayLabel(iso)} · ${n} ${n === 1 ? 'piece' : 'pieces'}`}
                    aria-label={`${dayLabel(iso)}: ${n} ${n === 1 ? 'piece' : 'pieces'} practiced`}
                    onClick={() => setSelected(selected === iso ? null : iso)}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
      {selected && (
        <div className="cal-detail">
          <div className="cal-detail-head">
            <strong>{dayLabel(selected)}</strong>
            <span className="muted">{selectedPieces.length ? `${selectedPieces.length} ${selectedPieces.length === 1 ? 'piece' : 'pieces'} practiced` : 'Nothing practiced.'}</span>
            <button type="button" className="cal-detail-close" aria-label="Close details" onClick={() => setSelected(null)}>{CloseIcon}</button>
          </div>
          {selectedPieces.length > 0 && (
            <ul className="cal-detail-list">
              {selectedPieces.map((p) => (
                <li key={p.id}>
                  <span>{p.title}</span>
                  <span className="muted">{composers.find((c) => c.id === p.composer_id)?.name ?? ''}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}

const strokeIcon = (d: string) => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
)
const EditIcon = strokeIcon('M17 3l4 4L8 20H4v-4L17 3zM14 6l4 4')
const CloseIcon = strokeIcon('M18 6 6 18M6 6l12 12')

const brandIcon = (d: string) => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d={d} /></svg>
)

const LINK_TYPES: Record<LinkType, { label: string; glyph: ReactNode }> = {
  youtube: { label: 'YouTube', glyph: brandIcon('M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z') },
  spotify: { label: 'Spotify', glyph: brandIcon('M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z') },
  instagram: {
    label: 'Instagram',
    glyph: (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r=".6" fill="currentColor" /></svg>
    ),
  },
  other: {
    label: 'Link',
    glyph: strokeIcon('M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5'),
  },
}

function detectLinkType(url: string): LinkType {
  const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase()
  const is = (d: string) => host === d || host.endsWith(`.${d}`)
  if (is('youtube.com') || is('youtu.be')) return 'youtube'
  if (is('spotify.com') || is('spotify.link')) return 'spotify'
  if (is('instagram.com') || is('instagr.am')) return 'instagram'
  return 'other'
}

// Short label for a link chip; same-type links are numbered, other links show their host.
function linkLabel(link: PieceLink, links: PieceLink[]): string {
  if (link.type === 'other') {
    try { return new URL(link.url).hostname.replace(/^www\./, '') } catch { return LINK_TYPES.other.label }
  }
  const same = links.filter((l) => l.type === link.type)
  const base = LINK_TYPES[link.type].label
  return same.length > 1 ? `${base} ${same.indexOf(link) + 1}` : base
}

function Rating({ label, value, glyph, onChange }: { label: string; value: number | null; glyph: string; onChange: (n: number | null) => void }) {
  const [hover, setHover] = useState<number | null>(null)
  const shown = hover ?? value ?? 0
  return (
    <div className="rating" role="group" aria-label={label} onMouseLeave={() => setHover(null)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" className={`rate${n <= shown ? ' on' : ''}${hover !== null ? ' preview' : ''}`}
          aria-label={`${label} ${n}`} aria-pressed={value === n}
          title={value === n ? `Clear ${label.toLowerCase()}` : `${label}: ${n} of 5`}
          onMouseEnter={() => setHover(n)} onFocus={() => setHover(n)} onBlur={() => setHover(null)}
          onClick={() => onChange(value === n ? null : n)}>{glyph}</button>
      ))}
    </div>
  )
}

type Toast = { id: number; message: string; kind: 'error' | 'info'; undo?: () => void }

function Library() {
  const [composers, setComposers] = useState<Composer[]>([])
  const [pieces, setPieces] = useState<Piece[]>([])
  const [logs, setLogs] = useState<PracticeLog[]>([])
  const [toasts, setToasts] = useState<Toast[]>([])
  const [preview, setPreview] = useState<{ title: string; url: string; pages: number | null } | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [sort, setSort] = useState<SortKey>('title')
  const [view, setViewState] = useState<View>(() => {
    const v = localStorage.getItem('sm:view')
    return VIEWS.some((x) => x.value === v) ? (v as View) : 'grouped'
  })
  const setView = (v: View) => { setViewState(v); localStorage.setItem('sm:view', v) }
  const [tableSort, setTableSort] = useState<{ key: TableKey; dir: 1 | -1 }>({ key: 'title', dir: 1 })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftTitle, setDraftTitle] = useState('')
  const [editingComposerId, setEditingComposerId] = useState<string | null>(null)
  const [draftComposer, setDraftComposer] = useState('')
  const [openLink, setOpenLink] = useState<string | null>(null)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())
  const [countFailed, setCountFailed] = useState<Set<string>>(new Set())
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
  const [panel, setPanel] = useState<'composer' | 'piece' | null>(null)

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

  // Backfill page counts for PDFs uploaded before the pdf_pages column existed.
  const countAttempted = useRef(new Set<string>())
  useEffect(() => {
    const missing = pieces.filter((p) => p.pdf_path && 'pdf_pages' in p && p.pdf_pages == null && !countAttempted.current.has(p.id))
    if (!missing.length) return
    void (async () => {
      for (const p of missing) {
        countAttempted.current.add(p.id)
        const { data } = await supabase.storage.from('sheet-music').download(p.pdf_path!)
        const pages = data ? await countPdfPages(data) : null
        if (pages) {
          await supabase.from('sm_pieces').update({ pdf_pages: pages }).eq('id', p.id)
          setPieces((prev) => prev.map((x) => (x.id === p.id ? { ...x, pdf_pages: pages } : x)))
        } else {
          setCountFailed((prev) => new Set(prev).add(p.id))
        }
      }
    })()
  }, [pieces])

  const run = async (op: PromiseLike<{ error: { message: string } | null }>) => {
    const { error } = await op
    if (error) notify(error.message)
    await load()
    return !error
  }

  const addComposer = (e: React.FormEvent) => {
    e.preventDefault()
    void run(supabase.from('sm_composers').insert({ name: composerName.trim() })).then(() => { setComposerName(''); setPanel(null) })
  }

  const addPiece = async (e: React.FormEvent) => {
    e.preventDefault()
    const { data: { user } } = await supabase.auth.getUser()
    let pdf_path: string | null = null
    let pdf_pages: number | null = null
    if (file && user) {
      pdf_pages = await countPdfPages(file)
      pdf_path = `${user.id}/${crypto.randomUUID()}.pdf`
      const up = await supabase.storage.from('sheet-music').upload(pdf_path, file, { contentType: 'application/pdf' })
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
        if (p.pdf_path) await supabase.storage.from('sheet-music').remove([p.pdf_path])
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
    const up = await supabase.storage.from('sheet-music').upload(pdf_path, f, { contentType: 'application/pdf' })
    if (up.error) {
      notify(`Upload failed: ${up.error.message}`)
    } else {
      const ok = await run(supabase.from('sm_pieces').update({ pdf_path, ...(pdf_pages ? { pdf_pages } : {}) }).eq('id', p.id))
      if (!ok) await supabase.storage.from('sheet-music').remove([pdf_path])
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
        if (paths.length) await supabase.storage.from('sheet-music').remove(paths)
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
    setPreviewLoading(true)
    const { data, error } = await supabase.storage.from('sheet-music').createSignedUrl(p.pdf_path, 3600)
    setPreviewLoading(false)
    if (error) notify(error.message)
    else setPreview({ title: p.title, url: data.signedUrl, pages: p.pdf_pages ?? null })
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
  const nextStatus = (s: Status, step: 1 | -1) => STATUSES[(STATUSES.findIndex((x) => x.value === s) + step + STATUSES.length) % STATUSES.length].value
  const statusLabel = (s: Status) => STATUSES.find((x) => x.value === s)?.short ?? ''

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

  const titleNode = (p: Piece) => editingId === p.id ? (
    <input className="title-edit" aria-label="Piece title" autoFocus value={draftTitle}
      onChange={(e) => setDraftTitle(e.target.value)}
      onBlur={() => commitEdit(p)}
      onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(p); if (e.key === 'Escape') setEditingId(null) }} />
  ) : p.pdf_path ? (
    <a className="piece-title" href="#" title="Preview PDF (double-click to rename)" onDoubleClick={() => startEdit(p)} onClick={(e) => { e.preventDefault(); void openPdf(p) }}>{p.title} <span aria-hidden="true">↗</span></a>
  ) : (
    <span className="piece-title plain" title="Double-click to rename" onDoubleClick={() => startEdit(p)}>{p.title}</span>
  )

  const actionsNode = (p: Piece) => (
    <div className="piece-actions">
      <button className="icon-btn edit" aria-label={`Rename ${p.title}`} title="Rename" onClick={() => startEdit(p)}>{EditIcon}</button>
      <button className="icon-btn" aria-label={`Delete ${p.title}`} title="Delete piece" onClick={() => remove(p)}>{CloseIcon}</button>
    </div>
  )

  const practiceNode = (p: Piece) => (
    <button className={`practiced-btn${practicedToday.has(p.id) ? ' done' : ''}`} aria-pressed={practicedToday.has(p.id)}
      title={practicedToday.has(p.id) ? 'Practiced today — click to undo' : 'Record that you practiced this today'}
      onClick={() => void togglePracticed(p)}>✓ {practicedToday.has(p.id) ? 'Today' : 'Practice'}</button>
  )

  const statusPill = (p: Piece) => {
    const s = statusOf(p)
    return (
      <button className={`status-pill s${s}`} title="Click to change status" onClick={() => update(p, statusPatch(nextStatus(s, 1)))}>
        <i aria-hidden="true" />{statusLabel(s)}
      </button>
    )
  }

  const instrumentIcons = (p: Piece) => (
    <span className="inst-icons">{INSTRUMENTS.filter((i) => p.instruments.includes(i.value)).map((i) => <span key={i.value} title={i.label}>{i.icon}</span>)}</span>
  )

  const tagList = (p: Piece) => (p.tags?.length ? (
    <span className="tag-list">
      {p.tags.map((t) => (
        <button key={t} type="button" className={`tag${tagFilter === t ? ' on' : ''}`} title={`Filter by #${t}`} onClick={() => setTagFilter(tagFilter === t ? null : t)}>#{t}</button>
      ))}
    </span>
  ) : null)

  const miniCard = (p: Piece, board = false) => {
    const s = statusOf(p)
    return (
      <article className="piece mini" key={p.id}>
        <div className="piece-head">
          <div className="mini-title">
            {titleNode(p)}
            <span className="mini-composer">{composerNameOf(p.composer_id)}</span>
          </div>
          {actionsNode(p)}
        </div>
        <div className="mini-meta">
          {instrumentIcons(p)}
          {p.pdf_pages ? <span className="page-count">{p.pdf_pages} p.</span> : null}
          {p.last_practiced && <span className="practiced-text">{practicedText(p.last_practiced)}</span>}
        </div>
        {tagList(p)}
        <div className="mini-foot">
          <Rating label="Rating" glyph="★" value={p.rating} onChange={(n) => update(p, { rating: n })} />
          {board ? (
            <span className="move-btns">
              <button className="icon-btn" aria-label="Move back" title="Move back" disabled={s === 0} onClick={() => update(p, statusPatch(nextStatus(s, -1)))}>←</button>
              <button className="icon-btn" aria-label="Move forward" title="Move forward" disabled={s === 100} onClick={() => update(p, statusPatch(nextStatus(s, 1)))}>→</button>
            </span>
          ) : statusPill(p)}
          {practiceNode(p)}
        </div>
      </article>
    )
  }

  const flat = sortPieces(visible, sort)
  const noMatches = composers.length > 0 && visible.length === 0

  return (
    <>
      <div className="toasts" role="region" aria-live="polite" aria-label="Notifications">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`} role={t.kind === 'error' ? 'alert' : 'status'}>
            <span>{t.message}</span>
            {t.undo && <button type="button" className="toast-action" onClick={t.undo}>Undo</button>}
            <button type="button" className="toast-close" aria-label="Dismiss" onClick={() => dismissToast(t.id)}>✕</button>
          </div>
        ))}
      </div>
      {preview && (
        <div className="modal-backdrop" onClick={() => setPreview(null)}>
          <div className="modal" role="dialog" aria-modal="true" aria-label={`PDF preview: ${preview.title}`} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-title">
                <strong>{preview.title}</strong>
                {preview.pages ? <span className="page-count">{preview.pages} {preview.pages === 1 ? 'page' : 'pages'}</span> : null}
              </div>
              <a className="btn" href={preview.url} target="_blank" rel="noopener noreferrer">Open in new tab ↗</a>
              <button type="button" className="icon-btn" autoFocus aria-label="Close preview" title="Close (Esc)" onClick={() => setPreview(null)}>{CloseIcon}</button>
            </div>
            <iframe className="modal-frame" src={preview.url} title={`PDF: ${preview.title}`} />
          </div>
        </div>
      )}
      <div className="library-intro">
        <div>
          <h2>Library</h2>
          <p>{composers.length} {composers.length === 1 ? 'composer' : 'composers'} · {pieces.length} {pieces.length === 1 ? 'piece' : 'pieces'}</p>
        </div>
        <div className="intro-actions">
          <button className={`btn${panel === 'composer' ? ' active' : ''}`} onClick={() => setPanel(panel === 'composer' ? null : 'composer')}>+ Composer</button>
          <button className="btn primary" onClick={() => setPanel(panel === 'piece' ? null : 'piece')} disabled={!composers.length} title={composers.length ? '' : 'Add a composer first'}>+ Piece</button>
        </div>
      </div>

      <PracticeCalendar logs={logs} pieces={pieces} composers={composers} />

      {panel === 'composer' && (
        <form className="panel" onSubmit={addComposer}>
          <label className="grow">Composer name<input autoFocus placeholder="e.g. Clara Schumann" value={composerName} onChange={(e) => setComposerName(e.target.value)} required /></label>
          <button className="btn primary" type="submit">Add composer</button>
        </form>
      )}
      {panel === 'piece' && (
        <form className="panel" onSubmit={(e) => void addPiece(e)}>
          <label>Composer<select value={composerId} onChange={(e) => setComposerId(e.target.value)} required>
            <option value="">Choose…</option>
            {composers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select></label>
          <label className="grow">Title<input autoFocus placeholder="Piece title" value={title} onChange={(e) => setTitle(e.target.value)} required /></label>
          <div className="field-group" role="group" aria-label="Instruments">
            <span>Instrument</span>
            <div className="instrument-toggle">
              {INSTRUMENTS.map((i) => (
                <button key={i.value} type="button" className={`chip${newInstruments.includes(i.value) ? ' on' : ''}`} aria-pressed={newInstruments.includes(i.value)}
                  onClick={() => setNewInstruments(toggleInstrument(newInstruments, i.value))}>{i.icon} {i.label}</button>
              ))}
            </div>
          </div>
          <div className="field-group">
            <span>Tags</span>
            <TagInput tags={newTags} suggestions={allTags} label="Tags for new piece" onChange={setNewTags} />
          </div>
          <label>PDF score (optional)<input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
          <button className="btn primary" type="submit">Add piece</button>
        </form>
      )}

      <div className="toolbar">
        <label className="search-field">
          <span aria-hidden="true">⌕</span>
          <input aria-label="Search pieces" placeholder="Search title, composer, notes…" value={search} onChange={(e) => setSearch(e.target.value)} />
          {search && <button type="button" className="search-clear" aria-label="Clear search" onClick={() => setSearch('')}>✕</button>}
        </label>
        {view !== 'table' && (
          <label className="sort-field">
            <span>Sort</span>
            <select aria-label="Sort pieces" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
              {SORTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        )}
        <div className="view-switch" role="group" aria-label="View">
          {VIEWS.map((v) => (
            <button key={v.value} type="button" className={view === v.value ? 'on' : ''} aria-pressed={view === v.value} onClick={() => setView(v.value)}>{v.label}</button>
          ))}
        </div>
        {filtering && <button type="button" className="link" onClick={() => { setSearch(''); setFilter('all'); setInstrumentFilter('all'); setTagFilter(null) }}>Clear filters</button>}
      </div>

      <div className="filter-bar" role="group" aria-label="Filter by instrument">
        {([{ value: 'all', label: 'All instruments', icon: '' }, ...INSTRUMENTS] as const).map((i) => (
          <button key={i.value} type="button" className={`filter-pill${instrumentFilter === i.value ? ' active' : ''}`} aria-pressed={instrumentFilter === i.value} onClick={() => setInstrumentFilter(i.value)}>{i.icon && `${i.icon} `}{i.label}</button>
        ))}
      </div>

      <div className="filter-bar" role="group" aria-label="Filter pieces">
        {FILTERS.map((f) => (
          <button key={f.value} type="button" className={`filter-pill${filter === f.value ? ' active' : ''}`} aria-pressed={filter === f.value} onClick={() => setFilter(f.value)}>{f.label}</button>
        ))}
      </div>

      {allTags.length > 0 && (
        <div className="filter-bar" role="group" aria-label="Filter by tag">
          <button type="button" className={`filter-pill${tagFilter === null ? ' active' : ''}`} aria-pressed={tagFilter === null} onClick={() => setTagFilter(null)}>All tags</button>
          {allTags.map((t) => (
            <button key={t} type="button" className={`filter-pill${tagFilter === t ? ' active' : ''}`} aria-pressed={tagFilter === t} onClick={() => setTagFilter(tagFilter === t ? null : t)}>#{t}</button>
          ))}
        </div>
      )}

      {!composers.length && (
        <div className="empty"><h3>No music yet</h3><p>Add your first composer to start building your library.</p></div>
      )}

      {view !== 'grouped' && noMatches && <div className="empty"><h3>No pieces found</h3><p>Try clearing the filters or add a piece.</p></div>}

      {view === 'table' && visible.length > 0 && (
        <div className="table-wrap">
          <table className="piece-table">
            <thead>
              <tr>
                {([['title', 'Title'], ['composer', 'Composer'], [null, 'Instruments'], [null, 'Tags'], ['status', 'Status'], ['difficulty', 'Difficulty'], ['rating', 'Rating'], ['pages', 'Pages'], ['practiced', 'Practiced']] as [TableKey | null, string][]).map(([key, label]) => (
                  <th key={label} aria-sort={key && tableSort.key === key ? (tableSort.dir === 1 ? 'ascending' : 'descending') : undefined}>
                    {key ? (
                      <button type="button" className={tableSort.key === key ? 'on' : ''} onClick={() => sortBy(key)}>
                        {label}<span aria-hidden="true">{tableSort.key === key ? (tableSort.dir === 1 ? ' ▲' : ' ▼') : ''}</span>
                      </button>
                    ) : label}
                  </th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {tableRows.map((p) => (
                <tr key={p.id}>
                  <td className="t-title">{titleNode(p)}</td>
                  <td className="t-muted">{composerNameOf(p.composer_id)}</td>
                  <td>{instrumentIcons(p)}</td>
                  <td>{tagList(p)}</td>
                  <td>{statusPill(p)}</td>
                  <td><Rating label="Difficulty" glyph="●" value={p.difficulty} onChange={(n) => update(p, { difficulty: n })} /></td>
                  <td className="stars"><Rating label="Rating" glyph="★" value={p.rating} onChange={(n) => update(p, { rating: n })} /></td>
                  <td className="t-muted">{p.pdf_pages ?? '–'}</td>
                  <td className="t-muted">{p.last_practiced ? practicedText(p.last_practiced) : '–'}</td>
                  <td className="t-actions">{practiceNode(p)}{actionsNode(p)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view === 'grid' && flat.length > 0 && <div className="piece-grid">{flat.map((p) => miniCard(p))}</div>}

      {view === 'board' && visible.length > 0 && (
        <div className="board">
          {STATUSES.map((st) => {
            const col = flat.filter((p) => statusOf(p) === st.value)
            return (
              <section className={`board-col s${st.value}`} key={st.value}>
                <h3>{st.label}<span className="count">{col.length}</span></h3>
                {col.length === 0 ? <p className="muted">Nothing here.</p> : col.map((p) => miniCard(p, true))}
              </section>
            )
          })}
        </div>
      )}

      {view === 'grouped' && <div className="composer-list">{composers.filter((c) => !hiddenIds.has(`composer:${c.id}`)).map((c) => {
        const list = sortPieces(visible.filter((p) => p.composer_id === c.id), sort)
        if (!list.length && filtering) return null
        return (
          <section className="composer-section" key={c.id}>
            <div className="section-heading">
              <div className="piece-titleline">
                {editingComposerId === c.id ? (
                  <input className="title-edit" aria-label="Composer name" autoFocus value={draftComposer}
                    onChange={(e) => setDraftComposer(e.target.value)}
                    onBlur={() => commitComposerEdit(c)}
                    onKeyDown={(e) => { if (e.key === 'Enter') commitComposerEdit(c); if (e.key === 'Escape') setEditingComposerId(null) }} />
                ) : (
                  <h3 title="Double-click to rename" onDoubleClick={() => startEditComposer(c)}>{c.name}</h3>
                )}
                <span className="count">{list.length}</span>
              </div>
              <div className="piece-actions">
                <button className="icon-btn edit" aria-label={`Rename ${c.name}`} title="Rename" onClick={() => startEditComposer(c)}>{EditIcon}</button>
                <button className="icon-btn" aria-label={`Delete ${c.name}`} title="Delete composer" onClick={() => removeComposer(c)}>{CloseIcon}</button>
              </div>
            </div>
            {list.length === 0 && (
              <div className="muted empty-row">
                <span>No pieces yet.</span>
                <button type="button" className="btn" onClick={() => { setComposerId(c.id); setPanel('piece'); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>+ Add piece</button>
              </div>
            )}
            {list.map((p) => {
              const status = statusOf(p)
              const pending = !!p.pdf_path && 'pdf_pages' in p && p.pdf_pages == null && !countFailed.has(p.id)
              return (
              <article className="piece" key={p.id}>
                <div className="piece-head">
                  <div className="piece-titleline">
                    {editingId === p.id ? (
                      <input className="title-edit" aria-label="Piece title" autoFocus value={draftTitle}
                        onChange={(e) => setDraftTitle(e.target.value)}
                        onBlur={() => commitEdit(p)}
                        onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(p); if (e.key === 'Escape') setEditingId(null) }} />
                    ) : p.pdf_path ? (
                      <a className="piece-title" href="#" title="Preview PDF (double-click to rename)" onDoubleClick={() => startEdit(p)} onClick={(e) => { e.preventDefault(); void openPdf(p) }}>{p.title} <span aria-hidden="true">↗</span></a>
                    ) : (
                      <span className="piece-title plain" title="Double-click to rename" onDoubleClick={() => startEdit(p)}>{p.title}</span>
                    )}
                    {p.pdf_pages ? <span className="page-count" title="Pages in the PDF">{p.pdf_pages} {p.pdf_pages === 1 ? 'page' : 'pages'}</span> : null}
                    {pending && <span className="skeleton" role="status" aria-label="Counting pages" />}
                  </div>
                  <div className="piece-actions">
                    {!p.pdf_path && (
                      <label className={`attach-btn${uploadingId === p.id ? ' busy' : ''}`}>
                        {uploadingId === p.id ? 'Uploading…' : '+ Attach PDF'}
                        <input type="file" accept="application/pdf" hidden disabled={uploadingId === p.id}
                          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void attachPdf(p, f) }} />
                      </label>
                    )}
                    <button className="icon-btn edit" aria-label={`Rename ${p.title}`} title="Rename" onClick={() => startEdit(p)}>{EditIcon}</button>
                    <button className="icon-btn" aria-label={`Delete ${p.title}`} title="Delete piece" onClick={() => remove(p)}>{CloseIcon}</button>
                  </div>
                </div>
                <input className="notes" aria-label={`Notes for ${p.title}`} placeholder="Add a note…" defaultValue={p.notes ?? ''} onBlur={(e) => { if (e.target.value !== (p.notes ?? '')) update(p, { notes: e.target.value }) }} />
                <div className="piece-row">
                  <TagInput tags={p.tags ?? []} suggestions={allTags} label={`Tags for ${p.title}`} onChange={(tags) => update(p, { tags })} />
                </div>
                <div className="piece-row">
                  <div className="chip-group" role="group" aria-label={`Instruments for ${p.title}`}>
                    {INSTRUMENTS.map((i) => (
                      <button key={i.value} className={`chip${p.instruments.includes(i.value) ? ' on' : ''}`} aria-pressed={p.instruments.includes(i.value)} title={i.label}
                        onClick={() => update(p, { instruments: toggleInstrument(p.instruments, i.value) })}>{i.icon} {i.label}</button>
                    ))}
                  </div>
                  <div className={`progress s${status}`}>
                    <input type="range" min={0} max={STATUSES.length - 1} step={1} value={STATUSES.findIndex((s) => s.value === status)}
                      aria-label={`Progress for ${p.title}`}
                      aria-valuetext={STATUSES.find((s) => s.value === status)?.label}
                      onChange={(e) => { const next = STATUSES[Number(e.target.value)].value; if (next !== status) update(p, statusPatch(next)) }} />
                    <div className="progress-labels" aria-hidden="true">
                      {STATUSES.map((st) => (
                        <button key={st.value} type="button" tabIndex={-1} className={status === st.value ? 'on' : ''} title={st.label}
                          onClick={() => { if (status !== st.value) update(p, statusPatch(st.value)) }}>{st.short}</button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="piece-row piece-foot">
                  <div className="links">
                    {(p.links ?? []).map((link) => {
                      const href = safeUrl(link.url)
                      if (!href) return null
                      const label = linkLabel(link, p.links ?? [])
                      return (
                        <span className={`link-chip ${link.type}`} key={link.url}>
                          <a href={href} target="_blank" rel="noopener noreferrer" title={href}>{LINK_TYPES[link.type].glyph}{label}</a>
                          <button className="link-remove" aria-label={`Remove ${label} link`} title="Remove link" onClick={() => removeLink(p, link)}>{CloseIcon}</button>
                        </span>
                      )
                    })}
                    {openLink === p.id ? (
                      <input className="link-input" autoFocus type="url" aria-label={`Add link for ${p.title}`} placeholder="Paste a YouTube, Spotify, Instagram or other link"
                        onBlur={(e) => addLink(p, e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { e.currentTarget.value = ''; e.currentTarget.blur() } }} />
                    ) : (
                      <button className="add-link" title="Add a YouTube, Spotify, Instagram or other link" onClick={() => setOpenLink(p.id)}>+ Link</button>
                    )}
                    <button className={`practiced-btn${practicedToday.has(p.id) ? ' done' : ''}`} aria-pressed={practicedToday.has(p.id)} title={practicedToday.has(p.id) ? 'Practiced today — click to undo' : 'Record that you practiced this today'} onClick={() => void togglePracticed(p)}>✓ {practicedToday.has(p.id) ? 'Practiced today' : 'Practice today'}</button>
                    {p.last_practiced && <span className="practiced-text">{practicedText(p.last_practiced)}</span>}
                  </div>
                  <div className="meters">
                    <div className="meter"><span>Difficulty</span><Rating label="Difficulty" glyph="●" value={p.difficulty} onChange={(n) => update(p, { difficulty: n })} /></div>
                    <div className="meter stars"><span>Rating</span><Rating label="Rating" glyph="★" value={p.rating} onChange={(n) => update(p, { rating: n })} /></div>
                  </div>
                </div>
              </article>
              )
            })}
          </section>
        )
      })}</div>}
    </>
  )
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true) })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  if (!ready) return null
  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="header-inner">
          <div className="brand"><span aria-hidden="true">♪</span><h1>Sheet Music</h1></div>
          {session && <button className="link" onClick={() => void supabase.auth.signOut()}>Sign out</button>}
        </div>
      </header>
      <main>{session ? <Library /> : <Login />}</main>
    </div>
  )
}
