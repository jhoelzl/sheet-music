import { useCallback, useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Composer, Instrument, Piece } from './supabase'
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
  { value: 'can_play', label: 'Can fully play' },
  { value: 'learned', label: 'Can partly play' },
  { value: 'cannot_play', label: "Can't play yet" },
  { value: 'to_learn', label: "Can't partly play" },
  { value: 'learn_later', label: 'Learn in future' },
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

async function countPdfPages(blob: Blob): Promise<number | null> {
  try {
    const { PDFDocument } = await import('pdf-lib')
    const doc = await PDFDocument.load(await blob.arrayBuffer(), { ignoreEncryption: true })
    return doc.getPageCount() || null
  } catch {
    return null
  }
}

function Library() {
  const [composers, setComposers] = useState<Composer[]>([])
  const [pieces, setPieces] = useState<Piece[]>([])
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [instrumentFilter, setInstrumentFilter] = useState<'all' | Instrument>('all')
  const [newInstruments, setNewInstruments] = useState<Instrument[]>(['piano'])
  const [composerName, setComposerName] = useState('')
  const [title, setTitle] = useState('')
  const [composerId, setComposerId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [panel, setPanel] = useState<'composer' | 'piece' | null>(null)

  const load = useCallback(async () => {
    const c = await supabase.from('sm_composers').select('*').order('name')
    const p = await supabase.from('sm_pieces').select('*').order('title')
    if (c.error || p.error) setError((c.error ?? p.error)!.message)
    setComposers(c.data ?? [])
    setPieces(p.data ?? [])
  }, [])

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
        }
      }
    })()
  }, [pieces])

  const run = async (op: PromiseLike<{ error: { message: string } | null }>) => {
    const { error } = await op
    setError(error?.message ?? '')
    await load()
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
      if (up.error) { setError(up.error.message); return }
    }
    await run(supabase.from('sm_pieces').insert({ title: title.trim(), composer_id: composerId, pdf_path, ...(pdf_pages ? { pdf_pages } : {}), instruments: newInstruments }))
    setTitle(''); setFile(null); setNewInstruments(['piano']); setPanel(null)
  }

  const update = (p: Piece, patch: Partial<Piece>) =>
    void run(supabase.from('sm_pieces').update(patch).eq('id', p.id))

  const remove = async (p: Piece) => {
    if (!confirm(`Delete "${p.title}"?`)) return
    if (p.pdf_path) await supabase.storage.from('sheet-music').remove([p.pdf_path])
    await run(supabase.from('sm_pieces').delete().eq('id', p.id))
  }

  const removeComposer = async (c: Composer) => {
    if (!confirm(`Delete ${c.name} and all their pieces?`)) return
    const paths = pieces.filter((p) => p.composer_id === c.id && p.pdf_path).map((p) => p.pdf_path!)
    if (paths.length) await supabase.storage.from('sheet-music').remove(paths)
    await run(supabase.from('sm_composers').delete().eq('id', c.id))
  }

  const renameComposer = async (c: Composer) => {
    const name = window.prompt('Composer name', c.name)
    if (name === null) return
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Composer name cannot be empty.')
      return
    }
    if (trimmedName !== c.name) {
      await run(supabase.from('sm_composers').update({ name: trimmedName }).eq('id', c.id))
    } else {
      setError('')
    }
  }

  const openPdf = async (path: string) => {
    const { data, error } = await supabase.storage.from('sheet-music').createSignedUrl(path, 300)
    if (error) setError(error.message)
    else window.open(data.signedUrl, '_blank', 'noopener')
  }

  const visible = pieces.filter((p) => {
    const cn = composers.find((c) => c.id === p.composer_id)?.name ?? ''
    if (search && !`${p.title} ${cn}`.toLowerCase().includes(search.toLowerCase())) return false
    if (instrumentFilter !== 'all' && !p.instruments.includes(instrumentFilter)) return false
    switch (filter) {
      case 'can_play': return p.can_play
      case 'cannot_play': return !p.can_play
      case 'learned': return p.learned
      case 'to_learn': return !p.learned
      case 'learn_later': return p.learn_later
      case 'hard': return (p.difficulty ?? 0) >= 4
      default: return true
    }
  })

  const rating = (label: string, value: number | null, onChange: (n: number | null) => void, glyph: string) => (
    <div className="rating" role="group" aria-label={label} title={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" className={`rate${value !== null && n <= value ? ' on' : ''}`} aria-label={`${label} ${n}`} aria-pressed={value === n}
          onClick={() => onChange(value === n ? null : n)}>{glyph}</button>
      ))}
    </div>
  )

  const filtering = Boolean(search) || filter !== 'all' || instrumentFilter !== 'all'

  return (
    <>
      {error && <p className="error" role="alert">{error}</p>}
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
          <label>PDF score (optional)<input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
          <button className="btn primary" type="submit">Add piece</button>
        </form>
      )}

      <div className="toolbar">
        <label className="search-field">
          <span aria-hidden="true">⌕</span>
          <input aria-label="Search title or composer" placeholder="Search title or composer" value={search} onChange={(e) => setSearch(e.target.value)} />
          {search && <button type="button" className="search-clear" aria-label="Clear search" onClick={() => setSearch('')}>✕</button>}
        </label>
        {filtering && <button type="button" className="link" onClick={() => { setSearch(''); setFilter('all'); setInstrumentFilter('all') }}>Clear filters</button>}
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

      {!composers.length && (
        <div className="empty"><h3>No music yet</h3><p>Add your first composer to start building your library.</p></div>
      )}

      <div className="composer-list">{composers.map((c) => {
        const list = visible.filter((p) => p.composer_id === c.id)
        if (!list.length && filtering) return null
        return (
          <section className="composer-section" key={c.id}>
            <div className="section-heading">
              <h3>{c.name} <span className="count">{list.length}</span></h3>
              <div className="composer-actions">
                <button className="link" onClick={() => void renameComposer(c)}>Rename</button>
                <button className="link danger" onClick={() => void removeComposer(c)}>Delete</button>
              </div>
            </div>
            {list.length === 0 && <p className="muted">No pieces yet.</p>}
            {list.map((p) => (
              <article className="piece" key={p.id}>
                <div className="piece-head">
                  <div className="piece-titleline">
                    {p.pdf_path
                      ? <a className="piece-title" href="#" title="Open PDF" onClick={(e) => { e.preventDefault(); void openPdf(p.pdf_path!) }}>{p.title} <span aria-hidden="true">↗</span></a>
                      : <span className="piece-title plain">{p.title}</span>}
                    {p.pdf_pages ? <span className="page-count" title="Pages in the PDF">{p.pdf_pages} {p.pdf_pages === 1 ? 'page' : 'pages'}</span> : null}
                  </div>
                  <button className="icon-btn" aria-label={`Delete ${p.title}`} title="Delete piece" onClick={() => void remove(p)}>✕</button>
                </div>
                <input className="notes" aria-label={`Notes for ${p.title}`} placeholder="Add a note…" defaultValue={p.notes ?? ''} onBlur={(e) => { if (e.target.value !== (p.notes ?? '')) update(p, { notes: e.target.value }) }} />
                <div className="piece-row">
                  <div className="chip-group" role="group" aria-label={`Instruments for ${p.title}`}>
                    {INSTRUMENTS.map((i) => (
                      <button key={i.value} className={`chip${p.instruments.includes(i.value) ? ' on' : ''}`} aria-pressed={p.instruments.includes(i.value)} title={i.label}
                        onClick={() => update(p, { instruments: toggleInstrument(p.instruments, i.value) })}>{i.icon} {i.label}</button>
                    ))}
                  </div>
                  <div className="chip-group" role="group" aria-label={`Progress for ${p.title}`}>
                    <button className={`chip${p.can_play ? ' on' : ''}`} aria-pressed={p.can_play} onClick={() => update(p, { can_play: !p.can_play })}>Can fully play</button>
                    <button className={`chip${p.learned ? ' on' : ''}`} aria-pressed={p.learned} onClick={() => update(p, { learned: !p.learned })}>Can partly play</button>
                    <button className={`chip${p.learn_later ? ' on' : ''}`} aria-pressed={p.learn_later} onClick={() => update(p, { learn_later: !p.learn_later })}>Learn in future</button>
                  </div>
                </div>
                <div className="piece-row piece-foot">
                  <div className="links">
                    {([['youtube_url', 'YouTube'], ['spotify_url', 'Spotify']] as const).map(([k, label]) => (
                      <span className="link-field" key={k}>
                        {p[k] && <a className={`link-badge ${k}`} href={p[k]!} target="_blank" rel="noreferrer">▶ {label}</a>}
                        <input aria-label={`${label} link for ${p.title}`} placeholder={p[k] ? 'edit link' : `+ ${label} link`} defaultValue={p[k] ?? ''} onBlur={(e) => { const v = e.target.value.trim(); if (v !== (p[k] ?? '')) update(p, { [k]: v || null }) }} />
                      </span>
                    ))}
                  </div>
                  <div className="meters">
                    <div className="meter"><span>Difficulty</span>{rating('Difficulty', p.difficulty, (n) => update(p, { difficulty: n }), '●')}</div>
                    <div className="meter stars"><span>Rating</span>{rating('Rating', p.rating, (n) => update(p, { rating: n }), '★')}</div>
                  </div>
                </div>
              </article>
            ))}
          </section>
        )
      })}</div>
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
