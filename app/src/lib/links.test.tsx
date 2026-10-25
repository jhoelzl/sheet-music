import { describe, expect, it } from 'vitest'
import { detectLinkType, safeUrl } from './links'

describe('safeUrl', () => {
  it('adds HTTPS to bare hosts and preserves valid HTTP(S) URLs', () => {
    expect(safeUrl('youtube.com/watch?v=123')).toBe('https://youtube.com/watch?v=123')
    expect(safeUrl('http://example.com')).toBe('http://example.com/')
  })

  it('rejects empty and non-web URLs', () => {
    expect(safeUrl('  ')).toBeNull()
    expect(safeUrl('javascript:alert(1)')).toBeNull()
    expect(safeUrl('data:text/html,unsafe')).toBeNull()
  })
})

describe('detectLinkType', () => {
  it('recognizes supported providers and avoids matching unrelated subdomains', () => {
    expect(detectLinkType('https://youtu.be/abc')).toBe('youtube')
    expect(detectLinkType('https://open.spotify.com/track/abc')).toBe('spotify')
    expect(detectLinkType('https://instagram.com/p/abc')).toBe('instagram')
    expect(detectLinkType('https://youtube.com.attacker.example/')).toBe('other')
  })
})
