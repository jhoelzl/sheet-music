import { CloseIcon } from './icons'

export function DeleteButton({ label, disabled, onClick }: { label: string; disabled?: boolean; onClick: () => void }) {
  return <button type="button" className="icon-btn delete-btn" aria-label={label} title={label} disabled={disabled} onClick={onClick}>{CloseIcon}</button>
}
