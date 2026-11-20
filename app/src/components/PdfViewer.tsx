import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentLoadingTask, PDFDocumentProxy, PDFPageProxy, RenderTask } from 'pdfjs-dist'
import { scoreImageType } from '../lib/scoreImage'

function PdfPage({ doc, number, width, zoom, scrollRoot }: {
  doc: PDFDocumentProxy
  number: number
  width: number
  zoom: number
  scrollRoot: HTMLElement | null
}) {
  const container = useRef<HTMLDivElement>(null)
  const [page, setPage] = useState<PDFPageProxy | null>(null)
  const [visible, setVisible] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    void doc.getPage(number).then((result) => {
      if (active) setPage(result)
    }).catch((reason: unknown) => {
      if (active) {
        console.error('Could not load PDF page', reason)
        setError(true)
      }
    })
    return () => { active = false }
  }, [doc, number])

  useEffect(() => {
    const element = container.current
    if (!element || !scrollRoot) return
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      root: scrollRoot,
      rootMargin: '100% 0px',
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [scrollRoot])

  useEffect(() => {
    const parent = container.current
    if (!page || !parent || !width || !visible) return
    const element = document.createElement('canvas')
    element.setAttribute('aria-label', `Page ${number}`)
    parent.prepend(element)
    let active = true
    let task: RenderTask | undefined
    const base = page.getViewport({ scale: 1 })
    const cssScale = width / base.width
    // Keep individual canvases within iOS WebKit's pixel and dimension limits.
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2, 4096 / width, 4096 / (width * base.height / base.width), Math.sqrt(4000000 / (width * width * base.height / base.width)))
    const viewport = page.getViewport({ scale: cssScale * pixelRatio })
    element.width = Math.max(1, Math.round(viewport.width))
    element.height = Math.max(1, Math.round(viewport.height))
    void Promise.resolve().then(() => {
      if (!active) return
      task = page.render({ canvas: element, viewport })
      return task.promise
    }).catch((reason: unknown) => {
      if (active) {
        console.error('Could not render PDF page', reason)
        setError(true)
      }
    })
    return () => {
      active = false
      task?.cancel()
      element.remove()
      if (task) {
        const release = () => { element.width = 0; element.height = 0 }
        void task.promise.then(release, release)
      } else {
        element.width = 0
        element.height = 0
      }
    }
  }, [page, width, visible, number])

  const viewport = page?.getViewport({ scale: 1 })
  return (
    <div ref={container} className="pdf-page" style={{ width: `${zoom * 100}%`, aspectRatio: viewport ? `${viewport.width} / ${viewport.height}` : '1 / 1.414' }}>
      {error && <p role="alert">Could not display page {number}. Close and reopen the PDF to retry.</p>}
    </div>
  )
}

const MIN_ZOOM = 0.5
const MAX_ZOOM = 4
const ZOOM_STEP = 0.25

export function PdfViewer({ url, onLoad }: { url: string; onLoad: (pages: number) => void }) {
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null)
  const onLoadRef = useRef(onLoad)
  useEffect(() => { onLoadRef.current = onLoad }, [onLoad])
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const [width, setWidth] = useState(0)
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    let active = true
    let task: PDFDocumentLoadingTask | undefined
    let objectUrl: string | undefined
    const controller = new AbortController()
    void (async () => {
      try {
        const pdfjs = await import('pdfjs-dist')
        const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
        if (!active) return
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default
        task = pdfjs.getDocument({ url })
        const loaded = await task.promise
        if (active) {
          setDoc(loaded)
          onLoadRef.current(loaded.numPages)
        }
      } catch (reason) {
        if (!active) return
        if (reason instanceof Error && reason.name === 'InvalidPDFException') {
          try {
            const response = await fetch(url, { signal: controller.signal })
            if (!response.ok) throw new Error(`Score request failed (${response.status})`)
            const bytes = new Uint8Array(await response.arrayBuffer())
            const type = scoreImageType(bytes)
            if (!type) throw new Error('The score is neither a supported image nor a valid PDF')
            if (!active) return
            objectUrl = URL.createObjectURL(new Blob([bytes], { type }))
            setImageUrl(objectUrl)
            return
          } catch (imageError) {
            if (!active) return
            console.error('Could not load score image', imageError)
          }
        } else {
          console.error('Could not load PDF', reason)
        }
        setError(true)
      }
    })()
    return () => {
      active = false
      controller.abort()
      if (task) void task.destroy().catch((reason: unknown) => console.error('Could not close PDF', reason))
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [url])

  useEffect(() => {
    const element = scrollRoot
    if (!element) return
    const update = () => setWidth(element.clientWidth)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [scrollRoot])

  const changeZoom = (delta: number) => setZoom((current) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round((current + delta) * 100) / 100)))
  const pageWidth = width * zoom

  return (
    <div className="pdf-viewer">
      <div ref={setScrollRoot} className="pdf-scroll" aria-label="PDF pages" tabIndex={0}>
        {error && <p className="pdf-message" role="alert">Could not load the score. Check your connection and file format, then close and reopen it.</p>}
        {!error && !doc && !imageUrl && <p className="pdf-message" role="status">Loading score…</p>}
        {!error && imageUrl && <img className="score-image" style={{ width: `${zoom * 100}%` }} src={imageUrl} alt="Sheet music" onError={() => setError(true)} />}
        {doc && Array.from({ length: doc.numPages }, (_, index) => (
          <PdfPage key={index} doc={doc} number={index + 1} width={pageWidth} zoom={zoom} scrollRoot={scrollRoot} />
        ))}
      </div>
      {!error && (
        <div className="pdf-zoom" role="group" aria-label="Zoom">
          <button type="button" aria-label="Zoom out" title="Zoom out" disabled={zoom <= MIN_ZOOM} onClick={() => changeZoom(-ZOOM_STEP)}>−</button>
          <button type="button" className="pdf-zoom-value" aria-label="Reset zoom" title="Reset to fit width" onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button>
          <button type="button" aria-label="Zoom in" title="Zoom in" disabled={zoom >= MAX_ZOOM} onClick={() => changeZoom(ZOOM_STEP)}>+</button>
        </div>
      )}
    </div>
  )
}
