import type { Library } from '../hooks/useLibrary'
import { sortPieces } from '../lib/sorting'
import { ComposerHeading } from './ComposerHeading'
import { CompactPiece } from './CompactPiece'

export function GroupedView({ lib }: { lib: Library }) {
  const { composers, visible, sort, filtering, hiddenIds } = lib
  return (
    <div className="composer-list">
      {composers.filter((c) => !hiddenIds.has(`composer:${c.id}`)).map((c) => {
        const list = sortPieces(visible.filter((p) => p.composer_id === c.id), sort)
        if (!list.length && filtering) return null
        return (
          <section className="composer-section" key={c.id}>
            <ComposerHeading lib={lib} composer={c} countLabel={String(list.length)} />
            {list.length === 0 && (
              <div className="muted empty-row">
                <span>No pieces yet.</span>
                <button type="button" className="btn" onClick={() => { lib.setComposerId(c.id); lib.setPanel('piece'); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>+ Add piece</button>
              </div>
            )}
            {list.map((p) => <CompactPiece key={p.id} lib={lib} p={p} />)}
          </section>
        )
      })}
    </div>
  )
}
