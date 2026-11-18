import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentLoadingTask, PDFDocumentProxy, PDFPageProxy, RenderTask } from 'pdfjs-dist'

function PdfPage({ doc, number, width, scrollRoot }: {
  doc: PDFDocumentProxy
  number: number
  width: number
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
    <div ref={container} className="pdf-page" style={{ aspectRatio: viewport ? `${viewport.width} / ${viewport.height}` : '1 / 1.414' }}>
      {error && <p role="alert">Could not display page {number}. Close and reopen the PDF to retry.</p>}
    </div>
  )
}

export function PdfViewer({ url, onLoad }: { url: string; onLoad: (pages: number) => void }) {
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null)
  const onLoadRef = useRef(onLoad)
  useEffect(() => { onLoadRef.current = onLoad }, [onLoad])
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [error, setError] = useState(false)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    let active = true
    let task: PDFDocumentLoadingTask | undefined
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
        if (active) {
          console.error('Could not load PDF', reason)
          setError(true)
        }
      }
    })()
    return () => {
      active = false
      if (task) void task.destroy().catch((reason: unknown) => console.error('Could not close PDF', reason))
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

  return (
    <div ref={setScrollRoot} className="pdf-scroll" aria-label="PDF pages" tabIndex={0}>
      {error && <p className="pdf-message" role="alert">Could not load the PDF. Check your connection, then close and reopen it.</p>}
      {!error && !doc && <p className="pdf-message" role="status">Loading PDF…</p>}
      {doc && Array.from({ length: doc.numPages }, (_, index) => (
        <PdfPage key={index} doc={doc} number={index + 1} width={width} scrollRoot={scrollRoot} />
      ))}
    </div>
  )
}
