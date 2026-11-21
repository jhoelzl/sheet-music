import { useId, useRef, useState } from 'react'
import { MAX_TAGS, MAX_TAG_LENGTH, normalizeTag } from '../lib/tags'
import { confirmDelete } from '../lib/confirmDelete'
import { DeleteButton } from './DeleteButton'

export function TagInput({ tags, suggestions, label, disabled = false, selectSuggestions = false, onChange }: { tags: string[]; suggestions: string[]; label: string; disabled?: boolean; selectSuggestions?: boolean; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState('')
  const listId = useId()
  const selectRef = useRef<HTMLSelectElement>(null)
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
  return (
    <div className="tag-input" role="group" aria-label={label}>
      {tags.map((t) => (
        <span className="tag" key={t}>
          #{t}
          <DeleteButton compact label={`Delete tag ${t}`} disabled={disabled} onClick={() => remove(t)} />
        </span>
      ))}
      {selectSuggestions && available.length > 0 && (
        <select ref={selectRef} aria-label={`Choose existing tag for ${label}`} value="" disabled={disabled}
          onPointerDown={() => { choosingSuggestion.current = true }}
          onBlur={() => { choosingSuggestion.current = false }}
          onChange={(event) => {
            choosingSuggestion.current = false
            if (event.currentTarget.value) add(event.currentTarget.value)
          }}>
          <option value="">Choose existing tag</option>
          {available.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
        </select>
      )}
      <input list={selectSuggestions ? undefined : listId} aria-label="Add tag" placeholder="+ tag" maxLength={MAX_TAG_LENGTH} value={draft} disabled={disabled}
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
        onBlur={(event) => {
          if ((selectRef.current && event.relatedTarget === selectRef.current) || choosingSuggestion.current) return
          if (draft.trim()) add(draft)
        }} />
      {!selectSuggestions && <datalist id={listId}>{available.map((s) => <option key={s} value={s} />)}</datalist>}
    </div>
  )
}
