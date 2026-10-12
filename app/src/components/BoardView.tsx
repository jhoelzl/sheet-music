import type { Library } from '../hooks/useLibrary'
import { STATUSES, statusOf } from '../lib/status'
import { MiniCard } from './MiniCard'

export function BoardView({ lib }: { lib: Library }) {
  return (
    <div className="board">
      {STATUSES.map((st) => {
        const col = lib.flat.filter((p) => statusOf(p) === st.value)
        return (
          <section className={`board-col s${st.value}`} key={st.value}>
            <h3>{st.label}<span className="count">{col.length}</span></h3>
            {col.length === 0
              ? <p className="muted">Nothing here.</p>
              : col.map((p) => <MiniCard key={p.id} lib={lib} p={p} board />)}
          </section>
        )
      })}
    </div>
  )
}
