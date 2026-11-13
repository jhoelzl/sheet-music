import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLibrary } from '../hooks/useLibrary'
import { ComposersPage } from './ComposersPage'
import { Toasts } from './Toasts'

const mocks = vi.hoisted(() => ({ from: vi.fn(), insert: vi.fn(), update: vi.fn() }))
vi.mock('../supabase', () => ({ supabase: { from: mocks.from } }))

function TestPage() {
  const lib = useLibrary()
  return <><Toasts lib={lib} /><ComposersPage lib={lib} /></>
}

describe('composer management', () => {
  beforeEach(() => {
    const composers = [
      { id: '1', name: 'Clara Schumann', born_year: null, died_year: null, notes: null },
      { id: '2', name: 'Johann Bach', born_year: null, died_year: null, notes: null },
    ]
    mocks.insert.mockResolvedValue({ error: null })
    mocks.update.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
    mocks.from.mockImplementation((table: string) => ({
      select: () => ({
        order: () => {
          const result = { data: table === 'sm_composers' ? composers : [], error: null }
          return Object.assign(Promise.resolve(result), { limit: () => Promise.resolve(result) })
        },
      }),
      insert: mocks.insert,
      update: mocks.update,
    }))
  })

  afterEach(() => { cleanup(); vi.clearAllMocks() })

  it('rejects duplicate names regardless of case and surrounding spaces', async () => {
    const user = userEvent.setup()
    render(<TestPage />)
    await screen.findByText('Clara Schumann')
    await user.click(screen.getByRole('button', { name: '+ Composer' }))
    await user.type(screen.getByLabelText('Composer name'), '  clara schumann  ')
    await user.click(screen.getByRole('button', { name: 'Add composer' }))

    expect((await screen.findByRole('alert')).textContent).toContain('A composer with this name already exists.')
    expect(mocks.insert).not.toHaveBeenCalled()
    expect((screen.getByLabelText('Composer name') as HTMLInputElement).value).toBe('  clara schumann  ')
  })

  it('keeps the form open when the database rejects a duplicate', async () => {
    mocks.insert.mockResolvedValue({ error: { code: '23505', message: 'duplicate key violates unique constraint "sm_composers_name_user_unique"' } })
    const user = userEvent.setup()
    render(<TestPage />)
    await screen.findByText('Clara Schumann')
    await user.click(screen.getByRole('button', { name: '+ Composer' }))
    await user.type(screen.getByLabelText('Composer name'), 'Fanny Mendelssohn')
    await user.click(screen.getByRole('button', { name: 'Add composer' }))

    expect((await screen.findByRole('alert')).textContent).toContain('A composer with this name already exists.')
    await waitFor(() => expect((screen.getByRole('button', { name: 'Add composer' }) as HTMLButtonElement).disabled).toBe(false))
    expect((screen.getByLabelText('Composer name') as HTMLInputElement).value).toBe('Fanny Mendelssohn')
  })

  it('creates a new composer and closes the form on success', async () => {
    const user = userEvent.setup()
    render(<TestPage />)
    await screen.findByText('Clara Schumann')
    await user.click(screen.getByRole('button', { name: '+ Composer' }))
    await user.type(screen.getByLabelText('Composer name'), '  Fanny Mendelssohn  ')
    await user.click(screen.getByRole('button', { name: 'Add composer' }))

    await waitFor(() => expect(mocks.insert).toHaveBeenCalledWith({ name: 'Fanny Mendelssohn' }))
    await waitFor(() => expect(screen.queryByLabelText('Composer name')).toBeNull())
  })

  it('rejects renaming a composer to an existing name', async () => {
    const user = userEvent.setup()
    render(<TestPage />)
    await screen.findByText('Clara Schumann')
    await user.click(screen.getByRole('button', { name: 'Rename Johann Bach' }))
    const input = screen.getByLabelText('Composer name')
    await user.clear(input)
    await user.type(input, '  CLARA SCHUMANN  {Enter}')

    expect((await screen.findByRole('alert')).textContent).toContain('A composer with this name already exists.')
    expect(mocks.update).not.toHaveBeenCalled()
  })
})
