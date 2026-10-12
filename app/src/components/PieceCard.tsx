import type { Piece } from '../supabase'
import type { Library } from '../hooks/useLibrary'
import { practicedText } from '../lib/dates'
import { INSTRUMENTS, toggleInstrument } from '../lib/instruments'
import { LINK_TYPES, linkLabel, safeUrl } from '../lib/links'
import { STATUSES, statusOf, statusPatch } from '../lib/status'
import { CloseIcon } from './icons'
import { EditDeleteButtons, PieceTitle, PracticeButton } from './PieceParts'
import { Rating } from './Rating'
import { TagInput } from './TagInput'

export function PieceCard({ lib, p }: { lib: Library; p: Piece }) {
  const status = statusOf(p)
  const pending = !!p.pdf_path && 'pdf_pages' in p && p.pdf_pages == null && !lib.countFailed.has(p.id)
  return (
    <article className="piece">
      <div className="piece-head">
        <div className="piece-titleline">
          <PieceTitle lib={lib} p={p} />
          {p.pdf_pages ? <span className="page-count" title="Pages in the PDF">{p.pdf_pages} {p.pdf_pages === 1 ? 'page' : 'pages'}</span> : null}
          {pending && <span className="skeleton" role="status" aria-label="Counting pages" />}
        </div>
        <div className="piece-actions">
          {!p.pdf_path && (
            <label className={`attach-btn${lib.uploadingId === p.id ? ' busy' : ''}`}>
              {lib.uploadingId === p.id ? 'Uploading…' : '+ Attach PDF'}
              <input type="file" accept="application/pdf" hidden disabled={lib.uploadingId === p.id}
                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void lib.attachPdf(p, f) }} />
            </label>
          )}
          <EditDeleteButtons lib={lib} p={p} />
        </div>
      </div>
      <input className="notes" aria-label={`Notes for ${p.title}`} placeholder="Add a note…" defaultValue={p.notes ?? ''} onBlur={(e) => { if (e.target.value !== (p.notes ?? '')) lib.update(p, { notes: e.target.value }) }} />
      <div className="piece-row">
        <TagInput tags={p.tags ?? []} suggestions={lib.allTags} label={`Tags for ${p.title}`} onChange={(tags) => lib.update(p, { tags })} />
      </div>
      <div className="piece-row">
        <div className="chip-group" role="group" aria-label={`Instruments for ${p.title}`}>
          {INSTRUMENTS.map((i) => (
            <button key={i.value} className={`chip${p.instruments.includes(i.value) ? ' on' : ''}`} aria-pressed={p.instruments.includes(i.value)} title={i.label}
              onClick={() => lib.update(p, { instruments: toggleInstrument(p.instruments, i.value) })}>{i.icon} {i.label}</button>
          ))}
        </div>
        <div className={`progress s${status}`}>
          <input type="range" min={0} max={STATUSES.length - 1} step={1} value={STATUSES.findIndex((s) => s.value === status)}
            aria-label={`Progress for ${p.title}`}
            aria-valuetext={STATUSES.find((s) => s.value === status)?.label}
            onChange={(e) => { const next = STATUSES[Number(e.target.value)].value; if (next !== status) lib.update(p, statusPatch(next)) }} />
          <div className="progress-labels" aria-hidden="true">
            {STATUSES.map((st) => (
              <button key={st.value} type="button" tabIndex={-1} className={status === st.value ? 'on' : ''} title={st.label}
                onClick={() => { if (status !== st.value) lib.update(p, statusPatch(st.value)) }}>{st.short}</button>
            ))}
          </div>
        </div>
      </div>
      <div className="piece-row piece-foot">
        <div className="links">
          {(p.links ?? []).map((link) => {
            const href = safeUrl(link.url)
            if (!href) return null
            const label = linkLabel(link, p.links ?? [])
            return (
              <span className={`link-chip ${link.type}`} key={link.url}>
                <a href={href} target="_blank" rel="noopener noreferrer" title={href}>{LINK_TYPES[link.type].glyph}{label}</a>
                <button className="link-remove" aria-label={`Remove ${label} link`} title="Remove link" onClick={() => lib.removeLink(p, link)}>{CloseIcon}</button>
              </span>
            )
          })}
          {lib.openLink === p.id ? (
            <input className="link-input" autoFocus type="url" aria-label={`Add link for ${p.title}`} placeholder="Paste a YouTube, Spotify, Instagram or other link"
              onBlur={(e) => lib.addLink(p, e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { e.currentTarget.value = ''; e.currentTarget.blur() } }} />
          ) : (
            <button className="add-link" title="Add a YouTube, Spotify, Instagram or other link" onClick={() => lib.setOpenLink(p.id)}>+ Link</button>
          )}
          <PracticeButton lib={lib} p={p} long />
          {p.last_practiced && <span className="practiced-text">{practicedText(p.last_practiced)}</span>}
        </div>
        <div className="meters">
          <div className="meter"><span>Difficulty</span><Rating label="Difficulty" glyph="●" value={p.difficulty} onChange={(n) => lib.update(p, { difficulty: n })} /></div>
          <div className="meter stars"><span>Rating</span><Rating label="Rating" glyph="★" value={p.rating} onChange={(n) => lib.update(p, { rating: n })} /></div>
        </div>
      </div>
    </article>
  )
}
