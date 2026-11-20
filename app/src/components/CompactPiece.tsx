import { useState } from 'react'
import type { Library } from '../hooks/useLibrary'
import { statusOf } from '../lib/status'
import type { Piece } from '../supabase'
import { PieceCard } from './PieceCard'

export function CompactPiece({ lib, p }: { lib: Library; p: Piece }) {
  const [open, setOpen] = useState(false)
  const keys = lib.keysOf(p)
  return (
    <details className="compact-piece" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className="compact-piece-summary">
        <span className="compact-piece-icon" aria-hidden="true">♪</span>
        <span className="compact-piece-info">
          <span className="compact-piece-title">
            <strong>{p.title}</strong>
            {p.subtitle && <span className="compact-piece-subtitle">{p.subtitle}</span>}
          </span>
          <span>{lib.composerNamesOf(p)}{p.instruments.length > 0 ? ` · ${p.instruments.join(', ')}` : ''}{keys.length > 0 ? ` · ${keys.join(', ')}` : ''}</span>
        </span>
        <span className="compact-piece-progress">{statusOf(p)}%</span>
        <span className="compact-piece-chevron" aria-hidden="true">⌄</span>
      </summary>
      {open && <PieceCard lib={lib} p={p} />}
    </details>
  )
}
