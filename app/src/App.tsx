import { useEffect, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import './App.css'
import { Library } from './components/Library'
import { ComposersPage } from './components/ComposersPage'
import { VideosPage } from './components/VideosPage'
import { SetlistsPage } from './components/SetlistsPage'
import { LessonsPage } from './components/LessonsPage'
import { SettingsPage } from './components/SettingsPage'
import { Login } from './components/Login'
import { PdfPreview } from './components/PdfPreview'
import { Toasts } from './components/Toasts'
import { strokeIcon } from './components/icons'
import { useLibrary } from './hooks/useLibrary'
import { updateUrlState, URL_STATE_CHANGE } from './hooks/useUrlState'
import { useUserSettings } from './hooks/useUserSettings'
import type { SettingsState } from './hooks/useUserSettings'
import type { UserSettings } from './lib/userSettings'

const libraryIcon = strokeIcon('M4 19V5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2m0-2a2 2 0 0 1 2-2h13M9 7h6M9 11h6')
const composersIcon = strokeIcon('M20 21a8 8 0 0 0-16 0M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8')
const videosIcon = strokeIcon('M4 5h16v14H4zM10 9l5 3-5 3z')
const setlistsIcon = strokeIcon('M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01')
const lessonsIcon = strokeIcon('M5 4h14v16H5zM8 8h8M8 12h8M8 16h5')
const settingsIcon = strokeIcon('M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M19.07 4.93l-1.42 1.42M6.35 17.65l-1.42 1.42')

type Page = 'library' | 'composers' | 'videos' | 'setlists' | 'lessons' | 'settings'
const PAGES: Page[] = ['library', 'composers', 'videos', 'setlists', 'lessons', 'settings']
const pageFromUrl = (): Page => PAGES.find((item) => item === new URLSearchParams(window.location.search).get('page')) ?? 'library'
type AuthState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; session: Session | null }

function AuthenticatedContent({ page, isIOS, onLessonDirty, userId, settingsState, saveSettings, retrySettings }: {
  page: Page; isIOS: boolean; onLessonDirty: (dirty: boolean) => void; userId: string
  settingsState: SettingsState; saveSettings: (settings: UserSettings) => Promise<void>; retrySettings: () => void
}) {
  const lib = useLibrary(settingsState.settings, userId)
  const save = async (next: UserSettings) => {
    await saveSettings(next)
    lib.applyDefaults(next, settingsState.settings)
  }
  return (
    <>
      <Toasts lib={lib} />
      <PdfPreview lib={lib} />
      {settingsState.status === 'error' && page !== 'settings' && <div className="error" role="alert">Could not load your settings. Default preferences are in use. Open Settings to retry.</div>}
      {page === 'composers' ? <ComposersPage lib={lib} /> : page === 'videos' ? <VideosPage defaultRandom={settingsState.settings.video_order === 'random'} /> : page === 'setlists' ? <SetlistsPage lib={lib} /> : page === 'lessons' ? <LessonsPage lib={lib} onDirtyChange={onLessonDirty} /> : page === 'settings' ? <SettingsPage lib={lib} settings={settingsState.settings} loadError={settingsState.status === 'error' ? settingsState.message : null} onRetry={retrySettings} onSave={save} /> : <Library lib={lib} isIOS={isIOS} />}
    </>
  )
}

function useTheme(theme: UserSettings['theme']) {
  useEffect(() => {
    const preference = window.matchMedia?.('(prefers-color-scheme: dark)')
    const apply = () => {
      document.documentElement.dataset.theme = theme === 'system' ? (preference?.matches ? 'dark' : 'light') : theme
    }
    apply()
    preference?.addEventListener('change', apply)
    return () => { preference?.removeEventListener('change', apply); delete document.documentElement.dataset.theme }
  }, [theme])
}

export default function App() {
  const [auth, setAuth] = useState<AuthState>({ status: 'loading' })
  const [authAttempt, setAuthAttempt] = useState(0)
  const [page, setPage] = useState<Page>(pageFromUrl)
  const [lessonDirty, setLessonDirty] = useState(false)
  const pageRef = useRef(page)
  const dirtyRef = useRef(lessonDirty)
  const currentUrl = useRef(window.location.href)
  useEffect(() => {
    pageRef.current = page
    dirtyRef.current = lessonDirty
  }, [page, lessonDirty])
  const isIOS = Capacitor.getPlatform() === 'ios'
  const session = auth.status === 'ready' ? auth.session : null
  const userSettings = useUserSettings(session?.user.id ?? null)
  useTheme(userSettings.state.settings.theme)
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
  useEffect(() => {
    const rememberUrl = () => { currentUrl.current = window.location.href }
    const onPopState = () => {
      const next = pageFromUrl()
      const previousParams = new URL(currentUrl.current).searchParams
      const nextParams = new URL(window.location.href).searchParams
      const changesLesson = next !== pageRef.current ||
        previousParams.get('lesson') !== nextParams.get('lesson') ||
        previousParams.get('lessonGroup') !== nextParams.get('lessonGroup') ||
        previousParams.get('materialTag') !== nextParams.get('materialTag')
      if (pageRef.current === 'lessons' && changesLesson && dirtyRef.current && !window.confirm('Discard unsaved changes?')) {
        window.history.pushState(window.history.state, '', currentUrl.current)
        window.dispatchEvent(new Event(URL_STATE_CHANGE))
        return
      }
      if (changesLesson) setLessonDirty(false)
      setPage(next)
      rememberUrl()
    }
    window.addEventListener(URL_STATE_CHANGE, rememberUrl)
    window.addEventListener('popstate', onPopState)
    return () => {
      window.removeEventListener(URL_STATE_CHANGE, rememberUrl)
      window.removeEventListener('popstate', onPopState)
    }
  }, [])
  const navigate = (next: Page) => {
    if (next === page) return
    if (lessonDirty && !window.confirm('Discard unsaved changes?')) return
    setLessonDirty(false)
    updateUrlState('page', next, true)
    setPage(next)
  }
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
      <button type="button" className={page === 'settings' ? 'on' : ''} aria-current={page === 'settings' ? 'page' : undefined} onClick={() => navigate('settings')}>
        {isIOS && <span className="page-nav-icon">{settingsIcon}</span>}Settings
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
            {session && <button type="button" className="link" onClick={() => { if (!lessonDirty || window.confirm('Discard unsaved changes?')) void supabase.auth.signOut() }}>Sign out</button>}
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
        ) : session ? userSettings.state.status === 'loading' ? (
          <div className="auth-wrap"><div className="panel auth-card" role="status">Loading your settings…</div></div>
        ) : <AuthenticatedContent key={`${session.user.id}:${userSettings.state.status}`} page={page} isIOS={isIOS} onLessonDirty={setLessonDirty} userId={session.user.id} settingsState={userSettings.state} saveSettings={userSettings.save} retrySettings={userSettings.retry} /> : <Login />}
      </main>
      {isIOS && navigation}
    </div>
  )
}
