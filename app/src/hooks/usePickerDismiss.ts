import { useEffect, useRef } from 'react'
import type { FocusEvent } from 'react'

export function usePickerDismiss(open: boolean, onDismiss: () => void) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const dismissOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !ref.current?.contains(event.target)) onDismiss()
    }
    document.addEventListener('pointerdown', dismissOutside)
    return () => document.removeEventListener('pointerdown', dismissOutside)
  }, [open, onDismiss])

  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    // iOS may blur the input with no relatedTarget before delivering a result's click.
    if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) onDismiss()
  }

  return { ref, onBlur }
}
