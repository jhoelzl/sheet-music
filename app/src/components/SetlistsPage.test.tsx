import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Piece } from '../supabase'
import { SetlistsPage } from './SetlistsPage'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  insert: vi.fn(),
  setlists: [] as { id: string; name: string }[],
  members: [] as { setlist_id: string; piece_id: string; position: number }[],
}))

vi.mock('../supabase', () => ({ supabase: { from: mocks.from } }))

const piece: Piece = {
  id: 'p1',
  composer_id: 'c1',
  composer_ids: ['c1'],
  title: 'Moanin’',
  subtitle: null,
  musical_key: 'F minor',
  pdf_path: null,
  play_progress: 0,
  difficulty: null,
  rating: null,
  notes: null,
  instruments: ['piano'],
}

const lib = { pieces: [piece], composerNamesOf: () => 'Bobby Timmons', hiddenIds: new Set<string>() }

describe('setlists page', () => {
  beforeEach(() => {
    mocks.setlists = []
    mocks.members = []
    mocks.insert.mockReset()
    mocks.insert.mockImplementation((table: string, values: Record<string, unknown> | Record<string, unknown>[]) => {
      if (table === 'sm_setlists' && !Array.isArray(values)) {
        const created = { id: 's1', name: String(values.name) }
        mocks.setlists.push(created)
        return created
      }
      if (table === 'sm_setlist_pieces' && !Array.isArray(values)) mocks.members.push(values as { setlist_id: string; piece_id: string; position: number })
      return null
    })
    mocks.from.mockImplementation((table: string) => {
      const filters: Record<string, string> = {}
      const query = {
        order: () => Promise.resolve({
          data: table === 'sm_setlists'
            ? mocks.setlists
            : table === 'sm_setlist_pieces'
              ? mocks.members.filter((member) => !filters.setlist_id || member.setlist_id === filters.setlist_id)
              : [],
          error: null,
        }),
        eq: (column: string, value: string) => { filters[column] = value; return query },
      }
      return {
        select: () => query,
        insert: (values: Record<string, unknown>) => {
          const created = mocks.insert(table, values)
          if (table === 'sm_setlists') return { select: () => ({ single: () => Promise.resolve({ data: created, error: null }) }) }
          return Promise.resolve({ error: null })
        },
        delete: () => ({
          eq: () => Promise.resolve({ error: null }),
        }),
        update: () => ({
          eq: () => ({
            eq: () => Promise.resolve({ error: null }),
          }),
        }),
      }
    })
  })

  afterEach(() => { cleanup(); vi.clearAllMocks() })

  it('creates a named setlist and adds a tune to it', async () => {
    const user = userEvent.setup()
    render(<SetlistsPage lib={lib} />)

    await user.type(screen.getByRole('textbox', { name: 'Setlist name' }), 'Friday gig')
    await user.click(screen.getByRole('button', { name: 'Create setlist' }))
    await screen.findByRole('heading', { name: 'Friday gig' })
    await user.click(screen.getByRole('checkbox', { name: 'Add Moanin’ to Friday gig' }))

    await waitFor(() => expect(mocks.insert).toHaveBeenCalledWith('sm_setlist_pieces', {
      setlist_id: 's1',
      piece_id: 'p1',
      position: 0,
    }))
    expect(screen.getByRole('list', { name: 'Tune order' }).textContent).toContain('Moanin’')
  })
})
