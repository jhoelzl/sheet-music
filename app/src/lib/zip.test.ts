import { describe, expect, it } from 'vitest'
import { createZip } from './zip'

const bytes = (text: string) => new TextEncoder().encode(text)
const read = async (blob: Blob) => new Uint8Array(await blob.arrayBuffer())

describe('createZip', () => {
  it('writes a stored entry with its name, data and CRC', async () => {
    const zip = await read(createZip([{ name: 'a.txt', data: bytes('hello') }]))
    const view = new DataView(zip.buffer)
    expect(view.getUint32(0, true)).toBe(0x04034b50)     // local file header
    expect(view.getUint16(8, true)).toBe(0)              // stored, not deflated
    expect(view.getUint32(14, true)).toBe(0x3610a686)    // CRC-32 of "hello"
    expect(view.getUint32(18, true)).toBe(5)
    expect(view.getUint32(22, true)).toBe(5)
    expect(new TextDecoder().decode(zip.slice(30, 35))).toBe('a.txt')
    expect(new TextDecoder().decode(zip.slice(35, 40))).toBe('hello')
  })

  it('ends with a central directory listing every entry', async () => {
    const zip = await read(createZip([
      { name: 'data.json', data: bytes('{}') },
      { name: 'scores/a.pdf', data: bytes('%PDF-1.4') },
    ]))
    const eocd = zip.length - 22
    const view = new DataView(zip.buffer)
    expect(view.getUint32(eocd, true)).toBe(0x06054b50)  // end of central directory
    expect(view.getUint16(eocd + 8, true)).toBe(2)       // entries on this disk
    expect(view.getUint16(eocd + 10, true)).toBe(2)      // total entries
    const text = new TextDecoder().decode(zip)
    expect(text).toContain('data.json')
    expect(text).toContain('scores/a.pdf')
  })
})
