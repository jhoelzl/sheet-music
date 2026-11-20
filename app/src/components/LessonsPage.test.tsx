import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Piece } from '../supabase'
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
    const checkbox = await screen.findByRole('checkbox', { name: 'Chord concepts' })
    await user.click(checkbox)
    await waitFor(() => expect(mocks.tables.sm_lesson_materials).toEqual([{ lesson_id: 'l1', material_id: 'id-1' }]))
    expect(mocks.upload.mock.calls[0][0]).toMatch(/^u1\/materials\/.+\.pdf$/)
    rendered.unmount()

    render(<LessonsPage lib={lib} onDirtyChange={mocks.dirty} />)
    expect((await screen.findByLabelText('Notes (Markdown)') as HTMLTextAreaElement).value).toBe('# Practice\n**Swing**')
    expect((screen.getByRole('checkbox', { name: 'Chord concepts' }) as HTMLInputElement).checked).toBe(true)
    expect(screen.getByRole('button', { name: 'Remove Autumn Leaves from Guitar' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Chord concepts' }))
    expect(mocks.openMaterialPdf).toHaveBeenCalledWith(expect.objectContaining({ title: 'Chord concepts' }))
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
    mocks.tables.sm_teaching_materials.push({ id: 'm1', title: 'Scales', pdf_path: 'u1/scales.pdf' })
    mocks.tables.sm_lesson_materials.push({ lesson_id: 'l1', material_id: 'm1' })
    const user = userEvent.setup()
    render(<LessonsPage lib={lib} onDirtyChange={mocks.dirty} />)
    expect((await screen.findByRole('checkbox', { name: 'Scales' }) as HTMLInputElement).checked).toBe(true)
    await user.click(screen.getByRole('button', { name: /Previous/ }))
    await user.click(screen.getByRole('checkbox', { name: 'Scales' }))
    await waitFor(() => expect(mocks.tables.sm_lesson_materials).toHaveLength(2))
    await user.click(screen.getByRole('button', { name: /Guitar/ }))
    await user.click(screen.getByRole('checkbox', { name: 'Scales' }))
    await waitFor(() => expect(mocks.tables.sm_lesson_materials).toEqual([{ lesson_id: 'l2', material_id: 'm1' }]))
    expect(mocks.remove).not.toHaveBeenCalled()
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
