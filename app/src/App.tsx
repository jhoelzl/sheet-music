import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import './App.css'
import { Library } from './components/Library'
import { Login } from './components/Login'

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
