import { useState } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLibrary } from '../hooks/useLibrary'
import { Library } from './Library'
import { ComposersPage } from './ComposersPage'
import { ComposerPicker } from './ComposerPicker'
import { PdfPreview } from './PdfPreview'
import { Toasts } from './Toasts'
import { SettingsPage } from './SettingsPage'
import { DEFAULT_USER_SETTINGS } from '../lib/userSettings'
import type { UserSettings } from '../lib/userSettings'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  signedUrl: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  download: vi.fn(),
  update: vi.fn(),
  insert: vi.fn(),
  delete: vi.fn(),
  pieces: [] as Record<string, unknown>[],
  scores: [] as Record<string, unknown>[],
  composerLinks: [] as { piece_id: string; composer_id: string; position: number }[],
  materials: [] as { id: string; title: string; pdf_path: string; tags: string[] }[],
  lessons: [] as { id: string; title: string; lesson_date: string; notes: string }[],
  lessonGroups: [] as { id: string; teacher_name: string; instrument: string }[],
  preparePhoto: vi.fn(),
  photosToPdf: vi.fn(),
  scannerAvailable: vi.fn(),
  scanDocument: vi.fn(),
}))
vi.mock('../lib/photoPdf', () => ({ preparePhoto: mocks.preparePhoto, photosToPdf: mocks.photosToPdf }))
vi.mock('../lib/documentScanner', () => ({ hasDocumentScanner: mocks.scannerAvailable, scanDocument: mocks.scanDocument }))
vi.mock('../supabase', () => ({
  supabase: {
    from: mocks.from,
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u1' } } }) },
    storage: { from: () => ({ createSignedUrl: mocks.signedUrl, upload: mocks.upload, remove: mocks.remove, download: mocks.download }) },
  },
}))
vi.mock('./PdfViewer', () => ({ PdfViewer: ({ url }: { url: string }) => <div>PDF content: {url}</div> }))

function TestLibrary() {
  const lib = useLibrary()
  return <><Toasts lib={lib} /><PdfPreview lib={lib} /><Library lib={lib} /></>
}

function TestComposers() {
  const lib = useLibrary()
  return <ComposersPage lib={lib} />
}

function TestBackup() {
  const lib = useLibrary()
  return <><Toasts lib={lib} /><SettingsPage lib={lib} settings={DEFAULT_USER_SETTINGS} loadError={null} onRetry={() => {}} onSave={async () => {}} /></>
}

function TestSettings({ save }: { save: (settings: UserSettings) => Promise<void> }) {
  const [settings, setSettings] = useState(DEFAULT_USER_SETTINGS)
  const lib = useLibrary(settings)
  return <><SettingsPage lib={lib} settings={settings} loadError={null} onRetry={() => {}} onSave={async (next) => {
    await save(next)
    lib.applyDefaults(next, settings)
    setSettings(next)
  }} /><Library lib={lib} /></>
}

function TestRememberedView({ userId }: { userId: string }) {
  const lib = useLibrary(DEFAULT_USER_SETTINGS, userId)
  return <Library lib={lib} />
}

