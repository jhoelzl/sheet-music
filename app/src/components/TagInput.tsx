import { useId, useState } from 'react'
import { MAX_TAGS, MAX_TAG_LENGTH, normalizeTag } from '../lib/tags'
import { CloseIcon } from './icons'

export function TagInput({ tags, suggestions, label, disabled = false, onChange }: { tags: string[]; suggestions: string[]; label: string; disabled?: boolean; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState('')
  const listId = useId()
  const add = (raw: string) => {
    if (disabled) return
    const t = normalizeTag(raw)
    setDraft('')
    if (t && !tags.includes(t) && tags.length < MAX_TAGS) onChange([...tags, t])
  }
  return (
    <div className="tag-input" role="group" aria-label={label}>
      {tags.map((t) => (
        <span className="tag" key={t}>
          #{t}
          <button type="button" className="tag-remove" aria-label={`Remove tag ${t}`} disabled={disabled} onClick={() => onChange(tags.filter((x) => x !== t))}>{CloseIcon}</button>
        </span>
      ))}
      <input list={listId} aria-label="Add tag" placeholder="+ tag" maxLength={MAX_TAG_LENGTH} value={draft} disabled={disabled}
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
          else if (e.key === 'Backspace' && !draft && tags.length) onChange(tags.slice(0, -1))
        }}
        onBlur={() => { if (draft.trim()) add(draft) }} />
      <datalist id={listId}>{suggestions.filter((s) => !tags.includes(s)).map((s) => <option key={s} value={s} />)}</datalist>
    </div>
  )
}
