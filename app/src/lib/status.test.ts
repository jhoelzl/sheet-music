import { describe, expect, it } from 'vitest'
import { nextStatus, statusLabel, statusOf, statusPatch } from './status'
import type { Piece } from '../supabase'

const piece = (play_progress: number): Piece => ({
  id: 'piece-1',
  composer_id: 'composer-1',
  title: 'Nocturne',
  pdf_path: null,
  play_progress,
  difficulty: null,
  rating: null,
  notes: null,
  instruments: ['piano'],
})

describe('piece progress', () => {
  it('cycles progress values forward and backward across the boundaries', () => {
    expect(nextStatus(100, 1)).toBe(0)
    expect(nextStatus(0, -1)).toBe(100)
    expect(nextStatus(50, 1)).toBe(75)
  })

  it('defaults unknown progress to zero and patches a valid status', () => {
    expect(statusOf(piece(12))).toBe(0)
    expect(statusPatch(75)).toEqual({ play_progress: 75 })
    expect(statusLabel(75)).toBe('75%')
  })
})
