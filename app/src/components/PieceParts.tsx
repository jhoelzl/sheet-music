import type { Piece } from '../supabase'
import type { Library } from '../hooks/useLibrary'
import { INSTRUMENTS } from '../lib/instruments'
import { nextStatus, statusLabel, statusOf, statusPatch } from '../lib/status'
import { EditIcon, OpenIcon } from './icons'
import { DeleteButton } from './DeleteButton'

type Props = { lib: Library; p: Piece }

export function PieceTitle({ lib, p }: Props) {
  if (lib.editingId === p.id) {
    return (
      <span className="piece-heading">
        <input className="title-edit" aria-label="Piece title" autoFocus value={lib.draftTitle}
          onChange={(e) => lib.setDraftTitle(e.target.value)}
          onBlur={() => lib.commitEdit(p)}
          onKeyDown={(e) => { if (e.key === 'Enter') lib.commitEdit(p); if (e.key === 'Escape') lib.setEditingId(null) }} />
        {p.subtitle && <span className="piece-subtitle">{p.subtitle}</span>}
      </span>
    )
  }
  return (
    <span className="piece-heading">
      <button type="button" className="piece-title" title="Click to rename" onClick={() => lib.startEdit(p)}>
        <span className="piece-title-text">{p.title}</span>
        <span className="title-edit-hint" aria-hidden="true">{EditIcon}</span>
      </button>
      {p.subtitle && <span className="piece-subtitle">{p.subtitle}</span>}
    </span>
  )
}

export function EditDeleteButtons({ lib, p }: Props) {
  return (
    <>
      {p.pdf_path && <button type="button" className="open-pdf-btn" aria-label={`Open PDF for ${p.title}`} title="Open PDF in full screen" onClick={() => void lib.openPdf(p)}>{OpenIcon} Open PDF</button>}
      <DeleteButton label={`Remove ${p.title} from library`} onClick={() => lib.remove(p)} />
    </>
  )
}

export function PieceActions({ lib, p }: Props) {
  return (
    <div className="piece-actions">
      <EditDeleteButtons lib={lib} p={p} />
    </div>
  )
}

export function PracticeButton({ lib, p, long = false }: Props & { long?: boolean }) {
  const done = lib.practicedToday.has(p.id)
  const label = long ? (done ? 'Practiced today' : 'Practice today') : (done ? 'Today' : 'Practice')
  return (
    <button className={`practiced-btn${done ? ' done' : ''}`} aria-pressed={done}
      title={done ? 'Practiced today — click to undo' : 'Record that you practiced this today'}
      onClick={() => void lib.togglePracticed(p)}>✓ {label}</button>
  )
}

export function StatusPill({ lib, p }: Props) {
  const s = statusOf(p)
  return (
    <button className={`status-pill s${s}`} title="Click to change status" onClick={() => lib.update(p, statusPatch(nextStatus(s, 1)))}>
      <i aria-hidden="true" />{statusLabel(s)}
    </button>
  )
}

export function InstrumentIcons({ p }: { p: Piece }) {
  return (
    <span className="inst-icons">{INSTRUMENTS.filter((i) => p.instruments.includes(i.value)).map((i) => <span key={i.value} title={i.label}>{i.icon}</span>)}</span>
  )
}

export function TagList({ lib, p }: Props) {
  if (!p.tags?.length) return null
  return (
    <span className="tag-list">
      {p.tags.map((t) => (
        <button key={t} type="button" className={`tag${lib.tagFilter === t ? ' on' : ''}`} title={`Filter by #${t}`} onClick={() => lib.setTagFilter(lib.tagFilter === t ? null : t)}>#{t}</button>
      ))}
    </span>
  )
}
