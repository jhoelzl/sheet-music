/** Move the item at `from` to `to`, returning a new array. Out-of-range indices are ignored. */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= list.length) return list
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(Math.max(0, Math.min(to, next.length)), 0, item)
  return next
}

/**
 * Index the dragged row should land on for a pointer whose vertical centre is `pointerCenter`.
 * `tops` are the rows' top offsets relative to the list and `heights` their heights, both in
 * the same coordinate space. Works for touch, pen and mouse because it only needs geometry.
 */
export function dropIndex(from: number, tops: number[], heights: number[], pointerCenter: number): number {
  const count = Math.min(tops.length, heights.length)
  let target = from
  for (let i = 0; i < count; i += 1) {
    if (i === from) continue
    const middle = tops[i] + heights[i] / 2
    if (i < from) {
      if (pointerCenter < middle) { target = i; break }
    } else if (pointerCenter > middle) {
      target = i
    }
  }
  return target
}
