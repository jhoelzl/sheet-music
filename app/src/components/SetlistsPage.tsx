import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { Library } from '../hooks/useLibrary'
import { supabase } from '../supabase'

type Setlist = { id: string; name: string; position: number }
type SetlistEntry = { id: string; piece_id: string | null; position: number; placeholder: string | null; comment: string | null }
type LibraryData = Pick<Library, 'pieces' | 'composerNamesOf' | 'hiddenIds'>

export function SetlistsPage({ lib }: { lib: LibraryData }) {
  const [setlists, setSetlists] = useState<Setlist[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [membersBySetlist, setMembersBySetlist] = useState<Record<string, SetlistEntry[]>>({})
  const [name, setName] = useState('')
  const [rename, setRename] = useState<string | null>(null)
  const [placeholder, setPlaceholder] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [membersLoading, setMembersLoading] = useState(false)
  const [loadedId, setLoadedId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const members = selectedId ? membersBySetlist[selectedId] ?? [] : []

  const updateMembers = (setlistId: string, update: (current: SetlistEntry[]) => SetlistEntry[]) =>
    setMembersBySetlist((current) => ({ ...current, [setlistId]: update(current[setlistId] ?? []) }))

  useEffect(() => {
    let active = true
    void (async () => {
      const { data, error: loadError } = await supabase.from('sm_setlists').select('id, name, position').order('position').order('created_at')
      if (!active) return
      if (loadError) setError(loadError.message)
      else {
        const loaded = (data ?? []) as Setlist[]
        setSetlists(loaded)
        if (loaded.length) {
          setMembersLoading(true)
          setSelectedId((current) => current ?? loaded[0].id)
        }
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
        .select('id, piece_id, position, placeholder, comment')
        .eq('setlist_id', selectedId).order('position').order('id')
      if (!active) return
      if (loadError) setError(loadError.message)
      else {
        setMembersBySetlist((current) => ({ ...current, [selectedId]: (data ?? []) as SetlistEntry[] }))
        setLoadedId(selectedId)
      }
      setMembersLoading(false)
    })()
    return () => { active = false }
  }, [selectedId])

  const perform = async (action: () => Promise<void>) => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setError('')
    try { await action() } finally { busyRef.current = false; setBusy(false) }
  }

  const createSetlist = (event: FormEvent) => {
    event.preventDefault()
    const nextName = name.trim()
    if (!nextName) return
    void perform(async () => {
      const position = setlists.reduce((max, item) => Math.max(max, item.position), -1) + 1
      const { data, error: createError } = await supabase.from('sm_setlists').insert({ name: nextName, position }).select('id, name, position').single()
      if (createError || !data) { setError(createError?.message ?? 'Could not create setlist.'); return }
      const created = data as Setlist
      setSetlists((current) => [...current, created])
      setLoadedId(null)
      setMembersLoading(true)
      setSelectedId(created.id)
      setName('')
      setRename(null)
    })
  }

  const renameSetlist = (event: FormEvent) => {
    event.preventDefault()
    const nextName = rename?.trim()
    if (!selectedId || !nextName) return
    void perform(async () => {
      const { error: saveError } = await supabase.from('sm_setlists').update({ name: nextName }).eq('id', selectedId)
      if (saveError) { setError(saveError.message); return }
      setSetlists((current) => current.map((item) => item.id === selectedId ? { ...item, name: nextName } : item))
      setRename(null)
    })
  }

  const removeSetlist = (setlist: Setlist) => {
    if (!window.confirm(`Delete "${setlist.name}" and its tune selection?`)) return
    void perform(async () => {
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
        setLoadedId(null)
        setMembersLoading(remaining.length > 0)
        setSelectedId(remaining[0]?.id ?? null)
        setRename(null)
      }
    })
  }

  const moveSetlist = (index: number, offset: -1 | 1) => {
    const other = index + offset
    if (other < 0 || other >= setlists.length) return
    void perform(async () => {
      const first = setlists[index]
      const second = setlists[other]
      const { error: moveError } = await supabase.rpc('sm_swap_setlists', { first_id: first.id, second_id: second.id })
      if (moveError) { setError(moveError.message); return }
      setSetlists((current) => current.map((item) => item.id === first.id ? { ...item, position: second.position }
        : item.id === second.id ? { ...item, position: first.position } : item).sort((a, b) => a.position - b.position))
    })
  }

  const addEntry = (pieceId: string | null, text: string | null) => {
    if (!selectedId || membersLoading || loadedId !== selectedId) return
    void perform(async () => {
      const position = members.reduce((max, member) => Math.max(max, member.position), -1) + 1
      const { data, error: addError } = await supabase.from('sm_setlist_pieces')
        .insert({ setlist_id: selectedId, piece_id: pieceId, position, placeholder: text })
        .select('id, piece_id, position, placeholder, comment').single()
      if (addError || !data) { setError(addError?.message ?? 'Could not add setlist entry.'); return }
      updateMembers(selectedId, (current) => [...current, data as SetlistEntry])
      if (text !== null) setPlaceholder('')
    })
  }

  const removeEntry = (entry: SetlistEntry) => {
    if (!selectedId) return
    void perform(async () => {
      const { error: removeError } = await supabase.from('sm_setlist_pieces').delete().eq('setlist_id', selectedId).eq('id', entry.id)
      if (removeError) { setError(removeError.message); return }
      updateMembers(selectedId, (current) => current.filter((item) => item.id !== entry.id))
    })
  }

  const moveEntry = (index: number, offset: -1 | 1) => {
    if (!selectedId) return
    const other = index + offset
    if (other < 0 || other >= members.length) return
    void perform(async () => {
      const first = members[index]
      const second = members[other]
      const { error: moveError } = await supabase.rpc('sm_swap_setlist_entries', { list_id: selectedId, first_id: first.id, second_id: second.id })
      if (moveError) { setError(moveError.message); return }
      updateMembers(selectedId, (current) => current.map((item) => item.id === first.id ? { ...item, position: second.position }
        : item.id === second.id ? { ...item, position: first.position } : item).sort((a, b) => a.position - b.position))
    })
  }

  const saveComment = (entry: SetlistEntry, input: HTMLInputElement) => {
    if (!selectedId) return
    const comment = input.value.trim() || null
    if (comment === entry.comment) return
    if (busyRef.current) { input.value = entry.comment ?? ''; setError('Wait for the current change before editing a comment.'); return }
    void perform(async () => {
      const { error: saveError } = await supabase.from('sm_setlist_pieces').update({ comment }).eq('setlist_id', selectedId).eq('id', entry.id)
      if (saveError) { input.value = entry.comment ?? ''; setError(saveError.message); return }
      updateMembers(selectedId, (current) => current.map((item) => item.id === entry.id ? { ...item, comment } : item))
    })
  }

  const selected = setlists.find((setlist) => setlist.id === selectedId)
  const entriesDisabled = busy || membersLoading || loadedId !== selectedId
  const tuneCount = members.filter((member) => member.piece_id && lib.pieces.some((piece) => piece.id === member.piece_id && !lib.hiddenIds.has(piece.id))).length
  const availablePieces = lib.pieces.filter((piece) => !lib.hiddenIds.has(piece.id))

  return (
    <>
      <div className="library-intro"><div><span className="library-kicker">Plan your music</span><h2>Setlists</h2><p>Collect and order tunes for gigs and jam sessions.</p></div></div>
      {error && <div className="error" role="alert">{error}</div>}
      <div className="setlist-layout">
        <aside className="setlist-sidebar" aria-label="Your setlists">
          <form className="setlist-create" onSubmit={createSetlist}>
            <label>Setlist name<input aria-label="Setlist name" placeholder="Friday jam session" value={name} onChange={(event) => setName(event.target.value)} required /></label>
            <button type="submit" className="btn primary" disabled={busy || loading}>Create setlist</button>
          </form>
          {loading && <p className="muted">Loading setlists…</p>}
          {!loading && !setlists.length && <p className="muted">Create a setlist to start choosing tunes.</p>}
          <div className="setlist-tabs">
            {setlists.map((setlist, index) => (
              <div className="setlist-tab-row" key={setlist.id}>
                <button type="button" className={`setlist-tab${setlist.id === selectedId ? ' on' : ''}`}
                  aria-pressed={setlist.id === selectedId} disabled={busy}
                  onClick={() => {
                    if (setlist.id !== selectedId) { setLoadedId(null); setMembersLoading(true); setSelectedId(setlist.id) }
                    setRename(null); setPlaceholder('')
                  }}>{setlist.name}</button>
                <button type="button" className="icon-btn" aria-label={`Move setlist ${setlist.name} up`} disabled={busy || index === 0} onClick={() => moveSetlist(index, -1)}>↑</button>
                <button type="button" className="icon-btn" aria-label={`Move setlist ${setlist.name} down`} disabled={busy || index === setlists.length - 1} onClick={() => moveSetlist(index, 1)}>↓</button>
              </div>
            ))}
          </div>
        </aside>
        <section className="setlist-editor" aria-label="Setlist contents">
          {!selected ? (
            <div className="empty"><h3>No setlist selected</h3><p>Create a setlist to start building your tune selection.</p></div>
          ) : (
            <>
              <div className="setlist-heading">
                <div>
                  {rename === null ? <h3>{selected.name}</h3> : (
                    <form className="setlist-rename" onSubmit={renameSetlist}>
                      <input aria-label="Edit setlist name" value={rename} onChange={(event) => setRename(event.target.value)} required autoFocus />
                      <button type="submit" className="btn" disabled={busy || !rename.trim()}>Save</button>
                      <button type="button" className="link" disabled={busy} onClick={() => setRename(null)}>Cancel</button>
                    </form>
                  )}
                  <p>{tuneCount} {tuneCount === 1 ? 'tune' : 'tunes'}</p>
                </div>
                <div className="setlist-heading-actions">
                  {rename === null && <button type="button" className="link" disabled={busy} onClick={() => setRename(selected.name)}>Rename</button>}
                  <button type="button" className="link danger" disabled={busy} onClick={() => removeSetlist(selected)}>Delete setlist</button>
                </div>
              </div>
              {membersLoading && <p className="muted">Loading entries…</p>}
              <ol className="setlist-order" aria-label="Tune order">
                {members.map((entry, index) => {
                  const piece = entry.piece_id ? lib.pieces.find((item) => item.id === entry.piece_id) : null
                  if (entry.piece_id && (!piece || lib.hiddenIds.has(entry.piece_id))) return null
                  const title = piece?.title ?? entry.placeholder ?? ''
                  return (
                    <li key={entry.id}>
                      <span className="setlist-number">{index + 1}</span>
                      <span className="setlist-piece-copy">
                        <strong>{title}</strong>
                        {piece ? <>
                          {piece.subtitle && <span>{piece.subtitle}</span>}
                          <small>{lib.composerNamesOf(piece)}{piece.musical_key ? ` · ${piece.musical_key}` : ''}</small>
                          <input className="setlist-comment" aria-label={`Comment for ${title}`} placeholder="Add a comment (e.g. soloist)" defaultValue={entry.comment ?? ''}
                            disabled={entriesDisabled} onBlur={(event) => saveComment(entry, event.currentTarget)}
                            onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { event.currentTarget.value = entry.comment ?? ''; event.currentTarget.blur() } }} />
                        </> : <small>Placeholder</small>}
                      </span>
                      <div className="setlist-piece-actions">
                        <button type="button" className="icon-btn" aria-label={`Move ${title} up`} disabled={entriesDisabled || index === 0} onClick={() => moveEntry(index, -1)}>↑</button>
                        <button type="button" className="icon-btn" aria-label={`Move ${title} down`} disabled={entriesDisabled || index === members.length - 1} onClick={() => moveEntry(index, 1)}>↓</button>
                        <button type="button" className="link danger" aria-label={`Remove ${title} from ${selected.name}`} disabled={entriesDisabled} onClick={() => removeEntry(entry)}>Remove</button>
                      </div>
                    </li>
                  )
                })}
              </ol>
              <form className="setlist-placeholder" onSubmit={(event) => { event.preventDefault(); const text = placeholder.trim(); if (text) addEntry(null, text) }}>
                <label>Placeholder<input aria-label="Placeholder" placeholder="e.g. Break or announcement" value={placeholder} onChange={(event) => setPlaceholder(event.target.value)} /></label>
                <button type="submit" className="btn" disabled={entriesDisabled || !placeholder.trim()}>Add placeholder</button>
              </form>
              <section className="setlist-available" aria-label="Choose tunes">
                <h4>Choose tunes</h4>
                {!availablePieces.length && <p className="muted">Add pieces to your library first.</p>}
                <div className="setlist-tune-list">
                  {availablePieces.map((piece) => {
                    const entry = members.find((item) => item.piece_id === piece.id)
                    return (
                      <label key={piece.id} className="setlist-tune-choice">
                        <input type="checkbox" checked={!!entry} disabled={entriesDisabled}
                          aria-label={`${entry ? 'Remove' : 'Add'} ${piece.title} ${entry ? 'from' : 'to'} ${selected.name}`}
                          onChange={() => entry ? removeEntry(entry) : addEntry(piece.id, null)} />
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
