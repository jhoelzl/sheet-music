import type { Library } from '../hooks/useLibrary'
import { CloseIcon } from './icons'

export function PdfPreview({ lib }: { lib: Library }) {
  const { preview, setPreview } = lib
  if (!preview) return null
  return (
    <div className="modal-backdrop" onClick={() => setPreview(null)}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={`PDF preview: ${preview.title}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">
            <strong>{preview.title}</strong>
            {preview.pages ? <span className="page-count">{preview.pages} {preview.pages === 1 ? 'page' : 'pages'}</span> : null}
          </div>
          <a className="btn" href={preview.url} target="_blank" rel="noopener noreferrer">Open in new tab ↗</a>
          <button type="button" className="icon-btn" autoFocus aria-label="Close preview" title="Close (Esc)" onClick={() => setPreview(null)}>{CloseIcon}</button>
        </div>
        <iframe className="modal-frame" src={preview.url} title={`PDF: ${preview.title}`} />
      </div>
    </div>
  )
}
