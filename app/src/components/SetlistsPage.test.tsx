import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Piece, PieceScore } from '../supabase'
import { SetlistsPage } from './SetlistsPage'

type Setlist = { id: string; name: string; position: number; archived_at: string | null }
type Entry = { id: string; setlist_id: string; piece_id: string | null; position: number; placeholder: string | null; comment: string | null; score_id?: string | null }

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  insert: vi.fn(),
  fail: '',
  setlists: [] as Setlist[],
  members: [] as Entry[],
  openPdf: vi.fn(),
  pdfUrl: vi.fn(),
  recordPdfPages: vi.fn(),
}))

vi.mock('../supabase', () => ({ supabase: { from: mocks.from, rpc: mocks.rpc } }))
vi.mock('./PdfViewer', () => ({
  PdfViewer: ({ url, onLoad }: { url: string; onLoad: (pages: number) => void }) => (
    <button type="button" data-url={url} onClick={() => onLoad(3)}>score</button>
  ),
}))

const piece: Piece = {
  id: 'p1', composer_id: 'c1', composer_ids: ['c1'], title: 'Moanin’', subtitle: null,
  scores: [{ id: 'sc-p1', piece_id: 'p1', pdf_path: 'u/moanin.pdf', pdf_pages: 2, musical_key: 'F minor', instrument: 'piano', lead_sheet: false, position: 0 }],
  instruments: ['piano'], musical_key: 'F minor', pdf_path: 'u/moanin.pdf', pdf_pages: 2,
  play_progress: 0, difficulty: null, rating: null, notes: null,
}
const waltz: Piece = {
  ...piece, id: 'p2', title: 'Waltz',
  scores: [{ id: 'sc-p2', piece_id: 'p2', pdf_path: 'u/waltz.pdf', pdf_pages: 1, musical_key: null, instrument: 'piano', lead_sheet: false, position: 0 }],
  musical_key: null, pdf_path: 'u/waltz.pdf', pdf_pages: 1,
}
const lib = {
  pieces: [piece, waltz],
  composerNamesOf: () => 'Bobby Timmons',
  hiddenIds: new Set<string>(),
  openPdf: mocks.openPdf,
  pdfUrl: mocks.pdfUrl,
  recordPdfPages: mocks.recordPdfPages,
}

/** Wait until the setlist entries are loaded and the picker is usable. */
async function tuneSearch() {
  const search = await screen.findByRole('searchbox', { name: 'Search tunes' })
  await waitFor(() => expect((search as HTMLInputElement).disabled).toBe(false))
  return search
}

/** Add a tune through the picker: focus the search box, then choose a result. */
async function addTune(user: ReturnType<typeof userEvent.setup>, title: string, setlistName: string) {
  await user.click(screen.getByRole('searchbox', { name: 'Search tunes' }))
  await user.click(await screen.findByRole('button', { name: `Add ${title} to ${setlistName}` }))
}

/** Click a rendered comment to open its inline editor and return the textarea. */
async function openComment(user: ReturnType<typeof userEvent.setup>, title: string) {
  await user.click(await screen.findByRole('button', { name: `Edit comment for ${title}` }))
  return await screen.findByRole('textbox', { name: `Comment for ${title}` }) as HTMLTextAreaElement
}

