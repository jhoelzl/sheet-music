export function scoreImageType(bytes: Uint8Array): string | null {
  const startsWith = (...signature: number[]) => signature.every((value, index) => bytes[index] === value)
  const text = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end))
  if (startsWith(0xff, 0xd8, 0xff)) return 'image/jpeg'
  if (startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png'
  if (text(0, 6) === 'GIF87a' || text(0, 6) === 'GIF89a') return 'image/gif'
  if (text(0, 4) === 'RIFF' && text(8, 12) === 'WEBP') return 'image/webp'
  if (text(0, 2) === 'BM') return 'image/bmp'
  if (text(4, 8) === 'ftyp') {
    const brands = text(8, 12)
    if (brands === 'avif' || brands === 'avis') return 'image/avif'
    if (['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(brands)) return 'image/heic'
  }
  return null
}
