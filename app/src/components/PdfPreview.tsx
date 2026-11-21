import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { Library } from '../hooks/useLibrary'
import { scoresOf } from '../hooks/useLibrary'
import { scoreLabel } from '../lib/scores'
import { PdfViewer } from './PdfViewer'
import { ScoreTags } from './ScoreTags'

export function PdfPreview({ lib }: { lib: Library }) {
  const { preview, pieces, openPdf, openBrowsePdf, closePdf, recordPdfPages, browseScores } = lib
  const closeRef = useRef(closePdf)
  useEffect(() => { closeRef.current = closePdf }, [closePdf])
  const dialogRef = useRef<HTMLDivElement>(null)
  const isOpen = preview !== null
  const piece = preview ? pieces.find((item) => item.id === preview.pieceId) ?? null : null
  const scores = piece ? scoresOf(piece) : []
  const score = scores.find((item) => item.id === preview?.id)
  const browseItems = browseScores?.flatMap((entry, index) => {
    const item = pieces.find((candidate) => candidate.id === entry.pieceId)
    const match = item && scoresOf(item).find((candidate) => candidate.id === entry.scoreId)
    return item && match ? [{ piece: item, score: match, index }] : []
  }) ?? []
  const browseIndex = browseScores?.findIndex((item) => item.scoreId === preview?.id && item.pieceId === preview?.pieceId) ?? -1
  const currentPosition = browseItems.findIndex((item) => item.index === browseIndex)
  const previous = [...browseItems].reverse().find((item) => item.index < browseIndex)
  const next = browseItems.find((item) => item.index > browseIndex)
  const saving = lib.savingScoreIds.size > 0

  useEffect(() => {
    if (!isOpen) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (document.activeElement instanceof HTMLElement && dialogRef.current?.contains(document.activeElement)) {
          document.activeElement.blur()
        }
        closeRef.current()
      } else if (event.key === 'Tab') {
        const elements = dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]')
        if (!elements?.length) return
        if (event.shiftKey && document.activeElement === elements[0]) {
          event.preventDefault()
          elements[elements.length - 1].focus()
        } else if (!event.shiftKey && document.activeElement === elements[elements.length - 1]) {
          event.preventDefault()
          elements[0].focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
      previousFocus?.focus()
    }
  }, [isOpen])

  if (!preview) return null
  return createPortal(
    <div className="modal-backdrop">
      <div ref={dialogRef} className="modal" role="dialog" aria-modal="true" aria-label={`PDF: ${preview.title}`}>
        <div className="modal-head">
          <button type="button" className="btn pdf-close" onClick={closePdf}>{piece ? '← Library' : '← Close'}</button>
          <div className="modal-title">
            <strong>{preview.title}</strong>
            {preview.pages ? <span className="page-count">{preview.pages} {preview.pages === 1 ? 'page' : 'pages'}</span> : null}
          </div>
          {piece && scores.length > 1 && (
            <label className="modal-score">Score
              <select aria-label="Choose score" value={preview.id} onChange={(event) => {
                const next = scores.find((score) => score.id === event.target.value)
                if (next) void (browseScores ? openBrowsePdf(piece, next) : openPdf(piece, next))
              }}>
                {scores.map((score) => <option key={score.id} value={score.id}
                  disabled={Boolean(browseScores && !browseScores.some((item) => item.pieceId === piece.id && item.scoreId === score.id))}>{scoreLabel(score)}</option>)}
              </select>
            </label>
          )}
        </div>
        {browseScores && browseIndex >= 0 && (
          <div className="pdf-browse" role="group" aria-label="Browse scores">
            <button type="button" className="btn" disabled={!previous}
              onClick={() => { if (previous) void openBrowsePdf(previous.piece, previous.score) }}>← Previous</button>
            <span aria-live="polite">{currentPosition < 0 ? 'Score no longer available' : `${currentPosition + 1} / ${browseItems.length}`}</span>
            <button type="button" className="btn" disabled={!next}
              onClick={() => { if (next) void openBrowsePdf(next.piece, next.score) }}>Next →</button>
          </div>
        )}
        {piece && score && (
          <div className="pdf-score-tags">
            <span>Score tags</span>
            <ScoreTags key={score.id} label={`Tags for the score of ${piece.title}`} tags={score.tags}
              suggestions={lib.allScoreTags} disabled={saving} onChange={(tags) => lib.updateScore(piece, score, { tags })} />
          </div>
        )}
        {preview.error ? (
          <div className="pdf-scroll"><p className="pdf-message" role="alert">{preview.error} Close and try again.</p></div>
        ) : preview.url ? (
          <PdfViewer key={preview.url} url={preview.url} onLoad={(pages) => void recordPdfPages(preview.id, pages)} />
        ) : (
          <div className="pdf-scroll"><p className="pdf-message" role="status">Opening PDF…</p></div>
        )}
      </div>
    </div>,
    document.body,
  )
}
