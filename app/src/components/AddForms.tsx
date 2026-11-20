import type { Library } from '../hooks/useLibrary'
import { INSTRUMENTS, toggleInstrument } from '../lib/instruments'
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
    const { newInstruments, setNewInstruments, newComposerIds, setNewComposerIds, pieceSaving } = lib
    return (
      <form className="panel" onSubmit={(e) => void lib.addPiece(e)} aria-busy={pieceSaving}>
        <div className="field-group">
          <span>Composers</span>
          <ComposerPicker composers={composers} selectedIds={newComposerIds} label="Composers for new piece" disabled={pieceSaving} onChange={setNewComposerIds} />
        </div>
        <label className="grow">Title<input autoFocus placeholder="Piece title" value={lib.title} onChange={(e) => lib.setTitle(e.target.value)} disabled={pieceSaving} required /></label>
        <label>Subtitle<input placeholder="Optional subtitle" value={lib.newSubtitle} onChange={(e) => lib.setNewSubtitle(e.target.value)} disabled={pieceSaving} /></label>
        <label>Key<KeySelect value={lib.newMusicalKey} onChange={lib.setNewMusicalKey} disabled={pieceSaving} /></label>
        <div className="field-group" role="group" aria-label="Instruments">
          <span>Instrument</span>
          <div className="instrument-toggle">
            {INSTRUMENTS.map((i) => (
              <button key={i.value} type="button" className={`chip${newInstruments.includes(i.value) ? ' on' : ''}`} aria-pressed={newInstruments.includes(i.value)} disabled={pieceSaving}
                onClick={() => setNewInstruments(toggleInstrument(newInstruments, i.value))}>{i.icon} {i.label}</button>
            ))}
          </div>
        </div>
        <div className="field-group">
          <span>Tags</span>
          <TagInput tags={lib.newTags} suggestions={lib.allTags} label="Tags for new piece" disabled={pieceSaving} onChange={lib.setNewTags} />
        </div>
        <label>PDF score (optional)<input type="file" accept="application/pdf" disabled={pieceSaving} onChange={(e) => lib.setFile(e.target.files?.[0] ?? null)} /></label>
        <button className="btn primary" type="submit" disabled={pieceSaving}>{pieceSaving ? 'Saving…' : 'Add piece'}</button>
      </form>
    )
  }
  return null
}
