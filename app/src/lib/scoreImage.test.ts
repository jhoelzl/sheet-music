import { describe, expect, it } from 'vitest'
import { scoreImageType } from './scoreImage'

describe('score image detection', () => {
  it.each([
    [[0xff, 0xd8, 0xff, 0xe0], 'image/jpeg'],
    [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'image/png'],
    [[...new TextEncoder().encode('GIF89a')], 'image/gif'],
    [[...new TextEncoder().encode('RIFF0000WEBP')], 'image/webp'],
    [[...new TextEncoder().encode('%PDF-1.7')], null],
  ])('detects the file content independently of its name', (bytes, type) => {
    expect(scoreImageType(new Uint8Array(bytes))).toBe(type)
  })
})
