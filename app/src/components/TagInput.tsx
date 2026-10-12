import { useId, useState } from 'react'
import { MAX_TAGS, MAX_TAG_LENGTH, normalizeTag } from '../lib/tags'
import { CloseIcon } from './icons'

export function TagInput({ tags, suggestions, label, onChange }: { tags: string[]; suggestions: string[]; label: string; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState('')
  const listId = useId()
  const add = (raw: string) => {
    const t = normalizeTag(raw)
    setDraft('')
    if (t && !tags.includes(t) && tags.length < MAX_TAGS) onChange([...tags, t])
  }
  return (
    <div className="tag-input" role="group" aria-label={label}>
      {tags.map((t) => (
        <span className="tag" key={t}>
          #{t}
          <button type="button" className="tag-remove" aria-label={`Remove tag ${t}`} onClick={() => onChange(tags.filter((x) => x !== t))}>{CloseIcon}</button>
        </span>
      ))}
      <input list={listId} aria-label="Add tag" placeholder={tags.length ? 'Add tag…' : '+ Tag (e.g. recital)'} maxLength={MAX_TAG_LENGTH} value={draft}
        onChange={(e) => {
          const v = e.target.value
          if (v.includes(',')) { v.split(',').forEach((part, i, all) => { if (i < all.length - 1) add(part); else setDraft(part) }) } else setDraft(v)
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
