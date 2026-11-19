import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLibrary } from '../hooks/useLibrary'
import { Library } from './Library'
import { PdfPreview } from './PdfPreview'
import { Toasts } from './Toasts'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  signedUrl: vi.fn(),
  update: vi.fn(),
  insert: vi.fn(),
  delete: vi.fn(),
  pieces: [] as Record<string, unknown>[],
  composerLinks: [] as { piece_id: string; composer_id: string; position: number }[],
}))
vi.mock('../supabase', () => ({
  supabase: {
    from: mocks.from,
    auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
    storage: { from: () => ({ createSignedUrl: mocks.signedUrl }) },
  },
}))
vi.mock('./PdfViewer', () => ({ PdfViewer: ({ url }: { url: string }) => <div>PDF content: {url}</div> }))

function TestLibrary() {
  const lib = useLibrary()
  return <><Toasts lib={lib} /><PdfPreview lib={lib} /><Library lib={lib} /></>
}

describe('focused library', () => {
  beforeEach(() => {
    localStorage.clear()
    mocks.pieces = [{ id: 'p1', composer_id: 'c1', title: 'Romance', subtitle: 'Étude', musical_key: 'C major', pdf_path: 'romance.pdf', pdf_pages: 2, instruments: ['piano'], tags: ['calm'], play_progress: 50, links: [] }]
    mocks.composerLinks = [{ piece_id: 'p1', composer_id: 'c1', position: 0 }]
    mocks.update.mockImplementation((table: string, patch: Record<string, unknown>, column: string, value: string) => {
      if (table === 'sm_pieces') mocks.pieces = mocks.pieces.map((piece) => piece[column] === value ? { ...piece, ...patch } : piece)
      if (table === 'sm_piece_composers') mocks.composerLinks = mocks.composerLinks.map((link) => link.piece_id === value ? { ...link, ...patch } : link)
    })
    mocks.insert.mockImplementation((table: string, values: Record<string, unknown> | Record<string, unknown>[]) => {
      const rows = Array.isArray(values) ? values : [values]
      if (table === 'sm_pieces') {
        const id = 'p-new'
        mocks.pieces.push({ ...rows[0], id })
        return id
      }
      if (table === 'sm_piece_composers') mocks.composerLinks.push(...rows as { piece_id: string; composer_id: string; position: number }[])
      return null
    })
    mocks.delete.mockImplementation((table: string, _column: string, value: string, ids?: string[]) => {
      if (table === 'sm_piece_composers' && ids) {
        mocks.composerLinks = mocks.composerLinks.filter((link) => link.piece_id !== value || !ids.includes(link.composer_id))
      }
    })
    mocks.signedUrl.mockResolvedValue({ data: { signedUrl: 'https://example.test/music.pdf' }, error: null })
    mocks.from.mockImplementation((table: string) => ({
      select: () => ({
        order: () => {
          const data = table === 'sm_composers'
            ? [{ id: 'c1', name: 'Clara Schumann' }, { id: 'c2', name: 'Fanny Mendelssohn' }]
            : table === 'sm_pieces'
              ? mocks.pieces
              : table === 'sm_piece_composers'
                ? mocks.composerLinks
              : []
          const result = { data, error: null }
          return Object.assign(Promise.resolve(result), { limit: () => Promise.resolve(result) })
        },
      }),
      update: (patch: unknown) => {
        const filters: Record<string, string> = {}
        const operation = {
          eq: (column: string, value: string) => { filters[column] = value; return operation },
          then: (resolve: (result: { error: null }) => unknown, reject: (error: unknown) => unknown) =>
            Promise.resolve().then(() => {
              const [column, value] = Object.entries(filters)[0]
              mocks.update(table, patch, column, value)
              return { error: null as null }
            }).then(resolve, reject),
        }
        return operation
      },
      delete: () => ({
        eq: (column: string, value: string) => ({
          in: (inColumn: string, ids: string[]) => {
            mocks.delete(table, column, value, inColumn === 'composer_id' ? ids : undefined)
            return Promise.resolve({ error: null })
          },
        }),
      }),
      insert: (values: unknown) => {
        mocks.insert(table, values)
        const id = table === 'sm_pieces' ? 'p-new' : undefined
        const result = Promise.resolve({ error: null })
        return Object.assign(result, {
          select: () => ({ single: () => Promise.resolve({ data: id ? { id } : null, error: null }) }),
        })
      },
    }))
  })

  afterEach(() => { cleanup(); vi.clearAllMocks(); localStorage.clear() })

  it('reveals piece controls and practice activity only when requested', async () => {
    const user = userEvent.setup()
    render(<TestLibrary />)
    const title = await screen.findByText('Romance', { selector: 'summary strong' })
    expect(screen.queryByRole('button', { name: /practice today/i })).toBeNull()
    expect(screen.queryByLabelText('Practice calendar')).toBeNull()

    await user.click(title)
    expect(screen.getByRole('button', { name: /practice today/i })).toBeTruthy()
    expect(screen.getByLabelText('Progress for Romance')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /view activity/i }))
    expect(screen.getByLabelText('Practice calendar')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /hide activity/i }))
    expect(screen.queryByLabelText('Practice calendar')).toBeNull()
  })

  it('keeps filters visible in the count when collapsed and supports clearing them', async () => {
    const user = userEvent.setup()
    render(<TestLibrary />)
    await screen.findByText('Romance', { selector: 'summary strong' })
    await user.click(screen.getByRole('button', { name: 'Filters' }))
    await user.click(within(screen.getByRole('group', { name: 'Filter by instrument' })).getByRole('button', { name: /guitar/i }))
    expect(screen.getByText('No pieces found')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Filters (1)' }))
    expect(screen.getByRole('button', { name: 'Filters (1)' }).getAttribute('aria-expanded')).toBe('false')
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(screen.getByText('Romance', { selector: 'summary strong' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Filters' })).toBeTruthy()
  })

  it('finds pieces by a substring and ignores accents', async () => {
    const user = userEvent.setup()
    render(<TestLibrary />)
    await screen.findByText('Romance', { selector: 'summary strong' })
    const search = screen.getByRole('textbox', { name: 'Search pieces' })

    await user.type(search, 'mance')
    expect(screen.getByText('Romance', { selector: 'summary strong' })).toBeTruthy()
    await user.clear(search)
    await user.type(search, 'etude')
    expect(screen.getByText('Romance', { selector: 'summary strong' })).toBeTruthy()
  })

  it('adds a piece with an optional subtitle and musical key', async () => {
    const user = userEvent.setup()
    render(<TestLibrary />)
    await screen.findByText('Romance', { selector: 'summary strong' })
    await user.click(screen.getByRole('button', { name: '+ Piece' }))
    await user.click(screen.getByLabelText('Clara Schumann'))
    await user.click(screen.getByLabelText('Fanny Mendelssohn'))
    await user.type(screen.getByLabelText('Title'), 'Nocturne')
    await user.type(screen.getByLabelText('Subtitle'), 'Op. 9 No. 2')
    await user.type(screen.getByLabelText('Key'), 'E-flat major')
    await user.click(screen.getByRole('button', { name: 'Add piece' }))

    await waitFor(() => expect(mocks.insert).toHaveBeenCalledWith('sm_pieces', expect.objectContaining({
      title: 'Nocturne',
      subtitle: 'Op. 9 No. 2',
      musical_key: 'E-flat major',
      composer_id: 'c1',
    })))
    expect(mocks.insert).toHaveBeenCalledWith('sm_piece_composers', [
      { piece_id: 'p-new', composer_id: 'c1', position: 0 },
      { piece_id: 'p-new', composer_id: 'c2', position: 1 },
    ])
  })

  it('respects a previously selected view and allows switching to the focused list', async () => {
    localStorage.setItem('sm:view', 'grouped')
    const user = userEvent.setup()
    render(<TestLibrary />)
    expect(await screen.findByText('Clara Schumann')).toBeTruthy()
    const view = screen.getByRole('combobox', { name: 'View' })
    expect((view as HTMLSelectElement).value).toBe('grouped')
    await user.selectOptions(view, 'list')
    expect(screen.getByText('Romance', { selector: 'summary strong' })).toBeTruthy()
    expect(localStorage.getItem('sm:view')).toBe('list')
  })

  it('opens the PDF in place and returns to the same filtered, expanded library', async () => {
    const user = userEvent.setup()
    render(<TestLibrary />)
    await screen.findByText('Romance', { selector: 'summary strong' })
    await user.type(screen.getByRole('textbox', { name: 'Search pieces' }), 'Romance')
    await user.click(screen.getByText('Romance', { selector: 'summary strong' }))
    const open = screen.getByRole('button', { name: 'Open PDF for Romance' })
    const openWindow = vi.spyOn(window, 'open')
    await user.click(open)

    expect(await screen.findByRole('dialog', { name: 'PDF: Romance' })).toBeTruthy()
    expect(await screen.findByText('PDF content: https://example.test/music.pdf')).toBeTruthy()
    expect(openWindow).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: '← Library' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect((screen.getByRole('textbox', { name: 'Search pieces' }) as HTMLInputElement).value).toBe('Romance')
    expect(screen.getByRole('button', { name: 'Open PDF for Romance' })).toBe(open)
    expect(document.activeElement).toBe(open)
    openWindow.mockRestore()
  })

  it('adds another composer to a piece', async () => {
    const user = userEvent.setup()
    render(<TestLibrary />)
    await user.click(await screen.findByText('Romance', { selector: 'summary strong' }))
    await user.click(screen.getByLabelText('Fanny Mendelssohn'))

    await waitFor(() => expect(mocks.insert).toHaveBeenCalledWith('sm_piece_composers', [{ piece_id: 'p1', composer_id: 'c2', position: 1 }]))
    await waitFor(() => expect((screen.getByLabelText('Fanny Mendelssohn') as HTMLInputElement).checked).toBe(true))
    await user.click(screen.getByLabelText('Clara Schumann'))
    await waitFor(() => {
      expect(mocks.update).toHaveBeenCalledWith('sm_pieces', { composer_id: 'c2' }, 'id', 'p1')
      expect(mocks.delete).toHaveBeenCalledWith('sm_piece_composers', 'piece_id', 'p1', ['c1'])
    })
  })

  it('updates titles with apostrophes in the piece list', async () => {
    const user = userEvent.setup()
    render(<TestLibrary />)
    await user.click(await screen.findByText('Romance', { selector: 'summary strong' }))
    await user.click(screen.getByRole('button', { name: 'Romance' }))
    const title = screen.getByRole('textbox', { name: 'Piece title' })
    await user.clear(title)
    await user.type(title, "Moanin'")
    await user.keyboard('{Enter}')

    expect(await screen.findByText("Moanin'", { selector: 'summary strong' })).toBeTruthy()
    expect(mocks.update).toHaveBeenCalledWith('sm_pieces', { title: "Moanin'" }, 'id', 'p1')
  })

  it('displays and saves a piece subtitle and key', async () => {
    const user = userEvent.setup()
    render(<TestLibrary />)
    await user.click(await screen.findByText('Romance', { selector: 'summary strong' }))
    expect(screen.getByText('Étude', { selector: '.piece-subtitle' })).toBeTruthy()
    await user.clear(screen.getByRole('textbox', { name: 'Subtitle for Romance' }))
    await user.type(screen.getByRole('textbox', { name: 'Subtitle for Romance' }), 'Op. 1')
    await user.clear(screen.getByRole('textbox', { name: 'Key for Romance' }))
    await user.type(screen.getByRole('textbox', { name: 'Key for Romance' }), 'A minor')
    await user.tab()

    await waitFor(() => {
      expect(mocks.update).toHaveBeenCalledWith('sm_pieces', { subtitle: 'Op. 1' }, 'id', 'p1')
      expect(mocks.update).toHaveBeenCalledWith('sm_pieces', { musical_key: 'A minor' }, 'id', 'p1')
    })
  })

  it('removes a piece from the library and supports undo', async () => {
    const user = userEvent.setup()
    render(<TestLibrary />)
    await user.click(await screen.findByText('Romance', { selector: 'summary strong' }))
    await user.click(screen.getByRole('button', { name: 'Remove Romance from library' }))

    expect(screen.queryByText('Romance', { selector: 'summary strong' })).toBeNull()
    expect(screen.getByText('Removed "Romance" from your library')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.getByText('Romance', { selector: 'summary strong' })).toBeTruthy()
  })

  it('does not reopen the viewer when a signed URL arrives after closing', async () => {
    let resolveUrl!: (value: { data: { signedUrl: string }; error: null }) => void
    mocks.signedUrl.mockReturnValueOnce(new Promise((resolve) => { resolveUrl = resolve }))
    const user = userEvent.setup()
    render(<TestLibrary />)
    await user.click(await screen.findByText('Romance', { selector: 'summary strong' }))
    await user.click(screen.getByRole('button', { name: 'Open PDF for Romance' }))
    expect(screen.getByRole('status').textContent).toContain('Opening PDF')
    await user.keyboard('{Escape}')
    await act(async () => { resolveUrl({ data: { signedUrl: 'https://example.test/music.pdf' }, error: null }) })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('keeps the library reachable when the PDF link cannot be created', async () => {
    mocks.signedUrl.mockResolvedValueOnce({ data: null, error: new Error('Access denied') })
    const user = userEvent.setup()
    render(<TestLibrary />)
    await user.click(await screen.findByText('Romance', { selector: 'summary strong' }))
    await user.click(screen.getByRole('button', { name: 'Open PDF for Romance' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Access denied')
    await user.click(screen.getByRole('button', { name: '← Library' }))
    expect(screen.getByRole('button', { name: 'Open PDF for Romance' })).toBeTruthy()
  })
})
