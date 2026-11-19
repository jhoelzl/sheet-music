import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { Library } from '../hooks/useLibrary'
import { supabase } from '../supabase'
import type { Piece } from '../supabase'

type Setlist = { id: string; name: string }
type SetlistPiece = { piece_id: string; position: number }
type LibraryData = Pick<Library, 'pieces' | 'composerNamesOf' | 'hiddenIds'>

export function SetlistsPage({ lib }: { lib: LibraryData }) {
  const [setlists, setSetlists] = useState<Setlist[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [membersBySetlist, setMembersBySetlist] = useState<Record<string, SetlistPiece[]>>({})
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const members = selectedId ? membersBySetlist[selectedId] ?? [] : []

  const updateMembers = (setlistId: string, update: (current: SetlistPiece[]) => SetlistPiece[]) =>
    setMembersBySetlist((current) => ({ ...current, [setlistId]: update(current[setlistId] ?? []) }))

  useEffect(() => {
    let active = true
    void (async () => {
      const { data, error: loadError } = await supabase.from('sm_setlists').select('id, name').order('created_at')
      if (!active) return
      if (loadError) setError(loadError.message)
      else {
        const loaded = (data ?? []) as Setlist[]
        setSetlists(loaded)
        if (loaded.length) setSelectedId((current) => current ?? loaded[0].id)
      }
      setLoading(false)
    })()
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!selectedId) return
    let active = true
    void (async () => {
      const { data, error: loadError } = await supabase.from('sm_setlist_pieces')
        .select('piece_id, position')
        .eq('setlist_id', selectedId)
        .order('position')
      if (!active) return
      if (loadError) setError(loadError.message)
      else setMembersBySetlist((current) => ({ ...current, [selectedId]: (data ?? []) as SetlistPiece[] }))
    })()
    return () => { active = false }
  }, [selectedId])

  const createSetlist = async (event: FormEvent) => {
    event.preventDefault()
    const nextName = name.trim()
    if (!nextName) return
    setError('')
    const { data, error: createError } = await supabase.from('sm_setlists').insert({ name: nextName }).select('id, name').single()
    if (createError || !data) { setError(createError?.message ?? 'Could not create setlist.'); return }
    const created = data as Setlist
    setSetlists((current) => [...current, created])
    setSelectedId(created.id)
    setName('')
  }

  const removeSetlist = async (setlist: Setlist) => {
    if (!window.confirm(`Delete "${setlist.name}" and its tune selection?`)) return
    setError('')
    const { error: deleteError } = await supabase.from('sm_setlists').delete().eq('id', setlist.id)
    if (deleteError) { setError(deleteError.message); return }
    const remaining = setlists.filter((item) => item.id !== setlist.id)
    setSetlists(remaining)
    if (selectedId === setlist.id) {
      setMembersBySetlist((current) => {
        const next = { ...current }
        delete next[setlist.id]
        return next
      })
      setSelectedId(remaining[0]?.id ?? null)
    }
  }

  const togglePiece = async (piece: Piece, selected: boolean) => {
    if (!selectedId) return
    setError('')
    if (selected) {
      const { error: addError } = await supabase.from('sm_setlist_pieces').insert({
        setlist_id: selectedId,
        piece_id: piece.id,
        position: members.reduce((max, member) => Math.max(max, member.position), -1) + 1,
      })
      if (addError) { setError(addError.message); return }
      updateMembers(selectedId, (current) => [...current, { piece_id: piece.id, position: current.reduce((max, member) => Math.max(max, member.position), -1) + 1 }])
    } else {
      const { error: removeError } = await supabase.from('sm_setlist_pieces').delete()
        .eq('setlist_id', selectedId)
        .eq('piece_id', piece.id)
      if (removeError) { setError(removeError.message); return }
      updateMembers(selectedId, (current) => current.filter((item) => item.piece_id !== piece.id))
    }
  }

  const movePiece = async (index: number, offset: -1 | 1) => {
    if (!selectedId) return
    const otherIndex = index + offset
    if (otherIndex < 0 || otherIndex >= members.length) return
    const next = [...members]
    const moved = next[index]
    next[index] = next[otherIndex]
    next[otherIndex] = moved
    next[index].position = members[index].position
    next[otherIndex].position = members[otherIndex].position
    const changed = [next[index], next[otherIndex]]
    const results = await Promise.all(changed.map((item) => supabase.from('sm_setlist_pieces')
      .update({ position: item.position })
      .eq('setlist_id', selectedId)
      .eq('piece_id', item.piece_id)))
    const moveError = results.find((result) => result.error)?.error
    if (moveError) { setError(moveError.message); return }
    updateMembers(selectedId, () => next)
  }

  const selected = setlists.find((setlist) => setlist.id === selectedId)
  const orderedPieces = members
    .map((member) => lib.pieces.find((piece) => piece.id === member.piece_id))
    .filter((piece): piece is Piece => !!piece && !lib.hiddenIds.has(piece.id))
  const availablePieces = lib.pieces.filter((piece) => !lib.hiddenIds.has(piece.id))

  return (
    <>
      <div className="library-intro">
        <div>
          <span className="library-kicker">Plan your music</span>
          <h2>Setlists</h2>
          <p>Collect and order tunes for gigs and jam sessions.</p>
        </div>
      </div>
      {error && <div className="error" role="alert">{error}</div>}
      <div className="setlist-layout">
        <aside className="setlist-sidebar" aria-label="Your setlists">
          <form className="setlist-create" onSubmit={(event) => void createSetlist(event)}>
            <label>Setlist name<input aria-label="Setlist name" placeholder="Friday jam session" value={name} onChange={(event) => setName(event.target.value)} required /></label>
            <button type="submit" className="btn primary">Create setlist</button>
          </form>
          {loading && <p className="muted">Loading setlists…</p>}
          {!loading && !setlists.length && <p className="muted">Create a setlist to start choosing tunes.</p>}
          <div className="setlist-tabs">
            {setlists.map((setlist) => (
              <button key={setlist.id} type="button" className={`setlist-tab${setlist.id === selectedId ? ' on' : ''}`}
                aria-pressed={setlist.id === selectedId} onClick={() => setSelectedId(setlist.id)}>{setlist.name}</button>
            ))}
          </div>
        </aside>
        <section className="setlist-editor" aria-label="Setlist contents">
          {!selected ? (
            <div className="empty"><h3>No setlist selected</h3><p>Create a setlist to start building your tune selection.</p></div>
          ) : (
            <>
              <div className="setlist-heading">
                <div><h3>{selected.name}</h3><p>{orderedPieces.length} {orderedPieces.length === 1 ? 'tune' : 'tunes'}</p></div>
                <button type="button" className="link danger" onClick={() => void removeSetlist(selected)}>Delete setlist</button>
              </div>
              <ol className="setlist-order" aria-label="Tune order">
                {members.map((member, index) => {
                  const piece = lib.pieces.find((item) => item.id === member.piece_id)
                  if (!piece || lib.hiddenIds.has(piece.id)) return null
                  return (
                    <li key={piece.id}>
                      <span className="setlist-number">{index + 1}</span>
                      <span className="setlist-piece-copy">
                        <strong>{piece.title}</strong>
                        {piece.subtitle && <span>{piece.subtitle}</span>}
                        <small>{lib.composerNamesOf(piece)}{piece.musical_key ? ` · ${piece.musical_key}` : ''}</small>
                      </span>
                      <div className="setlist-piece-actions">
                        <button type="button" className="icon-btn" aria-label={`Move ${piece.title} up`} disabled={index === 0} onClick={() => void movePiece(index, -1)}>↑</button>
                        <button type="button" className="icon-btn" aria-label={`Move ${piece.title} down`} disabled={index === members.length - 1} onClick={() => void movePiece(index, 1)}>↓</button>
                        <button type="button" className="link danger" aria-label={`Remove ${piece.title} from ${selected.name}`} onClick={() => void togglePiece(piece, false)}>Remove</button>
                      </div>
                    </li>
                  )
                })}
              </ol>
              <section className="setlist-available" aria-label="Choose tunes">
                <h4>Choose tunes</h4>
                {!availablePieces.length && <p className="muted">Add pieces to your library first.</p>}
                <div className="setlist-tune-list">
                  {availablePieces.map((piece) => {
                    const checked = members.some((member) => member.piece_id === piece.id)
                    return (
                      <label key={piece.id} className="setlist-tune-choice">
                        <input type="checkbox" checked={checked} disabled={!selectedId}
                          aria-label={`${checked ? 'Remove' : 'Add'} ${piece.title} ${checked ? 'from' : 'to'} ${selected.name}`}
                          onChange={(event) => void togglePiece(piece, event.target.checked)} />
                        <span><strong>{piece.title}</strong>{piece.subtitle && ` · ${piece.subtitle}`}
                          <small>{lib.composerNamesOf(piece)}{piece.musical_key ? ` · ${piece.musical_key}` : ''}</small>
                        </span>
                      </label>
                    )
                  })}
                </div>
              </section>
            </>
          )}
        </section>
      </div>
    </>
  )
}
