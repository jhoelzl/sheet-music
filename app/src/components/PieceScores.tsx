import { useState } from 'react'
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
      <span className="piece-scores-label">Scores</span>
      {uploaded && <UploadStatus state="success" title="Score uploaded and saved." />}
      {scores.length === 0 && <p className="muted">No PDFs attached yet.</p>}
      <ul className="score-list">
        {scores.map((score, index) => (
          <li className="score-row" key={score.id}>
            <KeySelect label={`Key for score ${index + 1} of ${p.title}`} value={score.musical_key ?? ''}
              disabled={lib.savingScoreIds.has(score.id) || lib.uploadingId === p.id}
              onChange={(value) => lib.updateScore(p, score, { musical_key: value || null })} />
            <ScoreTags label={`Tags for score ${index + 1} of ${p.title}`} tags={score.tags} suggestions={lib.allScoreTags}
              disabled={lib.savingScoreIds.has(score.id) || lib.uploadingId === p.id} onChange={(next) => lib.updateScore(p, score, { tags: next })} />
            {score.pdf_pages ? <span className="page-count">{score.pdf_pages} {score.pdf_pages === 1 ? 'page' : 'pages'}</span> : null}
            <button type="button" className="icon-btn" aria-label={`Open score ${index + 1} for ${p.title}`} title="Open this score"
              onClick={() => void lib.openPdf(p, score)}>{PdfIcon}</button>
            <DeleteButton label={`Delete score ${index + 1} for ${p.title}`}
              disabled={lib.savingScoreIds.has(score.id) || lib.uploadingId === p.id} onClick={() => lib.removeScore(p, score)} />
          </li>
        ))}
      </ul>
      {adding ? (
        <form className="score-add" onSubmit={submit}>
          <DocumentInput label={`PDF for ${p.title}`} file={file} disabled={attemptId !== null} onChange={setFile} onProcessingChange={setProcessingPhotos} />
          <KeySelect label={`Key for new score of ${p.title}`} value={key} onChange={setKey} disabled={attemptId !== null} />
          <ScoreTags label={`Tags for new score of ${p.title}`} tags={tags} suggestions={lib.allScoreTags}
            disabled={attemptId !== null} onChange={setTags} />
          {!uploadError && <button type="submit" className="btn" disabled={!file || processingPhotos || lib.uploadingId !== null}>{lib.uploadingId === p.id ? 'Uploading…' : 'Add score'}</button>}
          {!uploadError && <button type="button" className="link" disabled={lib.uploadingId === p.id} onClick={() => {
            if (attemptId && !window.confirm('The previous request may still complete. Check the score list before starting over. Discard this upload?')) return
            clearForm()
          }}>Cancel</button>}
          {lib.uploadingId === p.id && <UploadStatus key={uploadStage?.message} state="pending" stage={uploadStage} title="Uploading score" />}
          {uploadError && <UploadStatus state="error" stage={uploadStage} title="Upload failed" detail={`${uploadError} Your document is still selected; retry without scanning again.`}>
            <button type="submit" className="btn primary" disabled={lib.uploadingId !== null}>Retry upload</button>
            <button type="button" className="link" onClick={() => {
              if (!window.confirm('The previous request may still complete. Check the score list before starting over. Discard this upload?')) return
              clearForm()
            }}>Cancel</button>
          </UploadStatus>}
        </form>
      ) : (
        <button type="button" className="btn" onClick={() => { setUploaded(false); setAdding(true) }}>+ Add score</button>
      )}
    </div>
  )
}
