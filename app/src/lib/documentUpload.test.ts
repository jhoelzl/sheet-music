import { afterEach, describe, expect, it, vi } from 'vitest'
import { MAX_DOCUMENT_BYTES, saveUploadRecord, UploadCleanupError, uploadStep, validateDocumentSize } from './documentUpload'

const mocks = vi.hoisted(() => ({ remove: vi.fn() }))
vi.mock('../supabase', () => ({ supabase: { storage: { from: () => ({ remove: mocks.remove }) } } }))

describe('document upload safeguards', () => {
  afterEach(() => { vi.useRealTimers(); vi.clearAllMocks() })

  it('accepts documents up to 50 MB and rejects larger files', () => {
    const file = new File([], 'scan.pdf', { type: 'application/pdf' })
    Object.defineProperty(file, 'size', { value: MAX_DOCUMENT_BYTES, configurable: true })
    expect(() => validateDocumentSize(file)).not.toThrow()
    Object.defineProperty(file, 'size', { value: MAX_DOCUMENT_BYTES + 1 })
    expect(() => validateDocumentSize(file)).toThrow('larger than 50 MB')
  })

  it('times out a stalled request without waiting for it to settle', async () => {
    vi.useFakeTimers()
    const pending = uploadStep(new Promise(() => {}), 'Uploading the PDF')
    const assertion = expect(pending).rejects.toThrow('Uploading the PDF timed out')
    await vi.advanceTimersByTimeAsync(90_000)
    await assertion
  })

  it('does not delete a PDF after an ambiguous database timeout', async () => {
    vi.useFakeTimers()
    const uncertain = new Set<string>()
    const pending = saveUploadRecord(new Promise<{ data: null; error: null }>(() => {}), 'u/document.pdf', 'id', uncertain, 'Saving')
    const assertion = expect(pending).rejects.toThrow('Saving timed out')
    await vi.advanceTimersByTimeAsync(90_000)
    await assertion
    await expect(saveUploadRecord(Promise.resolve({ data: null, error: { code: '23514', message: 'Rejected' } }),
      'u/document.pdf', 'id', uncertain, 'Saving')).rejects.toMatchObject({ message: 'Rejected' })
    expect(mocks.remove).not.toHaveBeenCalled()
  })

  it('cleans up a definite database rejection and reports cleanup failures', async () => {
    mocks.remove.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: { message: 'Storage unavailable' } })
    const result = () => Promise.resolve({ data: null, error: { code: '23514', message: 'Rejected' } })
    await expect(saveUploadRecord(result(), 'u/document.pdf', 'id', new Set(), 'Saving')).rejects.toMatchObject({ message: 'Rejected' })
    expect(mocks.remove).toHaveBeenCalledWith(['u/document.pdf'])
    await expect(saveUploadRecord(result(), 'u/document.pdf', 'id', new Set(), 'Saving')).rejects.toBeInstanceOf(UploadCleanupError)
  })
})
