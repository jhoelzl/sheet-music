import type { Library } from '../hooks/useLibrary'
import { INSTRUMENTS } from '../lib/instruments'
import { KeySelect } from './KeySelect'
import { ComposerPicker } from './ComposerPicker'
import { TagInput } from './TagInput'

export function AddForms({ lib }: { lib: Library }) {
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
    return (
      <form className="panel" onSubmit={(e) => void lib.addPiece(e)} aria-busy={pieceSaving}>
        <div className="field-group">
          <span>Composers</span>
          <ComposerPicker composers={composers} selectedIds={newComposerIds} label="Composers for new piece" disabled={pieceSaving} onChange={setNewComposerIds} />
        </div>
        <label className="grow">Title<input autoFocus placeholder="Piece title" value={lib.title} onChange={(e) => lib.setTitle(e.target.value)} disabled={pieceSaving} required /></label>
        <label>Subtitle<input placeholder="Optional subtitle" value={lib.newSubtitle} onChange={(e) => lib.setNewSubtitle(e.target.value)} disabled={pieceSaving} /></label>
        <div className="field-group">
          <span>Tags</span>
          <TagInput tags={lib.newTags} suggestions={lib.allTags} label="Tags for new piece" disabled={pieceSaving} onChange={lib.setNewTags} />
        </div>
        <label>PDF score (optional)<input type="file" accept="application/pdf" disabled={pieceSaving} onChange={(e) => lib.setFile(e.target.files?.[0] ?? null)} /></label>
        {lib.file && <>
          <label>Key<KeySelect value={lib.newMusicalKey} onChange={lib.setNewMusicalKey} disabled={pieceSaving} /></label>
          <div className="field-group" role="group" aria-label="Type for the new score">
            <span>Instrument</span>
            <div className="instrument-toggle">
              <button type="button" className={`chip${lib.newScoreInstrument === null ? ' on' : ''}`} aria-pressed={lib.newScoreInstrument === null} disabled={pieceSaving}
                onClick={() => lib.setNewScoreInstrument(null)}>Lead sheet</button>
              {INSTRUMENTS.map((i) => (
                <button key={i.value} type="button" className={`chip${lib.newScoreInstrument === i.value ? ' on' : ''}`} aria-pressed={lib.newScoreInstrument === i.value} disabled={pieceSaving}
                  onClick={() => lib.setNewScoreInstrument(i.value)}>{i.icon} {i.label}</button>
              ))}
            </div>
          </div>
        </>}
        <button className="btn primary" type="submit" disabled={pieceSaving}>{pieceSaving ? 'Saving…' : 'Add piece'}</button>
      </form>
    )
  }
  return null
}
