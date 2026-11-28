import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Piece } from '../supabase'
import { AddToSetlists } from './AddToSetlists'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  setlists: [] as { id: string; name: string; archived_at: string | null }[],
  entries: [] as { setlist_id: string; piece_id: string | null; position: number; placeholder: string | null }[],
  failLoad: false,
  failInsert: '',
}))
vi.mock('../supabase', () => ({ supabase: { from: mocks.from } }))

const piece: Piece = {
  id: 'p1', composer_id: 'c1', title: 'Romance', instruments: [], pdf_path: null,
  play_progress: 0, difficulty: null, rating: null, notes: null,
}

describe('adding a library piece to setlists', () => {
  beforeEach(() => {
    mocks.setlists = [
      { id: 's1', name: 'Concert', archived_at: null },
      { id: 's2', name: 'Practice', archived_at: null },
      { id: 's3', name: 'Old concert', archived_at: '2026-01-01' },
      { id: 's4', name: 'Another concert', archived_at: null },
    ]
    mocks.entries = [
      { setlist_id: 's1', piece_id: 'p1', position: 0, placeholder: null },
      { setlist_id: 's2', piece_id: null, position: 4, placeholder: 'Break' },
    ]
    mocks.failLoad = false
    mocks.failInsert = ''
    mocks.from.mockImplementation((table: string) => {
      const filters: Record<string, string | null> = {}
      let descending = false
      let limit = Infinity
      const query = {
        is: (key: string, value: null) => { filters[key] = value; return query },
        eq: (key: string, value: string) => { filters[key] = value; return query },
        order: (_key: string, options?: { ascending?: boolean }) => { descending = options?.ascending === false; return query },
        limit: (value: number) => { limit = value; return query },
        then: (resolve: (value: unknown) => unknown) => {
          const rows = table === 'sm_setlists' ? mocks.setlists : mocks.entries
          const data = rows.filter((row) => Object.entries(filters).every(([key, value]) => Object.entries(row).some(([column, entry]) => column === key && entry === value)))
          if (descending) data.sort((a, b) => ('position' in b ? b.position : 0) - ('position' in a ? a.position : 0))
          return Promise.resolve({ data: data.slice(0, limit), error: mocks.failLoad ? { message: 'Load failed' } : null }).then(resolve)
        },
      }
      return {
        select: () => query,
        insert: async (entry: typeof mocks.entries[number]) => {
          if (entry.setlist_id === mocks.failInsert) return { error: { message: 'Save failed' } }
          mocks.entries.push(entry)
          return { error: null }
        },
      }
    })
  })

  afterEach(() => { cleanup(); vi.clearAllMocks() })

  it('adds to multiple active setlists at the end without changing existing entries', async () => {
    const user = userEvent.setup()
    render(<AddToSetlists piece={piece} />)
    const trigger = screen.getByRole('button', { name: 'Add Romance to setlists' })
    await user.click(trigger)
    const dialog = screen.getByRole('dialog', { name: 'Add Romance to setlists' })
    const concert = await within(dialog).findByRole('checkbox', { name: 'Concert (already added)' })
    expect(concert).toHaveProperty('disabled', true)
    expect(concert).toHaveProperty('checked', true)
    expect(within(dialog).queryByText('Old concert')).toBeNull()
    await user.click(within(dialog).getByRole('checkbox', { name: 'Practice' }))
    await user.click(within(dialog).getByRole('checkbox', { name: 'Another concert' }))
    await user.click(within(dialog).getByRole('button', { name: 'Add to selected' }))
    expect((await within(dialog).findByRole('status')).textContent).toContain('Added to 2 setlists.')
    expect(mocks.entries).toEqual([
      { setlist_id: 's1', piece_id: 'p1', position: 0, placeholder: null },
      { setlist_id: 's2', piece_id: null, position: 4, placeholder: 'Break' },
      { setlist_id: 's2', piece_id: 'p1', position: 5, placeholder: null },
      { setlist_id: 's4', piece_id: 'p1', position: 0, placeholder: null },
    ])
    await user.click(within(dialog).getByRole('button', { name: 'Done' }))
    expect(document.activeElement).toBe(trigger)
  })

  it('reports partial failures and lets the user retry only the failed setlist', async () => {
    mocks.failInsert = 's4'
    const user = userEvent.setup()
    render(<AddToSetlists piece={piece} />)
    await user.click(screen.getByRole('button', { name: 'Add Romance to setlists' }))
    await user.click(await screen.findByRole('checkbox', { name: 'Practice' }))
    await user.click(screen.getByRole('checkbox', { name: 'Another concert' }))
    await user.click(screen.getByRole('button', { name: 'Add to selected' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Another concert: Save failed')
    expect(screen.getByRole('checkbox', { name: 'Practice (already added)' })).toHaveProperty('disabled', true)
    expect(screen.getByRole('checkbox', { name: 'Another concert' })).toHaveProperty('checked', true)
    mocks.failInsert = ''
    await user.click(screen.getByRole('button', { name: 'Add to selected' }))
    await waitFor(() => expect(mocks.entries.filter((entry) => entry.piece_id === 'p1')).toHaveLength(3))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('reports loading errors instead of showing an empty setlist list', async () => {
    mocks.failLoad = true
    const user = userEvent.setup()
    render(<AddToSetlists piece={piece} />)
    await user.click(screen.getByRole('button', { name: 'Add Romance to setlists' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Load failed')
    expect(screen.queryByText(/No active setlists/)).toBeNull()
  })
})