describe('setlists page', () => {
  beforeEach(() => {
    mocks.setlists = []
    mocks.members = []
    mocks.fail = ''
    mocks.insert.mockReset()
    mocks.insert.mockImplementation((table: string, values: Record<string, unknown>) => {
      if (table === 'sm_setlists') {
        const created = { id: `s${mocks.setlists.length + 1}`, name: String(values.name), position: Number(values.position), archived_at: null }
        mocks.setlists.push(created)
        return created
      }
      const created = { id: `e${mocks.members.length + 1}`, comment: null, score_id: null, ...values } as Entry
      mocks.members.push(created)
      return created
    })
    mocks.rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => {
      if (mocks.fail === name) return { error: { message: 'Swap failed' } }
      if (name === 'sm_reorder_setlist_entries') {
        for (const [position, id] of (args.entry_ids as string[]).entries()) {
          const entry = mocks.members.find((row) => row.id === id)
          if (entry) entry.position = position
        }
        return { error: null }
      }
      if (name === 'sm_duplicate_setlist') {
        const copy: Setlist = { id: `s${mocks.setlists.length + 1}`, name: String(args.new_name), position: mocks.setlists.length, archived_at: null }
        mocks.setlists.push(copy)
        for (const entry of mocks.members.filter((row) => row.setlist_id === args.source_id)) {
          mocks.members.push({ ...entry, id: `e${mocks.members.length + 1}`, setlist_id: copy.id })
        }
        return { data: copy.id, error: null }
      }
      const rows = name === 'sm_swap_setlists' ? mocks.setlists : mocks.members.filter((entry) => entry.setlist_id === args.list_id)
      const first = rows.find((row) => row.id === args.first_id)!
      const second = rows.find((row) => row.id === args.second_id)!
      ;[first.position, second.position] = [second.position, first.position]
      return { error: null }
    })
    mocks.openPdf.mockReset()
    mocks.pdfUrl.mockReset()
    mocks.pdfUrl.mockImplementation(async (score: PieceScore) => `https://signed.test/${score.pdf_path}`)
    mocks.recordPdfPages.mockReset()
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

  afterEach(() => { cleanup(); vi.clearAllMocks(); localStorage.clear() })

  it('creates a named setlist and adds a tune to it', async () => {
    const user = userEvent.setup()
    render(<SetlistsPage lib={lib} />)
    await user.type(screen.getByRole('textbox', { name: 'Setlist name' }), 'Friday gig')
    await user.click(screen.getByRole('button', { name: 'Create setlist' }))
    await screen.findByRole('heading', { name: 'Friday gig' })
    await tuneSearch()
    await addTune(user, 'Moanin’', 'Friday gig')
    await waitFor(() => expect(mocks.insert).toHaveBeenCalledWith('sm_setlist_pieces', {
      setlist_id: 's1', piece_id: 'p1', position: 0, placeholder: null,
    }))
    expect(await screen.findByRole('button', { name: 'Edit comment for Moanin’' })).toBeTruthy()
  })

  it('adds a tune when an iOS tap blurs the search before click', async () => {
    mocks.setlists = [{ id: 's1', name: 'Gig', position: 0, archived_at: null }]
    const user = userEvent.setup()
    render(<SetlistsPage lib={lib} />)
    const search = await tuneSearch()
    await user.type(search, 'moanin')
    const result = screen.getByRole('button', { name: 'Add Moanin’ to Gig' })
    expect(fireEvent.pointerDown(result, { pointerType: 'touch' })).toBe(true)
    fireEvent.blur(search, { relatedTarget: null })
    fireEvent.click(result)
    await waitFor(() => expect(mocks.insert).toHaveBeenCalledWith('sm_setlist_pieces', {
      setlist_id: 's1', piece_id: 'p1', position: 0, placeholder: null,
    }))

    await user.click(search)
    fireEvent.pointerDown(document.body, { pointerType: 'touch' })
    expect(screen.queryByRole('button', { name: 'Add Waltz to Gig' })).toBeNull()
  })

  it('shows the chosen tunes as removable chips', async () => {
    mocks.setlists = [{ id: 's1', name: 'Gig', position: 0, archived_at: null }]
    mocks.members = [{ id: 'e1', setlist_id: 's1', piece_id: 'p1', position: 0, placeholder: null, comment: null }]
    const user = userEvent.setup()
    render(<SetlistsPage lib={lib} />)
    await tuneSearch()
    const picker = screen.getByRole('group', { name: 'Tunes in Gig' })
    expect(await within(picker).findByText('Moanin’')).toBeTruthy()
    await user.click(within(picker).getByRole('button', { name: 'Remove Moanin’ from Gig' }))
    await waitFor(() => expect(mocks.members).toHaveLength(0))
  })

  it('filters the tune picker by title, composer and key', async () => {
    mocks.setlists = [{ id: 's1', name: 'Gig', position: 0, archived_at: null }]
    const user = userEvent.setup()
    render(<SetlistsPage lib={lib} />)
    await screen.findByRole('heading', { name: 'Gig' })
    const search = await tuneSearch()
    await user.type(search, 'F minor')
    await screen.findByRole('button', { name: 'Add Moanin’ to Gig' })
    await user.clear(search)
    await user.type(search, 'waltz')
    await screen.findByRole('button', { name: 'Add Waltz to Gig' })
    expect(screen.queryByRole('button', { name: 'Add Moanin’ to Gig' })).toBeNull()
  })

  it('renames and manually reorders setlists, preserving order after reload', async () => {
    mocks.setlists = [
      { id: 's1', name: 'Friday', position: 0, archived_at: null },
      { id: 's2', name: 'Saturday', position: 1, archived_at: null },
    ]
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
    mocks.setlists = [{ id: 's1', name: 'Gig', position: 0, archived_at: null }]
    mocks.members = [{ id: 'e1', setlist_id: 's1', piece_id: 'p1', position: 0, placeholder: null, comment: null }]
    const user = userEvent.setup()
    const rendered = render(<SetlistsPage lib={lib} />)
    const comment = await openComment(user, 'Moanin’')
    await user.type(comment, 'Piano solo')
    fireEvent.blur(comment)
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
    expect((await openComment(user, 'Moanin’')).value).toBe('Piano solo')
    await user.click(screen.getAllByRole('button', { name: 'Remove Break from Gig' })[0])
    await waitFor(() => expect(mocks.members).toHaveLength(2))
  })

  it('reorders tunes by dragging the handle with touch', async () => {
    mocks.setlists = [{ id: 's1', name: 'Gig', position: 0, archived_at: null }]
    mocks.members = [
      { id: 'e1', setlist_id: 's1', piece_id: 'p1', position: 0, placeholder: null, comment: null },
      { id: 'e2', setlist_id: 's1', piece_id: null, position: 1, placeholder: 'Break', comment: null },
      { id: 'e3', setlist_id: 's1', piece_id: null, position: 2, placeholder: 'Encore', comment: null },
    ]
    render(<SetlistsPage lib={lib} />)
    const list = await screen.findByRole('list', { name: 'Tune order' })
    await waitFor(() => expect(list.children).toHaveLength(3))
    const items = Array.from(list.children) as HTMLElement[]
    expect(items).toHaveLength(3)
    // Three 52px rows with an 8px gap so the drag has real geometry to work with.
    list.getBoundingClientRect = () => ({ top: 0 } as DOMRect)
    items.forEach((item, index) => { item.getBoundingClientRect = () => ({ top: index * 60, height: 52 } as DOMRect) })
    const handle = within(items[0]).getByRole('button', { name: 'Reorder Moanin’' })
    fireEvent.pointerDown(handle, { pointerId: 1, pointerType: 'touch', button: 0, clientY: 26 })
    fireEvent.pointerMove(handle, { pointerId: 1, pointerType: 'touch', clientY: 160 })
    fireEvent.pointerUp(handle, { pointerId: 1, pointerType: 'touch', clientY: 160 })
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith('sm_reorder_setlist_entries', { list_id: 's1', entry_ids: ['e2', 'e3', 'e1'] }))
    const updated = within(list).getAllByRole('listitem').map((item) => item.querySelector('strong')?.textContent)
    expect(updated).toEqual(['Break', 'Encore', 'Moanin’'])
  })

  it('numbers tunes only and marks placeholders distinctly', async () => {
    mocks.setlists = [{ id: 's1', name: 'Gig', position: 0, archived_at: null }]
    mocks.members = [
      { id: 'e1', setlist_id: 's1', piece_id: 'p1', position: 0, placeholder: null, comment: null },
      { id: 'e2', setlist_id: 's1', piece_id: null, position: 1, placeholder: 'Break', comment: null },
      { id: 'e3', setlist_id: 's1', piece_id: 'p2', position: 2, placeholder: null, comment: null },
    ]
    render(<SetlistsPage lib={lib} />)
    const list = await screen.findByRole('list', { name: 'Tune order' })
    await waitFor(() => expect(within(list).getAllByRole('listitem')).toHaveLength(3))
    const items = within(list).getAllByRole('listitem')
    expect(items[0].querySelector('.setlist-number')?.textContent).toBe('1')
    expect(items[1].querySelector('.setlist-number')).toBeNull()
    expect(items[1].querySelector('.setlist-marker')).toBeTruthy()
    expect(items[2].querySelector('.setlist-number')?.textContent).toBe('2')
  })

  it('reports save errors and keeps the previous comment', async () => {
    mocks.setlists = [{ id: 's1', name: 'Gig', position: 0, archived_at: null }]
    mocks.members = [{ id: 'e1', setlist_id: 's1', piece_id: 'p1', position: 0, placeholder: null, comment: 'Sax solo' }]
    const user = userEvent.setup()
    render(<SetlistsPage lib={lib} />)
    const comment = await openComment(user, 'Moanin’')
    mocks.fail = 'update'
    await user.clear(comment)
    await user.type(comment, 'Piano solo')
    fireEvent.blur(comment)
    expect((await screen.findByRole('alert')).textContent).toContain('update failed')
    expect(screen.getByText('Sax solo')).toBeTruthy()
  })

  it('keeps comments specific to each setlist and allows clearing them', async () => {
    mocks.setlists = [
      { id: 's1', name: 'Gig', position: 0, archived_at: null },
      { id: 's2', name: 'Jam', position: 1, archived_at: null },
    ]
    mocks.members = [
      { id: 'e1', setlist_id: 's1', piece_id: 'p1', position: 0, placeholder: null, comment: 'Piano solo' },
      { id: 'e2', setlist_id: 's2', piece_id: 'p1', position: 0, placeholder: null, comment: 'Sax solo' },
    ]
    const user = userEvent.setup()
    render(<SetlistsPage lib={lib} />)
    const first = await openComment(user, 'Moanin’')
    expect(first.value).toBe('Piano solo')
    fireEvent.blur(first)
    await user.click(screen.getByRole('button', { name: 'Jam' }))
    await screen.findByText('Sax solo')
    const second = await openComment(user, 'Moanin’')
    expect(second.value).toBe('Sax solo')
    await user.clear(second)
    fireEvent.blur(second)
    await waitFor(() => expect(mocks.members.find((item) => item.id === 'e2')?.comment).toBeNull())
    expect(mocks.members.find((item) => item.id === 'e1')?.comment).toBe('Piano solo')
  })

  it('duplicates a setlist with its tunes, placeholders, comments and order', async () => {
    mocks.setlists = [{ id: 's1', name: 'Gig', position: 0, archived_at: null }]
    mocks.members = [
      { id: 'e1', setlist_id: 's1', piece_id: 'p1', position: 0, placeholder: null, comment: 'Piano solo' },
      { id: 'e2', setlist_id: 's1', piece_id: null, position: 1, placeholder: 'Break', comment: null },
    ]
    const user = userEvent.setup()
    render(<SetlistsPage lib={lib} />)
    await screen.findByRole('heading', { name: 'Gig' })
    await user.click(screen.getByRole('button', { name: 'Duplicate' }))
    await screen.findByRole('heading', { name: 'Gig (copy)' })
    expect(mocks.rpc).toHaveBeenCalledWith('sm_duplicate_setlist', { source_id: 's1', new_name: 'Gig (copy)' })
    const list = await screen.findByRole('list', { name: 'Tune order' })
    await waitFor(() => expect(within(list).getAllByRole('listitem')).toHaveLength(2))
    expect(within(list).getAllByRole('listitem').map((item) => item.querySelector('strong')?.textContent)).toEqual(['Moanin’', 'Break'])
    expect((await openComment(user, 'Moanin’')).value).toBe('Piano solo')
    // The copy is a new setlist; the original is untouched.
    expect(mocks.setlists.map((item) => item.name)).toEqual(['Gig', 'Gig (copy)'])
  })

  it('numbers further copies apart', async () => {
    mocks.setlists = [
      { id: 's1', name: 'Gig', position: 0, archived_at: null },
      { id: 's2', name: 'Gig (copy)', position: 1, archived_at: null },
    ]
    const user = userEvent.setup()
    render(<SetlistsPage lib={lib} />)
    await screen.findByRole('heading', { name: 'Gig' })
    await user.click(screen.getByRole('button', { name: 'Duplicate' }))
    await screen.findByRole('heading', { name: 'Gig (copy 2)' })
  })

  it('archives a setlist, keeps it read-only and restores it', async () => {
    mocks.setlists = [{ id: 's1', name: 'Gig', position: 0, archived_at: null }]
    mocks.members = [{ id: 'e1', setlist_id: 's1', piece_id: 'p1', position: 0, placeholder: null, comment: null }]
    const user = userEvent.setup()
    render(<SetlistsPage lib={lib} />)
    await screen.findByRole('heading', { name: 'Gig' })
    await user.click(screen.getByRole('button', { name: 'Archive' }))
    await waitFor(() => expect(mocks.setlists[0].archived_at).toBeTruthy())
    expect(await screen.findByText('Archived')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Archived (1)' })).toBeTruthy()
    // Archived setlists are read-only.
    expect((screen.getByRole('searchbox', { name: 'Search tunes' }) as HTMLInputElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Add placeholder' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByRole('button', { name: 'Rename' })).toBeNull()
    // Playing an archived setlist is still allowed.
    expect((screen.getByRole('button', { name: 'Play' }) as HTMLButtonElement).disabled).toBe(false)
    await user.click(screen.getByRole('button', { name: 'Restore' }))
    await waitFor(() => expect(mocks.setlists[0].archived_at).toBeNull())
    await waitFor(() => expect((screen.getByRole('searchbox', { name: 'Search tunes' }) as HTMLInputElement).disabled).toBe(false))
  })

  it('shows tune details and opens the score from a setlist entry', async () => {
    mocks.setlists = [{ id: 's1', name: 'Gig', position: 0, archived_at: null }]
    mocks.members = [{ id: 'e1', setlist_id: 's1', piece_id: 'p1', position: 0, placeholder: null, comment: null }]
    const user = userEvent.setup()
    render(<SetlistsPage lib={lib} />)
    await screen.findByRole('heading', { name: 'Gig' })
    await tuneSearch()
    await user.click(screen.getByRole('button', { name: 'Open score for Moanin’' }))
    expect(mocks.openPdf).toHaveBeenCalledWith(piece, piece.scores?.[0])
    const toggle = screen.getByRole('button', { name: 'Show details for Moanin’' })
    await user.click(toggle)
    const details = screen.getByRole('button', { name: 'Hide details for Moanin’' }).closest('li')!
    expect(within(details).getByText('F minor')).toBeTruthy()
    expect(within(details).getByText('Bobby Timmons')).toBeTruthy()
    expect(within(details).getByText(/2 pages/)).toBeTruthy()
    expect(within(details).getByText("Can't play yet (0%)")).toBeTruthy()
    await user.click(within(details).getByRole('button', { name: 'Open score' }))
    expect(mocks.openPdf).toHaveBeenCalledTimes(2)
  })

  it('tells the player when a tune has no score attached', async () => {
    mocks.setlists = [{ id: 's1', name: 'Gig', position: 0, archived_at: null }]
    mocks.members = [{ id: 'e1', setlist_id: 's1', piece_id: 'p3', position: 0, placeholder: null, comment: null }]
    const noScore = { ...lib, pieces: [{ ...piece, id: 'p3', title: 'Unfinished Sketch', scores: [], pdf_path: null, pdf_pages: null }] }
    const user = userEvent.setup()
    render(<SetlistsPage lib={noScore} />)
    await screen.findByRole('heading', { name: 'Gig' })
    await user.click(await screen.findByRole('button', { name: 'Play' }))
    const player = await screen.findByRole('dialog', { name: 'Live mode: Gig' })
    expect(await within(player).findByText('No score attached to this tune. Attach a PDF in the library to see it on stage.')).toBeTruthy()
    expect(mocks.pdfUrl).not.toHaveBeenCalled()
  })

  it('plays a setlist in live mode and steps through the scores', async () => {
    mocks.setlists = [{ id: 's1', name: 'Gig', position: 0, archived_at: null }]
    mocks.members = [
      { id: 'e1', setlist_id: 's1', piece_id: 'p1', position: 0, placeholder: null, comment: 'Count in' },
      { id: 'e2', setlist_id: 's1', piece_id: null, position: 1, placeholder: 'Break', comment: 'Introduce the band' },
      { id: 'e3', setlist_id: 's1', piece_id: 'p2', position: 2, placeholder: null, comment: null },
    ]
    const user = userEvent.setup()
    render(<SetlistsPage lib={lib} />)
    await screen.findByRole('heading', { name: 'Gig' })
    await user.click(screen.getByRole('button', { name: 'Play' }))
    const player = await screen.findByRole('dialog', { name: 'Live mode: Gig' })
    expect(await within(player).findByText('Tune 1 of 3')).toBeTruthy()
    await waitFor(() => expect(within(player).getByRole('button', { name: 'score' }).dataset.url).toBe('https://signed.test/u/moanin.pdf'))
    expect(within(player).getByText('Count in')).toBeTruthy()
    // The placeholder is a cue card, not a score.
    await user.click(within(player).getByRole('button', { name: 'Next tune' }))
    expect(within(player).getByRole('heading', { name: 'Break' })).toBeTruthy()
    expect(within(player).getAllByText('Introduce the band').length).toBeGreaterThan(0)
    await user.click(within(player).getByRole('button', { name: 'Next tune' }))
    await waitFor(() => expect(within(player).getByRole('button', { name: 'score' }).dataset.url).toBe('https://signed.test/u/waltz.pdf'))
    expect((within(player).getByRole('button', { name: 'Next tune' }) as HTMLButtonElement).disabled).toBe(true)
    // Page counts are recorded from the player too.
    await user.click(within(player).getByRole('button', { name: 'score' }))
    expect(mocks.recordPdfPages).toHaveBeenCalledWith('sc-p2', 3)
    // Arrow keys and the jump list switch tunes; Escape leaves live mode.
    await user.keyboard('{ArrowLeft}')
    await waitFor(() => expect(within(player).getByRole('heading', { name: 'Break' })).toBeTruthy())
    await user.selectOptions(within(player).getByRole('combobox', { name: 'Jump to tune' }), '2')
    await waitFor(() => expect(within(player).getByRole('button', { name: 'score' }).dataset.url).toBe('https://signed.test/u/waltz.pdf'))
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Live mode: Gig' })).toBeNull())
  })

  it('edits multi-line comments and keeps the line breaks', async () => {
    mocks.setlists = [{ id: 's1', name: 'Gig', position: 0, archived_at: null }]
    mocks.members = [{ id: 'e1', setlist_id: 's1', piece_id: 'p1', position: 0, placeholder: null, comment: null }]
    const user = userEvent.setup()
    render(<SetlistsPage lib={lib} />)
    await screen.findByRole('heading', { name: 'Gig' })
    const field = await openComment(user, 'Moanin’')
    await user.type(field, 'Solo 1{enter}Solo 2')
    fireEvent.blur(field)
    await waitFor(() => expect(mocks.members[0].comment).toBe('Solo 1\nSolo 2'))
    const view = screen.getByRole('button', { name: 'Edit comment for Moanin’' }).closest('.setlist-comment-view')
    expect(view?.querySelector('br')).toBeTruthy()
  })

  it('renders markdown comments in the editor and in live mode', async () => {
    mocks.setlists = [{ id: 's1', name: 'Gig', position: 0, archived_at: null }]
    mocks.members = [{ id: 'e1', setlist_id: 's1', piece_id: 'p1', position: 0, placeholder: null, comment: '**Count in** with *bass*' }]
    const user = userEvent.setup()
    render(<SetlistsPage lib={lib} />)
    await screen.findByRole('heading', { name: 'Gig' })
    await screen.findByRole('button', { name: 'Edit comment for Moanin’' })
    expect(screen.getByText('Count in').tagName).toBe('STRONG')
    expect(screen.getByText('bass').tagName).toBe('EM')
    await user.click(screen.getByRole('button', { name: 'Play' }))
    const player = await screen.findByRole('dialog', { name: 'Live mode: Gig' })
    expect(within(player).getByText('Count in').tagName).toBe('STRONG')
  })

  it('moves tune notes to the top, left, right, bottom or hides them', async () => {
    mocks.setlists = [{ id: 's1', name: 'Gig', position: 0, archived_at: null }]
    mocks.members = [{ id: 'e1', setlist_id: 's1', piece_id: 'p1', position: 0, placeholder: null, comment: 'Solo on the **bridge**' }]
    const user = userEvent.setup()
    render(<SetlistsPage lib={lib} />)
    await screen.findByRole('heading', { name: 'Gig' })
    await user.click(screen.getByRole('button', { name: 'Play' }))
    const player = await screen.findByRole('dialog', { name: 'Live mode: Gig' })
    const footerNote = () => player.querySelector('.player-comment')
    const body = () => player.querySelector('.player-body') as HTMLElement
    const notesSelect = () => within(player).getByRole('combobox', { name: 'Notes position' })

    // Default: notes in the footer.
    expect(footerNote()).toBeTruthy()
    expect(within(player).queryByRole('complementary', { name: 'Tune notes' })).toBeNull()

    await user.selectOptions(notesSelect(), 'right')
    const side = await within(player).findByRole('complementary', { name: 'Tune notes' })
    expect(within(side).getByText('bridge').tagName).toBe('STRONG')
    await waitFor(() => expect(footerNote()).toBeNull())
    expect(body().className).toContain('notes-right')
    expect(localStorage.getItem('sm:player-notes')).toBe('right')

    await user.selectOptions(notesSelect(), 'left')
    await waitFor(() => expect(body().className).toContain('notes-left'))
    expect(within(player).getByRole('complementary', { name: 'Tune notes' })).toBeTruthy()

    await user.selectOptions(notesSelect(), 'top')
    await waitFor(() => expect(body().className).toContain('notes-top'))
    expect(within(player).getByRole('complementary', { name: 'Tune notes' })).toBeTruthy()

    await user.selectOptions(notesSelect(), 'bottom')
    await waitFor(() => expect(footerNote()).toBeTruthy())
    expect(within(player).queryByRole('complementary', { name: 'Tune notes' })).toBeNull()

    await user.selectOptions(notesSelect(), 'off')
    await waitFor(() => expect(footerNote()).toBeNull())
    expect(within(player).queryByRole('complementary', { name: 'Tune notes' })).toBeNull()
  })

  it('lets the player choose between a tune’s scores', async () => {
    const twoScores: Piece = {
      ...piece,
      scores: [
        { id: 'sc-a', piece_id: 'p1', pdf_path: 'u/piano.pdf', pdf_pages: 2, musical_key: 'F minor', instrument: 'piano', lead_sheet: false, position: 0 },
        { id: 'sc-b', piece_id: 'p1', pdf_path: 'u/guitar.pdf', pdf_pages: 1, musical_key: 'C major', instrument: 'guitar', lead_sheet: false, position: 1 },
      ],
    }
    mocks.setlists = [{ id: 's1', name: 'Gig', position: 0, archived_at: null }]
    mocks.members = [{ id: 'e1', setlist_id: 's1', piece_id: 'p1', position: 0, placeholder: null, comment: null }]
    const user = userEvent.setup()
    render(<SetlistsPage lib={{ ...lib, pieces: [twoScores, waltz] }} />)
    await screen.findByRole('heading', { name: 'Gig' })
    await user.click(screen.getByRole('button', { name: 'Play' }))
    const player = await screen.findByRole('dialog', { name: 'Live mode: Gig' })
    await waitFor(() => expect(within(player).getByRole('button', { name: 'score' }).dataset.url).toBe('https://signed.test/u/piano.pdf'))
    await user.selectOptions(within(player).getByRole('combobox', { name: 'Choose score' }), 'sc-b')
    await waitFor(() => expect(within(player).getByRole('button', { name: 'score' }).dataset.url).toBe('https://signed.test/u/guitar.pdf'))
  })

  it('pre-selects a score for a setlist entry and opens it in live mode', async () => {
    const twoScores: Piece = {
      ...piece,
      scores: [
        { id: 'sc-a', piece_id: 'p1', pdf_path: 'u/piano.pdf', pdf_pages: 2, musical_key: 'F minor', instrument: 'piano', lead_sheet: false, position: 0 },
        { id: 'sc-b', piece_id: 'p1', pdf_path: 'u/guitar.pdf', pdf_pages: 1, musical_key: 'C major', instrument: 'guitar', lead_sheet: false, position: 1 },
      ],
    }
    mocks.setlists = [{ id: 's1', name: 'Gig', position: 0, archived_at: null }]
    mocks.members = [{ id: 'e1', setlist_id: 's1', piece_id: 'p1', position: 0, placeholder: null, comment: null, score_id: null }]
    const user = userEvent.setup()
    render(<SetlistsPage lib={{ ...lib, pieces: [twoScores, waltz] }} />)
    await screen.findByRole('heading', { name: 'Gig' })
    const select = await screen.findByRole('combobox', { name: 'Score for Moanin’' }) as HTMLSelectElement
    // With nothing chosen yet, the first score is the effective default.
    expect(select.value).toBe('sc-a')
    await user.selectOptions(select, 'sc-b')
    await waitFor(() => expect(mocks.members[0].score_id).toBe('sc-b'))

    await user.click(screen.getByRole('button', { name: 'Play' }))
    const player = await screen.findByRole('dialog', { name: 'Live mode: Gig' })
    await waitFor(() => expect(within(player).getByRole('button', { name: 'score' }).dataset.url).toBe('https://signed.test/u/guitar.pdf'))
    // The on-stage picker can still switch to another score.
    await user.selectOptions(within(player).getByRole('combobox', { name: 'Choose score' }), 'sc-a')
    await waitFor(() => expect(within(player).getByRole('button', { name: 'score' }).dataset.url).toBe('https://signed.test/u/piano.pdf'))
  })
})
