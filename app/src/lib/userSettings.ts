import type { Instrument } from '../supabase'
import type { SortKey, View } from './sorting'

export type UserSettings = {
  theme: 'system' | 'light' | 'dark'
  library_view: 'remember' | View
  library_sort: SortKey
  library_filter: 'all' | 'can_play' | 'learned' | 'cannot_play' | 'hard'
  library_instrument: 'all' | Instrument
  video_order: 'original' | 'random'
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  theme: 'system',
  library_view: 'remember',
  library_sort: 'title',
  library_filter: 'all',
  library_instrument: 'all',
  video_order: 'original',
}
