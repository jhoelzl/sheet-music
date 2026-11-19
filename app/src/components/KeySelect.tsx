const majorKeys = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'].map((note) => `${note} major`)
const minorKeys = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'].map((note) => `${note} minor`)

export function KeySelect({ value, onChange, label }: { value: string; onChange: (value: string) => void; label?: string }) {
  const isLegacyValue = value !== '' && !majorKeys.includes(value) && !minorKeys.includes(value)
  return (
    <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">No key</option>
      {isLegacyValue && <option value={value}>{value}</option>}
      <optgroup label="Major">
        {majorKeys.map((key) => <option key={key} value={key}>{key}</option>)}
      </optgroup>
      <optgroup label="Minor">
        {minorKeys.map((key) => <option key={key} value={key}>{key}</option>)}
      </optgroup>
    </select>
  )
}
