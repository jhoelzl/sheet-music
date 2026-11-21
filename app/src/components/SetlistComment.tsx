import { useEffect, useRef, useState } from 'react'
import { Markdown } from '../lib/markdown'

/** Grow the editor with its content so multi-line notes stay readable. */
function autosize(field: HTMLTextAreaElement) {
  field.style.height = 'auto'
  field.style.height = `${field.scrollHeight}px`
}

/**
 * Per-tune comment: rendered as markdown until you click it, then a multi-line
 * editor. Blur or Cmd/Ctrl+Enter saves, Escape reverts. Saving is delegated so the
 * page keeps its single error-handling path.
 */
export function SetlistComment({ comment, title, disabled, onSave }: {
  comment: string | null
  title: string
  disabled: boolean
  onSave: (value: string | null) => void
}) {
  const [editing, setEditing] = useState(false)
  const fieldRef = useRef<HTMLTextAreaElement | null>(null)

  // Focus and size the editor as soon as it opens, so one click is enough to edit.
  useEffect(() => {
    if (!editing) return
    const field = fieldRef.current
    if (!field) return
    field.focus()
    field.setSelectionRange(field.value.length, field.value.length)
    autosize(field)
  }, [editing])

  const commit = () => {
    const value = fieldRef.current?.value.trim() ?? ''
    setEditing(false)
    onSave(value || null)
  }

  if (editing) {
    return (
      <textarea ref={fieldRef} className="setlist-comment" aria-label={`Comment for ${title}`}
        defaultValue={comment ?? ''}
        onChange={(event) => autosize(event.currentTarget)} onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Escape') { event.preventDefault(); setEditing(false) }
          else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); commit() }
        }} />
    )
  }

  if (disabled && !comment) return null
  if (!comment) return <button type="button" className="setlist-comment-add" aria-label={`Add comment for ${title}`} onClick={() => setEditing(true)}>+ Comment</button>
  return (
    <div className={`setlist-comment-view${disabled ? ' disabled' : ''}`}
      onClick={(event) => { if (!disabled && !(event.target as HTMLElement).closest('a')) setEditing(true) }}>
      <Markdown className="setlist-comment-md" text={comment} />
      {!disabled && (
        <button type="button" className="setlist-comment-edit" aria-label={`Edit comment for ${title}`}
          onClick={(event) => { event.stopPropagation(); setEditing(true) }}>Edit</button>
      )}
    </div>
  )
}
