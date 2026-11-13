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

function AuthenticatedContent({ page }: { page: Page }) {
  const lib = useLibrary()
  return (
    <>
      <Toasts lib={lib} />
      <PdfPreview lib={lib} />
      {page === 'composers' ? <ComposersPage lib={lib} /> : page === 'videos' ? <VideosPage /> : <Library lib={lib} />}
    </>
  )
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [page, setPage] = useState<Page>('library')
  const isIOS = Capacitor.getPlatform() === 'ios'
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true) })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  if (!ready) return null
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
      <main>{session ? <AuthenticatedContent page={page} /> : <Login />}</main>
      {isIOS && navigation}
    </div>
  )
}
