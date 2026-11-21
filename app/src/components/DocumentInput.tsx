import { useEffect, useRef, useState } from 'react'
import { confirmDelete } from '../lib/confirmDelete'
import { photosToPdf, preparePhoto } from '../lib/photoPdf'
import type { PhotoPage } from '../lib/photoPdf'
import { DeleteButton } from './DeleteButton'

function PhotoPreview({ photo, number, disabled, onDelete }: { photo: PhotoPage; number: number; disabled: boolean; onDelete: () => void }) {
  const image = useRef<HTMLImageElement>(null)
  useEffect(() => {
    const next = URL.createObjectURL(photo.jpeg)
    if (image.current) image.current.src = next
    return () => URL.revokeObjectURL(next)
  }, [photo])
  return <li>
    <img ref={image} alt={`Photo page ${number}`} />
    <span>Page {number}</span>
    <DeleteButton compact label={`Delete photo page ${number}`} disabled={disabled} onClick={onDelete} />
  </li>
}

export function DocumentInput({ label, file, disabled, onChange, onProcessingChange }: {
  label: string
  file: File | null
  disabled: boolean
  onChange: (file: File | null) => void
  onProcessingChange: (processing: boolean) => void
}) {
  const [photos, setPhotos] = useState<PhotoPage[]>([])
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const camera = useRef<HTMLInputElement>(null)
  const pdfInput = useRef<HTMLInputElement>(null)
  const active = useRef(false)
  const processingRef = useRef(false)
  useEffect(() => {
    active.current = true
    return () => { active.current = false; onProcessingChange(false) }
  }, [onProcessingChange])

  const updatePhotos = async (change: () => Promise<PhotoPage[]>) => {
    if (processingRef.current) return
    processingRef.current = true
    setProcessing(true)
    onProcessingChange(true)
    setError('')
    try {
      const next = await change()
      const pdf = next.length ? await photosToPdf(next) : null
      if (!active.current) return
      if (pdfInput.current) pdfInput.current.value = ''
      setPhotos(next)
      onChange(pdf)
    } catch (reason) {
      if (active.current) setError(reason instanceof Error ? reason.message : 'Could not create the PDF from photos.')
    } finally {
      processingRef.current = false
      if (active.current) { setProcessing(false); onProcessingChange(false) }
    }
  }
  const locked = disabled || processing

  return <div className="document-input">
    <label>{label}<input ref={pdfInput} type="file" accept="application/pdf,.pdf" disabled={locked || photos.length > 0}
      onChange={(event) => { setError(''); onChange(event.target.files?.[0] ?? null) }} /></label>
    <button type="button" className="btn" disabled={locked} onClick={() => {
      if (file && !photos.length && !window.confirm('Replace the selected PDF with camera photos?')) return
      camera.current?.click()
    }}>{photos.length ? 'Take another photo' : 'Take photo'}</button>
    <input ref={camera} type="file" accept="image/*" capture="environment" aria-label="Camera photo" hidden disabled={locked}
      onChange={(event) => {
        const selected = event.target.files?.[0]
        event.target.value = ''
        if (selected) void updatePhotos(async () => [...photos, await preparePhoto(selected)])
      }} />
    {processing && <span className="muted" role="status">Preparing PDF…</span>}
    {error && <span className="error" role="alert">{error}</span>}
    {photos.length > 0 && <div>
      <span className="muted">{photos.length} {photos.length === 1 ? 'photo' : 'photos'} in PDF</span>
      <ol className="document-photos">
        {photos.map((photo, index) => <PhotoPreview key={photo.id} photo={photo} number={index + 1} disabled={locked}
          onDelete={() => {
            if (confirmDelete(`photo page ${index + 1}`, 'The other pages will be kept.'))
              void updatePhotos(async () => photos.filter((item) => item.id !== photo.id))
          }} />)}
      </ol>
    </div>}
    {file && !photos.length && <span className="muted">{file.name}</span>}
  </div>
}
