import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UploadStatus } from './UploadStatus'

describe('upload status', () => {
  afterEach(() => { cleanup(); vi.useRealTimers() })

  it('shows the current stage without claiming a byte percentage and warns about slow requests', async () => {
    vi.useFakeTimers()
    const { container, rerender } = render(<UploadStatus state="pending" title="Uploading score" stage={{ phase: 'upload', message: 'Uploading PDF…' }} />)
    const progress = screen.getByRole('progressbar')
    expect(progress.getAttribute('aria-valuenow')).toBeNull()
    expect(progress.getAttribute('aria-label')).toContain('Uploading PDF')
    expect(container.querySelector('.upload-status-step--done')?.textContent).toBe('Prepare')
    expect(container.querySelector('.upload-status-step--active')?.textContent).toBe('Upload')
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000) })
    expect(screen.getByRole('status').textContent).toContain('taking longer than usual')
    rerender(<UploadStatus state="error" title="Upload failed" stage={{ phase: 'upload', message: 'Uploading PDF…' }} detail="Connection lost" />)
    expect(screen.getByRole('alert').textContent).toContain('Connection lost')
    expect(container.querySelector('.upload-status-step--failed')?.textContent).toBe('Upload')
    rerender(<UploadStatus state="success" title="Saved" />)
    expect(screen.getByRole('status').textContent).toContain('Saved')
    expect(container.querySelectorAll('.upload-status-step--done')).toHaveLength(3)
  })
})
