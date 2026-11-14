import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import './App.css'
import { Library } from './components/Library'
import { ComposersPage } from './components/ComposersPage'
import { VideosPage } from './components/VideosPage'
import { Login } from './components/Login'
import { PdfPreview } from './components/PdfPreview'
import { Toasts } from './components/Toasts'
import { strokeIcon } from './components/icons'
import { useLibrary } from './hooks/useLibrary'

const libraryIcon = strokeIcon('M4 19V5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2m0-2a2 2 0 0 1 2-2h13M9 7h6M9 11h6')
const composersIcon = strokeIcon('M20 21a8 8 0 0 0-16 0M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8')
const videosIcon = strokeIcon('M4 5h16v14H4zM10 9l5 3-5 3z')

type Page = 'library' | 'composers' | 'videos'
type AuthState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; session: Session | null }

function AuthenticatedContent({ page, isIOS }: { page: Page; isIOS: boolean }) {
  const lib = useLibrary()
  return (
    <>
      <Toasts lib={lib} />
      <PdfPreview lib={lib} />
      {page === 'composers' ? <ComposersPage lib={lib} /> : page === 'videos' ? <VideosPage /> : <Library lib={lib} isIOS={isIOS} />}
    </>
  )
}

export default function App() {
  const [auth, setAuth] = useState<AuthState>({ status: 'loading' })
  const [authAttempt, setAuthAttempt] = useState(0)
  const [page, setPage] = useState<Page>('library')
  const isIOS = Capacitor.getPlatform() === 'ios'
  useEffect(() => {
    let active = true
    let subscription: { unsubscribe: () => void } | undefined
    let sessionChanged = false
    let latestSession: Session | null = null
    const initialize = async () => {
      try {
        subscription = supabase.auth.onAuthStateChange((event, nextSession) => {
          if (!active || event === 'INITIAL_SESSION') return
          sessionChanged = true
          latestSession = nextSession
          setAuth((current) => current.status === 'ready' ? { status: 'ready', session: nextSession } : current)
        }).data.subscription
        const { data, error } = await supabase.auth.getSession()
        if (error) throw error
        if (active) setAuth({ status: 'ready', session: sessionChanged ? latestSession : data.session })
      } catch (error) {
        if (active) {
          console.error('Could not initialize authentication', error)
          setAuth({ status: 'error' })
        }
      }
    }
    void initialize()
    return () => { active = false; subscription?.unsubscribe() }
  }, [authAttempt])
  const session = auth.status === 'ready' ? auth.session : null
  const navigation = session && (
    <nav className="page-nav" aria-label="Pages">
      <button type="button" className={page === 'library' ? 'on' : ''} aria-current={page === 'library' ? 'page' : undefined} onClick={() => setPage('library')}>
        {isIOS && <span className="page-nav-icon">{libraryIcon}</span>}Library
      </button>
      {isIOS && (
        <button type="button" className={page === 'composers' ? 'on' : ''} aria-current={page === 'composers' ? 'page' : undefined} onClick={() => setPage('composers')}>
          <span className="page-nav-icon">{composersIcon}</span>Composers
        </button>
      )}
      <button type="button" className={page === 'videos' ? 'on' : ''} aria-current={page === 'videos' ? 'page' : undefined} onClick={() => setPage('videos')}>
        {isIOS && <span className="page-nav-icon">{videosIcon}</span>}Videos
      </button>
    </nav>
  )
  return (
    <div className={`app-shell${isIOS ? ' ios-native' : ''}${isIOS && session ? ' has-navigation' : ''}`}>
      <header className="site-header">
        <div className="header-inner">
          <div className="brand"><span aria-hidden="true">♪</span><h1>Sheet Music</h1></div>
          {!isIOS && navigation}
          <div className="header-actions">
            <button type="button" className="link" title="Reload the app; unsaved changes will be lost" onClick={() => window.location.reload()}>Reload app</button>
            {session && <button type="button" className="link" onClick={() => void supabase.auth.signOut()}>Sign out</button>}
          </div>
        </div>
      </header>
      <main>
        {auth.status === 'loading' ? (
          <div className="auth-wrap"><div className="panel auth-card" role="status">Loading your session…</div></div>
        ) : auth.status === 'error' ? (
          <div className="auth-wrap">
            <div className="panel auth-card">
              <div role="alert"><h2>Could not load your session</h2><p>Check your connection and try again.</p></div>
              <button type="button" className="btn primary" onClick={() => { setAuth({ status: 'loading' }); setAuthAttempt((attempt) => attempt + 1) }}>Try again</button>
            </div>
          </div>
        ) : session ? <AuthenticatedContent page={page} isIOS={isIOS} /> : <Login />}
      </main>
      {isIOS && navigation}
    </div>
  )
}
