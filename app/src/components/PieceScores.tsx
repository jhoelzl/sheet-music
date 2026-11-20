import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Instrument, Piece } from '../supabase'
import type { Library } from '../hooks/useLibrary'
import { INSTRUMENTS } from '../lib/instruments'
import { CloseIcon, PdfIcon } from './icons'
import { KeySelect } from './KeySelect'

const labelOf = (value: Instrument) => INSTRUMENTS.find((item) => item.value === value)

/**
 * The piece's scores: one row per PDF, each with its own key and instrument.
 * A piece can hold several, e.g. a piano score and a guitar arrangement.
 */
export function PieceScores({ lib, p }: { lib: Library; p: Piece }) {
  const scores = lib.scoresOf(p)
  const [adding, setAdding] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [key, setKey] = useState('')
  const [instrument, setInstrument] = useState<Instrument>('piano')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!file) return
    void lib.addScore(p, file, key.trim() || null, instrument)
    setFile(null); setKey(''); setInstrument('piano'); setAdding(false)
  }

  return (
    <div className="piece-scores">
      <span className="piece-scores-label">Scores</span>
      {scores.length === 0 && <p className="muted">No PDFs attached yet.</p>}
      <ul className="score-list">
        {scores.map((score, index) => (
          <li className="score-row" key={score.id}>
            <span className="score-instrument" title={labelOf(score.instrument)?.label}>{labelOf(score.instrument)?.icon}</span>
            <KeySelect label={`Key for score ${index + 1} of ${p.title}`} value={score.musical_key ?? ''}
              onChange={(value) => lib.updateScore(p, score, { musical_key: value || null })} />
            <div className="score-instruments" role="group" aria-label={`Instrument for score ${index + 1} of ${p.title}`}>
              {INSTRUMENTS.map((item) => (
                <button key={item.value} type="button" className={`chip${score.instrument === item.value ? ' on' : ''}`}
                  aria-pressed={score.instrument === item.value} title={item.label} disabled={lib.uploadingId === p.id}
                  onClick={() => { if (score.instrument !== item.value) lib.updateScore(p, score, { instrument: item.value }) }}>{item.icon}</button>
              ))}
            </div>
            {score.pdf_pages ? <span className="page-count">{score.pdf_pages} {score.pdf_pages === 1 ? 'page' : 'pages'}</span> : null}
            <button type="button" className="icon-btn" aria-label={`Open score ${index + 1} for ${p.title}`} title="Open this score"
              onClick={() => void lib.openPdf(p, score)}>{PdfIcon}</button>
            <button type="button" className="icon-btn" aria-label={`Remove score ${index + 1} for ${p.title}`} title="Remove this score"
              disabled={lib.uploadingId === p.id} onClick={() => lib.removeScore(p, score)}>{CloseIcon}</button>
          </li>
        ))}
      </ul>
      {adding ? (
        <form className="score-add" onSubmit={submit}>
          <input type="file" accept="application/pdf" aria-label={`PDF for ${p.title}`} disabled={lib.uploadingId === p.id}
            onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          <KeySelect label={`Key for new score of ${p.title}`} value={key} onChange={setKey} disabled={lib.uploadingId === p.id} />
          <div className="score-instruments" role="group" aria-label={`Instrument for new score of ${p.title}`}>
            {INSTRUMENTS.map((item) => (
              <button key={item.value} type="button" className={`chip${instrument === item.value ? ' on' : ''}`}
                aria-pressed={instrument === item.value} disabled={lib.uploadingId === p.id}
                onClick={() => setInstrument(item.value)}>{item.icon} {item.label}</button>
            ))}
          </div>
          <button type="submit" className="btn" disabled={!file || lib.uploadingId === p.id}>{lib.uploadingId === p.id ? 'Uploading…' : 'Add score'}</button>
          <button type="button" className="link" onClick={() => setAdding(false)}>Cancel</button>
        </form>
      ) : (
        <button type="button" className="btn" onClick={() => setAdding(true)}>+ Add score</button>
      )}
    </div>
  )
}
