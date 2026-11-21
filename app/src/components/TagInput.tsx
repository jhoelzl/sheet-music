import { useId, useRef, useState } from 'react'
import { MAX_TAGS, MAX_TAG_LENGTH, normalizeTag } from '../lib/tags'
import { confirmDelete } from '../lib/confirmDelete'
import { DeleteButton } from './DeleteButton'

export function TagInput({ tags, suggestions, label, disabled = false, suggestionButtons = false, onChange }: { tags: string[]; suggestions: string[]; label: string; disabled?: boolean; suggestionButtons?: boolean; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState('')
  const listId = useId()
  const choosingSuggestion = useRef(false)
  const available = suggestions.filter((s) => !tags.includes(s))
  const add = (raw: string) => {
    if (disabled) return
    const t = normalizeTag(raw)
    setDraft('')
    if (t && !tags.includes(t) && tags.length < MAX_TAGS) onChange([...tags, t])
  }
  const remove = (tag: string) => {
    if (!disabled && confirmDelete(`tag "${tag}" from ${label}`)) onChange(tags.filter((item) => item !== tag))
  }
  const toggleSuggestion = (tag: string) => {
    choosingSuggestion.current = false
    const selected = tags.includes(tag)
    if (selected && !confirmDelete(`tag "${tag}" from ${label}`)) {
      if (draft.trim()) add(draft)
      return
    }
    const next = selected ? tags.filter((item) => item !== tag) : [...tags, tag]
    const pending = normalizeTag(draft)
    if (pending && pending !== tag && !next.includes(pending) && next.length < MAX_TAGS) next.push(pending)
    if (!pending || pending === tag || next.includes(pending)) setDraft('')
    onChange(next)
  }
  return (
    <div className="tag-input" role="group" aria-label={label}>
      {suggestionButtons ? [...new Set([...tags, ...suggestions])].sort().map((tag) => (
        <button key={tag} type="button" className={`chip${tags.includes(tag) ? ' on' : ''}`}
          aria-pressed={tags.includes(tag)} disabled={disabled || (!tags.includes(tag) && tags.length >= MAX_TAGS)}
          title={!tags.includes(tag) && tags.length >= MAX_TAGS ? `Maximum of ${MAX_TAGS} custom tags` : undefined}
          onPointerDown={() => { choosingSuggestion.current = true }}
          onPointerCancel={() => { choosingSuggestion.current = false; if (draft.trim()) add(draft) }}
          onClick={() => toggleSuggestion(tag)}>#{tag}</button>
      )) : tags.map((t) => (
        <span className="tag" key={t}>
          #{t}
          <DeleteButton compact label={`Delete tag ${t}`} disabled={disabled} onClick={() => remove(t)} />
        </span>
      ))}
      <input list={suggestionButtons ? undefined : listId} aria-label="Add tag" placeholder="+ tag" maxLength={MAX_TAG_LENGTH} value={draft} disabled={disabled}
        onChange={(e) => {
          const v = e.target.value
          if (v.includes(',')) {
            const parts = v.split(',')
            const next = [...tags]
            for (const part of parts.slice(0, -1)) {
              const tag = normalizeTag(part)
              if (tag && !next.includes(tag) && next.length < MAX_TAGS) next.push(tag)
            }
            if (next.length !== tags.length) onChange(next)
            setDraft(parts[parts.length - 1])
          } else setDraft(v)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); add(draft) }
          else if (e.key === 'Backspace' && !draft && tags.length) remove(tags[tags.length - 1])
        }}
        onBlur={() => {
          if (choosingSuggestion.current) return
          if (draft.trim()) add(draft)
        }} />
      {!suggestionButtons && <datalist id={listId}>{available.map((s) => <option key={s} value={s} />)}</datalist>}
    </div>
  )
}
