export type PhotoPage = { id: string; jpeg: Blob; width: number; height: number }

export async function preparePhoto(file: File): Promise<PhotoPage> {
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('Could not read the photo. Please try another photo.'))
      image.src = url
    })
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('The photo has no image data.')
    const scale = Math.min(1, 4000 / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('This device could not prepare the photo.')
    context.fillStyle = '#fff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const jpeg = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not prepare the photo.')), 'image/jpeg', 0.9))
    return { id: crypto.randomUUID(), jpeg, width: canvas.width, height: canvas.height }
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function photosToPdf(photos: PhotoPage[]): Promise<File> {
  if (!photos.length) throw new Error('Add at least one photo.')
  const { PDFDocument } = await import('pdf-lib')
  const doc = await PDFDocument.create()
  for (const photo of photos) {
    const image = await doc.embedJpg(await photo.jpeg.arrayBuffer())
    const scale = 842 / Math.max(photo.width, photo.height)
    const width = photo.width * scale
    const height = photo.height * scale
    doc.addPage([width, height]).drawImage(image, { x: 0, y: 0, width, height })
  }
  return new File([new Uint8Array(await doc.save())], 'camera-scan.pdf', { type: 'application/pdf' })
}
