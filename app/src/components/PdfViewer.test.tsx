import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PdfViewer } from './PdfViewer'

const mocks = vi.hoisted(() => {
  const renderPage = vi.fn(() => ({ promise: Promise.resolve(), cancel: vi.fn() }))
  const page = { getViewport: ({ scale }: { scale: number }) => ({ width: 600 * scale, height: 900 * scale }), render: renderPage }
  const document = { numPages: 2, getPage: vi.fn(async () => page) }
  const destroy = vi.fn(async () => {})
  return { renderPage, document, destroy, getDocument: vi.fn(() => ({ promise: Promise.resolve(document), destroy })) }
})
vi.mock('pdfjs-dist', () => ({ getDocument: mocks.getDocument, GlobalWorkerOptions: {} }))
vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({ default: '/worker.mjs' }))

describe('PDF viewer', () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.clearAllMocks() })

  it('renders pages at the scroll area width and resizes for rotation', async () => {
    let updateWidth!: () => void
    let width = 390
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => width)
    vi.stubGlobal('devicePixelRatio', 2)
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: () => void) { updateWidth = callback }
      observe() {}
      disconnect() {}
    })
    vi.stubGlobal('IntersectionObserver', class {
      callback: (entries: { isIntersecting: boolean }[]) => void
      constructor(callback: (entries: { isIntersecting: boolean }[]) => void) { this.callback = callback }
      observe() { this.callback([{ isIntersecting: true }]) }
      disconnect() {}
    })
    const onLoad = vi.fn()
    render(<PdfViewer url="https://example.test/a.pdf" onLoad={onLoad} />)

    await waitFor(() => expect(mocks.renderPage).toHaveBeenCalledTimes(2))
    expect(mocks.getDocument).toHaveBeenCalledWith({
      url: 'https://example.test/a.pdf',
      wasmUrl: new URL(`${import.meta.env.BASE_URL}pdfjs-wasm/`, document.baseURI).href,
    })
    expect(onLoad).toHaveBeenCalledWith(2)
    expect((screen.getByLabelText('Page 1') as HTMLCanvasElement).width).toBe(780)
    expect((screen.getByLabelText('Page 2') as HTMLCanvasElement).width).toBe(780)
    width = 834
    act(() => updateWidth())
    await waitFor(() => expect((screen.getByLabelText('Page 1') as HTMLCanvasElement).width).toBe(1633))
    expect(screen.getByLabelText('Page 1').parentElement?.className).toBe('pdf-page')
  })

  it('zooms the pages in and out and resets to fit width', async () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => 400)
    vi.stubGlobal('devicePixelRatio', 1)
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
    vi.stubGlobal('IntersectionObserver', class {
      callback: (entries: { isIntersecting: boolean }[]) => void
      constructor(callback: (entries: { isIntersecting: boolean }[]) => void) { this.callback = callback }
      observe() { this.callback([{ isIntersecting: true }]) }
      disconnect() {}
    })
    const user = userEvent.setup()
    render(<PdfViewer url="https://example.test/a.pdf" onLoad={vi.fn()} />)
    await waitFor(() => expect(mocks.renderPage).toHaveBeenCalledTimes(2))
    const page = () => screen.getByLabelText('Page 1') as HTMLCanvasElement
    expect(page().width).toBe(400)
    expect(page().parentElement?.style.width).toBe('100%')

    await user.click(screen.getByRole('button', { name: 'Zoom in' }))
    await waitFor(() => expect(page().parentElement?.style.width).toBe('125%'))
    await waitFor(() => expect(page().width).toBe(500))

    await user.click(screen.getByRole('button', { name: 'Zoom out' }))
    await waitFor(() => expect(page().parentElement?.style.width).toBe('100%'))
    await user.click(screen.getByRole('button', { name: 'Zoom out' }))
    await waitFor(() => expect(page().parentElement?.style.width).toBe('75%'))
    await user.click(screen.getByRole('button', { name: 'Zoom out' }))
    await waitFor(() => expect((screen.getByRole('button', { name: 'Zoom out' }) as HTMLButtonElement).disabled).toBe(true))

    await user.click(screen.getByRole('button', { name: 'Reset zoom' }))
    await waitFor(() => expect(page().parentElement?.style.width).toBe('100%'))
    expect((screen.getByRole('button', { name: 'Zoom out' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('reports a PDF loading failure', async () => {
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.getDocument.mockReturnValueOnce({ promise: Promise.reject(new Error('offline')), destroy: mocks.destroy })
    render(<PdfViewer url="https://example.test/a.pdf" onLoad={vi.fn()} />)
    expect((await screen.findByRole('alert')).textContent).toContain('Could not load the score')
    expect(log).toHaveBeenCalled()
  })

  it('displays a JPEG even when its URL and response type say PDF', async () => {
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
    const createObjectURL = vi.fn((_blob: Blob) => 'blob:score')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', Object.assign(class extends URL {}, { createObjectURL, revokeObjectURL }))
    const imageBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      headers: new Headers({ 'Content-Type': 'application/pdf' }),
      arrayBuffer: async () => imageBytes.buffer,
    })))
    mocks.getDocument.mockReturnValueOnce({
      promise: Promise.reject(Object.assign(new Error('Invalid PDF'), { name: 'InvalidPDFException' })),
      destroy: mocks.destroy,
    })
    const onLoad = vi.fn()
    const { unmount } = render(<PdfViewer url="https://example.test/score.pdf" onLoad={onLoad} />)

    const image = await screen.findByRole('img', { name: 'Sheet music' })
    expect(image.getAttribute('src')).toBe('blob:score')
    expect(createObjectURL.mock.calls[0][0].type).toBe('image/jpeg')
    expect(onLoad).not.toHaveBeenCalled()
    unmount()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:score')
  })

  it('reports an invalid file instead of displaying it as an image', async () => {
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer })))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.getDocument.mockReturnValueOnce({
      promise: Promise.reject(Object.assign(new Error('Invalid PDF'), { name: 'InvalidPDFException' })),
      destroy: mocks.destroy,
    })
    render(<PdfViewer url="https://example.test/score.pdf" onLoad={vi.fn()} />)
    expect((await screen.findByRole('alert')).textContent).toContain('Could not load the score')
    expect(screen.queryByRole('img')).toBeNull()
  })
})
