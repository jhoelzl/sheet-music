import type { Composer, Piece, PracticeLog } from '../supabase'
import { ActivityCalendar } from './ActivityCalendar'

export function PracticeCalendar({ logs, pieces, composers }: { logs: PracticeLog[]; pieces: Piece[]; composers: Composer[] }) {
  const entries = logs.map((log) => {
    const piece = pieces.find((item) => item.id === log.piece_id)
    return {
      id: log.id,
      date: log.practiced_on,
      title: piece?.title,
      subtitle: piece && (piece.composer_ids ?? [piece.composer_id]).map((id) => composers.find((c) => c.id === id)?.name).filter(Boolean).join(', '),
    }
  })
  return <ActivityCalendar entries={entries} kind="practice" />
}
