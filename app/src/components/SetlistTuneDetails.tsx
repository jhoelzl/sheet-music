import type { Piece } from '../supabase'
import { practicedText } from '../lib/dates'
import { INSTRUMENTS } from '../lib/instruments'
import { LINK_TYPES, linkLabel, safeUrl } from '../lib/links'
import { STATUSES, statusOf } from '../lib/status'
import { PdfIcon } from './icons'

/** Read-only summary of a tune inside a setlist, with a shortcut to its score. */
export function SetlistTuneDetails({ piece, composerNamesOf, onOpenPdf }: {
  piece: Piece
  composerNamesOf: (p: Piece) => string
  onOpenPdf: (p: Piece) => void
}) {
  const status = STATUSES.find((item) => item.value === statusOf(piece))
  const instruments = INSTRUMENTS.filter((item) => piece.instruments.includes(item.value)).map((item) => item.label)
  const links = (piece.links ?? []).flatMap((link) => {
    const href = safeUrl(link.url)
    return href ? [{ href, label: linkLabel(link, piece.links ?? []), type: link.type }] : []
  })
  return (
    <div className="setlist-details">
      <dl className="setlist-facts">
        <div><dt>Composers</dt><dd>{composerNamesOf(piece) || 'Unknown'}</dd></div>
        <div><dt>Key</dt><dd>{piece.musical_key || '—'}</dd></div>
        <div><dt>Instruments</dt><dd>{instruments.join(', ') || '—'}</dd></div>
        <div><dt>Progress</dt><dd>{status?.label ?? '—'}</dd></div>
        <div><dt>Difficulty</dt><dd>{piece.difficulty ? `${piece.difficulty} / 5` : '—'}</dd></div>
        <div><dt>Rating</dt><dd>{piece.rating ? `${piece.rating} / 5` : '—'}</dd></div>
        <div><dt>Score</dt><dd>{piece.pdf_path ? `${piece.pdf_pages ?? '?'} ${piece.pdf_pages === 1 ? 'page' : 'pages'}` : 'No PDF attached'}</dd></div>
        <div><dt>Practice</dt><dd>{piece.last_practiced ? practicedText(piece.last_practiced) : 'Not practised yet'}</dd></div>
      </dl>
      {(piece.tags ?? []).length > 0 && (
        <p className="setlist-detail-tags">{(piece.tags ?? []).map((tag) => <span className="tag" key={tag}>{tag}</span>)}</p>
      )}
      {piece.notes && <p className="setlist-detail-notes">{piece.notes}</p>}
      {links.length > 0 && (
        <p className="links">
          {links.map((link) => (
            <span className={`link-chip ${link.type}`} key={link.href}>
              <a href={link.href} target="_blank" rel="noopener noreferrer" title={link.href}>{LINK_TYPES[link.type].glyph}{link.label}</a>
            </span>
          ))}
        </p>
      )}
      <div className="setlist-detail-actions">
        <button type="button" className="btn" disabled={!piece.pdf_path} title={piece.pdf_path ? 'Open the score' : 'No PDF attached to this tune'}
          onClick={() => onOpenPdf(piece)}>{PdfIcon} Open score</button>
      </div>
    </div>
  )
}
