import type { Piece } from '../supabase'
import type { Library } from '../hooks/useLibrary'
import { practicedText } from '../lib/dates'
import { nextStatus, statusOf, statusPatch } from '../lib/status'
import { InstrumentIcons, PieceActions, PieceTitle, PracticeButton, StatusPill, TagList } from './PieceParts'
import { Rating } from './Rating'

export function MiniCard({ lib, p, board = false }: { lib: Library; p: Piece; board?: boolean }) {
  const s = statusOf(p)
  return (
    <article className="piece mini">
      <div className="piece-head">
        <div className="mini-title">
          <PieceTitle lib={lib} p={p} />
          <span className="mini-composer">{lib.composerNameOf(p.composer_id)}</span>
        </div>
        <PieceActions lib={lib} p={p} />
      </div>
      <div className="mini-meta">
        <InstrumentIcons p={p} />
        {p.pdf_pages ? <span className="page-count">{p.pdf_pages} p.</span> : null}
        {p.last_practiced && <span className="practiced-text">{practicedText(p.last_practiced)}</span>}
      </div>
      <TagList lib={lib} p={p} />
      <div className="mini-foot">
        <Rating label="Rating" glyph="★" value={p.rating} onChange={(n) => lib.update(p, { rating: n })} />
        {board ? (
          <span className="move-btns">
            <button className="icon-btn" aria-label="Move back" title="Move back" disabled={s === 0} onClick={() => lib.update(p, statusPatch(nextStatus(s, -1)))}>←</button>
            <button className="icon-btn" aria-label="Move forward" title="Move forward" disabled={s === 100} onClick={() => lib.update(p, statusPatch(nextStatus(s, 1)))}>→</button>
          </span>
        ) : <StatusPill lib={lib} p={p} />}
        <PracticeButton lib={lib} p={p} />
      </div>
    </article>
  )
}
