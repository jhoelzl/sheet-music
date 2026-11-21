import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { Library } from '../hooks/useLibrary'
import { INSTRUMENTS } from '../lib/instruments'
import { FILTERS, SORTS, VIEWS } from '../lib/sorting'
import type { UserSettings } from '../lib/userSettings'

export function SettingsPage({ lib, settings, loadError, onRetry, onSave }: {
  lib: Library
  settings: UserSettings
  loadError: string | null
  onRetry: () => void
  onSave: (settings: UserSettings) => Promise<void>
}) {
  const [draft, setDraft] = useState(settings)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const change = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    setDraft((current) => ({ ...current, [key]: value }))
    setMessage('')
    setError('')
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (loadError || savingRef.current) return
    savingRef.current = true
    setSaving(true)
    setError('')
    setMessage('')
    try {
      await onSave(draft)
      setMessage('Settings saved.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save your settings.')
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  return <div className="settings-page">
    <div className="library-intro"><div><h2>Settings</h2><p>Preferences sync across your devices.</p></div></div>
    {loadError && <div className="error" role="alert">Could not load your settings: {loadError} <button type="button" className="link" onClick={onRetry}>Try again</button></div>}
    <form className="settings-form" onSubmit={(event) => void submit(event)}>
      <fieldset disabled={saving || Boolean(loadError)}>
        <section className="settings-section">
          <h3>Appearance</h3>
          <label>Theme
            <select value={draft.theme} onChange={(event) => change('theme', event.target.value as UserSettings['theme'])}>
              <option value="system">Match device</option><option value="light">Light</option><option value="dark">Dark</option>
            </select>
          </label>
        </section>
        <section className="settings-section">
          <h3>Library defaults</h3>
          <p>These are applied when you open the app. You can still change them in the library.</p>
          <div className="settings-grid">
            <label>Default view
              <select value={draft.library_view} onChange={(event) => change('library_view', event.target.value as UserSettings['library_view'])}>
                <option value="remember">Remember last view on this device</option>
                {VIEWS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label>Default sort
              <select value={draft.library_sort} onChange={(event) => change('library_sort', event.target.value as UserSettings['library_sort'])}>
                {SORTS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label>Default filter
              <select value={draft.library_filter} onChange={(event) => change('library_filter', event.target.value as UserSettings['library_filter'])}>
                {FILTERS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label>Default instrument
              <select value={draft.library_instrument} onChange={(event) => change('library_instrument', event.target.value as UserSettings['library_instrument'])}>
                <option value="all">All instruments</option>
                {INSTRUMENTS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          </div>
        </section>
        <section className="settings-section">
          <h3>Videos</h3>
          <label>Default order
            <select value={draft.video_order} onChange={(event) => change('video_order', event.target.value as UserSettings['video_order'])}>
              <option value="original">Library order</option><option value="random">Random</option>
            </select>
          </label>
        </section>
        <button type="submit" className="btn primary">{saving ? 'Saving…' : 'Save settings'}</button>
      </fieldset>
      {message && <p className="settings-message" role="status">{message}</p>}
      {error && <p className="error" role="alert">Could not save your settings: {error}</p>}
    </form>
    <section className="settings-section">
      <h3>Backup</h3>
      <p>Download your data and scores as a zip file.</p>
      <button type="button" className="btn" disabled={lib.backingUp} onClick={() => void lib.backup()}>{lib.backingUp ? 'Preparing…' : 'Download backup'}</button>
    </section>
  </div>
}
