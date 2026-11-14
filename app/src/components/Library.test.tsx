import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLibrary } from '../hooks/useLibrary'
import { Library } from './Library'

const mocks = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock('../supabase', () => ({ supabase: { from: mocks.from } }))

function TestLibrary() {
  const lib = useLibrary()
  return <Library lib={lib} />
}

describe('focused library', () => {
  beforeEach(() => {
    localStorage.clear()
    mocks.from.mockImplementation((table: string) => ({
      select: () => ({
        order: () => {
          const data = table === 'sm_composers'
            ? [{ id: 'c1', name: 'Clara Schumann' }]
            : table === 'sm_pieces'
              ? [{ id: 'p1', composer_id: 'c1', title: 'Romance', instruments: ['piano'], tags: ['calm'], play_progress: 50, links: [] }]
              : []
          const result = { data, error: null }
          return Object.assign(Promise.resolve(result), { limit: () => Promise.resolve(result) })
        },
      }),
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
})