describe('focused library', () => {
  beforeEach(() => {
    mocks.scannerAvailable.mockReturnValue(false)
    vi.stubGlobal('confirm', vi.fn(() => true))
    localStorage.clear()
    mocks.pieces = [{ id: 'p1', composer_id: 'c1', title: 'Romance', subtitle: 'Étude', tags: ['calm'], play_progress: 50, links: [] }]
    mocks.scores = [{ id: 's1', piece_id: 'p1', pdf_path: 'romance.pdf', pdf_pages: 2, musical_key: 'C major', instrument: 'piano', lead_sheet: false, tags: ['piano'], position: 0 }]
    mocks.composerLinks = [{ piece_id: 'p1', composer_id: 'c1', position: 0 }]
    mocks.materials = []
    mocks.lessons = []
    mocks.lessonGroups = []
    mocks.update.mockImplementation((table: string, patch: Record<string, unknown>, column: string, value: string) => {
      if (table === 'sm_pieces') mocks.pieces = mocks.pieces.map((piece) => piece[column] === value ? { ...piece, ...patch } : piece)
      if (table === 'sm_piece_scores') mocks.scores = mocks.scores.map((score) => score[column] === value ? { ...score, ...patch } : score)
      if (table === 'sm_piece_composers') mocks.composerLinks = mocks.composerLinks.map((link) => link.piece_id === value ? { ...link, ...patch } : link)
    })
    mocks.insert.mockImplementation((table: string, values: Record<string, unknown> | Record<string, unknown>[]) => {
      const rows = Array.isArray(values) ? values : [values]
      if (table === 'sm_pieces') {
        const id = 'p-new'
        mocks.pieces.push({ ...rows[0], id })
        return id
      }
      if (table === 'sm_piece_scores') mocks.scores.push(...rows.map((row, index) => ({ id: `sc-new-${mocks.scores.length + index}`, ...row })))
      if (table === 'sm_piece_composers') mocks.composerLinks.push(...rows as { piece_id: string; composer_id: string; position: number }[])
      return null
    })
    mocks.delete.mockImplementation((table: string, _column: string, value: string, ids?: string[]) => {
      if (table === 'sm_piece_scores') mocks.scores = mocks.scores.filter((score) => score.id !== value)
      if (table === 'sm_piece_composers' && ids) {
        mocks.composerLinks = mocks.composerLinks.filter((link) => link.piece_id !== value || !ids.includes(link.composer_id))
      }
    })
    mocks.signedUrl.mockResolvedValue({ data: { signedUrl: 'https://example.test/music.pdf' }, error: null })
    mocks.upload.mockResolvedValue({ error: null })
    mocks.remove.mockResolvedValue({ error: null })
    mocks.download.mockResolvedValue({ data: new Blob(['%PDF-1.4'], { type: 'application/pdf' }), error: null })
    mocks.from.mockImplementation((table: string) => ({
      select: () => {
        const data = table === 'sm_composers'
          ? [{ id: 'c1', name: 'Clara Schumann' }, { id: 'c2', name: 'Fanny Mendelssohn' }]
          : table === 'sm_pieces'
            ? mocks.pieces
            : table === 'sm_piece_composers'
              ? mocks.composerLinks
              : table === 'sm_piece_scores'
                ? mocks.scores
                : table === 'sm_teaching_materials'
                  ? mocks.materials
                  : table === 'sm_lessons'
                    ? mocks.lessons
                  : table === 'sm_lesson_groups'
                    ? mocks.lessonGroups
                : []
        const result = { data, error: null }
        const promise = Promise.resolve(result)
        const withLimit = Object.assign(promise, { limit: () => promise })
        return Object.assign(promise, { order: () => withLimit, limit: () => promise })
      },
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
          then: (resolve: (result: { error: null }) => unknown) =>
            Promise.resolve().then(() => {
              mocks.delete(table, column, value)
              return { error: null as null }
            }).then(resolve),
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

  afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); localStorage.clear() })

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

  it('filters pieces by score tags and piece tags in the same tag filter', async () => {
    mocks.pieces = [
      { id: 'p1', composer_id: 'c1', title: 'Score match', tags: ['calm'], play_progress: 0 },
      { id: 'p2', composer_id: 'c1', title: 'Piece match', tags: ['solo'], play_progress: 0 },
      { id: 'p3', composer_id: 'c1', title: 'No match', tags: [], play_progress: 0 },
    ]
    mocks.scores = [
      { id: 's1', piece_id: 'p1', pdf_path: 'one.pdf', tags: ['piano'], position: 0 },
      { id: 's2', piece_id: 'p1', pdf_path: 'two.pdf', tags: ['solo', 'duet'], position: 1 },
    ]
    const user = userEvent.setup()
    render(<TestLibrary />)
    await screen.findByText('Score match', { selector: 'summary strong' })
    await user.click(screen.getByRole('button', { name: 'Filters' }))
    const tags = screen.getByRole('group', { name: 'Filter by tag' })
    expect(within(tags).getAllByRole('button', { name: '#solo' })).toHaveLength(1)
    expect(within(tags).getByRole('button', { name: '#duet' })).toBeTruthy()
    await user.click(within(tags).getByRole('button', { name: '#solo' }))
    expect(screen.getByText('Score match', { selector: 'summary strong' })).toBeTruthy()
    expect(screen.getByText('Piece match', { selector: 'summary strong' })).toBeTruthy()
    expect(screen.queryByText('No match', { selector: 'summary strong' })).toBeNull()
    await user.click(within(tags).getByRole('button', { name: '#duet' }))
    expect(screen.getByText('Score match', { selector: 'summary strong' })).toBeTruthy()
    expect(screen.queryByText('Piece match', { selector: 'summary strong' })).toBeNull()
    await user.click(within(tags).getByRole('button', { name: 'All tags' }))
    expect(screen.getByText('No match', { selector: 'summary strong' })).toBeTruthy()
  })

  it('filters missing links, scores, score keys and score tags independently', async () => {
    mocks.pieces = [
      { id: 'p1', composer_id: 'c1', title: 'No score or music', play_progress: 0, links: [] },
      { id: 'p2', composer_id: 'c1', title: 'YouTube only', play_progress: 0, links: [{ type: 'youtube', url: 'https://youtube.com/watch?v=1' }] },
      { id: 'p3', composer_id: 'c1', title: 'Spotify complete', play_progress: 0, links: [{ type: 'spotify', url: 'https://open.spotify.com/track/1' }] },
      { id: 'p4', composer_id: 'c1', title: 'Missing key', play_progress: 0, links: [{ type: 'instagram', url: 'https://instagram.com/example' }] },
      { id: 'p5', composer_id: 'c1', title: 'Missing tags', play_progress: 0, links: [{ type: 'youtube', url: 'https://youtube.com/watch?v=2' }] },
      { id: 'p6', composer_id: 'c1', title: 'Mixed scores', play_progress: 100, links: [{ type: 'spotify', url: 'https://open.spotify.com/track/2' }] },
      { id: 'p7', composer_id: 'c1', title: 'Invalid music link', play_progress: 0, links: [{ type: 'youtube', url: 'javascript:alert(1)' }] },
    ]
    mocks.scores = [
      { id: 's3', piece_id: 'p3', pdf_path: '3.pdf', musical_key: 'C major', tags: ['piano'], position: 0 },
      { id: 's4', piece_id: 'p4', pdf_path: '4.pdf', musical_key: ' ', tags: ['guitar'], position: 0 },
      { id: 's5', piece_id: 'p5', pdf_path: '5.pdf', musical_key: 'C major', tags: [], position: 0 },
      { id: 's6a', piece_id: 'p6', pdf_path: '6a.pdf', musical_key: 'C major', tags: ['piano'], position: 0 },
      { id: 's6b', piece_id: 'p6', pdf_path: '6b.pdf', musical_key: null, tags: [], position: 1 },
      { id: 's7', piece_id: 'p7', pdf_path: '7.pdf', musical_key: 'C major', tags: ['piano'], position: 0 },
    ]
    const user = userEvent.setup()
    render(<TestLibrary />)
    await screen.findByText('No score or music', { selector: 'summary strong' })
    await user.click(screen.getByRole('button', { name: 'Filters' }))
    const missing = screen.getByRole('group', { name: 'Filter missing data' })
    const shown = () => screen.queryAllByText(/.*/, { selector: 'summary strong' }).map((element) => element.textContent).sort()

    await user.click(within(missing).getByRole('button', { name: 'No YouTube or Spotify' }))
    expect(shown()).toEqual(['Invalid music link', 'Missing key', 'No score or music'])
    expect(screen.getByRole('button', { name: 'Filters (1)' })).toBeTruthy()
    await user.click(within(missing).getByRole('button', { name: 'No scores' }))
    expect(shown()).toEqual(['No score or music', 'YouTube only'])
    await user.click(within(missing).getByRole('button', { name: 'Score missing key' }))
    expect(shown()).toEqual(['Missing key', 'Mixed scores'])
    await user.click(within(missing).getByRole('button', { name: 'Score missing tags' }))
    expect(shown()).toEqual(['Missing tags', 'Mixed scores'])
    await user.click(within(screen.getByRole('group', { name: 'Filter pieces' })).getByRole('button', { name: 'Can fully play (100%)' }))
    expect(shown()).toEqual(['Mixed scores'])
    expect(screen.getByRole('button', { name: 'Filters (2)' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(shown()).toHaveLength(7)
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

  it('adds a piece with an optional subtitle and a score', async () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'uuid-1' })
    mocks.scores[0].tags = ['piano', 'duet']
    const user = userEvent.setup()
    render(<TestLibrary />)
    await screen.findByText('Romance', { selector: 'summary strong' })
    await user.click(screen.getByRole('button', { name: '+ Piece' }))
    const composerSearch = screen.getByRole('searchbox', { name: 'Search composers for new piece' })
    await user.type(composerSearch, 'schum')
    await user.keyboard('{Enter}')
    expect(screen.getByRole('button', { name: 'Delete composer Clara Schumann' })).toBeTruthy()
    await user.type(composerSearch, 'FANNY')
    await user.click(screen.getByRole('button', { name: 'Fanny Mendelssohn' }))
    expect(screen.getByRole('button', { name: 'Delete composer Fanny Mendelssohn' })).toBeTruthy()
    await user.type(screen.getByLabelText('Title'), 'Nocturne')
    await user.type(screen.getByLabelText('Subtitle'), 'Op. 9 No. 2')
    await user.upload(screen.getByLabelText('PDF score (optional)'), new File(['x'], 'nocturne.pdf', { type: 'application/pdf' }))
    await user.selectOptions(screen.getByLabelText('Key'), 'Eb major')
    const newScoreTags = screen.getByRole('group', { name: 'Tags for the new score' })
    await user.click(within(newScoreTags).getByRole('button', { name: 'Lead sheet' }))
    await user.selectOptions(within(newScoreTags).getByRole('combobox', { name: /choose existing tag/i }), 'duet')
    await user.click(screen.getByRole('button', { name: 'Add piece' }))

    await waitFor(() => expect(mocks.insert).toHaveBeenCalledWith('sm_pieces', expect.objectContaining({
      title: 'Nocturne',
      subtitle: 'Op. 9 No. 2',
      composer_id: 'c1',
    })))
    await waitFor(() => expect(mocks.insert).toHaveBeenCalledWith('sm_piece_scores', expect.objectContaining({
      piece_id: 'p-new',
      pdf_path: 'u1/uuid-1.pdf',
      musical_key: 'Eb major',
      tags: ['piano', 'lead sheet', 'duet'],
    })))
    expect(mocks.insert).toHaveBeenCalledWith('sm_piece_composers', [
      { piece_id: 'p-new', composer_id: 'c1', position: 0 },
      { piece_id: 'p-new', composer_id: 'c2', position: 1 },
    ])
  })

  it('uploads camera photos as the new piece score PDF', async () => {
    vi.stubGlobal('URL', Object.assign(class extends URL {}, { createObjectURL: vi.fn(() => 'blob:photo'), revokeObjectURL: vi.fn() }))
    const pdf = new File(['pdf'], 'camera-scan.pdf', { type: 'application/pdf' })
    mocks.preparePhoto.mockResolvedValueOnce({ id: 'one', jpeg: new Blob(['jpeg']), width: 10, height: 20 })
    mocks.photosToPdf.mockResolvedValueOnce(pdf)
    const user = userEvent.setup()
    render(<TestLibrary />)
    await screen.findByText('Romance', { selector: 'summary strong' })
    await user.click(screen.getByRole('button', { name: '+ Piece' }))
    await user.type(screen.getByRole('searchbox', { name: 'Search composers for new piece' }), 'clara{Enter}')
    await user.type(screen.getByLabelText('Title'), 'Camera score')
    fireEvent.change(screen.getByLabelText('Camera photo'), { target: { files: [new File(['photo'], 'one.jpg', { type: 'image/jpeg' })] } })
    await screen.findByText('1 photo in PDF')
    await user.click(screen.getByRole('button', { name: 'Add piece' }))
    await waitFor(() => expect(mocks.upload).toHaveBeenCalledWith(expect.stringMatching(/\.pdf$/), pdf, { contentType: 'application/pdf' }))
  })

  it('uploads a scanned PDF as a score for an existing piece', async () => {
    mocks.scannerAvailable.mockReturnValue(true)
    const pdf = new File(['%PDF-'], 'document-scan.pdf', { type: 'application/pdf' })
    mocks.scanDocument.mockResolvedValueOnce(pdf)
    const user = userEvent.setup()
    render(<TestLibrary />)
    await user.click(await screen.findByText('Romance', { selector: 'summary strong' }))
    await user.click(screen.getByRole('button', { name: '+ Add score' }))
    await user.click(screen.getByRole('button', { name: 'Scan document' }))
    await screen.findByText('document-scan.pdf')
    await user.click(screen.getByRole('button', { name: 'Add score' }))
    await waitFor(() => expect(mocks.upload).toHaveBeenCalledWith(expect.stringMatching(/\.pdf$/), pdf, { contentType: 'application/pdf' }))
  })

  it('saves a new piece only once while the save is pending', async () => {
    const user = userEvent.setup()
    render(<TestLibrary />)
    await screen.findByText('Romance', { selector: 'summary strong' })
    await user.click(screen.getByRole('button', { name: '+ Piece' }))
    await user.type(screen.getByRole('searchbox', { name: 'Search composers for new piece' }), 'clara{Enter}')

    let resolveInsert!: (value: { data: { id: string }; error: null }) => void
    mocks.from.mockImplementationOnce(() => ({
      insert: (values: unknown) => {
        mocks.insert('sm_pieces', values)
        return { select: () => ({ single: () => new Promise((resolve) => { resolveInsert = resolve }) }) }
      },
    }))

    const title = "Café´'s Waltz"
    await user.type(screen.getByLabelText('Title'), title)
    const add = screen.getByRole('button', { name: 'Add piece' })
    await user.click(add)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Saving…' })).toBeTruthy())
    expect((screen.getByRole('button', { name: 'Saving…' }) as HTMLButtonElement).disabled).toBe(true)
    // Even a programmatic resubmit must not create a second piece.
    fireEvent.submit(add.closest('form')!)
    const pieceInserts = mocks.insert.mock.calls.filter(([table]) => table === 'sm_pieces')
    expect(pieceInserts).toHaveLength(1)
    expect(pieceInserts[0][1]).toEqual(expect.objectContaining({ title }))

    await act(async () => resolveInsert({ data: { id: 'p-new' }, error: null }))
    await waitFor(() => expect(screen.queryByLabelText('Title')).toBeNull())
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

  it('switches between a piece’s scores in the viewer', async () => {
    mocks.scores = [
      { id: 's1', piece_id: 'p1', pdf_path: 'romance.pdf', pdf_pages: 2, musical_key: 'C major', instrument: 'piano', tags: ['piano'], position: 0 },
      { id: 's2', piece_id: 'p1', pdf_path: 'romance-guitar.pdf', pdf_pages: 1, musical_key: 'A minor', instrument: 'guitar', lead_sheet: false, tags: ['guitar'], position: 1 },
    ]
    mocks.signedUrl.mockImplementation(async (path: string) => ({ data: { signedUrl: `https://example.test/${path}` }, error: null }))
    const user = userEvent.setup()
    render(<TestLibrary />)
    await user.click(await screen.findByText('Romance', { selector: 'summary strong' }))
    await user.click(screen.getByRole('button', { name: 'Open PDF for Romance' }))
    const dialog = await screen.findByRole('dialog', { name: 'PDF: Romance' })
    expect(await within(dialog).findByText('PDF content: https://example.test/romance.pdf')).toBeTruthy()

    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Choose score' }), 's2')
    expect(await within(dialog).findByText('PDF content: https://example.test/romance-guitar.pdf')).toBeTruthy()
  })

  it('adds another composer to a piece', async () => {
    const user = userEvent.setup()
    render(<TestLibrary />)
    await user.click(await screen.findByText('Romance', { selector: 'summary strong' }))
    const composerSearch = screen.getByRole('searchbox', { name: 'Search composers for romance' })
    expect((screen.getByRole('button', { name: 'Delete composer Clara Schumann' }) as HTMLButtonElement).disabled).toBe(true)
    await user.type(composerSearch, 'mendels')
    await user.click(screen.getByRole('button', { name: 'Fanny Mendelssohn' }))

    await waitFor(() => expect(mocks.insert).toHaveBeenCalledWith('sm_piece_composers', [{ piece_id: 'p1', composer_id: 'c2', position: 1 }]))
    await waitFor(() => expect((screen.getByRole('button', { name: 'Delete composer Clara Schumann' }) as HTMLButtonElement).disabled).toBe(false))
    expect(screen.getByRole('button', { name: 'Delete composer Fanny Mendelssohn' })).toBeTruthy()
    vi.mocked(window.confirm).mockReturnValueOnce(false)
    await user.click(screen.getByRole('button', { name: 'Delete composer Clara Schumann' }))
    expect(window.confirm).toHaveBeenLastCalledWith('Delete composer "Clara Schumann" from Composers for Romance? The original composer will be kept.')
    expect(mocks.delete).not.toHaveBeenCalledWith('sm_piece_composers', 'piece_id', 'p1', ['c1'])
    await user.click(screen.getByRole('button', { name: 'Delete composer Clara Schumann' }))
    await waitFor(() => {
      expect(mocks.update).toHaveBeenCalledWith('sm_pieces', { composer_id: 'c2' }, 'id', 'p1')
      expect(mocks.delete).toHaveBeenCalledWith('sm_piece_composers', 'piece_id', 'p1', ['c1'])
    })
    await waitFor(() => expect((screen.getByRole('button', { name: 'Delete composer Fanny Mendelssohn' }) as HTMLButtonElement).disabled).toBe(true))
  })

  it('only suggests unselected composers and allows removing them from a new piece', async () => {
    const user = userEvent.setup()
    render(<TestLibrary />)
    await screen.findByText('Romance', { selector: 'summary strong' })
    await user.click(screen.getByRole('button', { name: '+ Piece' }))
    const search = screen.getByRole('searchbox', { name: 'Search composers for new piece' })
    await user.type(search, 'clara{Enter}')
    await user.type(search, 'clara')
    expect(screen.getByText('No matching composers')).toBeTruthy()
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: 'Delete composer Clara Schumann' }))
    await user.type(search, 'clara')
    expect(screen.getByRole('button', { name: 'Clara Schumann' })).toBeTruthy()
  })

  it('selects a composer when an iOS tap blurs the search before click', async () => {
    const user = userEvent.setup()
    render(<TestLibrary />)
    await screen.findByText('Romance', { selector: 'summary strong' })
    await user.click(screen.getByRole('button', { name: '+ Piece' }))
    const search = screen.getByRole('searchbox', { name: 'Search composers for new piece' })
    await user.type(search, 'clara')
    const result = screen.getByRole('button', { name: 'Clara Schumann' })
    expect(fireEvent.pointerDown(result, { pointerType: 'touch' })).toBe(true)
    fireEvent.blur(search, { relatedTarget: null })
    fireEvent.click(result)
    expect(await screen.findByRole('button', { name: 'Delete composer Clara Schumann' })).toBeTruthy()

    await user.type(search, 'fanny')
    fireEvent.pointerDown(document.body, { pointerType: 'touch' })
    expect(screen.queryByRole('button', { name: 'Fanny Mendelssohn' })).toBeNull()

    await user.type(search, 'fanny')
    fireEvent.blur(search, { relatedTarget: screen.getByPlaceholderText('Piece title') })
    expect(screen.queryByRole('button', { name: 'Fanny Mendelssohn' })).toBeNull()
  })

  it('prevents overlapping composer edits while a save is pending', async () => {
    let finish!: () => void
    const save = vi.fn(() => new Promise<void>((resolve) => { finish = resolve }))
    const user = userEvent.setup()
    render(<ComposerPicker composers={[
      { id: 'c1', name: 'Clara Schumann', born_year: null, died_year: null, notes: null },
      { id: 'c2', name: 'Fanny Mendelssohn', born_year: null, died_year: null, notes: null },
    ]} selectedIds={['c1']} label="Composers for Romance" onChange={save} />)
    const search = screen.getByRole('searchbox', { name: 'Search composers for romance' })
    await user.type(search, 'fanny{Enter}')
    expect(save).toHaveBeenCalledWith(['c1', 'c2'])
    expect((search as HTMLInputElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Delete composer Clara Schumann' }) as HTMLButtonElement).disabled).toBe(true)
    await act(async () => finish())
    expect((search as HTMLInputElement).disabled).toBe(false)
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

  it('displays and saves a piece subtitle and score key', async () => {
    const user = userEvent.setup()
    render(<TestLibrary />)
    await user.click(await screen.findByText('Romance', { selector: 'summary strong' }))
    expect(screen.getByText('Étude', { selector: '.piece-subtitle' })).toBeTruthy()
    await user.clear(screen.getByRole('textbox', { name: 'Subtitle for Romance' }))
    await user.type(screen.getByRole('textbox', { name: 'Subtitle for Romance' }), 'Op. 1')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Key for score 1 of Romance' }), 'A minor')

    await waitFor(() => {
      expect(mocks.update).toHaveBeenCalledWith('sm_pieces', { subtitle: 'Op. 1' }, 'id', 'p1')
      expect(mocks.update).toHaveBeenCalledWith('sm_piece_scores', { musical_key: 'A minor' }, 'id', 's1')
    })
  })

  it('offers twelve major and twelve minor keys and retains legacy values', async () => {
    mocks.scores[0].musical_key = 'E-flat major'
    const user = userEvent.setup()
    render(<TestLibrary />)
    await user.click(await screen.findByText('Romance', { selector: 'summary strong' }))
    const key = screen.getByRole('combobox', { name: 'Key for score 1 of Romance' }) as HTMLSelectElement
    expect(key.value).toBe('E-flat major')
    expect(mocks.update).not.toHaveBeenCalled()
    expect(Array.from(within(key).getByRole('group', { name: 'Major' }).querySelectorAll('option'), (option) => option.value))
      .toEqual(['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'].map((note) => `${note} major`))
    expect(Array.from(within(key).getByRole('group', { name: 'Minor' }).querySelectorAll('option'), (option) => option.value))
      .toEqual(['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'].map((note) => `${note} minor`))
    await user.selectOptions(key, '')
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith('sm_piece_scores', { musical_key: null }, 'id', 's1'))
    await waitFor(() => expect(key.value).toBe(''))
  })

  it('downloads a zip backup of the data and scores', async () => {
    mocks.materials = [{ id: 'm1', title: 'Chord theory', pdf_path: 'u1/materials/chords.pdf', tags: ['harmony'] }]
    mocks.lessons = [{ id: 'l1', title: 'Guitar lesson', lesson_date: '2026-11-18', notes: '# Practice' }]
    mocks.lessonGroups = [{ id: 'g1', teacher_name: 'Alex', instrument: 'guitar' }]
    const createObjectURL = vi.fn((_blob: Blob) => 'blob:backup')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const user = userEvent.setup()
    render(<TestBackup />)
    await screen.findByRole('heading', { name: 'Settings' })
    await user.click(screen.getByRole('button', { name: 'Download backup' }))

    await waitFor(() => expect(mocks.download).toHaveBeenCalledWith('romance.pdf'))
    await waitFor(() => expect(mocks.download).toHaveBeenCalledWith('u1/materials/chords.pdf'))
    expect(click).toHaveBeenCalled()
    const blob = createObjectURL.mock.calls[0][0]
    expect(blob.type).toBe('application/zip')
    const text = new TextDecoder().decode(new Uint8Array(await blob.arrayBuffer()))
    expect(text).toContain('data.json')
    expect(text).toContain('scores/Romance - Piano · C major (s1).pdf')
    expect(text).toContain('teaching-materials/Chord theory (m1).pdf')
    expect(text).toContain('"harmony"')
    expect(text).toContain('Guitar lesson')
    expect(text).toContain('"teacher_name": "Alex"')
    expect(await screen.findByText('Backup downloaded.')).toBeTruthy()
  })

  it('applies saved library defaults without preventing temporary filter changes', async () => {
    mocks.pieces = [
      { id: 'p1', composer_id: 'c1', title: 'Older', play_progress: 100, difficulty: 4, created_at: '2025-01-01', links: [] },
      { id: 'p2', composer_id: 'c1', title: 'Newer', play_progress: 100, difficulty: 5, created_at: '2026-01-01', links: [] },
      { id: 'p3', composer_id: 'c1', title: 'Excluded', play_progress: 0, difficulty: 5, created_at: '2026-02-01', links: [] },
    ]
    mocks.scores = mocks.pieces.map((piece) => ({ id: `s-${piece.id}`, piece_id: piece.id, pdf_path: 'score.pdf', instrument: 'piano', tags: ['piano'], position: 0 }))
    const save = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<TestSettings save={save} />)
    await screen.findByText('Older', { selector: 'summary strong' })
    await user.selectOptions(screen.getByLabelText('Default view'), 'table')
    await user.selectOptions(screen.getByLabelText('Default sort'), 'recent')
    await user.selectOptions(screen.getByLabelText('Default filter'), 'can_play')
    await user.selectOptions(screen.getByLabelText('Default instrument'), 'piano')
    await user.click(screen.getByRole('button', { name: 'Save settings' }))
    await screen.findByText('Settings saved.')
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ library_view: 'table', library_sort: 'recent', library_filter: 'can_play', library_instrument: 'piano' }))
    const rows = within(screen.getByRole('table')).getAllByRole('row')
    expect(rows).toHaveLength(3)
    expect(rows[1].textContent).toContain('Newer')
    expect(rows[2].textContent).toContain('Older')
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(4)
  })

  it('reports a failed settings save without applying its defaults', async () => {
    const user = userEvent.setup()
    render(<TestSettings save={vi.fn().mockRejectedValue(new Error('Offline'))} />)
    await screen.findByText('Romance', { selector: 'summary strong' })
    await user.selectOptions(screen.getByLabelText('Default view'), 'table')
    await user.click(screen.getByRole('button', { name: 'Save settings' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Offline')
    expect(screen.getByLabelText('View')).toHaveProperty('value', 'list')
  })

  it('remembers each user’s last library view separately on the device', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<TestRememberedView key="user-1" userId="user-1" />)
    await user.selectOptions(await screen.findByLabelText('View'), 'grid')
    rerender(<TestRememberedView key="user-2" userId="user-2" />)
    expect(screen.getByLabelText('View')).toHaveProperty('value', 'list')
    await user.selectOptions(screen.getByLabelText('View'), 'table')
    rerender(<TestRememberedView key="user-1" userId="user-1" />)
    expect(screen.getByLabelText('View')).toHaveProperty('value', 'grid')
  })

  it('combines and removes independent score tags, including custom tags', async () => {
    const user = userEvent.setup()
    render(<TestLibrary />)
    await user.click(await screen.findByText('Romance', { selector: 'summary strong' }))
    const group = () => screen.getByRole('group', { name: 'Tags for score 1 of Romance' })
    await user.click(within(group()).getByRole('button', { name: 'Lead sheet' }))
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith('sm_piece_scores', { tags: ['piano', 'lead sheet'] }, 'id', 's1'))
    await waitFor(() => expect(within(group()).getByRole('button', { name: 'Lead sheet' }).getAttribute('aria-pressed')).toBe('true'))
    await user.click(within(group()).getByRole('button', { name: 'Solo' }))
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith('sm_piece_scores', { tags: ['piano', 'lead sheet', 'solo'] }, 'id', 's1'))
    await user.type(within(group()).getByRole('textbox', { name: 'Add tag' }), 'Duet{Enter}')
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith('sm_piece_scores', { tags: ['piano', 'lead sheet', 'solo', 'duet'] }, 'id', 's1'))
    await user.click(within(group()).getByRole('button', { name: 'Piano' }))
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith('sm_piece_scores', { tags: ['lead sheet', 'solo', 'duet'] }, 'id', 's1'))
    await user.click(within(group()).getByRole('button', { name: 'Lead sheet' }))
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith('sm_piece_scores', { tags: ['solo', 'duet'] }, 'id', 's1'))
    await user.click(within(group()).getByRole('button', { name: 'Solo' }))
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith('sm_piece_scores', { tags: ['duet'] }, 'id', 's1'))
    await user.click(within(group()).getByRole('button', { name: 'Delete tag duet' }))
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith('sm_piece_scores', { tags: [] }, 'id', 's1'))
  })

  it('filters a score with multiple instruments by either instrument and searches its custom tags', async () => {
    mocks.scores[0].tags = ['piano', 'guitar', 'solo', 'duet']
    const user = userEvent.setup()
    render(<TestLibrary />)
    await screen.findByText('Romance', { selector: 'summary strong' })
    await user.click(screen.getByRole('button', { name: 'Filters' }))
    const filters = screen.getByRole('group', { name: 'Filter by instrument' })
    await user.click(within(filters).getByRole('button', { name: /guitar/i }))
    expect(screen.getByText('Romance', { selector: 'summary strong' })).toBeTruthy()
    await user.click(within(filters).getByRole('button', { name: /piano/i }))
    expect(screen.getByText('Romance', { selector: 'summary strong' })).toBeTruthy()
    await user.type(screen.getByRole('textbox', { name: 'Search pieces' }), 'duet')
    expect(screen.getByText('Romance', { selector: 'summary strong' })).toBeTruthy()
  })

  it('lets an existing score select an already-used custom tag', async () => {
    mocks.scores.push({
      id: 's2', piece_id: 'p1', pdf_path: 'other.pdf', pdf_pages: 1, musical_key: null,
      instrument: 'guitar', lead_sheet: false, tags: ['guitar', 'duet'], position: 1,
    })
    const user = userEvent.setup()
    render(<TestLibrary />)
    await user.click(await screen.findByText('Romance', { selector: 'summary strong' }))
    const group = () => screen.getByRole('group', { name: 'Tags for score 1 of Romance' })
    const picker = within(group()).getByRole('combobox', { name: /choose existing tag/i })
    expect(within(picker).getByRole('option', { name: 'duet' })).toBeTruthy()
    expect(within(picker).queryByRole('option', { name: 'guitar' })).toBeNull()
    await user.selectOptions(picker, 'duet')
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith('sm_piece_scores', { tags: ['piano', 'duet'] }, 'id', 's1'))
    await waitFor(() => expect(within(group()).queryByRole('combobox', { name: /choose existing tag/i })).toBeNull())
  })

  it('adds and removes scores on a piece', async () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'uuid-2' })
    const user = userEvent.setup()
    render(<TestLibrary />)
    await user.click(await screen.findByText('Romance', { selector: 'summary strong' }))
    expect(screen.getByRole('combobox', { name: 'Key for score 1 of Romance' })).toBeTruthy()

    await user.click(screen.getByRole('button', { name: '+ Add score' }))
    await user.upload(screen.getByLabelText('PDF for Romance'), new File(['x'], 'guitar.pdf', { type: 'application/pdf' }))
    await user.selectOptions(screen.getByLabelText('Key for new score of Romance'), 'C major')
    const group = screen.getByRole('group', { name: 'Tags for new score of Romance' })
    await user.click(within(group).getByRole('button', { name: 'Piano' }))
    await user.click(within(group).getByRole('button', { name: 'Guitar' }))
    await user.click(within(group).getByRole('button', { name: 'Solo' }))
    await user.click(screen.getByRole('button', { name: 'Add score' }))

    await waitFor(() => expect(mocks.insert).toHaveBeenCalledWith('sm_piece_scores', expect.objectContaining({
      piece_id: 'p1', pdf_path: 'u1/uuid-2.pdf', musical_key: 'C major', tags: ['guitar', 'solo'], position: 1,
    })))
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Key for score 2 of Romance' })).toBeTruthy())

    vi.mocked(window.confirm).mockReturnValueOnce(false)
    await user.click(screen.getByRole('button', { name: 'Delete score 2 for Romance' }))
    expect(mocks.delete).not.toHaveBeenCalledWith('sm_piece_scores', 'id', 'sc-new-1')
    await user.click(screen.getByRole('button', { name: 'Delete score 2 for Romance' }))
    expect(window.confirm).toHaveBeenLastCalledWith('Delete this score for "Romance"? Its PDF will also be deleted. Setlists using it will no longer reference it.')
    await waitFor(() => expect(mocks.delete).toHaveBeenCalledWith('sm_piece_scores', 'id', 'sc-new-1'))
    await waitFor(() => expect(screen.queryByRole('combobox', { name: 'Key for score 2 of Romance' })).toBeNull())
    expect(screen.getByRole('combobox', { name: 'Key for score 1 of Romance' })).toBeTruthy()
  })

  it('adds a multi-photo PDF to an existing piece and waits for conversion', async () => {
    vi.stubGlobal('URL', Object.assign(class extends URL {}, { createObjectURL: vi.fn(() => 'blob:photo'), revokeObjectURL: vi.fn() }))
    const first = { id: 'one', jpeg: new Blob(['one']), width: 10, height: 20 }
    const second = { id: 'two', jpeg: new Blob(['two']), width: 10, height: 20 }
    const pdf = new File(['pdf'], 'camera-scan.pdf', { type: 'application/pdf' })
    let finish!: (file: File) => void
    mocks.preparePhoto.mockResolvedValueOnce(first).mockResolvedValueOnce(second)
    mocks.photosToPdf.mockResolvedValueOnce(pdf).mockImplementationOnce(() => new Promise<File>((resolve) => { finish = resolve }))
    const user = userEvent.setup()
    render(<TestLibrary />)
    await user.click(await screen.findByText('Romance', { selector: 'summary strong' }))
    await user.click(screen.getByRole('button', { name: '+ Add score' }))
    const camera = screen.getByLabelText('Camera photo')
    fireEvent.change(camera, { target: { files: [new File(['one'], 'one.jpg', { type: 'image/jpeg' })] } })
    await screen.findByText('1 photo in PDF')
    fireEvent.change(camera, { target: { files: [new File(['two'], 'two.jpg', { type: 'image/jpeg' })] } })
    await screen.findByText('Preparing PDF…')
    const button = screen.getByRole('button', { name: 'Add score' })
    expect((button as HTMLButtonElement).disabled).toBe(true)
    fireEvent.submit(button.closest('form')!)
    expect(mocks.upload).not.toHaveBeenCalled()
    await act(async () => finish(pdf))
    await screen.findByText('2 photos in PDF')
    expect(mocks.photosToPdf).toHaveBeenLastCalledWith([first, second])
    await user.click(button)
    await waitFor(() => expect(mocks.upload).toHaveBeenCalledWith(expect.stringMatching(/\.pdf$/), pdf, { contentType: 'application/pdf' }))
    await waitFor(() => expect(mocks.insert).toHaveBeenCalledWith('sm_piece_scores', expect.objectContaining({ piece_id: 'p1' })))
  })

  it('discards the selected score when cancelling the add form', async () => {
    const user = userEvent.setup()
    render(<TestLibrary />)
    await user.click(await screen.findByText('Romance', { selector: 'summary strong' }))
    await user.click(screen.getByRole('button', { name: '+ Add score' }))
    await user.upload(screen.getByLabelText('PDF for Romance'), new File(['pdf'], 'score.pdf', { type: 'application/pdf' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await user.click(screen.getByRole('button', { name: '+ Add score' }))
    expect((screen.getByRole('button', { name: 'Add score' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByText('score.pdf')).toBeNull()
  })

  it('removes a piece from the library and supports undo', async () => {
    const user = userEvent.setup()
    render(<TestLibrary />)
    await user.click(await screen.findByText('Romance', { selector: 'summary strong' }))
    vi.mocked(window.confirm).mockReturnValueOnce(false)
    await user.click(screen.getByRole('button', { name: 'Delete Romance from library' }))
    expect(screen.getByText('Romance', { selector: 'summary strong' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Delete Romance from library' }))
    expect(window.confirm).toHaveBeenLastCalledWith('Delete "Romance" from your library? Its scores, practice history, and links to lessons and setlists will also be deleted.')

    expect(screen.queryByText('Romance', { selector: 'summary strong' })).toBeNull()
    expect(screen.getByText('Deleted "Romance" from your library')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.getByText('Romance', { selector: 'summary strong' })).toBeTruthy()
  })

  it('asks before deleting a composer and describes the effect on pieces', async () => {
    const user = userEvent.setup()
    render(<TestComposers />)
    const remove = await screen.findByRole('button', { name: 'Delete Clara Schumann' })
    vi.mocked(window.confirm).mockReturnValueOnce(false)
    await user.click(remove)
    expect(window.confirm).toHaveBeenCalledWith('Delete composer "Clara Schumann"? 1 piece with no other composer and their scores will also be deleted. Shared pieces will be kept.')
    expect(screen.getByRole('heading', { name: 'Clara Schumann' })).toBeTruthy()
    expect(mocks.delete).not.toHaveBeenCalledWith('sm_composers', 'id', 'c1')
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
