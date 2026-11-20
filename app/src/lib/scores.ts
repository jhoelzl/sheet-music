import type { PieceScore } from '../supabase'
import { INSTRUMENTS } from './instruments'

/** Short label for a score, e.g. "Piano · F minor" or "Lead sheet · C major". */
export function scoreLabel(score: PieceScore): string {
  const type = score.lead_sheet ? 'Lead sheet' : INSTRUMENTS.find((item) => item.value === score.instrument)?.label ?? 'Score'
  return [type, score.musical_key].filter(Boolean).join(' · ')
}
