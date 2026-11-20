import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import './App.css'
import { Library } from './components/Library'
import { ComposersPage } from './components/ComposersPage'
import { VideosPage } from './components/VideosPage'
import { SetlistsPage } from './components/SetlistsPage'
import { LessonsPage } from './components/LessonsPage'
import { Login } from './components/Login'
import { PdfPreview } from './components/PdfPreview'
import { Toasts } from './components/Toasts'
import { strokeIcon } from './components/icons'
import { useLibrary } from './hooks/useLibrary'

const libraryIcon = strokeIcon('M4 19V5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2m0-2a2 2 0 0 1 2-2h13M9 7h6M9 11h6')
const composersIcon = strokeIcon('M20 21a8 8 0 0 0-16 0M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8')
const videosIcon = strokeIcon('M4 5h16v14H4zM10 9l5 3-5 3z')
const setlistsIcon = strokeIcon('M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01')
const lessonsIcon = strokeIcon('M5 4h14v16H5zM8 8h8M8 12h8M8 16h5')

type Page = 'library' | 'composers' | 'videos' | 'setlists' | 'lessons'
type AuthState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; session: Session | null }

function AuthenticatedContent({ page, isIOS, onLessonDirty }: { page: Page; isIOS: boolean; onLessonDirty: (dirty: boolean) => void }) {
  const lib = useLibrary()
  return (
    <>
      <Toasts lib={lib} />
      <PdfPreview lib={lib} />
      {page === 'composers' ? <ComposersPage lib={lib} /> : page === 'videos' ? <VideosPage /> : page === 'setlists' ? <SetlistsPage lib={lib} /> : page === 'lessons' ? <LessonsPage lib={lib} onDirtyChange={onLessonDirty} /> : <Library lib={lib} isIOS={isIOS} />}
    </>
  )
}

export default function App() {
  const [auth, setAuth] = useState<AuthState>({ status: 'loading' })
  const [authAttempt, setAuthAttempt] = useState(0)
  const [page, setPage] = useState<Page>('library')
  const [lessonDirty, setLessonDirty] = useState(false)
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
  useEffect(() => {
    if (!lessonDirty) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [lessonDirty])
  const navigate = (next: Page) => {
    if (next === page) return
    if (lessonDirty && !window.confirm('Discard unsaved lesson changes?')) return
    setLessonDirty(false)
    setPage(next)
  }
  const session = auth.status === 'ready' ? auth.session : null
  const navigation = session && (
    <nav className="page-nav" aria-label="Pages">
      <button type="button" className={page === 'library' ? 'on' : ''} aria-current={page === 'library' ? 'page' : undefined} onClick={() => navigate('library')}>
        {isIOS && <span className="page-nav-icon">{libraryIcon}</span>}Library
      </button>
      <button type="button" className={page === 'composers' ? 'on' : ''} aria-current={page === 'composers' ? 'page' : undefined} onClick={() => navigate('composers')}>
        {isIOS && <span className="page-nav-icon">{composersIcon}</span>}Composers
      </button>
      <button type="button" className={page === 'videos' ? 'on' : ''} aria-current={page === 'videos' ? 'page' : undefined} onClick={() => navigate('videos')}>
        {isIOS && <span className="page-nav-icon">{videosIcon}</span>}Videos
      </button>
      <button type="button" className={page === 'setlists' ? 'on' : ''} aria-current={page === 'setlists' ? 'page' : undefined} onClick={() => navigate('setlists')}>
        {isIOS && <span className="page-nav-icon">{setlistsIcon}</span>}Setlists
      </button>
      <button type="button" className={page === 'lessons' ? 'on' : ''} aria-current={page === 'lessons' ? 'page' : undefined} onClick={() => navigate('lessons')}>
        {isIOS && <span className="page-nav-icon">{lessonsIcon}</span>}Lessons
      </button>
    </nav>
  )
  return (
    <div className={`app-shell${isIOS ? ' ios-native' : ''}${isIOS && session ? ' has-navigation' : ''}`}>
      <header className="site-header">
        <div className="header-inner">
          <div className="brand"><img className="brand-icon" src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" /><h1>Sheet Music</h1></div>
          {!isIOS && navigation}
          <div className="header-actions">
            <button type="button" className="link" title="Reload the app; unsaved changes will be lost" onClick={() => window.location.reload()}>Reload app</button>
            {session && <button type="button" className="link" onClick={() => { if (!lessonDirty || window.confirm('Discard unsaved lesson changes?')) void supabase.auth.signOut() }}>Sign out</button>}
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
        ) : session ? <AuthenticatedContent page={page} isIOS={isIOS} onLessonDirty={setLessonDirty} /> : <Login />}
      </main>
      {isIOS && navigation}
    </div>
  )
}
