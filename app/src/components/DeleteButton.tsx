import { CloseIcon } from './icons'

export function DeleteButton({ label, title = label, disabled, compact = false, onClick }: { label: string; title?: string; disabled?: boolean; compact?: boolean; onClick: () => void }) {
  return <button type="button" className={`icon-btn delete-btn${compact ? ' compact' : ''}`} aria-label={label} title={title} disabled={disabled} onClick={onClick}>{CloseIcon}</button>
}
