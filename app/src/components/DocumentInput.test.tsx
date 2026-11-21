import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { DocumentInput } from './DocumentInput'

const mocks = vi.hoisted(() => ({ prepare: vi.fn(), pdf: vi.fn() }))
vi.mock('../lib/photoPdf', () => ({ preparePhoto: mocks.prepare, photosToPdf: mocks.pdf }))

function Form() {
  const [file, setFile] = useState<File | null>(null)
  const [processing, setProcessing] = useState(false)
  return <form onSubmit={(event) => event.preventDefault()}>
    <DocumentInput label="PDF file" file={file} disabled={false} onChange={setFile} onProcessingChange={setProcessing} />
    <button type="submit" disabled={processing || !file}>Save</button>
  </form>
}

beforeEach(() => {
  vi.stubGlobal('URL', Object.assign(class extends URL {}, { createObjectURL: vi.fn(() => 'blob:photo'), revokeObjectURL: vi.fn() }))
  vi.stubGlobal('confirm', vi.fn(() => true))
  mocks.prepare.mockReset()
  mocks.pdf.mockReset()
  mocks.prepare.mockImplementation(async (file: File) => ({ id: file.name, jpeg: file, width: 10, height: 20 }))
  mocks.pdf.mockImplementation(async () => new File(['pdf'], 'camera-scan.pdf', { type: 'application/pdf' }))
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it('collects photos in order, permits deleting pages, and produces a PDF', async () => {
  const user = userEvent.setup()
  render(<Form />)
  const camera = screen.getByLabelText('Camera photo') as HTMLInputElement
  expect(camera.getAttribute('capture')).toBe('environment')
  fireEvent.change(camera, { target: { files: [new File(['first'], 'first.jpg', { type: 'image/jpeg' })] } })
  expect(await screen.findByText('1 photo in PDF')).toBeTruthy()
  expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(false)
  expect((screen.getByLabelText('PDF file') as HTMLInputElement).disabled).toBe(true)
  fireEvent.change(camera, { target: { files: [new File(['second'], 'second.jpg', { type: 'image/jpeg' })] } })
  expect(await screen.findByText('2 photos in PDF')).toBeTruthy()
  expect(mocks.pdf.mock.lastCall?.[0].map((page: { id: string }) => page.id)).toEqual(['first.jpg', 'second.jpg'])
  await user.click(screen.getByRole('button', { name: 'Delete photo page 1' }))
  await waitFor(() => expect(mocks.pdf.mock.lastCall?.[0].map((page: { id: string }) => page.id)).toEqual(['second.jpg']))
  expect(screen.getByText('1 photo in PDF')).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Delete photo page 1' }))
  await waitFor(() => expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true))
  expect((screen.getByLabelText('PDF file') as HTMLInputElement).disabled).toBe(false)
})

it('keeps the selected PDF if camera capture fails or is cancelled', async () => {
  const user = userEvent.setup()
  render(<Form />)
  const original = new File(['pdf'], 'original.pdf', { type: 'application/pdf' })
  await user.upload(screen.getByLabelText('PDF file'), original)
  vi.mocked(window.confirm).mockReturnValueOnce(false)
  await user.click(screen.getByRole('button', { name: 'Take photo' }))
  expect(mocks.prepare).not.toHaveBeenCalled()
  mocks.prepare.mockRejectedValueOnce(new Error('Could not read the photo.'))
  fireEvent.change(screen.getByLabelText('Camera photo'), { target: { files: [new File(['bad'], 'bad.jpg', { type: 'image/jpeg' })] } })
  expect((await screen.findByRole('alert')).textContent).toContain('Could not read the photo.')
  expect(screen.getByText('original.pdf')).toBeTruthy()
  expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(false)
})

it('blocks submission while a photo is being processed', async () => {
  let finish!: (value: { id: string; jpeg: Blob; width: number; height: number }) => void
  mocks.prepare.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
  render(<Form />)
  fireEvent.change(screen.getByLabelText('Camera photo'), { target: { files: [new File(['photo'], 'one.jpg', { type: 'image/jpeg' })] } })
  expect(screen.getByRole('status').textContent).toContain('Preparing PDF')
  expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true)
  finish({ id: 'one', jpeg: new Blob(['photo']), width: 10, height: 20 })
  await waitFor(() => expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(false))
})
