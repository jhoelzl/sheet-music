import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Piece } from '../supabase'
import { SetlistsPage } from './SetlistsPage'

type Setlist = { id: string; name: string; position: number }
type Entry = { id: string; setlist_id: string; piece_id: string | null; position: number; placeholder: string | null; comment: string | null }

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  insert: vi.fn(),
  fail: '',
  setlists: [] as Setlist[],
  members: [] as Entry[],
}))

vi.mock('../supabase', () => ({ supabase: { from: mocks.from, rpc: mocks.rpc } }))

const piece: Piece = {
  id: 'p1', composer_id: 'c1', composer_ids: ['c1'], title: 'Moanin’', subtitle: null, musical_key: 'F minor',
  pdf_path: null, play_progress: 0, difficulty: null, rating: null, notes: null, instruments: ['piano'],
}
const lib = { pieces: [piece], composerNamesOf: () => 'Bobby Timmons', hiddenIds: new Set<string>() }

describe('setlists page', () => {
  beforeEach(() => {
    mocks.setlists = []
    mocks.members = []
    mocks.fail = ''
    mocks.insert.mockReset()
    mocks.insert.mockImplementation((table: string, values: Record<string, unknown>) => {
      if (table === 'sm_setlists') {
        const created = { id: `s${mocks.setlists.length + 1}`, name: String(values.name), position: Number(values.position) }
        mocks.setlists.push(created)
        return created
      }
      const created = { id: `e${mocks.members.length + 1}`, comment: null, ...values } as Entry
      mocks.members.push(created)
      return created
    })
    mocks.rpc.mockImplementation(async (name: string, args: Record<string, string>) => {
      if (mocks.fail === name) return { error: { message: 'Swap failed' } }
      const rows = name === 'sm_swap_setlists' ? mocks.setlists : mocks.members.filter((entry) => entry.setlist_id === args.list_id)
      const first = rows.find((row) => row.id === args.first_id)!
      const second = rows.find((row) => row.id === args.second_id)!
      ;[first.position, second.position] = [second.position, first.position]
      return { error: null }
    })
    mocks.from.mockImplementation((table: string) => {
      const filters: Record<string, string> = {}
      const rows = () => table === 'sm_setlists' ? mocks.setlists : mocks.members
      const matches = (row: Setlist | Entry) => Object.entries(filters).every(([key, value]) => row[key as keyof typeof row] === value)
      const query = {
        eq: (column: string, value: string) => { filters[column] = value; return query },
        order: () => query,
        then: (resolve: (result: { data: (Setlist | Entry)[]; error: { message: string } | null }) => unknown) =>
          Promise.resolve({ data: rows().filter(matches).sort((a, b) => a.position - b.position).map((row) => ({ ...row })), error: mocks.fail === 'load' ? { message: 'Load failed' } : null }).then(resolve),
      }
      const mutation = (operation: 'update' | 'delete', values?: Record<string, unknown>) => {
        const run = () => {
          if (mocks.fail === operation) return { error: { message: `${operation} failed` } }
          if (operation === 'update') rows().filter(matches).forEach((row) => Object.assign(row, values))
          else if (table === 'sm_setlists') mocks.setlists = mocks.setlists.filter((row) => !matches(row))
          else mocks.members = mocks.members.filter((row) => !matches(row))
          return { error: null }
        }
        const chain = {
          eq: (column: string, value: string) => { filters[column] = value; return chain },
          then: (resolve: (result: { error: { message: string } | null }) => unknown) => Promise.resolve(run()).then(resolve),
        }
        return chain
      }
      return {
        select: () => query,
        insert: (values: Record<string, unknown>) => {
          const created = mocks.insert(table, values)
          return { select: () => ({ single: () => Promise.resolve({ data: created, error: null }) }) }
        },
        update: (values: Record<string, unknown>) => mutation('update', values),
        delete: () => mutation('delete'),
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
    await waitFor(() => expect((screen.getByRole('checkbox', { name: 'Add Moanin’ to Friday gig' }) as HTMLInputElement).disabled).toBe(false))
    await user.click(screen.getByRole('checkbox', { name: 'Add Moanin’ to Friday gig' }))
    await waitFor(() => expect(mocks.insert).toHaveBeenCalledWith('sm_setlist_pieces', {
      setlist_id: 's1', piece_id: 'p1', position: 0, placeholder: null,
    }))
    expect(await screen.findByRole('textbox', { name: 'Comment for Moanin’' })).toBeTruthy()
  })

  it('renames and manually reorders setlists, preserving order after reload', async () => {
    mocks.setlists = [{ id: 's1', name: 'Friday', position: 0 }, { id: 's2', name: 'Saturday', position: 1 }]
    const user = userEvent.setup()
    const rendered = render(<SetlistsPage lib={lib} />)
    await screen.findByRole('heading', { name: 'Friday' })
    await user.click(screen.getByRole('button', { name: 'Rename' }))
    const input = screen.getByRole('textbox', { name: 'Edit setlist name' })
    await user.clear(input)
    await user.type(input, 'Jam night')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByRole('heading', { name: 'Jam night' })
    await user.click(screen.getByRole('button', { name: 'Move setlist Jam night down' }))
    await waitFor(() => expect(mocks.setlists.find((s) => s.id === 's1')?.position).toBe(1))
    rendered.unmount()
    render(<SetlistsPage lib={lib} />)
    const sidebar = await screen.findByRole('complementary', { name: 'Your setlists' })
    await screen.findByRole('button', { name: 'Jam night' })
    const tabs = within(sidebar).getAllByRole('button').filter((button) => button.hasAttribute('aria-pressed'))
    expect(tabs.map((button) => button.textContent)).toEqual(['Saturday', 'Jam night'])
  })

  it('persists comments and repeatable placeholders with independent order', async () => {
    mocks.setlists = [{ id: 's1', name: 'Gig', position: 0 }]
    mocks.members = [{ id: 'e1', setlist_id: 's1', piece_id: 'p1', position: 0, placeholder: null, comment: null }]
    const user = userEvent.setup()
    const rendered = render(<SetlistsPage lib={lib} />)
    const comment = await screen.findByRole('textbox', { name: 'Comment for Moanin’' })
    await user.type(comment, 'Piano solo{Enter}')
    await waitFor(() => expect(mocks.members[0].comment).toBe('Piano solo'))
    const placeholder = screen.getByRole('textbox', { name: 'Placeholder' })
    await user.type(placeholder, 'Break')
    await user.click(screen.getByRole('button', { name: 'Add placeholder' }))
    await screen.findByRole('button', { name: 'Move Break up' })
    await user.type(placeholder, 'Break')
    await user.click(screen.getByRole('button', { name: 'Add placeholder' }))
    await waitFor(() => expect(mocks.members).toHaveLength(3))
    const buttons = screen.getAllByRole('button', { name: 'Move Break up' })
    await user.click(buttons[0])
    await waitFor(() => expect(mocks.members.find((entry) => entry.id === 'e2')?.position).toBe(0))
    rendered.unmount()
    render(<SetlistsPage lib={lib} />)
    const list = await screen.findByRole('list', { name: 'Tune order' })
    await waitFor(() => expect(within(list).getAllByRole('listitem')).toHaveLength(3))
    expect(within(list).getAllByRole('listitem').map((item) => item.querySelector('strong')?.textContent)).toEqual(['Break', 'Moanin’', 'Break'])
    expect((screen.getByRole('textbox', { name: 'Comment for Moanin’' }) as HTMLInputElement).value).toBe('Piano solo')
    await user.click(screen.getAllByRole('button', { name: 'Remove Break from Gig' })[0])
    await waitFor(() => expect(mocks.members).toHaveLength(2))
  })

  it('reports save errors and keeps the previous comment', async () => {
    mocks.setlists = [{ id: 's1', name: 'Gig', position: 0 }]
    mocks.members = [{ id: 'e1', setlist_id: 's1', piece_id: 'p1', position: 0, placeholder: null, comment: 'Sax solo' }]
    const user = userEvent.setup()
    render(<SetlistsPage lib={lib} />)
    const comment = await screen.findByRole('textbox', { name: 'Comment for Moanin’' }) as HTMLInputElement
    mocks.fail = 'update'
    await user.clear(comment)
    await user.type(comment, 'Piano solo{Enter}')
    expect((await screen.findByRole('alert')).textContent).toContain('update failed')
    expect(comment.value).toBe('Sax solo')
  })

  it('keeps comments specific to each setlist and allows clearing them', async () => {
    mocks.setlists = [{ id: 's1', name: 'Gig', position: 0 }, { id: 's2', name: 'Jam', position: 1 }]
    mocks.members = [
      { id: 'e1', setlist_id: 's1', piece_id: 'p1', position: 0, placeholder: null, comment: 'Piano solo' },
      { id: 'e2', setlist_id: 's2', piece_id: 'p1', position: 0, placeholder: null, comment: 'Sax solo' },
    ]
    const user = userEvent.setup()
    render(<SetlistsPage lib={lib} />)
    const first = await screen.findByRole('textbox', { name: 'Comment for Moanin’' }) as HTMLInputElement
    expect(first.value).toBe('Piano solo')
    await user.click(screen.getByRole('button', { name: 'Jam' }))
    await waitFor(() => expect((screen.getByRole('textbox', { name: 'Comment for Moanin’' }) as HTMLInputElement).value).toBe('Sax solo'))
    const second = screen.getByRole('textbox', { name: 'Comment for Moanin’' })
    await user.clear(second)
    await user.keyboard('{Enter}')
    await waitFor(() => expect(mocks.members.find((item) => item.id === 'e2')?.comment).toBeNull())
    expect(mocks.members.find((item) => item.id === 'e1')?.comment).toBe('Piano solo')
  })
})
