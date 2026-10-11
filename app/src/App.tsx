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
      <form className="card auth-card" onSubmit={(e) => { e.preventDefault(); void submit(false) }}>
        <div className="card-heading">
          <span className="heading-icon">♩</span>
          <div>
            <h2>Welcome back</h2>
            <p>Sign in to your personal music library.</p>
          </div>
        </div>
        <label>Email<input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label>Password<input type="password" placeholder="Your password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        <button className="primary-button" type="submit">Sign in</button>
        <button className="text-button" type="button" onClick={() => void submit(true)}>Create an account</button>
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
    void run(supabase.from('sm_composers').insert({ name: composerName.trim() })).then(() => setComposerName(''))
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
    setTitle(''); setFile(null)
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

  const stars = (value: number | null, onChange: (n: number | null) => void) => (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}>
      <option value="">–</option>
      {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
    </select>
  )

  return (
    <>
      {error && <p className="error">{error}</p>}
      <div className="library-intro">
        <div>
          <p className="eyebrow">Your collection</p>
          <h2>Sheet music library</h2>
          <p>Keep every piece organized, ready to practice, and easy to find.</p>
        </div>
        <span className="collection-count">{pieces.length} {pieces.length === 1 ? 'piece' : 'pieces'}</span>
      </div>

      <div className="row add-cards">
        <form className="card" onSubmit={addComposer}>
          <h3>Add a composer</h3>
          <label>Composer name<input placeholder="e.g. Clara Schumann" value={composerName} onChange={(e) => setComposerName(e.target.value)} required /></label>
          <button className="secondary-button" type="submit">Add composer</button>
        </form>
        <form className="card" onSubmit={(e) => void addPiece(e)}>
          <h3>Add a piece</h3>
          <label>Composer<select value={composerId} onChange={(e) => setComposerId(e.target.value)} required>
            <option value="">Composer…</option>
            {composers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select></label>
          <label>Title<input placeholder="Piece title" value={title} onChange={(e) => setTitle(e.target.value)} required /></label>
          <label>PDF score<input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
          <button className="primary-button" type="submit">Add to library</button>
        </form>
      </div>

      <div className="toolbar">
        <label className="search-field"><span aria-hidden="true">⌕</span><input aria-label="Search title or composer" placeholder="Search title or composer" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
        <label className="filter-field">Show<select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All</option>
          <option value="can_play">I can play</option>
          <option value="cannot_play">I can't play yet</option>
          <option value="learned">Learned</option>
          <option value="to_learn">Not learned</option>
          <option value="favorite">Favorites</option>
          <option value="hard">Hard (4+)</option>
        </select></label>
      </div>

      <div className="composer-list">{composers.map((c) => {
        const list = visible.filter((p) => p.composer_id === c.id)
        if (!list.length && (search || filter !== 'all')) return null
        return (
          <section className="composer-section" key={c.id}>
            <div className="section-heading"><h3>{c.name}</h3><button className="small danger-button" onClick={() => void removeComposer(c)}>Delete composer</button></div>
            {list.length > 0 && (
              <div className="table-wrap"><table>
                <thead>
                  <tr><th>Title</th><th>Can play</th><th>Learned</th><th>Fav</th><th>Difficulty</th><th>Rating</th><th>Notes</th><th /></tr>
                </thead>
                <tbody>
                  {list.map((p) => (
                    <tr key={p.id}>
                      <td>{p.pdf_path ? <a href="#" onClick={(e) => { e.preventDefault(); void openPdf(p.pdf_path!) }}>{p.title}</a> : p.title}</td>
                      <td><input type="checkbox" checked={p.can_play} onChange={(e) => update(p, { can_play: e.target.checked })} /></td>
                      <td><input type="checkbox" checked={p.learned} onChange={(e) => update(p, { learned: e.target.checked })} /></td>
                      <td><input type="checkbox" checked={p.favorite} onChange={(e) => update(p, { favorite: e.target.checked })} /></td>
                      <td>{stars(p.difficulty, (n) => update(p, { difficulty: n }))}</td>
                      <td>{stars(p.rating, (n) => update(p, { rating: n }))}</td>
                      <td><input defaultValue={p.notes ?? ''} onBlur={(e) => { if (e.target.value !== (p.notes ?? '')) update(p, { notes: e.target.value }) }} /></td>
                      <td><button className="small" onClick={() => void remove(p)}>delete</button></td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            )}
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
          <div className="brand"><span>♬</span><h1>Sheet Music</h1></div>
          {session && <button className="sign-out" onClick={() => void supabase.auth.signOut()}>Sign out</button>}
        </div>
      </header>
      <main>{session ? <Library /> : <Login />}</main>
    </div>
  )
}
