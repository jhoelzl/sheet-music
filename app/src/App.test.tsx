import { cleanup, render, screen, within } from '@testing-library/react'
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
    mocks.getSession.mockResolvedValue({ data: { session: {} } })
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
    expect(screen.queryByRole('navigation', { name: 'Pages' })).toBeNull()
  })
})
