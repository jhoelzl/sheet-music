import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../supabase'
import type { Piece } from '../supabase'

type Setlist = { id: string; name: string }

function errorMessage(reason: unknown, fallback: string): string {
  return typeof reason === 'object' && reason !== null && 'message' in reason && typeof reason.message === 'string'
    ? reason.message : fallback
}

export function AddToSetlists({ piece }: { piece: Piece }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [setlists, setSetlists] = useState<Setlist[]>([])
  const [existing, setExisting] = useState<string[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const busyRef = useRef(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    let active = true
    setLoading(true)
    setError('')
    setMessage('')
    setSelected([])
    setSetlists([])
    setExisting([])
    void (async () => {
      try {
        const [lists, entries] = await Promise.all([
          supabase.from('sm_setlists').select('id, name').is('archived_at', null).order('position').order('created_at'),
          supabase.from('sm_setlist_pieces').select('setlist_id').eq('piece_id', piece.id),
        ])
        if (!active) return
        if (lists.error || entries.error) throw lists.error ?? entries.error
        setSetlists(lists.data ?? [])
        setExisting((entries.data ?? []).map((entry) => entry.setlist_id))
      } catch (reason) {
        if (active) setError(errorMessage(reason, 'Could not load setlists.'))
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [open, piece.id])

  const close = () => {
    if (busyRef.current) return
    setOpen(false)
    triggerRef.current?.focus()
  }

  const add = async () => {
    if (busyRef.current || selected.length === 0) return
    busyRef.current = true
    setSaving(true)
    setError('')
    setMessage('')
    const added: string[] = []
    const failures: string[] = []
    try {
      for (const id of selected) {
        const list = setlists.find((item) => item.id === id)
        if (!list) continue
        try {
          const { data, error: loadError } = await supabase.from('sm_setlist_pieces')
            .select('position').eq('setlist_id', id).order('position', { ascending: false }).limit(1)
          if (loadError) throw loadError
          const position = (data?.[0]?.position ?? -1) + 1
          const { error: addError } = await supabase.from('sm_setlist_pieces')
            .insert({ setlist_id: id, piece_id: piece.id, position, placeholder: null })
          if (addError) throw addError
          added.push(id)
        } catch (reason) {
          failures.push(`${list.name}: ${errorMessage(reason, 'Unknown error')}`)
        }
      }
      if (added.length) {
        setExisting((current) => [...current, ...added])
        setSelected((current) => current.filter((id) => !added.includes(id)))
        setMessage(`Added to ${added.length} ${added.length === 1 ? 'setlist' : 'setlists'}.`)
      }
      if (failures.length) setError(`Could not add to ${failures.join('; ')}`)
    } finally {
      busyRef.current = false
      setSaving(false)
    }
  }

  return (
    <>
      <button ref={triggerRef} type="button" className="btn setlist-add-trigger" onClick={() => setOpen(true)} aria-label={`Add ${piece.title} to setlists`}>+ Setlist</button>
      {open && createPortal(
        <div className="setlist-picker-overlay" onKeyDown={(event) => {
          if (event.key === 'Escape') close()
          if (event.key !== 'Tab') return
          const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)')
          if (!focusable?.length) { event.preventDefault(); return }
          const first = focusable[0], last = focusable[focusable.length - 1]
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
        }}>
          <section ref={dialogRef} className="setlist-picker-dialog" role="dialog" aria-modal="true" aria-labelledby={`setlist-picker-${piece.id}`}>
            <div className="setlist-picker-heading">
              <h3 id={`setlist-picker-${piece.id}`}>Add {piece.title} to setlists</h3>
              <button ref={closeRef} type="button" className="icon-btn" aria-label="Close setlist picker" disabled={saving} onClick={close}>×</button>
            </div>
            {loading ? <p>Loading setlists…</p> : error && !setlists.length ? null : setlists.length === 0
              ? <p>No active setlists. Create one on the Setlists page first.</p>
              : <fieldset disabled={saving} className="setlist-picker-list">
                <legend>Choose setlists</legend>
                {setlists.map((list) => {
                  const alreadyAdded = existing.includes(list.id)
                  return <label key={list.id}>
                    <input type="checkbox" checked={alreadyAdded || selected.includes(list.id)} disabled={alreadyAdded}
                      onChange={(event) => setSelected((current) => event.target.checked ? [...current, list.id] : current.filter((id) => id !== list.id))} />
                    <span>{list.name}{alreadyAdded && ' (already added)'}</span>
                  </label>
                })}
              </fieldset>}
            {message && <p role="status">{message}</p>}
            {error && <p role="alert" className="setlist-picker-error">{error}</p>}
            <div className="setlist-picker-actions">
              <button type="button" className="btn primary" disabled={loading || saving || !selected.length} onClick={() => void add()}>{saving ? 'Adding…' : 'Add to selected'}</button>
              <button type="button" className="btn" disabled={saving} onClick={close}>Done</button>
            </div>
          </section>
        </div>,
        document.body,
      )}
    </>
  )
}
