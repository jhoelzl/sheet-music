import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { UploadStage } from '../lib/documentUpload'

const steps = [
  { phase: 'prepare', label: 'Prepare' },
  { phase: 'upload', label: 'Upload' },
  { phase: 'save', label: 'Save' },
] as const

export function UploadStatus({ state, stage, title, detail, children }: {
  state: 'pending' | 'success' | 'error'
  stage?: UploadStage | null
  title: string
  detail?: string
  children?: ReactNode
}) {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    if (state !== 'pending') return
    const timer = window.setTimeout(() => setSlow(true), 15_000)
    return () => window.clearTimeout(timer)
  }, [state])
  const active = steps.findIndex((step) => step.phase === stage?.phase)
  return <div className={`upload-status upload-status--${state}`} role={state === 'error' ? 'alert' : 'status'}>
    <div className="upload-status-heading">
      <span className="upload-status-icon" aria-hidden="true">{state === 'success' ? '✓' : state === 'error' ? '!' : '↑'}</span>
      <div className="upload-status-copy">
        <strong>{title}</strong>
        <p>{state === 'pending' ? stage?.message : detail}</p>
      </div>
    </div>
    <div className="upload-status-steps" aria-label={state === 'pending' ? `${title}: ${stage?.message ?? 'Preparing'}` : undefined}
      role={state === 'pending' ? 'progressbar' : undefined}>
      {steps.map((step, index) => {
        const stepState = state === 'success' || index < active ? 'done' : index === active ? state === 'error' ? 'failed' : 'active' : 'waiting'
        return <div key={step.phase} className={`upload-status-step upload-status-step--${stepState}`}>
          <span className="upload-status-track" aria-hidden="true"><span /></span>
          <span aria-hidden="true">{step.label}</span>
        </div>
      })}
    </div>
    {state === 'pending' && <p className="upload-status-hint">Keep this page open.{slow && ' This is taking longer than usual; the app will report a timeout if the request does not finish.'}</p>}
    {children && <div className="upload-status-actions">{children}</div>}
  </div>
}
