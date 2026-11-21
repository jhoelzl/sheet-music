import { useState } from 'react'
import type { Library } from '../hooks/useLibrary'
import { KeySelect } from './KeySelect'
import { ComposerPicker } from './ComposerPicker'
import { TagInput } from './TagInput'
import { DocumentInput } from './DocumentInput'
import { ScoreTags } from './ScoreTags'

export function AddForms({ lib }: { lib: Library }) {
  const [processingPhotos, setProcessingPhotos] = useState(false)
  const { panel, composers } = lib
  if (panel === 'composer') {
    return (
      <form className="panel" onSubmit={(e) => void lib.addComposer(e)} aria-busy={lib.composerSaving}>
        <label className="grow">Composer name<input autoFocus placeholder="e.g. Clara Schumann" value={lib.composerName} onChange={(e) => lib.setComposerName(e.target.value)} disabled={lib.composerSaving} required /></label>
        <button className="btn primary" type="submit" disabled={lib.composerSaving || !lib.composersLoaded}>{lib.composerSaving ? 'Saving…' : 'Add composer'}</button>
      </form>
    )
  }
  if (panel === 'piece') {
    const { newComposerIds, setNewComposerIds, pieceSaving } = lib
    const locked = pieceSaving || Boolean(lib.pieceScoreAttempt) || lib.pieceSaveUncertain
    return (
      <form id="piece-add-form" className="panel piece-add-form" onSubmit={(e) => { if (processingPhotos) e.preventDefault(); else void lib.addPiece(e) }} aria-busy={pieceSaving || processingPhotos}>
        <div className="field-group">
          <span>Composers</span>
          <ComposerPicker composers={composers} selectedIds={newComposerIds} label="Composers for new piece" disabled={locked} onChange={setNewComposerIds} />
        </div>
        <label className="grow">Title<input autoFocus placeholder="Piece title" value={lib.title} onChange={(e) => lib.setTitle(e.target.value)} disabled={locked} required /></label>
        <label>Subtitle<input placeholder="Optional subtitle" value={lib.newSubtitle} onChange={(e) => lib.setNewSubtitle(e.target.value)} disabled={locked} /></label>
        <div className="field-group">
          <span>Tags</span>
          <TagInput tags={lib.newTags} suggestions={lib.allTags} label="Tags for new piece" disabled={locked} onChange={lib.setNewTags} />
        </div>
        <DocumentInput label="PDF score (optional)" file={lib.file} disabled={locked} onChange={lib.setFile} onProcessingChange={setProcessingPhotos} />
        {lib.file && <>
          <label>Key<KeySelect value={lib.newMusicalKey} onChange={lib.setNewMusicalKey} disabled={locked} /></label>
          <div className="field-group">
            <span>Score tags</span>
            <ScoreTags label="Tags for the new score" tags={lib.newScoreTags} suggestions={lib.allScoreTags}
              disabled={locked} onChange={lib.setNewScoreTags} />
          </div>
        </>}
        {!lib.pieceSaveUncertain && (!lib.pieceScoreAttempt || pieceSaving) && <button className="btn primary" type="submit" disabled={pieceSaving || processingPhotos}>{pieceSaving ? 'Saving…' : 'Add piece'}</button>}
      </form>
    )
  }
  return null
}
