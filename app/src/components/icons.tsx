/* eslint-disable react-refresh/only-export-components */
export const strokeIcon = (d: string) => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
)
export const EditIcon = strokeIcon('M17 3l4 4L8 20H4v-4L17 3zM14 6l4 4')
export const CloseIcon = strokeIcon('M18 6 6 18M6 6l12 12')
export const OpenIcon = strokeIcon('M14 3h7v7M10 14 21 3M5 7v14h14v-4')

export const GripIcon = (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
    <circle cx="9" cy="6" r="1.7" /><circle cx="15" cy="6" r="1.7" />
    <circle cx="9" cy="12" r="1.7" /><circle cx="15" cy="12" r="1.7" />
    <circle cx="9" cy="18" r="1.7" /><circle cx="15" cy="18" r="1.7" />
  </svg>
)

export const brandIcon = (d: string) => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d={d} /></svg>
)
