import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { DEFAULT_USER_SETTINGS } from './lib/userSettings'

const mocks = vi.hoisted(() => ({
  getPlatform: vi.fn(),
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signOut: vi.fn(),
  theme: 'system' as 'system' | 'light' | 'dark',
}))

vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: mocks.getPlatform } }))
vi.mock('./supabase', () => ({
  supabase: { auth: { getSession: mocks.getSession, onAuthStateChange: mocks.onAuthStateChange, signOut: mocks.signOut } },
}))
vi.mock('./components/Library', () => ({ Library: () => <div>Library content</div> }))
vi.mock('./components/ComposersPage', () => ({ ComposersPage: () => <div>Composers content</div> }))
vi.mock('./components/VideosPage', () => ({ VideosPage: () => <div>Videos content</div> }))
vi.mock('./components/LessonsPage', () => ({ LessonsPage: ({ onDirtyChange }: { onDirtyChange: (dirty: boolean) => void }) => (
  <div>Lessons content<button type="button" onClick={() => onDirtyChange(true)}>Edit lesson draft</button></div>
) }))
vi.mock('./components/Login', () => ({ Login: () => <div>Login content</div> }))
vi.mock('./components/Toasts', () => ({ Toasts: () => null }))
vi.mock('./components/PdfPreview', () => ({ PdfPreview: () => null }))
vi.mock('./hooks/useLibrary', () => ({ useLibrary: () => ({}) }))
vi.mock('./hooks/useUserSettings', () => ({
  useUserSettings: () => ({ state: { status: 'ready', settings: { ...DEFAULT_USER_SETTINGS, theme: mocks.theme } }, save: vi.fn(), retry: vi.fn() }),
}))

