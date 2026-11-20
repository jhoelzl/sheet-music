import { useRef, useState } from 'react'
import type { Composer } from '../supabase'
import { CloseIcon } from './icons'

export function ComposerPicker({ composers, selectedIds, label, requireOne = false, disabled = false, onChange }: {
  composers: Composer[]
  selectedIds: string[]
  label: string
  requireOne?: boolean
  disabled?: boolean
  onChange: (ids: string[]) => void | Promise<void>
}) {
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const search = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const matches = query.trim()
    ? composers.filter((composer) => !selectedIds.includes(composer.id) && search(composer.name).includes(search(query.trim())))
    : []

  const change = async (ids: string[]) => {
    if (savingRef.current || disabled) return
    savingRef.current = true
    setSaving(true)
    try {
      await onChange(ids)
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }
  const busy = saving || disabled
  const add = (id: string) => {
    setQuery('')
    void change([...new Set([...selectedIds, id])])
  }

  return (
    <div className="composer-picker" role="group" aria-label={label}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setQuery('') }}>
      <div className="composer-picker-chips">
        {selectedIds.map((id) => {
          const name = composers.find((composer) => composer.id === id)?.name ?? 'Unknown composer'
          const cannotRemove = requireOne && selectedIds.length === 1
          return (
            <span className="tag" key={id}>
              {name}
              <button type="button" className="tag-remove" aria-label={`Remove composer ${name}`}
                title={cannotRemove ? 'A piece must have at least one composer' : `Remove ${name}`}
                disabled={busy || cannotRemove} onClick={() => void change(selectedIds.filter((selected) => selected !== id))}>{CloseIcon}</button>
            </span>
          )
        })}
      </div>
      <div className="composer-search">
        <input type="search" aria-label={`Search ${label.toLowerCase()}`} placeholder="Search composers" value={query} disabled={busy}
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
            {matches.slice(0, 8).map((composer) => (
              <button type="button" key={composer.id} disabled={busy} onPointerDown={(event) => event.preventDefault()}
                onClick={() => add(composer.id)}>{composer.name}</button>
            ))}
            {matches.length === 0 && <span>No matching composers</span>}
            {matches.length > 8 && <span>Keep typing to narrow results</span>}
          </div>
        )}
      </div>
    </div>
  )
}
