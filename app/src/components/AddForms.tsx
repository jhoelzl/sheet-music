import type { Library } from '../hooks/useLibrary'
import { INSTRUMENTS, toggleInstrument } from '../lib/instruments'
import { TagInput } from './TagInput'

export function AddForms({ lib }: { lib: Library }) {
  const { panel, composers } = lib
  if (panel === 'composer') {
    return (
      <form className="panel" onSubmit={lib.addComposer}>
        <label className="grow">Composer name<input autoFocus placeholder="e.g. Clara Schumann" value={lib.composerName} onChange={(e) => lib.setComposerName(e.target.value)} required /></label>
        <button className="btn primary" type="submit">Add composer</button>
      </form>
    )
  }
  if (panel === 'piece') {
    const { newInstruments, setNewInstruments } = lib
    return (
      <form className="panel" onSubmit={(e) => void lib.addPiece(e)}>
        <label>Composer<select value={lib.composerId} onChange={(e) => lib.setComposerId(e.target.value)} required>
          <option value="">Choose…</option>
          {composers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select></label>
        <label className="grow">Title<input autoFocus placeholder="Piece title" value={lib.title} onChange={(e) => lib.setTitle(e.target.value)} required /></label>
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
