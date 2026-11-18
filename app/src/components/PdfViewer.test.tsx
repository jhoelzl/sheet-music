import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
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
    expect(onLoad).toHaveBeenCalledWith(2)
    expect((screen.getByLabelText('Page 1') as HTMLCanvasElement).width).toBe(780)
    expect((screen.getByLabelText('Page 2') as HTMLCanvasElement).width).toBe(780)
    width = 834
    act(() => updateWidth())
    await waitFor(() => expect((screen.getByLabelText('Page 1') as HTMLCanvasElement).width).toBe(1633))
    expect(screen.getByLabelText('Page 1').parentElement?.className).toBe('pdf-page')
  })

  it('reports a PDF loading failure', async () => {
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.getDocument.mockReturnValueOnce({ promise: Promise.reject(new Error('offline')), destroy: mocks.destroy })
    render(<PdfViewer url="https://example.test/a.pdf" onLoad={vi.fn()} />)
    expect((await screen.findByRole('alert')).textContent).toContain('Could not load the PDF')
    expect(log).toHaveBeenCalled()
  })
})
