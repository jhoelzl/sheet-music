import { SCORE_TAGS, toggleScoreTag } from '../lib/scores'
import { TagInput } from './TagInput'

export function ScoreTags({ tags, suggestions, label, disabled, onChange }: {
  tags: string[]
  suggestions: string[]
  label: string
  disabled?: boolean
  onChange: (tags: string[]) => void
}) {
  const predefined = SCORE_TAGS.map((item) => item.value)
  return (
    <div className="score-tags" role="group" aria-label={label}>
      <div className="score-instruments">
        {SCORE_TAGS.map((item) => (
          <button key={item.value} type="button" className={`chip${tags.includes(item.value) ? ' on' : ''}`}
            aria-pressed={tags.includes(item.value)} disabled={disabled}
            onClick={() => onChange(toggleScoreTag(tags, item.value))}>{item.label}</button>
        ))}
      </div>
      <TagInput tags={tags.filter((tag) => !predefined.includes(tag))}
        suggestions={suggestions.filter((tag) => !predefined.includes(tag))}
        label={`Custom tags for ${label}`} disabled={disabled}
        onChange={(custom) => onChange([...new Set([...tags.filter((tag) => predefined.includes(tag)), ...custom])])} />
    </div>
  )
}
