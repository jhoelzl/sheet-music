export async function countPdfPages(blob: Blob): Promise<number | null> {
  try {
    const { PDFDocument } = await import('pdf-lib')
    const doc = await PDFDocument.load(await blob.arrayBuffer(), { ignoreEncryption: true })
    return doc.getPageCount() || null
  } catch {
    return null
  }
}
