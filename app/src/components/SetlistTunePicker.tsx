import { useState } from 'react'
import type { Piece } from '../supabase'
import { CloseIcon } from './icons'

const MAX_RESULTS = 8

/**
 * Tune selection for a setlist: the chosen tunes as removable chips plus a
 * search box with a results dropdown. Same interaction as the composer picker
 * on the tunes page, so picking tunes feels like picking composers.
 */
export function SetlistTunePicker({ pieces, selectedIds, setlistName, disabled = false, composerNamesOf, onAdd, onRemove }: {
  pieces: Piece[]
  selectedIds: string[]
  setlistName: string
  disabled?: boolean
  composerNamesOf: (p: Piece) => string
  onAdd: (id: string) => void
  onRemove: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const terms = normalize(query.trim()).split(/\s+/).filter(Boolean)
  const selected = selectedIds.map((id) => pieces.find((piece) => piece.id === id)).filter((piece): piece is Piece => piece !== undefined)
  const matches = pieces.filter((piece) => {
    if (selectedIds.includes(piece.id)) return false
    if (!terms.length) return true
    const haystack = normalize([piece.title, piece.subtitle ?? '', piece.musical_key ?? '', composerNamesOf(piece)].join(' '))
    return terms.every((term) => haystack.includes(term))
  })
  const shown = matches.slice(0, MAX_RESULTS)
  // Keep the search box mounted even while a save is in flight, so the caret stays put.
  const remaining = pieces.length - selected.length

  const add = (id: string) => {
    setQuery('')
    onAdd(id)
  }

  return (
    <div className="composer-picker" role="group" aria-label={`Tunes in ${setlistName}`}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) { setQuery(''); setOpen(false) } }}>
      <div className="composer-picker-chips">
        {selected.length === 0 && <span className="muted">No tunes yet.</span>}
        {selected.map((piece) => (
          <span className="tag" key={piece.id}>
            {piece.title}
            <button type="button" className="tag-remove" aria-label={`Remove ${piece.title} from ${setlistName}`}
              title={`Remove ${piece.title}`} disabled={disabled} onClick={() => onRemove(piece.id)}>{CloseIcon}</button>
          </span>
        ))}
      </div>
      {remaining > 0 && (
        <div className="composer-search">
          <input type="search" aria-label="Search tunes" placeholder="Search tunes" value={query} disabled={disabled}
            onFocus={() => setOpen(true)}
            onChange={(event) => { setQuery(event.target.value); setOpen(true) }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') { setQuery(''); setOpen(false) }
              if (event.key === 'Enter' && shown.length) {
                event.preventDefault()
                add(shown[0].id)
              }
            }} />
          {open && (
            <div className="composer-results" aria-live="polite">
              {shown.map((piece) => (
                <button type="button" key={piece.id} className="tune-result" disabled={disabled}
                  aria-label={`Add ${piece.title} to ${setlistName}`} onPointerDown={(event) => event.preventDefault()}
                  onClick={() => add(piece.id)}>
                  <strong>{piece.title}</strong>
                  <small>{[composerNamesOf(piece), piece.musical_key, piece.subtitle].filter(Boolean).join(' · ')}</small>
                </button>
              ))}
              {!shown.length && <span>No matching tunes</span>}
              {matches.length > MAX_RESULTS && <span>Keep typing to narrow results</span>}
            </div>
          )}
        </div>
      )}
      {remaining === 0 && pieces.length > 0 && <p className="muted">Every tune in your library is in this setlist.</p>}
      {!pieces.length && <p className="muted">Add pieces to your library first.</p>}
    </div>
  )
}
