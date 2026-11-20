import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Piece } from '../supabase'
import { PdfViewer } from './PdfViewer'
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon, PauseIcon } from './icons'

export type PlayerEntry = {
  id: string
  title: string
  subtitle: string | null
  composers: string
  comment: string | null
  piece: Piece | null
}

/**
 * Live mode: one score at a time, full screen, with the next tune one tap away.
 * Placeholders (breaks, announcements) show as cue cards so the running order
 * stays complete on stage.
 */
export function SetlistPlayer({ name, entries, pdfUrl, onClose, onPages }: {
  name: string
  entries: PlayerEntry[]
  pdfUrl: (p: Piece) => Promise<string | null>
  onClose: () => void
  onPages?: (p: Piece, pages: number) => void
}) {
  const [index, setIndex] = useState(0)
  // The signed URL and any failure belong to a specific tune, so a stale result
  // for the previous tune is ignored instead of cleared when the tune changes.
  const [signed, setSigned] = useState<{ id: string; url: string } | null>(null)
  const [failure, setFailure] = useState<{ id: string; message: string } | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  useEffect(() => { closeRef.current = onClose }, [onClose])
  const current = entries[index] ?? null
  const piece = current?.piece ?? null
  const pieceId = piece?.id ?? null
  const pdfPath = piece?.pdf_path ?? null
  const pieceRef = useRef<Piece | null>(piece)
  useEffect(() => { pieceRef.current = piece }, [piece])
  const pdfUrlRef = useRef(pdfUrl)
  useEffect(() => { pdfUrlRef.current = pdfUrl }, [pdfUrl])
  const last = entries.length - 1
  const go = (next: number) => setIndex(Math.max(0, Math.min(next, last)))
  const url = signed && signed.id === pieceId ? signed.url : null
  const error = failure && failure.id === pieceId ? failure.message : ''

  // Sign the score of the tune on stage; reload it whenever the tune changes.
  useEffect(() => {
    if (!pieceId || !pdfPath) return
    let active = true
    void (async () => {
      try {
        const next = await pdfUrlRef.current(pieceRef.current!)
        if (!active) return
        if (!next) throw new Error('This tune has no score attached.')
        setSigned({ id: pieceId, url: next })
      } catch (reason) {
        if (active) setFailure({ id: pieceId, message: reason instanceof Error ? reason.message : 'Could not open this score.' })
      }
    })()
    return () => { active = false }
  }, [pieceId, pdfPath])

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialogRef.current?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
      previousFocus?.focus()
    }
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current() }
      else if (event.key === 'ArrowRight') { event.preventDefault(); setIndex((i) => Math.min(i + 1, last)) }
      else if (event.key === 'ArrowLeft') { event.preventDefault(); setIndex((i) => Math.max(i - 1, 0)) }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [last])

  if (!current) return null
  return createPortal(
    <div ref={dialogRef} className="player" role="dialog" aria-modal="true" aria-label={`Live mode: ${name}`} tabIndex={-1}>
      <header className="player-head">
        <button type="button" className="btn player-exit" onClick={onClose}>{CloseIcon} Exit</button>
        <div className="player-heading">
          <strong>{name}</strong>
          <span aria-live="polite">Tune {index + 1} of {entries.length}</span>
        </div>
        <label className="player-jump">Jump to
          <select aria-label="Jump to tune" value={index} onChange={(event) => go(Number(event.target.value))}>
            {entries.map((entry, position) => (
              <option key={entry.id} value={position}>{position + 1}. {entry.title}</option>
            ))}
          </select>
        </label>
      </header>
      <div className="player-body">
        {error ? (
          <p className="player-message" role="alert">{error}</p>
        ) : piece && !pdfPath ? (
          <div className="player-cue">
            <span className="setlist-marker" aria-hidden="true">{PauseIcon}</span>
            <h3>{current.title}</h3>
            <p>No score attached to this tune. Attach a PDF in the library to see it on stage.</p>
          </div>
        ) : piece ? (
          url ? <PdfViewer key={url} url={url} onLoad={(pages) => onPages?.(piece, pages)} />
            : <p className="player-message" role="status">Opening score…</p>
        ) : (
          <div className="player-cue">
            <span className="setlist-marker" aria-hidden="true">{PauseIcon}</span>
            <h3>{current.title}</h3>
            <p>{current.comment ?? 'No notes for this slot.'}</p>
          </div>
        )}
      </div>
      <footer className="player-foot">
        <button type="button" className="btn player-step" aria-label="Previous tune" title="Previous tune (←)" disabled={index === 0} onClick={() => go(index - 1)}>{ChevronLeftIcon} Previous</button>
        <div className="player-current">
          <strong>{current.title}</strong>
          {current.composers && <span>{current.composers}{current.subtitle ? ` · ${current.subtitle}` : ''}</span>}
          {current.comment && <em>{current.comment}</em>}
        </div>
        <button type="button" className="btn primary player-step" aria-label="Next tune" title="Next tune (→)" disabled={index === last} onClick={() => go(index + 1)}>Next {ChevronRightIcon}</button>
      </footer>
    </div>,
    document.body,
  )
}
