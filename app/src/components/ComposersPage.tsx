import type { Library } from '../hooks/useLibrary'
import { AddForms } from './AddForms'
import { ComposerHeading } from './ComposerHeading'

export function ComposersPage({ lib }: { lib: Library }) {
  const composers = lib.composers.filter((c) => !lib.hiddenIds.has(`composer:${c.id}`))

  return (
    <>
      <div className="library-intro">
        <div>
          <h2>Composers</h2>
          <p>{composers.length} {composers.length === 1 ? 'composer' : 'composers'}</p>
        </div>
        <button className={`btn primary${lib.panel === 'composer' ? ' active' : ''}`} onClick={() => lib.setPanel(lib.panel === 'composer' ? null : 'composer')}>+ Composer</button>
      </div>

      {lib.panel === 'composer' && <AddForms lib={lib} />}
      {!composers.length && <div className="empty"><h3>No composers yet</h3><p>Add your first composer to get started.</p></div>}
      <div className="composer-list">
        {composers.map((c) => {
          const count = lib.pieces.filter((p) => p.composer_id === c.id && !lib.hiddenIds.has(p.id)).length
          return (
            <section className="composer-section" key={c.id}>
              <ComposerHeading lib={lib} composer={c} countLabel={`${count} ${count === 1 ? 'piece' : 'pieces'}`} />
            </section>
          )
        })}
      </div>
    </>
  )
}
