import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useUserSettings } from './useUserSettings'
import { DEFAULT_USER_SETTINGS } from '../lib/userSettings'

const mocks = vi.hoisted(() => ({ from: vi.fn(), maybeSingle: vi.fn(), upsert: vi.fn() }))
vi.mock('../supabase', () => ({ supabase: { from: mocks.from } }))

describe('user settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.from.mockImplementation(() => ({
      select: () => ({ eq: (_column: string, userId: string) => ({ maybeSingle: () => mocks.maybeSingle(userId) }) }),
      upsert: mocks.upsert,
    }))
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null })
    mocks.upsert.mockResolvedValue({ error: null })
  })

  it('loads and saves settings for the signed-in user', async () => {
    const stored = { ...DEFAULT_USER_SETTINGS, theme: 'dark', library_sort: 'recent' } as const
    mocks.maybeSingle.mockResolvedValue({ data: stored, error: null })
    const { result } = renderHook(() => useUserSettings('user-1'))
    await waitFor(() => expect(result.current.state.status).toBe('ready'))
    expect(result.current.state.settings).toEqual(stored)
    const updated = { ...stored, video_order: 'random' } as const
    await act(async () => { await result.current.save(updated) })
    expect(mocks.upsert).toHaveBeenCalledWith({ user_id: 'user-1', ...updated })
    expect(result.current.state.settings).toEqual(updated)
  })

  it('reports load failures, retries, and does not apply failed saves', async () => {
    mocks.maybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'Database unavailable' } })
    const { result } = renderHook(() => useUserSettings('user-1'))
    await waitFor(() => expect(result.current.state.status).toBe('error'))
    if (result.current.state.status === 'error') expect(result.current.state.message).toBe('Database unavailable')
    act(() => result.current.retry())
    await waitFor(() => expect(result.current.state.status).toBe('ready'))
    mocks.upsert.mockResolvedValueOnce({ error: { message: 'Save failed' } })
    await expect(result.current.save({ ...DEFAULT_USER_SETTINGS, theme: 'dark' })).rejects.toThrow('Save failed')
    expect(result.current.state.settings.theme).toBe('system')
  })

  it('does not expose a previous user’s settings while switching accounts', async () => {
    let finishFirst!: (result: { data: typeof DEFAULT_USER_SETTINGS; error: null }) => void
    mocks.maybeSingle.mockImplementation((id: string) => id === 'user-1'
      ? new Promise((resolve) => { finishFirst = resolve })
      : Promise.resolve({ data: { ...DEFAULT_USER_SETTINGS, theme: 'light' }, error: null }))
    const { result, rerender } = renderHook(({ userId }) => useUserSettings(userId), { initialProps: { userId: 'user-1' } })
    rerender({ userId: 'user-2' })
    await waitFor(() => expect(result.current.state.settings.theme).toBe('light'))
    await act(async () => { finishFirst({ data: { ...DEFAULT_USER_SETTINGS, theme: 'dark' }, error: null }) })
    expect(result.current.state.settings.theme).toBe('light')
  })

  it('ignores a save that finishes after the user changes', async () => {
    let finishSave!: (result: { error: null }) => void
    mocks.upsert.mockReturnValue(new Promise((resolve) => { finishSave = resolve }))
    mocks.maybeSingle.mockImplementation((id: string) => Promise.resolve({
      data: { ...DEFAULT_USER_SETTINGS, theme: id === 'user-2' ? 'light' : 'system' }, error: null,
    }))
    const { result, rerender } = renderHook(({ userId }) => useUserSettings(userId), { initialProps: { userId: 'user-1' } })
    await waitFor(() => expect(result.current.state.status).toBe('ready'))
    let pending!: Promise<void>
    act(() => { pending = result.current.save({ ...DEFAULT_USER_SETTINGS, theme: 'dark' }) })
    rerender({ userId: 'user-2' })
    await waitFor(() => expect(result.current.state.settings.theme).toBe('light'))
    await act(async () => { finishSave({ error: null }); await pending })
    expect(result.current.state.settings.theme).toBe('light')
  })
})
