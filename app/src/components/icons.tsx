/* eslint-disable react-refresh/only-export-components */
export const strokeIcon = (d: string) => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
)
export const EditIcon = strokeIcon('M17 3l4 4L8 20H4v-4L17 3zM14 6l4 4')
export const CloseIcon = strokeIcon('M18 6 6 18M6 6l12 12')
export const OpenIcon = strokeIcon('M14 3h7v7M10 14 21 3M5 7v14h14v-4')
export const PauseIcon = strokeIcon('M9 5v14M15 5v14')
export const PdfIcon = strokeIcon('M14 3v5h5M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM9 13h6M9 17h4')
export const InfoIcon = strokeIcon('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 7.5h.01')
export const ArchiveIcon = strokeIcon('M3 8h18v12H3zM3 4h18v4H3zM10 12h4')
export const ChevronLeftIcon = strokeIcon('M15 5l-7 7 7 7')
export const ChevronRightIcon = strokeIcon('M9 5l7 7-7 7')

export const PlayIcon = (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l13-7.5z" /></svg>
)

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
