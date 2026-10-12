import type { Instrument } from '../supabase'

export const INSTRUMENTS: { value: Instrument; label: string; icon: string }[] = [
  { value: 'piano', label: 'Piano', icon: '🎹' },
  { value: 'guitar', label: 'Guitar', icon: '🎸' },
]

export function toggleInstrument(current: Instrument[], i: Instrument): Instrument[] {
  const next = current.includes(i) ? current.filter((x) => x !== i) : [...current, i]
  return next.length ? next : current
}
