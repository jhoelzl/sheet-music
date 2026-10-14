import { useState } from 'react'
import type { Library } from '../hooks/useLibrary'
import { STATUSES, statusOf, statusPatch } from '../lib/status'
import type { Status } from '../lib/status'
import { MiniCard } from './MiniCard'

export function BoardView({ lib }: { lib: Library }) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<Status | null>(null)

  const drop = (value: Status) => {
    const p = lib.flat.find((x) => String(x.id) === dragId)
    setDragId(null)
    setOverCol(null)
    if (p && statusOf(p) !== value) lib.update(p, statusPatch(value))
  }

  return (
    <div className="board">
      {STATUSES.map((st) => {
        const col = lib.flat.filter((p) => statusOf(p) === st.value)
        return (
          <section
            className={`board-col s${st.value}${overCol === st.value ? ' drag-over' : ''}`}
            key={st.value}
            onDragOver={(e) => { if (dragId) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setOverCol(st.value) } }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverCol(null) }}
            onDrop={(e) => { e.preventDefault(); drop(st.value) }}
          >
            <h3>{st.label}<span className="count">{col.length}</span></h3>
            {col.length === 0
              ? <p className="muted">{dragId ? 'Drop here' : 'Nothing here.'}</p>
              : col.map((p) => (
                <div
                  key={p.id}
                  className={`board-drag${dragId === String(p.id) ? ' dragging' : ''}`}
                  draggable
                  onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(p.id)); setDragId(String(p.id)) }}
                  onDragEnd={() => { setDragId(null); setOverCol(null) }}
                >
                  <MiniCard lib={lib} p={p} board />
                </div>
              ))}
          </section>
        )
      })}
    </div>
  )
}
