// @vitest-environment node
import { PDFDocument } from 'pdf-lib'
import { expect, it } from 'vitest'
import { photosToPdf } from './photoPdf'
import imageData from './test-photo.jpg?inline'


it('creates a readable PDF with one correctly oriented page per photo', async () => {
  const blob = new Blob([Uint8Array.from(atob(imageData.split(',')[1]), (character) => character.charCodeAt(0))], { type: 'image/jpeg' })
  const file = await photosToPdf([
    { id: 'one', jpeg: blob, width: 1200, height: 1800 },
    { id: 'two', jpeg: blob, width: 1800, height: 1200 },
  ])
  expect(file.type).toBe('application/pdf')
  const document = await PDFDocument.load(await file.arrayBuffer())
  expect(document.getPageCount()).toBe(2)
  expect(document.getPage(0).getHeight()).toBeGreaterThan(document.getPage(0).getWidth())
  expect(document.getPage(1).getWidth()).toBeGreaterThan(document.getPage(1).getHeight())
})
