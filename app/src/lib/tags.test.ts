import { describe, expect, it } from 'vitest'
import { MAX_TAG_LENGTH, normalizeTag } from './tags'

describe('normalizeTag', () => {
  it('trims hashes and whitespace and normalizes case', () => {
    expect(normalizeTag('  ##  Film   Music  ')).toBe('film music')
  })

  it('limits normalized tags to the maximum length', () => {
    expect(normalizeTag('A'.repeat(MAX_TAG_LENGTH + 5))).toHaveLength(MAX_TAG_LENGTH)
  })
})
