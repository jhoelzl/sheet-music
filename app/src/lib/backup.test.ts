import { describe, expect, it } from 'vitest'
import type { PieceScore } from '../supabase'
import { backupFileName, buildBackup, scoreFileName } from './backup'

const score = (over: Partial<PieceScore> = {}): PieceScore => ({
  id: 's1', piece_id: 'p1', pdf_path: 'u/a.pdf', pdf_pages: 2, musical_key: 'F minor', instrument: 'piano', lead_sheet: false, position: 0, ...over,
})

describe('backup helpers', () => {
  it('names the archive after the export date', () => {
    expect(backupFileName(new Date('2026-05-04T10:00:00Z'))).toBe('sheet-music-backup-2026-05-04.zip')
  })

  it('stamps the payload with the app, version and time', () => {
    const payload = buildBackup({ composers: [], pieces: [], piece_composers: [], scores: [], setlists: [], setlist_pieces: [], practice_log: [], lesson_groups: [], lessons: [], teaching_materials: [], lesson_pieces: [], lesson_materials: [], user_settings: [] })
    expect(payload.app).toBe('sheet-music')
    expect(payload.version).toBe(1)
    expect(payload.exported_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  })

  it('names a score file from its piece, type and key', () => {
    expect(scoreFileName(score(), 'Moanin’')).toBe('scores/Moanin’ - Piano · F minor (s1).pdf')
  })

  it('names a lead sheet and strips path characters', () => {
    expect(scoreFileName(score({ id: 's2', lead_sheet: true, instrument: null, musical_key: null }), 'A/B: C'))
      .toBe('scores/A B C - Lead sheet (s2).pdf')
  })
})
