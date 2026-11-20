import type { PieceScore } from '../supabase'
import { INSTRUMENTS } from './instruments'

/** Short label for a score, e.g. "Piano · F minor". */
export function scoreLabel(score: PieceScore): string {
  const instrument = INSTRUMENTS.find((item) => item.value === score.instrument)?.label ?? score.instrument
  return [instrument, score.musical_key].filter(Boolean).join(' · ')
}
