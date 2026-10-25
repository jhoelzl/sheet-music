import { describe, expect, it } from 'vitest'
import { sortPieces } from './sorting'
import type { Piece } from '../supabase'

const piece = (title: string, rating: number | null, created_at: string): Piece => ({
  id: title,
  composer_id: 'composer-1',
  title,
  pdf_path: null,
  play_progress: 0,
  difficulty: null,
  rating,
  notes: null,
  instruments: ['piano'],
  created_at,
})

describe('sortPieces', () => {
  it('sorts by rating descending and uses title for ties and missing ratings', () => {
    const input = [
      piece('Waltz', null, '2025-01-01'),
      piece('Ballade', 5, '2025-01-02'),
      piece('Etude', 5, '2025-01-03'),
    ]

    expect(sortPieces(input, 'rating').map(({ title }) => title)).toEqual(['Ballade', 'Etude', 'Waltz'])
    expect(input.map(({ title }) => title)).toEqual(['Waltz', 'Ballade', 'Etude'])
  })

  it('sorts recently added first with a title tie-breaker', () => {
    const input = [
      piece('Waltz', null, '2025-01-02'),
      piece('Etude', null, '2025-01-02'),
      piece('Ballade', null, '2025-01-01'),
    ]

    expect(sortPieces(input, 'recent').map(({ title }) => title)).toEqual(['Etude', 'Waltz', 'Ballade'])
  })
})
