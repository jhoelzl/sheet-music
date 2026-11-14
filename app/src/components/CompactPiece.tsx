import { useState } from 'react'
import type { Library } from '../hooks/useLibrary'
import { statusOf } from '../lib/status'
import type { Piece } from '../supabase'
import { PieceCard } from './PieceCard'

export function CompactPiece({ lib, p }: { lib: Library; p: Piece }) {
  const [open, setOpen] = useState(false)
  return (
    <details className="compact-piece" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className="compact-piece-summary">
        <span className="compact-piece-icon" aria-hidden="true">♪</span>
        <span className="compact-piece-info">
          <strong>{p.title}</strong>
          <span>{lib.composerNameOf(p.composer_id)}{p.instruments.length > 0 ? ` · ${p.instruments.join(', ')}` : ''}</span>
        </span>
        <span className="compact-piece-progress">{statusOf(p)}%</span>
        <span className="compact-piece-chevron" aria-hidden="true">⌄</span>
      </summary>
      {open && <PieceCard lib={lib} p={p} />}
    </details>
  )
}
