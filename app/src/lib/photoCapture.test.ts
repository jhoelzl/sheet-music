import { afterEach, expect, it, vi } from 'vitest'
import { preparePhoto } from './photoPdf'

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

it('converts an oversized camera image to an oriented JPEG page and releases its URL', async () => {
  const revoke = vi.fn()
  vi.stubGlobal('URL', Object.assign(class extends URL {}, { createObjectURL: vi.fn(() => 'blob:photo'), revokeObjectURL: revoke }))
  vi.stubGlobal('Image', class {
    naturalWidth = 8000
    naturalHeight = 4000
    onload: (() => void) | null = null
    set src(_value: string) { queueMicrotask(() => this.onload?.()) }
  })
  const context = { fillStyle: '', fillRect: vi.fn(), drawImage: vi.fn() }
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(Object.assign({} as CanvasRenderingContext2D, context))
  const jpeg = new Blob(['jpeg'], { type: 'image/jpeg' })
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(jpeg))
  const page = await preparePhoto(new File(['image'], 'photo.jpg', { type: 'image/jpeg' }))
  expect(page).toMatchObject({ width: 4000, height: 2000, jpeg })
  expect(context.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 4000, 2000)
  expect(revoke).toHaveBeenCalledWith('blob:photo')
})
