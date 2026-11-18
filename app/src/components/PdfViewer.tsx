import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist'

export const PDF_VIEWER_HASH = '#pdf='

export function pdfViewerUrl(signedUrl: string, title: string) {
  const base = `${window.location.origin}${window.location.pathname}`
  return `${base}${PDF_VIEWER_HASH}${encodeURIComponent(signedUrl)}&title=${encodeURIComponent(title)}`
}

function parseHash() {
  const params = new URLSearchParams(window.location.hash.slice(1))
  return { url: params.get('pdf'), title: params.get('title') ?? 'PDF' }
}

export function PdfViewer() {
  const { url, title } = parseHash()
  const containerRef = useRef<HTMLDivElement>(null)
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [error, setError] = useState(false)
  const [width, setWidth] = useState(0)

  useEffect(() => { document.title = title }, [title])

  useEffect(() => {
    if (!url) { setError(true); return }
    let cancelled = false
    let task: PDFDocumentLoadingTask | null = null
    void (async () => {
      try {
        const pdfjs = await import('pdfjs-dist')
        const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default
        task = pdfjs.getDocument({ url })
        const loaded = await task.promise
        if (cancelled) return
        setDoc(loaded)
      } catch {
        if (!cancelled) setError(true)
      }
    })()
    return () => { cancelled = true; void task?.destroy() }
  }, [url])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => setWidth(el.clientWidth)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!doc || !el || !width) return
    let cancelled = false
    void (async () => {
      const canvases: HTMLCanvasElement[] = []
      for (let n = 1; n <= doc.numPages; n++) {
        const page = await doc.getPage(n)
        if (cancelled) return
        const base = page.getViewport({ scale: 1 })
        const scale = width / base.width
        const viewport = page.getViewport({ scale: scale * Math.min(window.devicePixelRatio || 1, 3) })
        const canvas = document.createElement('canvas')
        canvas.width = Math.floor(viewport.width)
        canvas.height = Math.floor(viewport.height)
        canvas.style.width = '100%'
        canvas.style.display = 'block'
        canvas.style.marginBottom = '8px'
        await page.render({ canvas, viewport }).promise
        if (cancelled) return
        canvases.push(canvas)
        if (n === 1) el.replaceChildren(canvas)
        else el.appendChild(canvas)
      }
    })()
    return () => { cancelled = true }
  }, [doc, width])

  return (
    <div style={{ background: '#525659', minHeight: '100vh' }}>
      {error && <p style={{ color: '#fff', padding: 16 }}>Could not load the PDF. Close this tab and try again.</p>}
      {!error && !doc && <p style={{ color: '#fff', padding: 16 }}>Loading…</p>}
      <div ref={containerRef} style={{ width: '100%' }} />
    </div>
  )
}
