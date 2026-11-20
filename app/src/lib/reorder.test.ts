import { describe, expect, it } from 'vitest'
import { dropIndex, moveItem } from './reorder'

describe('moveItem', () => {
  it('moves an item forward and backward without mutating the input', () => {
    const input = ['a', 'b', 'c', 'd']
    expect(moveItem(input, 0, 2)).toEqual(['b', 'c', 'a', 'd'])
    expect(moveItem(input, 3, 1)).toEqual(['a', 'd', 'b', 'c'])
    expect(input).toEqual(['a', 'b', 'c', 'd'])
  })

  it('ignores no-op and out-of-range moves', () => {
    const input = ['a', 'b', 'c']
    expect(moveItem(input, 1, 1)).toBe(input)
    expect(moveItem(input, -1, 1)).toBe(input)
    expect(moveItem(input, 5, 1)).toBe(input)
  })
})

describe('dropIndex', () => {
  // Three 50px rows with an 10px gap: centres at 25, 85, 145.
  const tops = [0, 60, 120]
  const heights = [50, 50, 50]

  it('keeps the index when the pointer stays inside the dragged row', () => {
    expect(dropIndex(1, tops, heights, 85)).toBe(1)
    expect(dropIndex(0, tops, heights, 20)).toBe(0)
  })

  it('moves down once the pointer passes a lower row centre', () => {
    expect(dropIndex(0, tops, heights, 90)).toBe(1)
    expect(dropIndex(0, tops, heights, 150)).toBe(2)
  })

  it('moves up once the pointer passes an upper row centre', () => {
    expect(dropIndex(2, tops, heights, 80)).toBe(1)
    expect(dropIndex(2, tops, heights, 20)).toBe(0)
  })
})
