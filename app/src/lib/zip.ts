export type ZipEntry = { name: string; data: Uint8Array<ArrayBuffer> }

let crcTable: Uint32Array | null = null

/** Standard CRC-32 (IEEE 802.3), needed by the zip format. */
function crc32(bytes: Uint8Array<ArrayBuffer>): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256)
    for (let i = 0; i < 256; i++) {
      let value = i
      for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
      crcTable[i] = value >>> 0
    }
  }
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i++) crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

/**
 * Build a zip archive without compression (store method). Small enough to avoid
 * a dependency and fine for a manual backup: the PDFs are already compressed.
 */
export function createZip(entries: ZipEntry[]): Blob {
  const parts: Uint8Array<ArrayBuffer>[] = []
  const central: Uint8Array<ArrayBuffer>[] = []
  let offset = 0

  for (const entry of entries) {
    const name = new TextEncoder().encode(entry.name)
    const crc = crc32(entry.data)

    const header = new Uint8Array(30 + name.length)
    const h = new DataView(header.buffer)
    h.setUint32(0, 0x04034b50, true)         // local file header
    h.setUint16(4, 20, true)                 // version needed to extract
    h.setUint16(6, 0x0800, true)             // flag: UTF-8 file name
    h.setUint16(8, 0, true)                  // compression: store
    h.setUint32(14, crc, true)
    h.setUint32(18, entry.data.length, true)
    h.setUint32(22, entry.data.length, true)
    h.setUint16(26, name.length, true)
    header.set(name, 30)
    parts.push(header, entry.data)

    const record = new Uint8Array(46 + name.length)
    const c = new DataView(record.buffer)
    c.setUint32(0, 0x02014b50, true)         // central directory header
    c.setUint16(4, 20, true)                 // version made by
    c.setUint16(6, 20, true)                 // version needed
    c.setUint16(8, 0x0800, true)             // flag: UTF-8 file name
    c.setUint16(10, 0, true)                 // compression: store
    c.setUint32(16, crc, true)
    c.setUint32(20, entry.data.length, true)
    c.setUint32(24, entry.data.length, true)
    c.setUint16(28, name.length, true)
    c.setUint32(42, offset, true)            // offset of the local header
    record.set(name, 46)
    central.push(record)

    offset += header.length + entry.data.length
  }

  const centralSize = central.reduce((total, record) => total + record.length, 0)
  const end = new Uint8Array(22)
  const e = new DataView(end.buffer)
  e.setUint32(0, 0x06054b50, true)           // end of central directory
  e.setUint16(8, entries.length, true)
  e.setUint16(10, entries.length, true)
  e.setUint32(12, centralSize, true)
  e.setUint32(16, offset, true)

  return new Blob([...parts, ...central, end], { type: 'application/zip' })
}
