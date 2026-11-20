import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Piece } from '../supabase'
import { isoOf, todayISO } from '../lib/dates'
import { LessonsPage } from './LessonsPage'

type Row = Record<string, unknown>
const mocks = vi.hoisted(() => ({
  tables: {} as Record<string, Row[]>,
  fail: '',
  upload: vi.fn(),
  remove: vi.fn(),
  openMaterialPdf: vi.fn(),
  openPdf: vi.fn(),
  dirty: vi.fn(),
}))

vi.mock('../supabase', () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } }, error: null }) },
    storage: { from: () => ({ upload: mocks.upload, remove: mocks.remove }) },
    from: (table: string) => {
      let action = 'select'
      let values: Row = {}
      const filters: Record<string, unknown> = {}
      const execute = () => {
        if (mocks.fail === `${table}:${action}`) return { data: null, error: { message: 'Database unavailable' } }
        const rows = mocks.tables[table]
        const matches = (row: Row) => Object.entries(filters).every(([key, value]) => row[key] === value)
        if (action === 'insert') {
          const row = { ...values, ...(!values.id && !table.startsWith('sm_lesson_') ? { id: `id-${rows.length + 1}` } : {}) }
          rows.push(row)
          return { data: row, error: null }
        }
        if (action === 'update') rows.filter(matches).forEach((row) => Object.assign(row, values))
        if (action === 'delete') mocks.tables[table] = rows.filter((row) => !matches(row))
        return { data: action === 'select' ? rows.map((row) => ({ ...row })) : null, error: null }
      }
      const query = {
        select: () => query,
        order: () => query,
        insert: (row: Row) => { action = 'insert'; values = row; return query },
        update: (row: Row) => { action = 'update'; values = row; return query },
        delete: () => { action = 'delete'; return query },
        eq: (key: string, value: unknown) => { filters[key] = value; return query },
        single: async () => execute(),
        then: (resolve: (result: ReturnType<typeof execute>) => unknown) => Promise.resolve(execute()).then(resolve),
      }
      return query
    },
  },
}))

const piece: Piece = {
  id: 'p1', composer_id: 'c1', title: 'Autumn Leaves', instruments: ['guitar'],
  pdf_path: null, play_progress: 0, difficulty: null, rating: null, notes: null,
}
const lib = {
  pieces: [piece], hiddenIds: new Set<string>(), composerNamesOf: () => 'Joseph Kosma',
  openPdf: mocks.openPdf, openMaterialPdf: mocks.openMaterialPdf,
}

