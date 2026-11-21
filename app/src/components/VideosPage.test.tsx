import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { VideosPage } from './VideosPage'

const mocks = vi.hoisted(() => ({ from: vi.fn(), getPlatform: vi.fn(), open: vi.fn() }))
vi.mock('../supabase', () => ({ supabase: { from: mocks.from } }))
vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: mocks.getPlatform },
  registerPlugin: () => ({ open: mocks.open }),
}))

describe('video feed', () => {
  beforeEach(() => {
    mocks.getPlatform.mockReturnValue('web')
    mocks.open.mockResolvedValue(undefined)
    mocks.from.mockImplementation((table: string) => ({
      select: () => {
        const data = table === 'sm_composers'
          ? [{ id: 'c1', name: 'Clara Schumann' }]
          : [
              { id: 'p1', composer_id: 'c1', title: 'Romance', links: [{ url: 'https://youtu.be/abcdefghi' }] },
              { id: 'p2', composer_id: 'missing', title: 'Nocturne', links: [{ url: 'https://www.youtube.com/watch?v=abcdefghj' }] },
            ]
        const result = { data, error: null }
        return Object.assign(Promise.resolve(result), { order: () => Promise.resolve(result) })
      },
    }))
  })

  it('uses the native player on iOS and reports failures with a usable YouTube link', async () => {
    mocks.getPlatform.mockReturnValue('ios')
    mocks.open.mockRejectedValueOnce(new Error('Player unavailable'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const user = userEvent.setup()
    render(<VideosPage />)
    const play = await screen.findByRole('button', { name: 'Play Romance' })

    await user.click(play)
    expect(mocks.open).toHaveBeenCalledWith({ videoId: 'abcdefghi', title: 'Romance' })
    expect((await screen.findByRole('alert')).textContent).toContain('Could not open the video player')
    expect(screen.getByRole('link', { name: 'Open Romance on YouTube' })).toBeTruthy()
    expect(screen.queryByTitle('Romance')).toBeNull()
    await user.click(play)
    expect(screen.queryByRole('alert')).toBeNull()
    consoleError.mockRestore()
  })

  afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.clearAllMocks() })

  it('switches between the original and a stable random order, and reshuffles on demand', async () => {
    const random = vi.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValueOnce(0.99)
    const user = userEvent.setup()
    render(<VideosPage />)
    await screen.findByRole('button', { name: 'Play Romance' })
    const titles = () => screen.getAllByRole('article').map((card) => card.querySelector('strong')?.textContent)
    expect(titles()).toEqual(['Romance', 'Nocturne'])

    await user.click(screen.getByRole('button', { name: 'Random order' }))
    expect(screen.getByRole('button', { name: 'Random order' }).getAttribute('aria-pressed')).toBe('true')
    expect(titles()).toEqual(['Nocturne', 'Romance'])
    await user.click(screen.getByRole('button', { name: 'Play Romance' }))
    expect(titles()).toEqual(['Nocturne', 'Romance'])
    expect(random).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Shuffle again' }))
    expect(titles()).toEqual(['Romance', 'Nocturne'])
    expect(screen.getByTitle('Romance')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Random order' }))
    expect(screen.getByRole('button', { name: 'Random order' }).getAttribute('aria-pressed')).toBe('false')
    expect(screen.queryByRole('button', { name: 'Shuffle again' })).toBeNull()
    expect(titles()).toEqual(['Romance', 'Nocturne'])
  })

  it('opens in random order when configured, while allowing the user to turn it off', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const user = userEvent.setup()
    render(<VideosPage defaultRandom />)
    await screen.findByRole('button', { name: 'Play Romance' })
    expect(screen.getAllByRole('article').map((card) => card.querySelector('strong')?.textContent)).toEqual(['Nocturne', 'Romance'])
    expect(screen.getByRole('button', { name: 'Random order' }).getAttribute('aria-pressed')).toBe('true')
    await user.click(screen.getByRole('button', { name: 'Random order' }))
    expect(screen.getAllByRole('article').map((card) => card.querySelector('strong')?.textContent)).toEqual(['Romance', 'Nocturne'])
  })

  it('shows composer details and keeps video playback and source links accessible', async () => {
    const user = userEvent.setup()
    render(<VideosPage />)
    const play = await screen.findByRole('button', { name: 'Play Romance' })
    const card = play.closest('article')!
    expect(within(card).getByText('Clara Schumann')).toBeTruthy()
    const source = within(card).getByRole('link', { name: 'Open Romance on YouTube' })
    expect(source.getAttribute('href')).toBe('https://youtu.be/abcdefghi')
    expect(source.getAttribute('rel')).toContain('noopener')
    expect(screen.getByText('Unknown composer')).toBeTruthy()
    expect(screen.queryByTitle('Romance')).toBeNull()

    await user.click(play)
    expect(screen.getByTitle('Romance').getAttribute('src')).toContain('youtube-nocookie.com/embed/abcdefghi')
    await user.click(screen.getByRole('button', { name: 'Play Nocturne' }))
    expect(screen.queryByTitle('Romance')).toBeNull()
    expect(screen.getByTitle('Nocturne')).toBeTruthy()
  })
})
