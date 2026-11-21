import { describe, expect, it } from 'vitest'
import type { PieceScore } from '../supabase'
import { scoreLabel } from './scores'

const base: PieceScore = {
  id: 's1', piece_id: 'p1', pdf_path: 'a.pdf', pdf_pages: 2, musical_key: null, instrument: null, lead_sheet: false, tags: [], position: 0,
}

describe('scoreLabel', () => {
  it('names an instrument score with its key', () => {
    expect(scoreLabel({ ...base, tags: ['guitar'], musical_key: 'C major' })).toBe('Guitar · C major')
  })

  it('names a lead sheet', () => {
    expect(scoreLabel({ ...base, tags: ['lead sheet'], musical_key: 'F minor' })).toBe('Lead sheet · F minor')
  })

  it('includes multiple and custom tags in the label', () => {
    expect(scoreLabel({ ...base, tags: ['piano', 'lead sheet', 'solo', 'duet'], musical_key: 'C major' }))
      .toBe('Piano · Lead sheet · Solo · duet · C major')
  })

  it('falls back to "Score" when there is no instrument or key', () => {
    expect(scoreLabel(base)).toBe('Score')
  })
})