describe('app navigation', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/')
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } }, error: null })
    mocks.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
    mocks.theme = 'system'
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('uses a bottom navigation on iOS and switches pages', async () => {
    mocks.getPlatform.mockReturnValue('ios')
    const user = userEvent.setup()
    render(<App />)

    const navigation = await screen.findByRole('navigation', { name: 'Pages' })
    expect(navigation.closest('header')).toBeNull()
    expect(screen.getByRole('button', { name: 'Reload app' }).parentElement).toBe(screen.getByRole('button', { name: 'Sign out' }).parentElement)
    expect(within(navigation).getByRole('button', { name: 'Library' }).getAttribute('aria-current')).toBe('page')
    await user.click(within(navigation).getByRole('button', { name: 'Composers' }))
    expect(screen.getByText('Composers content')).toBeTruthy()
    expect(within(navigation).getByRole('button', { name: 'Composers' }).getAttribute('aria-current')).toBe('page')
    await user.click(within(navigation).getByRole('button', { name: 'Videos' }))
    expect(screen.getByText('Videos content')).toBeTruthy()
    expect(within(navigation).getByRole('button', { name: 'Videos' }).getAttribute('aria-current')).toBe('page')
    await user.click(within(navigation).getByRole('button', { name: 'Lessons' }))
    expect(screen.getByText('Lessons content')).toBeTruthy()
    expect(within(navigation).getByRole('button', { name: 'Lessons' }).getAttribute('aria-current')).toBe('page')
    await user.click(within(navigation).getByRole('button', { name: 'Settings' }))
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeTruthy()
    expect(within(navigation).getByRole('button', { name: 'Settings' }).getAttribute('aria-current')).toBe('page')
  })

  it('keeps browser navigation in the header and switches to Composers', async () => {
    mocks.getPlatform.mockReturnValue('web')
    const user = userEvent.setup()
    render(<App />)

    const navigation = await screen.findByRole('navigation', { name: 'Pages' })
    expect(navigation.closest('header')).not.toBeNull()
    expect(screen.getByText('Library content')).toBeTruthy()
    await user.click(within(navigation).getByRole('button', { name: 'Composers' }))
    expect(screen.getByText('Composers content')).toBeTruthy()
    expect(within(navigation).getByRole('button', { name: 'Composers' }).getAttribute('aria-current')).toBe('page')
    await user.click(within(navigation).getByRole('button', { name: 'Lessons' }))
    expect(screen.getByText('Lessons content')).toBeTruthy()
  })

  it('does not show navigation while signed out', async () => {
    mocks.getPlatform.mockReturnValue('ios')
    mocks.getSession.mockResolvedValue({ data: { session: null } })
    render(<App />)

    expect(await screen.findByText('Login content')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reload app' })).toBeTruthy()
    expect(screen.queryByRole('navigation', { name: 'Pages' })).toBeNull()
  })

  it('uses the selected theme and follows device changes in system mode', async () => {
    let onChange = () => {}
    const preference = { matches: false, addEventListener: (_event: string, handler: () => void) => { onChange = handler }, removeEventListener: vi.fn() }
    vi.stubGlobal('matchMedia', () => preference)
    mocks.theme = 'dark'
    const { rerender } = render(<App />)
    await screen.findByText('Library content')
    expect(document.documentElement.dataset.theme).toBe('dark')
    mocks.theme = 'system'
    rerender(<App />)
    expect(document.documentElement.dataset.theme).toBe('light')
    preference.matches = true
    act(() => onChange())
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('protects unsaved lesson notes when changing pages', async () => {
    mocks.getPlatform.mockReturnValue('web')
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()
    render(<App />)
    const navigation = await screen.findByRole('navigation', { name: 'Pages' })
    await user.click(within(navigation).getByRole('button', { name: 'Lessons' }))
    await user.click(screen.getByRole('button', { name: 'Edit lesson draft' }))
    await user.click(within(navigation).getByRole('button', { name: 'Library' }))
    expect(confirm).toHaveBeenCalledOnce()
    expect(confirm).toHaveBeenCalledWith('Discard unsaved changes?')
    expect(screen.getByText('Lessons content')).toBeTruthy()
    confirm.mockRestore()
  })

  it('restores pages from the URL and supports browser back and forward', async () => {
    window.history.replaceState(null, '', '/?page=videos&other=keep#anchor')
    const user = userEvent.setup()
    render(<App />)
    expect(await screen.findByText('Videos content')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Composers' }))
    expect(window.location.search).toContain('page=composers')
    expect(window.location.search).toContain('other=keep')
    expect(window.location.hash).toBe('#anchor')
    act(() => window.history.back())
    await waitFor(() => expect(screen.getByText('Videos content')).toBeTruthy())
    act(() => window.history.forward())
    await waitFor(() => expect(screen.getByText('Composers content')).toBeTruthy())
  })

  it('does not lose an unsaved lesson on cancelled browser navigation', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Lessons' }))
    await user.click(screen.getByRole('button', { name: 'Edit lesson draft' }))
    act(() => window.history.back())
    await waitFor(() => expect(confirm).toHaveBeenCalledOnce())
    expect(screen.getByText('Lessons content')).toBeTruthy()
    expect(new URLSearchParams(window.location.search).get('page')).toBe('lessons')
    confirm.mockRestore()
  })

  it('uses the library for an invalid page', async () => {
    window.history.replaceState(null, '', '/?page=unknown')
    render(<App />)
    expect(await screen.findByText('Library content')).toBeTruthy()
  })

  it('shows a loading state until the session is restored', async () => {
    let resolveSession!: (result: { data: { session: null }; error: null }) => void
    mocks.getSession.mockReturnValueOnce(new Promise((resolve) => { resolveSession = resolve }))
    render(<App />)

    expect(screen.getByRole('status').textContent).toContain('Loading your session')
    expect(screen.queryByText('Login content')).toBeNull()
    await act(async () => { resolveSession({ data: { session: null }, error: null }) })
    expect(await screen.findByText('Login content')).toBeTruthy()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('reports a session error and retries without treating it as a signed-out session', async () => {
    const unsubscribe = vi.fn()
    mocks.onAuthStateChange.mockImplementationOnce((callback) => {
      callback('INITIAL_SESSION', null)
      return { data: { subscription: { unsubscribe } } }
    })
    mocks.getSession.mockResolvedValueOnce({ data: { session: null }, error: { message: 'Session unavailable' } })
    let resolveRetry!: (result: { data: { session: null }; error: null }) => void
    mocks.getSession.mockReturnValueOnce(new Promise((resolve) => { resolveRetry = resolve }))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const user = userEvent.setup()
    render(<App />)

    expect((await screen.findByRole('alert')).textContent).toContain('Could not load your session')
    expect(screen.queryByText('Login content')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(unsubscribe).toHaveBeenCalledOnce()
    expect(screen.getByRole('status').textContent).toContain('Loading your session')
    await act(async () => { resolveRetry({ data: { session: null }, error: null }) })
    expect(await screen.findByText('Login content')).toBeTruthy()
    expect(mocks.getSession).toHaveBeenCalledTimes(2)
    consoleError.mockRestore()
  })

  it('allows retry after a rejected initialization', async () => {
    mocks.getSession.mockRejectedValueOnce(new Error('Network failed'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const user = userEvent.setup()
    render(<App />)

    expect(await screen.findByRole('alert')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Library content')).toBeTruthy()
    consoleError.mockRestore()
  })

  it('does not overwrite an auth change with an older session response', async () => {
    let authChange!: (event: string, session: object | null) => void
    let resolveSession!: (result: { data: { session: object }; error: null }) => void
    mocks.onAuthStateChange.mockImplementationOnce((callback) => {
      authChange = callback
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    })
    mocks.getSession.mockReturnValueOnce(new Promise((resolve) => { resolveSession = resolve }))
    render(<App />)

    act(() => { authChange('SIGNED_OUT', null) })
    await act(async () => { resolveSession({ data: { session: { user: { id: 'u1' } } }, error: null }) })
    expect(await screen.findByText('Login content')).toBeTruthy()
    act(() => { authChange('SIGNED_IN', { user: { id: 'u1' } }) })
    expect(screen.getByText('Library content')).toBeTruthy()
  })
})
