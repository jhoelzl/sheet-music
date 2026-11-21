import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import type { Piece } from '../supabase'
import type { UploadStage } from '../lib/documentUpload'
import type { Library } from '../hooks/useLibrary'
import { PdfIcon } from './icons'
import { KeySelect } from './KeySelect'
import { DeleteButton } from './DeleteButton'
import { DocumentInput } from './DocumentInput'
import { ScoreTags } from './ScoreTags'
import { UploadStatus } from './UploadStatus'

/** The piece's scores: one row per PDF, each with its own key and tags. */
export function PieceScores({ lib, p }: { lib: Library; p: Piece }) {
  const scores = lib.scoresOf(p)
  const formHeadingId = useId()
  const [adding, setAdding] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [processingPhotos, setProcessingPhotos] = useState(false)
  const [key, setKey] = useState('')
  const [tags, setTags] = useState<string[]>(['piano'])
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState('')
  const [uploadStage, setUploadStage] = useState<UploadStage | null>(null)
  const [uploaded, setUploaded] = useState(false)

  const clearForm = () => {
    setFile(null); setKey(''); setTags(['piano']); setAttemptId(null); setUploadError(''); setAdding(false)
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!file || processingPhotos || lib.uploadingId === p.id) return
    const id = attemptId ?? crypto.randomUUID()
    setAttemptId(id)
    setUploadError('')
    setUploaded(false)
    void lib.addScore(p, file, key.trim() || null, tags, id, setUploadStage).then((result) => {
      if (result.error) {
        if (result.newAttempt) setAttemptId(crypto.randomUUID())
        setUploadError(result.error)
      }
      else { clearForm(); setUploaded(true) }
    })
  }

  return (
    <div className="piece-scores">
      <div className="piece-scores-heading">
        <span className="piece-scores-label">Saved scores</span>
        <span className="piece-scores-count">{scores.length}</span>
      </div>
      {uploaded && <UploadStatus state="success" title="Score uploaded and saved." />}
      {scores.length === 0 && <p className="muted">No scores saved yet. Add your first score below.</p>}
      <ul className="score-list" aria-label={`Saved scores for ${p.title}`}>
        {scores.map((score, index) => (
          <li className="score-row" key={score.id}>
            <div className="score-row-heading">
              <span className="score-row-icon" aria-hidden="true">{PdfIcon}</span>
              <div className="score-row-title">
                <strong>Score {index + 1}</strong>
                <span>Saved{score.pdf_pages ? ` · ${score.pdf_pages} ${score.pdf_pages === 1 ? 'page' : 'pages'}` : ''}</span>
              </div>
              <div className="score-row-actions">
                <button type="button" className="icon-btn" aria-label={`Open score ${index + 1} for ${p.title}`} title="Open this score"
                  onClick={() => void lib.openPdf(p, score)}>{PdfIcon}</button>
                <DeleteButton label={`Delete score ${index + 1} for ${p.title}`}
                  disabled={lib.savingScoreIds.has(score.id) || lib.uploadingId === p.id} onClick={() => lib.removeScore(p, score)} />
              </div>
            </div>
            <div className="score-row-details">
              <div className="score-field"><span>Key</span>
                <KeySelect label={`Key for score ${index + 1} of ${p.title}`} value={score.musical_key ?? ''}
                  disabled={lib.savingScoreIds.has(score.id) || lib.uploadingId === p.id}
                  onChange={(value) => lib.updateScore(p, score, { musical_key: value || null })} />
              </div>
              <div className="score-field"><span>Tags</span>
                <ScoreTags label={`Tags for score ${index + 1} of ${p.title}`} tags={score.tags} suggestions={lib.allScoreTags}
                  disabled={lib.savingScoreIds.has(score.id) || lib.uploadingId === p.id} onChange={(next) => lib.updateScore(p, score, { tags: next })} />
              </div>
            </div>
          </li>
        ))}
      </ul>
      {adding ? (
        <form className="document-add" onSubmit={submit} aria-labelledby={formHeadingId}>
          <div className="document-add-heading">
            <span className="document-add-icon" aria-hidden="true">+</span>
            <div>
              <span className="document-add-kicker">New score</span>
              <h4 id={formHeadingId}>Add a score to {p.title}</h4>
              <p>Your saved scores will stay unchanged.</p>
            </div>
          </div>
          {lib.uploadingId === p.id && <UploadStatus key={uploadStage?.message} state="pending" stage={uploadStage} title="Uploading new score" />}
          {uploadError && <UploadStatus state="error" stage={uploadStage} title="Upload failed" detail={`${uploadError}${/[.!?]$/.test(uploadError) ? '' : '.'} Your document is still selected; retry without scanning again.`}>
            <button type="submit" className="btn primary" disabled={lib.uploadingId !== null}>Retry upload</button>
            <button type="button" className="link" onClick={() => {
              if (!window.confirm('The previous request may still complete. Check the score list before starting over. Discard this upload?')) return
              clearForm()
            }}>Cancel</button>
          </UploadStatus>}
          {file && (lib.uploadingId === p.id || uploadError) && <div className="document-add-file"><span>{lib.uploadingId === p.id ? 'Uploading document' : 'Selected document'}</span><strong>“{file.name}”</strong></div>}
          <div className="document-add-section" hidden={attemptId !== null}>
            <span className="document-add-step">1 <span>Choose a document</span></span>
            <DocumentInput label={`PDF for ${p.title}`} file={file} disabled={attemptId !== null} onChange={setFile} onProcessingChange={setProcessingPhotos} />
          </div>
          <div className="document-add-section" hidden={attemptId !== null}>
            <span className="document-add-step">2 <span>Score details</span></span>
            <div className="document-add-details">
              <div className="score-field"><span>Key</span><KeySelect label={`Key for new score of ${p.title}`} value={key} onChange={setKey} disabled={attemptId !== null} /></div>
              <div className="score-field"><span>Tags</span><ScoreTags label={`Tags for new score of ${p.title}`} tags={tags} suggestions={lib.allScoreTags}
                disabled={attemptId !== null} onChange={setTags} /></div>
            </div>
          </div>
          {!uploadError && <div className="document-add-actions">
            <button type="submit" className="btn primary" disabled={!file || processingPhotos || lib.uploadingId !== null}>{lib.uploadingId === p.id ? 'Uploading…' : 'Add score'}</button>
            <button type="button" className="link" disabled={lib.uploadingId === p.id} onClick={() => {
              if (attemptId && !window.confirm('The previous request may still complete. Check the score list before starting over. Discard this upload?')) return
              clearForm()
            }}>Cancel</button>
          </div>}
        </form>
      ) : (
        <button type="button" className="btn" onClick={() => { setUploaded(false); setAdding(true) }}>+ Add score</button>
      )}
    </div>
  )
}
