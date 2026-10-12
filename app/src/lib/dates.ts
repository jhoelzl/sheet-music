export function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function todayISO(): string {
  return isoOf(new Date())
}

export function practicedText(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const now = new Date()
  const days = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - new Date(y, m - 1, d).getTime()) / 86400000)
  const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'} ago`
  if (days <= 0) return 'Practiced today'
  if (days === 1) return 'Practiced yesterday'
  if (days < 30) return `Practiced ${plural(days, 'day')}`
  if (days < 365) return `Practiced ${plural(Math.floor(days / 30), 'month')}`
  return `Practiced ${plural(Math.floor(days / 365), 'year')}`
}

export const WEEKS = 26
