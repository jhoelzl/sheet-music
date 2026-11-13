import type { Library } from '../hooks/useLibrary'
import type { Composer } from '../supabase'
import { CloseIcon, EditIcon } from './icons'

export function ComposerHeading({ lib, composer, countLabel }: { lib: Library; composer: Composer; countLabel: string }) {
  return (
    <div className="section-heading">
      <div className="piece-titleline">
        {lib.editingComposerId === composer.id ? (
          <input className="title-edit" aria-label="Composer name" autoFocus value={lib.draftComposer}
            onChange={(e) => lib.setDraftComposer(e.target.value)}
            onBlur={() => lib.commitComposerEdit(composer)}
            onKeyDown={(e) => { if (e.key === 'Enter') lib.commitComposerEdit(composer); if (e.key === 'Escape') lib.setEditingComposerId(null) }} />
        ) : (
          <h3 title="Double-click to rename" onDoubleClick={() => lib.startEditComposer(composer)}>{composer.name}</h3>
        )}
        <span className="count">{countLabel}</span>
      </div>
      <div className="piece-actions">
        <button className="icon-btn edit" aria-label={`Rename ${composer.name}`} title="Rename" onClick={() => lib.startEditComposer(composer)}>{EditIcon}</button>
        <button className="icon-btn" aria-label={`Delete ${composer.name}`} title="Delete composer and their pieces" onClick={() => lib.removeComposer(composer)}>{CloseIcon}</button>
      </div>
    </div>
  )
}
