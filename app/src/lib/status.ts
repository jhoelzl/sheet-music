import type { Piece } from '../supabase'

export type Status = 0 | 25 | 50 | 75 | 100

export const STATUSES: { value: Status; label: string; short: string }[] = [
  { value: 0, label: "Can't play yet (0%)", short: '0%' },
  { value: 25, label: 'Just started (25%)', short: '25%' },
  { value: 50, label: 'Can partly play (50%)', short: '50%' },
  { value: 75, label: 'Almost there (75%)', short: '75%' },
  { value: 100, label: 'Can fully play (100%)', short: '100%' },
]

export function statusOf(p: Piece): Status {
  return (STATUSES.find((s) => s.value === p.play_progress)?.value ?? 0) as Status
}

export function statusPatch(s: Status): Partial<Piece> {
  return { play_progress: s }
}

export function nextStatus(s: Status, step: 1 | -1): Status {
  return STATUSES[(STATUSES.findIndex((x) => x.value === s) + step + STATUSES.length) % STATUSES.length].value
}

export function statusLabel(s: Status): string {
  return STATUSES.find((x) => x.value === s)?.short ?? ''
}
