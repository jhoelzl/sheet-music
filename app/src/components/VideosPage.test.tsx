import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { VideosPage } from './VideosPage'

const mocks = vi.hoisted(() => ({ from: vi.fn(), getPlatform: vi.fn(), open: vi.fn(), pieces: [] as Record<string, unknown>[] }))
vi.mock('../supabase', () => ({ supabase: { from: mocks.from } }))
vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: mocks.getPlatform },
  registerPlugin: () => ({ open: mocks.open }),
}))

describe('video feed', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/')
    mocks.getPlatform.mockReturnValue('web')
    mocks.open.mockResolvedValue(undefined)
    mocks.pieces = [
      { id: 'p1', composer_id: 'c1', title: 'Romance', links: [{ url: 'https://youtu.be/abcdefghi' }] },
      { id: 'p2', composer_id: 'missing', title: 'Nocturne', links: [{ url: 'https://www.youtube.com/watch?v=abcdefghj' }] },
    ]
    mocks.from.mockImplementation((table: string) => ({
      select: () => {
        const data = table === 'sm_composers'
          ? [{ id: 'c1', name: 'Clara Schumann' }]
          : table === 'sm_pieces' ? mocks.pieces : []
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

    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort by' }), 'random')
    expect(screen.getByRole('combobox', { name: 'Sort by' })).toHaveProperty('value', 'random')
    expect(titles()).toEqual(['Nocturne', 'Romance'])
    await user.click(screen.getByRole('button', { name: 'Play Romance' }))
    expect(titles()).toEqual(['Nocturne', 'Romance'])
    expect(random).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Shuffle again' }))
    expect(titles()).toEqual(['Romance', 'Nocturne'])
    expect(screen.getByTitle('Romance')).toBeTruthy()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort by' }), 'ordered')
    expect(screen.getByRole('combobox', { name: 'Sort by' })).toHaveProperty('value', 'ordered')
    expect(screen.queryByRole('button', { name: 'Shuffle again' })).toBeNull()
    expect(titles()).toEqual(['Romance', 'Nocturne'])
  })

  it('opens in random order when configured, while allowing the user to turn it off', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const user = userEvent.setup()
    render(<VideosPage defaultRandom />)
    await screen.findByRole('button', { name: 'Play Romance' })
    expect(screen.getAllByRole('article').map((card) => card.querySelector('strong')?.textContent)).toEqual(['Nocturne', 'Romance'])
    expect(screen.getByRole('combobox', { name: 'Sort by' })).toHaveProperty('value', 'random')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort by' }), 'ordered')
    expect(screen.getAllByRole('article').map((card) => card.querySelector('strong')?.textContent)).toEqual(['Romance', 'Nocturne'])
  })

  it('restores the same random order after remount', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const user = userEvent.setup()
    const rendered = render(<VideosPage />)
    await screen.findByRole('button', { name: 'Play Romance' })
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort by' }), 'random')
    const before = screen.getAllByRole('article').map((card) => card.querySelector('strong')?.textContent)
    expect(new URLSearchParams(window.location.search).get('videoOrder')).toBe('random:0')
    rendered.unmount()
    render(<VideosPage />)
    await screen.findByRole('button', { name: 'Play Romance' })
    expect(screen.getAllByRole('article').map((card) => card.querySelector('strong')?.textContent)).toEqual(before)
    expect(screen.getByRole('combobox', { name: 'Sort by' })).toHaveProperty('value', 'random')
  })

  it('sorts by each link’s added date and the piece’s last practice date, leaving unknown dates last', async () => {
    mocks.pieces = [
      { id: 'p1', composer_id: 'c1', title: 'Alpha', last_practiced: null, links: [
        { url: 'https://youtu.be/abcdefghi', added_at: '2026-03-01T10:00:00Z' },
        { url: 'https://youtu.be/abcdefghj' },
      ] },
      { id: 'p2', composer_id: 'c1', title: 'Beta', last_practiced: '2026-05-01', links: [
        { url: 'https://youtu.be/abcdefghk', added_at: '2026-04-01T10:00:00Z' },
      ] },
      { id: 'p3', composer_id: 'c1', title: 'Gamma', last_practiced: '2026-04-01', links: [
        { url: 'https://youtu.be/abcdefghl', added_at: 'invalid' },
      ] },
    ]
    const user = userEvent.setup()
    const rendered = render(<VideosPage />)
    await screen.findByRole('button', { name: 'Play Beta' })
    const urls = () => screen.getAllByRole('article').map((card) => within(card).getByRole('link').getAttribute('href'))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort by' }), 'added')
    expect(urls()).toEqual(['https://youtu.be/abcdefghk', 'https://youtu.be/abcdefghi', 'https://youtu.be/abcdefghj', 'https://youtu.be/abcdefghl'])
    expect(screen.getByText('Older links without a recorded date appear last.')).toBeTruthy()
    expect(new URLSearchParams(window.location.search).get('videoOrder')).toBe('added')
    rendered.unmount()
    render(<VideosPage />)
    await screen.findByRole('button', { name: 'Play Beta' })
    expect(screen.getByRole('combobox', { name: 'Sort by' })).toHaveProperty('value', 'added')
    expect(urls()[0]).toBe('https://youtu.be/abcdefghk')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort by' }), 'practised')
    expect(urls()).toEqual(['https://youtu.be/abcdefghk', 'https://youtu.be/abcdefghl', 'https://youtu.be/abcdefghi', 'https://youtu.be/abcdefghj'])
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

  it('shows Instagram links as cards that open the original post', async () => {
    const instagramUrl = 'https://www.instagram.com/share/IQI5MzgiV'
    mocks.pieces = [
      { id: 'p1', composer_id: 'c1', title: 'Instagram piece', links: [{ url: instagramUrl }] },
    ]
    render(<VideosPage />)

    const card = (await screen.findByRole('link', { name: 'Watch Instagram piece on Instagram' })).closest('article')!
    expect(within(card).getByRole('link', { name: 'Open Instagram piece on Instagram' }).getAttribute('href')).toBe(instagramUrl)
    expect(within(card).getByRole('link', { name: 'Watch Instagram piece on Instagram' }).getAttribute('href')).toBe(instagramUrl)
    expect(within(card).queryByRole('iframe')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Play Instagram piece' })).toBeNull()
  })
})
