import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

const mocks = vi.hoisted(() => ({
  getPlatform: vi.fn(),
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: mocks.getPlatform } }))
vi.mock('./supabase', () => ({
  supabase: { auth: { getSession: mocks.getSession, onAuthStateChange: mocks.onAuthStateChange, signOut: mocks.signOut } },
}))
vi.mock('./components/Library', () => ({ Library: () => <div>Library content</div> }))
vi.mock('./components/ComposersPage', () => ({ ComposersPage: () => <div>Composers content</div> }))
vi.mock('./components/VideosPage', () => ({ VideosPage: () => <div>Videos content</div> }))
vi.mock('./components/Login', () => ({ Login: () => <div>Login content</div> }))
vi.mock('./components/Toasts', () => ({ Toasts: () => null }))
vi.mock('./components/PdfPreview', () => ({ PdfPreview: () => null }))
vi.mock('./hooks/useLibrary', () => ({ useLibrary: () => ({}) }))

describe('app navigation', () => {
  beforeEach(() => {
    mocks.getSession.mockResolvedValue({ data: { session: {} }, error: null })
    mocks.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
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
  })

  it('keeps browser navigation in the header', async () => {
    mocks.getPlatform.mockReturnValue('web')
    render(<App />)

    const navigation = await screen.findByRole('navigation', { name: 'Pages' })
    expect(navigation.closest('header')).not.toBeNull()
    expect(screen.getByText('Library content')).toBeTruthy()
  })

  it('does not show navigation while signed out', async () => {
    mocks.getPlatform.mockReturnValue('ios')
    mocks.getSession.mockResolvedValue({ data: { session: null } })
    render(<App />)

    expect(await screen.findByText('Login content')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reload app' })).toBeTruthy()
    expect(screen.queryByRole('navigation', { name: 'Pages' })).toBeNull()
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
    await act(async () => { resolveSession({ data: { session: {} }, error: null }) })
    expect(await screen.findByText('Login content')).toBeTruthy()
    act(() => { authChange('SIGNED_IN', {}) })
    expect(screen.getByText('Library content')).toBeTruthy()
  })
})
