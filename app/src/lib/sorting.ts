import type { Piece } from '../supabase'

export const FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'can_play', label: 'Can fully play (100%)' },
  { value: 'learned', label: 'In progress (25–75%)' },
  { value: 'cannot_play', label: "Can't play yet (0%)" },
  { value: 'hard', label: 'Hard (4+)' },
]

export type SortKey = 'title' | 'rating' | 'difficulty' | 'recent'

export const SORTS: { value: SortKey; label: string }[] = [
  { value: 'title', label: 'Title' },
  { value: 'rating', label: 'Rating (best first)' },
  { value: 'difficulty', label: 'Difficulty (hardest first)' },
  { value: 'recent', label: 'Recently added' },
]

export type View = 'grouped' | 'table' | 'grid' | 'board'
export const VIEWS: { value: View; label: string }[] = [
  { value: 'grouped', label: 'Grouped' },
  { value: 'table', label: 'Table' },
  { value: 'grid', label: 'Grid' },
  { value: 'board', label: 'Board' },
]
export type TableKey = 'title' | 'composer' | 'status' | 'difficulty' | 'rating' | 'pages' | 'practiced'

export function sortPieces(list: Piece[], key: SortKey): Piece[] {
  const byTitle = (a: Piece, b: Piece) => a.title.localeCompare(b.title)
  const byNumber = (get: (p: Piece) => number | null) => (a: Piece, b: Piece) =>
    (get(b) ?? -1) - (get(a) ?? -1) || byTitle(a, b)
  const cmp = {
    title: byTitle,
    rating: byNumber((p) => p.rating),
    difficulty: byNumber((p) => p.difficulty),
    recent: (a: Piece, b: Piece) => (b.created_at ?? '').localeCompare(a.created_at ?? '') || byTitle(a, b),
  }[key]
  return [...list].sort(cmp)
}
