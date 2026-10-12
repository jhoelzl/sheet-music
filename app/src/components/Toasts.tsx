import type { Library } from '../hooks/useLibrary'

export function Toasts({ lib }: { lib: Library }) {
  return (
    <div className="toasts" role="region" aria-live="polite" aria-label="Notifications">
      {lib.toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`} role={t.kind === 'error' ? 'alert' : 'status'}>
          <span>{t.message}</span>
          {t.undo && <button type="button" className="toast-action" onClick={t.undo}>Undo</button>}
          <button type="button" className="toast-close" aria-label="Dismiss" onClick={() => lib.dismissToast(t.id)}>✕</button>
        </div>
      ))}
    </div>
  )
}
