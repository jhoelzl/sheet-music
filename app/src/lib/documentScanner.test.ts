// @vitest-environment node
import { PDFDocument } from 'pdf-lib'
import { beforeEach, expect, it, vi } from 'vitest'
import { hasDocumentScanner, scanDocument } from './documentScanner'

const mocks = vi.hoisted(() => ({ platform: vi.fn(), available: vi.fn(), scan: vi.fn(), readChunk: vi.fn(), release: vi.fn() }))
vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: mocks.platform, isPluginAvailable: mocks.available },
  registerPlugin: () => ({ scan: mocks.scan, readChunk: mocks.readChunk, release: mocks.release }),
}))

beforeEach(() => {
  vi.resetAllMocks()
  mocks.platform.mockReturnValue('ios')
  mocks.available.mockReturnValue(true)
  mocks.release.mockResolvedValue(undefined)
})

it('only enables scanning in an iOS app with the native plugin', () => {
  expect(hasDocumentScanner()).toBe(true)
  mocks.available.mockReturnValue(false)
  expect(hasDocumentScanner()).toBe(false)
  mocks.platform.mockReturnValue('web')
  mocks.available.mockReturnValue(true)
  expect(hasDocumentScanner()).toBe(false)
})

it('reconstructs a multi-page PDF in chunks and removes the temporary file', async () => {
  const document = await PDFDocument.create()
  document.addPage([595, 842])
  document.addPage([842, 595])
  const bytes = await document.save()
  mocks.scan.mockResolvedValue({ cancelled: false, token: 'scan-1', size: bytes.length })
  mocks.readChunk.mockImplementation(async ({ offset }: { offset: number }) => ({
    data: btoa(Array.from(bytes.subarray(offset, offset + 64), (byte) => String.fromCharCode(byte)).join('')),
  }))
  const file = await scanDocument(() => true)
  expect(file?.type).toBe('application/pdf')
  expect(file?.name).toBe('document-scan.pdf')
  expect((await PDFDocument.load(await file!.arrayBuffer())).getPageCount()).toBe(2)
  expect(mocks.readChunk.mock.calls.length).toBeGreaterThan(1)
  expect(mocks.release).toHaveBeenCalledExactlyOnceWith({ token: 'scan-1' })
})

it('keeps cancellation harmless and releases scans when the form closes', async () => {
  mocks.scan.mockResolvedValueOnce({ cancelled: true })
  expect(await scanDocument(() => true)).toBeNull()
  expect(mocks.release).not.toHaveBeenCalled()
  mocks.scan.mockResolvedValueOnce({ cancelled: false, token: 'scan-2', size: 100 })
  expect(await scanDocument(() => false)).toBeNull()
  expect(mocks.readChunk).not.toHaveBeenCalled()
  expect(mocks.release).toHaveBeenCalledExactlyOnceWith({ token: 'scan-2' })
})

it('rejects incomplete or invalid PDF data and still removes the temporary file', async () => {
  mocks.scan.mockResolvedValue({ cancelled: false, token: 'scan-3', size: 20 })
  mocks.readChunk.mockResolvedValueOnce({ data: btoa('%PDF-') }).mockResolvedValueOnce({ data: '' })
  await expect(scanDocument(() => true)).rejects.toThrow('could not be read completely')
  expect(mocks.release).toHaveBeenCalledWith({ token: 'scan-3' })
  mocks.scan.mockResolvedValueOnce({ cancelled: false, token: 'scan-4', size: 5 })
  mocks.readChunk.mockResolvedValueOnce({ data: btoa('image') })
  await expect(scanDocument(() => true)).rejects.toThrow('not a valid PDF')
  expect(mocks.release).toHaveBeenCalledWith({ token: 'scan-4' })
})
