import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Composer, Piece } from './supabase'
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

function Library() {
  const [composers, setComposers] = useState<Composer[]>([])
  const [pieces, setPieces] = useState<Piece[]>([])
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
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
    if (file && user) {
      pdf_path = `${user.id}/${crypto.randomUUID()}.pdf`
      const up = await supabase.storage.from('sheet-music').upload(pdf_path, file, { contentType: 'application/pdf' })
      if (up.error) { setError(up.error.message); return }
    }
    await run(supabase.from('sm_pieces').insert({ title: title.trim(), composer_id: composerId, pdf_path }))
    setTitle(''); setFile(null); setPanel(null)
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
    switch (filter) {
      case 'can_play': return p.can_play
      case 'cannot_play': return !p.can_play
      case 'learned': return p.learned
      case 'to_learn': return !p.learned
      case 'favorite': return p.favorite
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

  const filtering = Boolean(search) || filter !== 'all'

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
          <label>PDF score (optional)<input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
          <button className="btn primary" type="submit">Add piece</button>
        </form>
      )}

      <div className="toolbar">
        <label className="search-field"><span aria-hidden="true">⌕</span><input aria-label="Search title or composer" placeholder="Search title or composer" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
        <select aria-label="Filter pieces" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All pieces</option>
          <option value="can_play">I can play</option>
          <option value="cannot_play">I can't play yet</option>
          <option value="learned">Learned</option>
          <option value="to_learn">Not learned</option>
          <option value="favorite">Favorites</option>
          <option value="hard">Hard (4+)</option>
        </select>
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
                <div className="piece-main">
                  {p.pdf_path
                    ? <a className="piece-title" href="#" onClick={(e) => { e.preventDefault(); void openPdf(p.pdf_path!) }}>{p.title} <span aria-hidden="true">↗</span></a>
                    : <span className="piece-title plain">{p.title}</span>}
                  <input className="notes" aria-label={`Notes for ${p.title}`} placeholder="Add a note…" defaultValue={p.notes ?? ''} onBlur={(e) => { if (e.target.value !== (p.notes ?? '')) update(p, { notes: e.target.value }) }} />
                </div>
                <div className="piece-controls">
                  <button className={`chip${p.can_play ? ' on' : ''}`} aria-pressed={p.can_play} onClick={() => update(p, { can_play: !p.can_play })}>Can play</button>
                  <button className={`chip${p.learned ? ' on' : ''}`} aria-pressed={p.learned} onClick={() => update(p, { learned: !p.learned })}>Learned</button>
                  <button className={`chip fav${p.favorite ? ' on' : ''}`} aria-pressed={p.favorite} aria-label="Favorite" onClick={() => update(p, { favorite: !p.favorite })}>{p.favorite ? '♥' : '♡'}</button>
                  <div className="meter"><span>Difficulty</span>{rating('Difficulty', p.difficulty, (n) => update(p, { difficulty: n }), '●')}</div>
                  <div className="meter"><span>Rating</span>{rating('Rating', p.rating, (n) => update(p, { rating: n }), '★')}</div>
                  <button className="icon-btn" aria-label={`Delete ${p.title}`} title="Delete piece" onClick={() => void remove(p)}>✕</button>
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
