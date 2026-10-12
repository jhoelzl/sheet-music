import type { Library } from '../hooks/useLibrary'
import { MiniCard } from './MiniCard'

export function GridView({ lib }: { lib: Library }) {
  return (
    <div className="piece-grid">
      {lib.flat.map((p) => <MiniCard key={p.id} lib={lib} p={p} />)}
    </div>
  )
}
