import { Capacitor, registerPlugin } from '@capacitor/core'

type ScanResult = { cancelled: true } | { cancelled: false; token: string; size: number }
type ScannerPlugin = {
  scan(): Promise<ScanResult>
  readChunk(options: { token: string; offset: number }): Promise<{ data: string }>
  release(options: { token: string }): Promise<void>
}

const scanner = registerPlugin<ScannerPlugin>('DocumentScanner')

export function hasDocumentScanner(): boolean {
  return Capacitor.getPlatform() === 'ios' && Capacitor.isPluginAvailable('DocumentScanner')
}

export async function scanDocument(isActive: () => boolean): Promise<File | null> {
  const result = await scanner.scan()
  if (result.cancelled) return null
  const { token, size } = result
  try {
    if (!token || !Number.isSafeInteger(size) || size <= 0) throw new Error('The scanned PDF is invalid.')
    const chunks: Uint8Array<ArrayBuffer>[] = []
    let offset = 0
    while (offset < size) {
      if (!isActive()) return null
      const { data } = await scanner.readChunk({ token, offset })
      const decoded = atob(data)
      if (!decoded.length || decoded.length > size - offset) throw new Error('The scanned PDF could not be read completely.')
      const bytes = Uint8Array.from(decoded, (character) => character.charCodeAt(0))
      if (offset === 0 && new TextDecoder().decode(bytes.subarray(0, 5)) !== '%PDF-') throw new Error('The scanned document is not a valid PDF.')
      chunks.push(bytes)
      offset += bytes.length
    }
    return new File(chunks, 'document-scan.pdf', { type: 'application/pdf' })
  } finally {
    if (token) await scanner.release({ token })
  }
}
