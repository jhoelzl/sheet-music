import { useState } from 'react'

export function Rating({ label, value, glyph, onChange }: { label: string; value: number | null; glyph: string; onChange: (n: number | null) => void }) {
  const [hover, setHover] = useState<number | null>(null)
  const shown = hover ?? value ?? 0
  return (
    <div className="rating" role="group" aria-label={label} onMouseLeave={() => setHover(null)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" className={`rate${n <= shown ? ' on' : ''}${hover !== null ? ' preview' : ''}`}
          aria-label={`${label} ${n}`} aria-pressed={value === n}
          title={value === n ? `Clear ${label.toLowerCase()}` : `${label}: ${n} of 5`}
          onMouseEnter={() => setHover(n)} onFocus={() => setHover(n)} onBlur={() => setHover(null)}
          onClick={() => onChange(value === n ? null : n)}>{glyph}</button>
      ))}
    </div>
  )
}