describe('lessons', () => {
  beforeEach(() => {
    mocks.tables = {
      sm_lessons: [{ id: 'l1', lesson_date: '2026-11-18', title: 'Guitar', notes: '' }],
      sm_teaching_materials: [], sm_lesson_pieces: [], sm_lesson_materials: [],
    }
    mocks.fail = ''
    mocks.upload.mockResolvedValue({ error: null })
    mocks.remove.mockResolvedValue({ error: null })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })
  afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.clearAllMocks() })

  it('saves markdown notes and links a tune and reusable material across reloads', async () => {
    const user = userEvent.setup()
    const rendered = render(<LessonsPage lib={lib} onDirtyChange={mocks.dirty} />)
    const notes = await screen.findByLabelText('Notes (Markdown)')
    await user.type(notes, '# Practice{Enter}**Swing**')
    expect(within(screen.getByRole('region', { name: 'Notes preview' })).getByText('Swing').tagName).toBe('STRONG')
    await user.click(screen.getByRole('button', { name: 'Save lesson' }))
    await waitFor(() => expect(mocks.tables.sm_lessons[0].notes).toBe('# Practice\n**Swing**'))

    await user.type(screen.getByRole('searchbox', { name: 'Search tunes' }), 'autumn')
    await user.click(screen.getByRole('button', { name: 'Add Autumn Leaves to Guitar' }))
    await waitFor(() => expect(mocks.tables.sm_lesson_pieces).toEqual([{ lesson_id: 'l1', piece_id: 'p1' }]))

    await user.type(screen.getByLabelText('Material title'), 'Chord concepts')
    await user.upload(screen.getByLabelText('PDF file'), new File(['pdf'], 'chords.pdf', { type: 'application/pdf' }))
    expect((screen.getByLabelText('PDF file') as HTMLInputElement).files?.length).toBe(1)
    expect(screen.getByLabelText('PDF file').closest('form')?.checkValidity()).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Upload PDF' }))
    const materialSearch = await screen.findByRole('searchbox', { name: 'Search materials for guitar' })
    await user.type(materialSearch, 'chord{Enter}')
    await waitFor(() => expect(mocks.tables.sm_lesson_materials).toEqual([{ lesson_id: 'l1', material_id: 'id-1' }]))
    expect(mocks.upload.mock.calls[0][0]).toMatch(/^u1\/materials\/.+\.pdf$/)
    rendered.unmount()

    render(<LessonsPage lib={lib} onDirtyChange={mocks.dirty} />)
    expect((await screen.findByLabelText('Notes (Markdown)') as HTMLTextAreaElement).value).toBe('# Practice\n**Swing**')
    expect(screen.getByRole('button', { name: 'Remove material Chord concepts' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Remove Autumn Leaves from Guitar' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Open material Chord concepts' }))
    expect(mocks.openMaterialPdf).toHaveBeenCalledWith(expect.objectContaining({ title: 'Chord concepts' }))
  })

  it('opens the correct linked tune, including tunes without a score', async () => {
    const first = { ...piece, pdf_path: 'u/a.pdf', scores: [{ id: 's1', piece_id: 'p1', pdf_path: 'u/a.pdf', pdf_pages: 1, musical_key: null, instrument: 'guitar' as const, lead_sheet: false, position: 0 }] }
    const second = { ...piece, id: 'p2', title: 'Blue Bossa', pdf_path: 'u/b.pdf', scores: [{ ...first.scores[0], id: 's2', piece_id: 'p2', pdf_path: 'u/b.pdf' }] }
    const third = { ...piece, id: 'p3', title: 'No score' }
    const user = userEvent.setup()
    const data = { ...lib, pieces: [first, second, third] }
    const rendered = render(<LessonsPage lib={data} onDirtyChange={mocks.dirty} />)
    const search = await screen.findByRole('searchbox', { name: 'Search tunes' })
    for (const [query, title] of [['autumn', 'Autumn Leaves'], ['blue', 'Blue Bossa'], ['no score', 'No score']]) {
      await user.type(search, `${query}{Enter}`)
      await screen.findByRole('button', { name: `Show details for ${title}` })
    }
    expect(mocks.tables.sm_lesson_pieces).toHaveLength(3)
    rendered.unmount()
    render(<LessonsPage lib={data} onDirtyChange={mocks.dirty} />)
    await user.click(await screen.findByRole('button', { name: 'Show details for Blue Bossa' }))
    const secondDetails = screen.getByRole('region', { name: 'Details for Blue Bossa' })
    await user.click(within(secondDetails).getByRole('button', { name: 'Open score' }))
    expect(mocks.openPdf).toHaveBeenLastCalledWith(second)
    await user.click(screen.getByRole('button', { name: 'Show details for Autumn Leaves' }))
    expect(screen.queryByRole('region', { name: 'Details for Blue Bossa' })).toBeNull()
    await user.click(within(screen.getByRole('region', { name: 'Details for Autumn Leaves' })).getByRole('button', { name: 'Open score' }))
    expect(mocks.openPdf).toHaveBeenLastCalledWith(first)
    await user.click(screen.getByRole('button', { name: 'Show details for No score' }))
    expect(within(screen.getByRole('region', { name: 'Details for No score' })).getByText('No PDF attached')).toBeTruthy()
  })

  it('previews nested lesson notes as nested lists', async () => {
    mocks.tables.sm_lessons[0].notes = '- Chromatische Treppen Übungen\n    - Auf 9. Bund beginnen\n- Vaya con dios\n    - Melodie weiterüben'
    render(<LessonsPage lib={lib} onDirtyChange={mocks.dirty} />)
    const preview = await screen.findByRole('region', { name: 'Notes preview' })
    const items = preview.querySelectorAll('.md > ul > li')
    expect(items).toHaveLength(2)
    expect(items[0].querySelector('ul > li')?.textContent).toBe('Auf 9. Bund beginnen')
    expect(items[1].querySelector('ul > li')?.textContent).toBe('Melodie weiterüben')
  })

  it('shows lesson activity by date and opens a lesson from the heatmap', async () => {
    const today = todayISO()
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const previousDate = isoOf(yesterday)
    mocks.tables.sm_lessons = [
      { id: 'l1', lesson_date: today, title: 'Today lesson', notes: '' },
      { id: 'l2', lesson_date: previousDate, title: 'Previous lesson', notes: '' },
      { id: 'l3', lesson_date: previousDate, title: 'Another lesson', notes: '' },
    ]
    const user = userEvent.setup()
    render(<LessonsPage lib={lib} onDirtyChange={mocks.dirty} />)
    await screen.findByLabelText('Notes (Markdown)')
    expect(screen.getByText('1 lesson today')).toBeTruthy()
    expect(screen.queryByLabelText('Lesson calendar')).toBeNull()
    await user.click(screen.getByRole('button', { name: /view activity/i }))
    const calendar = screen.getByRole('region', { name: 'Lesson calendar' })
    expect(within(calendar).getByText('lesson today')).toBeTruthy()
    await user.click(within(calendar).getByRole('button', { name: /2 lessons$/ }))
    const detail = within(calendar).getByRole('button', { name: 'Previous lesson' })
    await user.click(detail)
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Previous lesson')
    await user.click(screen.getByRole('button', { name: /hide activity/i }))
    expect(screen.queryByLabelText('Lesson calendar')).toBeNull()
  })

  it('updates activity only after saving a date change and after deletion', async () => {
    const today = todayISO()
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    mocks.tables.sm_lessons[0].lesson_date = isoOf(yesterday)
    const user = userEvent.setup()
    render(<LessonsPage lib={lib} onDirtyChange={mocks.dirty} />)
    await screen.findByLabelText('Notes (Markdown)')
    await user.click(screen.getByRole('button', { name: /view activity/i }))
    expect(screen.getByText('0 lessons today')).toBeTruthy()
    const date = screen.getByLabelText('Lesson date')
    await user.clear(date)
    await user.type(date, today)
    expect(screen.getByText('0 lessons today')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Save lesson' }))
    await screen.findByText('1 lesson today')
    await user.click(screen.getByRole('button', { name: 'Delete lesson' }))
    await screen.findByText('0 lessons today')
  })

  it('adds newly created lessons to the heatmap', async () => {
    mocks.tables.sm_lessons = []
    const user = userEvent.setup()
    render(<LessonsPage lib={lib} onDirtyChange={mocks.dirty} />)
    await screen.findByText('No lessons yet.')
    await user.click(screen.getByRole('button', { name: /view activity/i }))
    await user.type(screen.getByLabelText('Lesson title'), 'New lesson')
    await user.click(screen.getByRole('button', { name: 'Add lesson' }))
    await screen.findByText('1 lesson today')
    const calendar = screen.getByRole('region', { name: 'Lesson calendar' })
    await user.click(within(calendar).getByRole('button', { name: /1 lesson$/ }))
    expect(within(calendar).getByRole('button', { name: 'New lesson' })).toBeTruthy()
  })

  it('protects unsaved notes when opening a lesson from the calendar', async () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    mocks.tables.sm_lessons[0].lesson_date = todayISO()
    mocks.tables.sm_lessons.push({ id: 'l2', lesson_date: isoOf(yesterday), title: 'Previous', notes: '' })
    vi.mocked(window.confirm).mockReturnValue(false)
    const user = userEvent.setup()
    render(<LessonsPage lib={lib} onDirtyChange={mocks.dirty} />)
    await user.type(await screen.findByLabelText('Notes (Markdown)'), 'Unsaved notes')
    await user.click(screen.getByRole('button', { name: /view activity/i }))
    const calendar = screen.getByRole('region', { name: 'Lesson calendar' })
    await user.click(within(calendar).getAllByRole('button', { name: /1 lesson$/ })[0])
    await user.click(within(calendar).getByRole('button', { name: 'Previous' }))
    expect(window.confirm).toHaveBeenCalledWith('Discard unsaved lesson changes?')
    expect((screen.getByLabelText('Notes (Markdown)') as HTMLTextAreaElement).value).toBe('Unsaved notes')
  })

  it('does not count upcoming lessons as past activity', async () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    mocks.tables.sm_lessons[0].lesson_date = isoOf(tomorrow)
    const user = userEvent.setup()
    render(<LessonsPage lib={lib} onDirtyChange={mocks.dirty} />)
    await screen.findByLabelText('Notes (Markdown)')
    await user.click(screen.getByRole('button', { name: /view activity/i }))
    const calendar = screen.getByRole('region', { name: 'Lesson calendar' })
    expect(within(calendar).getByText(/lessons this week/).textContent).toContain('lessons this week · 0/7 days')
    expect(screen.getByText('0 lessons today')).toBeTruthy()
  })

  it('creates a lesson and keeps materials when deleting it', async () => {
    const user = userEvent.setup()
    render(<LessonsPage lib={lib} onDirtyChange={mocks.dirty} />)
    await screen.findByLabelText('Notes (Markdown)')
    await user.type(screen.getByLabelText('Lesson title'), 'Scales')
    await user.click(screen.getByRole('button', { name: 'Add lesson' }))
    await waitFor(() => expect(mocks.tables.sm_lessons).toHaveLength(2))
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Scales')
    await user.click(screen.getByRole('button', { name: 'Delete lesson' }))
    await waitFor(() => expect(mocks.tables.sm_lessons).toHaveLength(1))
    expect(mocks.remove).not.toHaveBeenCalled()
  })

  it('reuses materials in multiple lessons and unlinks them independently', async () => {
    mocks.tables.sm_lessons.push({ id: 'l2', lesson_date: '2026-11-11', title: 'Previous', notes: '' })
    mocks.tables.sm_teaching_materials.push({ id: 'm1', title: 'Scales', pdf_path: 'u1/scales.pdf', tags: [] })
    mocks.tables.sm_lesson_materials.push({ lesson_id: 'l1', material_id: 'm1' })
    const user = userEvent.setup()
    render(<LessonsPage lib={lib} onDirtyChange={mocks.dirty} />)
    expect(await screen.findByRole('button', { name: 'Remove material Scales' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /Previous/ }))
    await user.type(screen.getByRole('searchbox', { name: 'Search materials for previous' }), 'scale{Enter}')
    await waitFor(() => expect(mocks.tables.sm_lesson_materials).toHaveLength(2))
    await user.click(screen.getByRole('button', { name: /Guitar/ }))
    await user.click(screen.getByRole('button', { name: 'Remove material Scales' }))
    await waitFor(() => expect(mocks.tables.sm_lesson_materials).toEqual([{ lesson_id: 'l2', material_id: 'm1' }]))
    expect(mocks.remove).not.toHaveBeenCalled()
  })

  it('searches and links multiple materials, opens each, and unlinks only the chosen one', async () => {
    mocks.tables.sm_teaching_materials = [
      { id: 'm1', title: 'Étude', pdf_path: 'u1/etude.pdf', tags: [] },
      { id: 'm2', title: 'Scales', pdf_path: 'u1/scales.pdf', tags: [] },
    ]
    const user = userEvent.setup()
    const rendered = render(<LessonsPage lib={lib} onDirtyChange={mocks.dirty} />)
    const search = await screen.findByRole('searchbox', { name: 'Search materials for guitar' })
    await user.type(search, 'etude')
    const result = within(screen.getByRole('group', { name: 'Materials for Guitar' })).getByRole('button', { name: 'Étude' })
    expect(fireEvent.pointerDown(result, { pointerType: 'touch' })).toBe(true)
    fireEvent.blur(search, { relatedTarget: null })
    fireEvent.click(result)
    await screen.findByRole('button', { name: 'Open material Étude' })
    await user.type(search, 'scales{Enter}')
    await screen.findByRole('button', { name: 'Open material Scales' })
    await user.click(screen.getByRole('button', { name: 'Open material Étude' }))
    expect(mocks.openMaterialPdf).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'm1', pdf_path: 'u1/etude.pdf' }))
    await user.click(screen.getByRole('button', { name: 'Open material Scales' }))
    expect(mocks.openMaterialPdf).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'm2', pdf_path: 'u1/scales.pdf' }))
    await user.click(screen.getByRole('button', { name: 'Remove material Étude' }))
    await waitFor(() => expect(mocks.tables.sm_lesson_materials).toEqual([{ lesson_id: 'l1', material_id: 'm2' }]))
    expect(mocks.remove).not.toHaveBeenCalled()
    rendered.unmount()
    render(<LessonsPage lib={lib} onDirtyChange={mocks.dirty} />)
    expect(await screen.findByRole('button', { name: 'Open material Scales' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Open material Étude' })).toBeNull()
  })

  it('shows an error and preserves the linked material when unlinking fails', async () => {
    mocks.tables.sm_teaching_materials = [{ id: 'm1', title: 'Scales', pdf_path: 'u1/scales.pdf', tags: [] }]
    mocks.tables.sm_lesson_materials = [{ lesson_id: 'l1', material_id: 'm1' }]
    mocks.fail = 'sm_lesson_materials:delete'
    const user = userEvent.setup()
    render(<LessonsPage lib={lib} onDirtyChange={mocks.dirty} />)
    await user.click(await screen.findByRole('button', { name: 'Remove material Scales' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Database unavailable')
    expect(screen.getByRole('button', { name: 'Open material Scales' })).toBeTruthy()
  })

  it('uploads material tags and keeps them after reloading', async () => {
    const user = userEvent.setup()
    const rendered = render(<LessonsPage lib={lib} onDirtyChange={mocks.dirty} />)
    await screen.findByLabelText('Notes (Markdown)')
    await user.type(screen.getByLabelText('Material title'), 'Chord concepts')
    const tags = within(screen.getByRole('group', { name: 'Tags for new material' }))
    await user.type(tags.getByRole('combobox', { name: 'Add tag' }), '#Jazz{Enter}theory{Enter}')
    await user.upload(screen.getByLabelText('PDF file'), new File(['pdf'], 'chords.pdf', { type: 'application/pdf' }))
    await user.click(screen.getByRole('button', { name: 'Upload PDF' }))
    await waitFor(() => expect(mocks.tables.sm_teaching_materials[0].tags).toEqual(['jazz', 'theory']))
    expect(await screen.findByRole('group', { name: 'Tags for Chord concepts' })).toBeTruthy()
    rendered.unmount()
    render(<LessonsPage lib={lib} onDirtyChange={mocks.dirty} />)
    const persisted = await screen.findByRole('group', { name: 'Tags for Chord concepts' })
    expect(within(persisted).getByRole('button', { name: 'Remove tag jazz' })).toBeTruthy()
    expect(within(persisted).getByRole('button', { name: 'Remove tag theory' })).toBeTruthy()
  })

  it('edits tags on existing materials and filters the material library', async () => {
    mocks.tables.sm_teaching_materials = [
      { id: 'm1', title: 'Scales', pdf_path: 'u1/scales.pdf', tags: [] },
      { id: 'm2', title: 'Chords', pdf_path: 'u1/chords.pdf', tags: ['harmony'] },
      { id: 'm3', title: 'Exercises', pdf_path: 'u1/exercises.pdf', tags: ['technique'] },
    ]
    const user = userEvent.setup()
    const rendered = render(<LessonsPage lib={lib} onDirtyChange={mocks.dirty} />)
    const scales = await screen.findByRole('group', { name: 'Tags for Scales' })
    await user.type(within(scales).getByRole('combobox', { name: 'Add tag' }), 'Technique{Enter}')
    await waitFor(() => expect(mocks.tables.sm_teaching_materials[0].tags).toEqual(['technique']))
    const filter = screen.getByRole('group', { name: 'Filter teaching materials by tag' })
    await user.click(within(filter).getByRole('button', { name: '#technique' }))
    expect(screen.getByRole('button', { name: 'Scales' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Exercises' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Chords' })).toBeNull()
    await user.click(within(screen.getByRole('group', { name: 'Tags for Scales' })).getByRole('button', { name: 'Remove tag technique' }))
    await waitFor(() => expect(mocks.tables.sm_teaching_materials[0].tags).toEqual([]))
    expect(screen.queryByRole('button', { name: 'Scales' })).toBeNull()
    await user.click(within(filter).getByRole('button', { name: 'All tags' }))
    expect(screen.getByRole('button', { name: 'Chords' })).toBeTruthy()
    rendered.unmount()
    render(<LessonsPage lib={lib} onDirtyChange={mocks.dirty} />)
    expect(within(await screen.findByRole('group', { name: 'Tags for Scales' })).queryByRole('button', { name: 'Remove tag technique' })).toBeNull()
  })

  it('finds materials by tag when linking them to a lesson', async () => {
    mocks.tables.sm_teaching_materials = [
      { id: 'm1', title: 'Circle of fifths', pdf_path: 'u1/fifths.pdf', tags: ['harmony'] },
      { id: 'm2', title: 'Alternate picking', pdf_path: 'u1/picking.pdf', tags: ['technique'] },
    ]
    const user = userEvent.setup()
    render(<LessonsPage lib={lib} onDirtyChange={mocks.dirty} />)
    const search = await screen.findByRole('searchbox', { name: 'Search materials for guitar' })
    await user.type(search, 'harmony{Enter}')
    await screen.findByRole('button', { name: 'Open material Circle of fifths' })
    expect(mocks.tables.sm_lesson_materials).toEqual([{ lesson_id: 'l1', material_id: 'm1' }])
    expect(screen.queryByRole('button', { name: 'Open material Alternate picking' })).toBeNull()
  })

  it('reports failed tag updates and keeps the previously saved tags', async () => {
    mocks.tables.sm_teaching_materials = [{ id: 'm1', title: 'Scales', pdf_path: 'u1/scales.pdf', tags: ['technique'] }]
    mocks.fail = 'sm_teaching_materials:update'
    const user = userEvent.setup()
    render(<LessonsPage lib={lib} onDirtyChange={mocks.dirty} />)
    const group = await screen.findByRole('group', { name: 'Tags for Scales' })
    await user.click(within(group).getByRole('button', { name: 'Remove tag technique' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Database unavailable')
    expect(within(group).getByRole('button', { name: 'Remove tag technique' })).toBeTruthy()
    expect(mocks.tables.sm_teaching_materials[0].tags).toEqual(['technique'])
  })

  it('removes an uploaded PDF if its database record fails', async () => {
    mocks.fail = 'sm_teaching_materials:insert'
    const user = userEvent.setup()
    render(<LessonsPage lib={lib} onDirtyChange={mocks.dirty} />)
    await screen.findByLabelText('Notes (Markdown)')
    await user.type(screen.getByLabelText('Material title'), 'Theory')
    await user.upload(screen.getByLabelText('PDF file'), new File(['pdf'], 'theory.pdf', { type: 'application/pdf' }))
    expect(screen.getByLabelText('PDF file').closest('form')?.checkValidity()).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Upload PDF' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Database unavailable')
    expect(mocks.remove).toHaveBeenCalledWith([mocks.upload.mock.calls[0][0]])
    expect(mocks.tables.sm_teaching_materials).toHaveLength(0)
  })

  it('does not discard unsaved notes when lesson switching is cancelled', async () => {
    mocks.tables.sm_lessons.push({ id: 'l2', lesson_date: '2026-11-11', title: 'Previous', notes: '' })
    vi.mocked(window.confirm).mockReturnValue(false)
    const user = userEvent.setup()
    render(<LessonsPage lib={lib} onDirtyChange={mocks.dirty} />)
    await user.type(await screen.findByLabelText('Notes (Markdown)'), 'Unsaved')
    await user.click(screen.getByRole('button', { name: /Previous/ }))
    expect((screen.getByLabelText('Notes (Markdown)') as HTMLTextAreaElement).value).toBe('Unsaved')
    expect(mocks.dirty).toHaveBeenLastCalledWith(true)
  })
})
