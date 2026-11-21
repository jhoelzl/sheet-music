import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase'
import { DEFAULT_USER_SETTINGS } from '../lib/userSettings'
import type { UserSettings } from '../lib/userSettings'

export type SettingsState =
  | { status: 'loading'; settings: UserSettings }
  | { status: 'error'; settings: UserSettings; message: string }
  | { status: 'ready'; settings: UserSettings }

export function useUserSettings(userId: string | null) {
  const generation = useRef(0)
  const [loaded, setLoaded] = useState<{ userId: string | null; state: SettingsState }>({
    userId: null, state: { status: 'ready', settings: DEFAULT_USER_SETTINGS },
  })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    generation.current += 1
    return () => { generation.current += 1 }
  }, [userId])

  useEffect(() => {
    if (!userId) return
    let active = true
    void (async () => {
      try {
        const { data, error } = await supabase.from('sm_user_settings')
          .select('theme, library_view, library_sort, library_filter, library_instrument, video_order')
          .eq('user_id', userId).maybeSingle()
        if (error) throw new Error(error.message)
        if (active) setLoaded({ userId, state: { status: 'ready', settings: data ? { ...DEFAULT_USER_SETTINGS, ...data } : DEFAULT_USER_SETTINGS } })
      } catch (error) {
        if (active) setLoaded({ userId, state: { status: 'error', settings: DEFAULT_USER_SETTINGS, message: error instanceof Error ? error.message : 'Could not load your settings.' } })
      }
    })()
    return () => { active = false }
  }, [userId, attempt])

  const retry = useCallback(() => {
    setLoaded({ userId, state: { status: 'loading', settings: DEFAULT_USER_SETTINGS } })
    setAttempt((value) => value + 1)
  }, [userId])

  const save = async (settings: UserSettings) => {
    if (!userId) throw new Error('You must be signed in to save settings.')
    const requestGeneration = generation.current
    const { error } = await supabase.from('sm_user_settings').upsert({ user_id: userId, ...settings })
    if (error) throw new Error(error.message)
    if (generation.current === requestGeneration) setLoaded({ userId, state: { status: 'ready', settings } })
  }

  const state: SettingsState = !userId
    ? { status: 'ready', settings: DEFAULT_USER_SETTINGS }
    : loaded.userId === userId ? loaded.state : { status: 'loading', settings: DEFAULT_USER_SETTINGS }
  return { state, save, retry }
}
