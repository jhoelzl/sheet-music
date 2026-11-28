import type { Piece } from '../supabase'
import type { Library } from '../hooks/useLibrary'
import { practicedText } from '../lib/dates'
import { InstrumentIcons, PieceActions, PieceTitle, PracticeButton, StatusPill, TagList } from './PieceParts'
import { Rating } from './Rating'
import { AddToSetlists } from './AddToSetlists'

export function MiniCard({ lib, p, board = false }: { lib: Library; p: Piece; board?: boolean }) {
  const keys = lib.keysOf(p)
  return (
    <article className="piece mini">
      <div className="piece-head">
        <div className="mini-title">
          <PieceTitle lib={lib} p={p} />
          <span className="mini-composer">{lib.composerNamesOf(p)}</span>
        </div>
        <PieceActions lib={lib} p={p} showSetlist={false} />
      </div>
      <div className="mini-meta">
        <InstrumentIcons p={p} />
        {p.pdf_pages ? <span className="page-count">{p.pdf_pages} p.</span> : null}
        {keys.length > 0 && <span className="page-count">{keys.join(' · ')}</span>}
        {p.last_practiced && <span className="practiced-text">{practicedText(p.last_practiced)}</span>}
      </div>
      <TagList lib={lib} p={p} />
      <div className="mini-foot">
        <Rating label="Rating" glyph="★" value={p.rating} onChange={(n) => lib.update(p, { rating: n })} />
        {!board && <StatusPill lib={lib} p={p} />}
        <PracticeButton lib={lib} p={p} />
        <AddToSetlists piece={p} />
      </div>
    </article>
  )
}
