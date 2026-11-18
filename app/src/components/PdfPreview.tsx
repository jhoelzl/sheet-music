import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { Library } from '../hooks/useLibrary'
import { PdfViewer } from './PdfViewer'

export function PdfPreview({ lib }: { lib: Library }) {
  const { preview, closePdf, recordPdfPages } = lib
  const closeRef = useRef(closePdf)
  useEffect(() => { closeRef.current = closePdf }, [closePdf])
  const dialogRef = useRef<HTMLDivElement>(null)
  const isOpen = preview !== null

  useEffect(() => {
    if (!isOpen) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeRef.current()
      } else if (event.key === 'Tab') {
        const elements = dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]')
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
          <button type="button" className="btn pdf-close" onClick={closePdf}>← Library</button>
          <div className="modal-title">
            <strong>{preview.title}</strong>
            {preview.pages ? <span className="page-count">{preview.pages} {preview.pages === 1 ? 'page' : 'pages'}</span> : null}
          </div>
        </div>
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
