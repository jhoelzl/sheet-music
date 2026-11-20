import type { Composer } from '../supabase'
import { SearchPicker } from './SearchPicker'

export function ComposerPicker({ composers, selectedIds, label, requireOne = false, disabled = false, onChange }: {
  composers: Composer[]
  selectedIds: string[]
  label: string
  requireOne?: boolean
  disabled?: boolean
  onChange: (ids: string[]) => void | Promise<void>
}) {
  return <SearchPicker items={composers} selectedIds={selectedIds} label={label} singular="composer" plural="composers"
    requireOne={requireOne} disabled={disabled} onChange={onChange} />
}
