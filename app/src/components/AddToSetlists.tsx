import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase'
import type { Piece } from '../supabase'
import { SearchPicker } from './SearchPicker'

type Setlist = { id: string; name: string }

function errorMessage(reason: unknown, fallback: string): string {
  return typeof reason === 'object' && reason !== null && 'message' in reason && typeof reason.message === 'string'
    ? reason.message : fallback
}

export function AddToSetlists({ piece }: { piece: Piece }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [setlists, setSetlists] = useState<Setlist[]>([])
  const [existing, setExisting] = useState<string[]>([])
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const busyRef = useRef(false)

  useEffect(() => {
    if (!open) return
    let active = true
    setLoading(true)
    setError('')
    setMessage('')
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
        const activeLists = lists.data ?? []
        setSetlists(activeLists)
        setExisting((entries.data ?? []).map((entry) => entry.setlist_id).filter((id) => activeLists.some((list) => list.id === id)))
      } catch (reason) {
        if (active) setError(errorMessage(reason, 'Could not load setlists.'))
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [open, piece.id])

  const add = async (ids: string[]) => {
    const id = ids.find((item) => !existing.includes(item))
    if (!id || busyRef.current) return
    busyRef.current = true
    setError('')
    setMessage('')
    try {
      const { data, error: loadError } = await supabase.from('sm_setlist_pieces')
        .select('position').eq('setlist_id', id).order('position', { ascending: false }).limit(1)
      if (loadError) throw loadError
      const position = (data?.[0]?.position ?? -1) + 1
      const { error: addError } = await supabase.from('sm_setlist_pieces')
        .insert({ setlist_id: id, piece_id: piece.id, position, placeholder: null })
      if (addError) throw addError
      setExisting((current) => [...current, id])
      setMessage(`Added to ${setlists.find((list) => list.id === id)?.name ?? 'setlist'}.`)
    } catch (reason) {
      const name = setlists.find((list) => list.id === id)?.name ?? 'setlist'
      setError(`Could not add to ${name}: ${errorMessage(reason, 'Unknown error')}`)
    } finally {
      busyRef.current = false
    }
  }

  return (
    <div className="piece-setlists">
      <button type="button" className="btn setlist-add-trigger" aria-expanded={open} aria-label={`Add ${piece.title} to setlists`}
        onClick={() => { if (!busyRef.current) setOpen((current) => !current) }}>+ Setlist</button>
      {open && <div className="piece-setlists-picker">
        {loading ? <span>Loading setlists…</span> : error && !setlists.length ? null : setlists.length === 0
          ? <span>No active setlists. Create one on the Setlists page first.</span>
          : <>
            <SearchPicker items={setlists} selectedIds={existing} label={`Setlists for ${piece.title}`}
              singular="setlist" plural="setlists" allowRemove={false} onChange={add} />
            {existing.length > 0 && <span>Manage existing entries on the Setlists page.</span>}
          </>}
        {error && <span role="alert" className="setlist-picker-error">{error}</span>}
        {message && <span role="status">{message}</span>}
      </div>}
    </div>
  )
}
