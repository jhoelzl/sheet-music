import type { PieceScore } from '../supabase'
import { INSTRUMENTS } from './instruments'

export const SCORE_TAGS = [
  ...INSTRUMENTS.map(({ value, label }) => ({ value, label })),
  { value: 'lead sheet', label: 'Lead sheet' },
  { value: 'solo', label: 'Solo' },
]

export function toggleScoreTag(tags: string[], tag: string): string[] {
  return tags.includes(tag) ? tags.filter((item) => item !== tag) : [...tags, tag]
}

/** Short label for a score, e.g. "Piano · Solo · F minor". */
export function scoreLabel(score: PieceScore): string {
  const tags = score.tags.map((tag) => SCORE_TAGS.find((item) => item.value === tag)?.label ?? tag)
  return [...(tags.length ? tags : ['Score']), score.musical_key].filter(Boolean).join(' · ')
}
