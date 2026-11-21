// @vitest-environment node
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs'

function scannedPdf(): Uint8Array {
  const image = Buffer.from('26a0d5fcb51fffffffffffffffffffffff8ff0010010', 'hex')
  const content = 'q 32 0 0 32 0 0 cm /Im0 Do Q'
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 32 32] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>',
    Buffer.concat([
      Buffer.from(`<< /Type /XObject /Subtype /Image /Width 32 /Height 32 /ColorSpace /DeviceGray /BitsPerComponent 1 /Filter /CCITTFaxDecode /DecodeParms << /K -1 /Columns 32 /Rows 32 >> /Length ${image.length} >>\nstream\n`),
      image,
      Buffer.from('\nendstream'),
    ]),
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ]
  const chunks = [Buffer.from('%PDF-1.4\n')]
  const offsets = [0]
  for (const [index, object] of objects.entries()) {
    offsets.push(chunks.reduce((sum, chunk) => sum + chunk.length, 0))
    chunks.push(Buffer.from(`${index + 1} 0 obj\n`), Buffer.from(object), Buffer.from('\nendobj\n'))
  }
  const xref = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  chunks.push(Buffer.from(`xref\n0 ${offsets.length}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`))
  return new Uint8Array(Buffer.concat(chunks))
}

describe('PDF image decoder', () => {
  it('decodes CCITT-compressed scanned pages', async () => {
    const packagePath = createRequire(import.meta.url).resolve('pdfjs-dist/package.json')
    const task = getDocument({ data: scannedPdf(), wasmUrl: `${join(dirname(packagePath), 'wasm')}/` })
    try {
      const doc = await task.promise
      const page = await doc.getPage(1)
      const operators = await page.getOperatorList()
      const index = operators.fnArray.indexOf(OPS.paintImageXObject)
      expect(index).toBeGreaterThanOrEqual(0)
      const image = await new Promise<{ width: number; height: number; data: Uint8Array } | null>((resolve) => {
        page.objs.get(operators.argsArray[index][0], resolve)
      })
      expect(image).not.toBeNull()
      expect(image?.width).toBe(32)
      expect(image?.height).toBe(32)
      expect(new Set(image?.data).size).toBeGreaterThan(1)
    } finally {
      await task.destroy()
    }
  })
})
