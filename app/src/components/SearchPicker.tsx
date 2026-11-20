import { useRef, useState } from 'react'
import { usePickerDismiss } from '../hooks/usePickerDismiss'
import { CloseIcon } from './icons'

export function SearchPicker({ items, selectedIds, label, singular, plural, requireOne = false, disabled = false, onChange, onOpen }: {
  items: { id: string; name: string; keywords?: string[] }[]
  selectedIds: string[]
  label: string
  singular: string
  plural: string
  requireOne?: boolean
  disabled?: boolean
  onChange: (ids: string[]) => void | Promise<void>
  onOpen?: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const dismiss = usePickerDismiss(Boolean(query.trim()), () => setQuery(''))
  const search = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const matches = query.trim()
    ? items.filter((item) => !selectedIds.includes(item.id) && [item.name, ...(item.keywords ?? [])].some((value) => search(value).includes(search(query.trim()))))
    : []
  const change = async (ids: string[]) => {
    if (savingRef.current || disabled) return
    savingRef.current = true
    setSaving(true)
    try { await onChange(ids) }
    finally { savingRef.current = false; setSaving(false) }
  }
  const busy = saving || disabled
  const add = (id: string) => {
    setQuery('')
    void change([...new Set([...selectedIds, id])])
  }

  return (
    <div className="composer-picker" role="group" aria-label={label} {...dismiss}>
      <div className="composer-picker-chips">
        {selectedIds.map((id) => {
          const item = items.find((entry) => entry.id === id)
          const name = item?.name ?? `Unknown ${singular}`
          const cannotRemove = requireOne && selectedIds.length === 1
          return (
            <span className="tag" key={id}>
              {onOpen && item ? <button type="button" className="picker-item-open" aria-label={`Open ${singular} ${name}`} onClick={() => onOpen(id)}>{name}</button> : name}
              <button type="button" className="tag-remove" aria-label={`Remove ${singular} ${name}`}
                title={cannotRemove ? `A piece must have at least one ${singular}` : `Remove ${name}`}
                disabled={busy || cannotRemove} onClick={() => void change(selectedIds.filter((selected) => selected !== id))}>{CloseIcon}</button>
            </span>
          )
        })}
      </div>
      <div className="composer-search">
        <input type="search" aria-label={`Search ${label.toLowerCase()}`} placeholder={`Search ${plural}`} value={query} disabled={busy}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setQuery('')
            if (event.key === 'Enter' && query.trim()) {
              event.preventDefault()
              if (matches[0]) add(matches[0].id)
            }
          }} />
        {query.trim() && (
          <div className="composer-results" aria-live="polite">
            {matches.slice(0, 8).map((item) => (
              <button type="button" key={item.id} disabled={busy} onPointerDown={(event) => { if (event.pointerType === 'mouse') event.preventDefault() }}
                onClick={() => add(item.id)}>{item.name}</button>
            ))}
            {matches.length === 0 && <span>No matching {plural}</span>}
            {matches.length > 8 && <span>Keep typing to narrow results</span>}
          </div>
        )}
      </div>
    </div>
  )
}
