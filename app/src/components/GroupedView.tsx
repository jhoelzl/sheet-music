import type { Library } from '../hooks/useLibrary'
import { sortPieces } from '../lib/sorting'
import { CloseIcon, EditIcon } from './icons'
import { PieceCard } from './PieceCard'

export function GroupedView({ lib }: { lib: Library }) {
  const { composers, visible, sort, filtering, hiddenIds } = lib
  return (
    <div className="composer-list">
      {composers.filter((c) => !hiddenIds.has(`composer:${c.id}`)).map((c) => {
        const list = sortPieces(visible.filter((p) => p.composer_id === c.id), sort)
        if (!list.length && filtering) return null
        return (
          <section className="composer-section" key={c.id}>
            <div className="section-heading">
              <div className="piece-titleline">
                {lib.editingComposerId === c.id ? (
                  <input className="title-edit" aria-label="Composer name" autoFocus value={lib.draftComposer}
                    onChange={(e) => lib.setDraftComposer(e.target.value)}
                    onBlur={() => lib.commitComposerEdit(c)}
                    onKeyDown={(e) => { if (e.key === 'Enter') lib.commitComposerEdit(c); if (e.key === 'Escape') lib.setEditingComposerId(null) }} />
                ) : (
                  <h3 title="Double-click to rename" onDoubleClick={() => lib.startEditComposer(c)}>{c.name}</h3>
                )}
                <span className="count">{list.length}</span>
              </div>
              <div className="piece-actions">
                <button className="icon-btn edit" aria-label={`Rename ${c.name}`} title="Rename" onClick={() => lib.startEditComposer(c)}>{EditIcon}</button>
                <button className="icon-btn" aria-label={`Delete ${c.name}`} title="Delete composer" onClick={() => lib.removeComposer(c)}>{CloseIcon}</button>
              </div>
            </div>
            {list.length === 0 && (
              <div className="muted empty-row">
                <span>No pieces yet.</span>
                <button type="button" className="btn" onClick={() => { lib.setComposerId(c.id); lib.setPanel('piece'); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>+ Add piece</button>
              </div>
            )}
            {list.map((p) => <PieceCard key={p.id} lib={lib} p={p} />)}
          </section>
        )
      })}
    </div>
  )
}
