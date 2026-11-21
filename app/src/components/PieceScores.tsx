import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Piece } from '../supabase'
import type { Library } from '../hooks/useLibrary'
import { PdfIcon } from './icons'
import { KeySelect } from './KeySelect'
import { DeleteButton } from './DeleteButton'
import { DocumentInput } from './DocumentInput'
import { ScoreTags } from './ScoreTags'

/** The piece's scores: one row per PDF, each with its own key and tags. */
export function PieceScores({ lib, p }: { lib: Library; p: Piece }) {
  const scores = lib.scoresOf(p)
  const [adding, setAdding] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [processingPhotos, setProcessingPhotos] = useState(false)
  const [key, setKey] = useState('')
  const [tags, setTags] = useState<string[]>(['piano'])

  const clearForm = () => {
    setFile(null); setKey(''); setTags(['piano']); setAdding(false)
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!file || processingPhotos || lib.uploadingId === p.id) return
    void lib.addScore(p, file, key.trim() || null, tags)
    clearForm()
  }

  return (
    <div className="piece-scores">
      <span className="piece-scores-label">Scores</span>
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
          <DocumentInput label={`PDF for ${p.title}`} file={file} disabled={lib.uploadingId === p.id} onChange={setFile} onProcessingChange={setProcessingPhotos} />
          <KeySelect label={`Key for new score of ${p.title}`} value={key} onChange={setKey} disabled={lib.uploadingId === p.id} />
          <ScoreTags label={`Tags for new score of ${p.title}`} tags={tags} suggestions={lib.allScoreTags}
            disabled={lib.uploadingId === p.id} onChange={setTags} />
          <button type="submit" className="btn" disabled={!file || processingPhotos || lib.uploadingId === p.id}>{lib.uploadingId === p.id ? 'Uploading…' : 'Add score'}</button>
          <button type="button" className="link" onClick={clearForm}>Cancel</button>
        </form>
      ) : (
        <button type="button" className="btn" onClick={() => setAdding(true)}>+ Add score</button>
      )}
    </div>
  )
}
