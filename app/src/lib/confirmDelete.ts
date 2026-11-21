export function confirmDelete(subject: string, details?: string): boolean {
  return window.confirm(`Delete ${subject}?${details ? ` ${details}` : ''}`)
}
