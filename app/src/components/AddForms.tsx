import type { Library } from '../hooks/useLibrary'
import { INSTRUMENTS, toggleInstrument } from '../lib/instruments'
import { KeySelect } from './KeySelect'
import { TagInput } from './TagInput'

export function AddForms({ lib }: { lib: Library }) {
  const { panel, composers } = lib
  if (panel === 'composer') {
    return (
      <form className="panel" onSubmit={(e) => void lib.addComposer(e)}>
        <label className="grow">Composer name<input autoFocus placeholder="e.g. Clara Schumann" value={lib.composerName} onChange={(e) => lib.setComposerName(e.target.value)} required /></label>
        <button className="btn primary" type="submit" disabled={lib.composerSaving || !lib.composersLoaded}>Add composer</button>
      </form>
    )
  }
  if (panel === 'piece') {
    const { newInstruments, setNewInstruments, newComposerIds, setNewComposerIds } = lib
    return (
      <form className="panel" onSubmit={(e) => void lib.addPiece(e)}>
        <div className="field-group">
          <span>Composers</span>
          <div className="composer-check-list" role="group" aria-label="Composers">
            {composers.map((c) => (
              <label key={c.id} className="composer-choice">
                <input type="checkbox" checked={newComposerIds.includes(c.id)}
                  onChange={() => setNewComposerIds(newComposerIds.includes(c.id)
                    ? newComposerIds.filter((id) => id !== c.id)
                    : [...newComposerIds, c.id])} />
                {c.name}
              </label>
            ))}
          </div>
        </div>
        <label className="grow">Title<input autoFocus placeholder="Piece title" value={lib.title} onChange={(e) => lib.setTitle(e.target.value)} required /></label>
        <label>Subtitle<input placeholder="Optional subtitle" value={lib.newSubtitle} onChange={(e) => lib.setNewSubtitle(e.target.value)} /></label>
        <label>Key<KeySelect value={lib.newMusicalKey} onChange={lib.setNewMusicalKey} /></label>
        <div className="field-group" role="group" aria-label="Instruments">
          <span>Instrument</span>
          <div className="instrument-toggle">
            {INSTRUMENTS.map((i) => (
              <button key={i.value} type="button" className={`chip${newInstruments.includes(i.value) ? ' on' : ''}`} aria-pressed={newInstruments.includes(i.value)}
                onClick={() => setNewInstruments(toggleInstrument(newInstruments, i.value))}>{i.icon} {i.label}</button>
            ))}
          </div>
        </div>
        <div className="field-group">
          <span>Tags</span>
          <TagInput tags={lib.newTags} suggestions={lib.allTags} label="Tags for new piece" onChange={lib.setNewTags} />
        </div>
        <label>PDF score (optional)<input type="file" accept="application/pdf" onChange={(e) => lib.setFile(e.target.files?.[0] ?? null)} /></label>
        <button className="btn primary" type="submit">Add piece</button>
      </form>
    )
  }
  return null
}
