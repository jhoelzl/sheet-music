import { useEffect, useRef, useState } from 'react'
import type { FormEvent, PointerEvent as ReactPointerEvent } from 'react'
import type { Library } from '../hooks/useLibrary'
import { scoresOf } from '../hooks/useLibrary'
import { supabase } from '../supabase'
import { dropIndex, moveItem } from '../lib/reorder'
import { confirmDelete } from '../lib/confirmDelete'
import { todayISO } from '../lib/dates'
import { scoreLabel } from '../lib/scores'
import { SetlistComment } from './SetlistComment'
import { SetlistPlayer } from './SetlistPlayer'
import type { PlayerEntry } from './SetlistPlayer'
import { SetlistTuneDetails } from './SetlistTuneDetails'
import { SetlistTunePicker } from './SetlistTunePicker'
import { DeleteButton } from './DeleteButton'
import { ActivityCalendar } from './ActivityCalendar'
import { ArchiveIcon, GripIcon, InfoIcon, PauseIcon, PdfIcon, PlayIcon } from './icons'

type Setlist = { id: string; name: string; position: number; archived_at: string | null; event_date: string | null; event_time: string | null }
type SetlistEntry = { id: string; piece_id: string | null; position: number; placeholder: string | null; comment: string | null; score_id: string | null }
type LibraryData = Pick<Library, 'pieces' | 'composerNamesOf' | 'hiddenIds' | 'openPdf' | 'pdfUrl' | 'recordPdfPages'>
type DragState = { pointerId: number; fromRow: number; startY: number; startScrollY: number; tops: number[]; heights: number[]; shift: number }

export function SetlistsPage({ lib }: { lib: LibraryData }) {
  const [setlists, setSetlists] = useState<Setlist[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [membersBySetlist, setMembersBySetlist] = useState<Record<string, SetlistEntry[]>>({})
  const [name, setName] = useState('')
  const [newDate, setNewDate] = useState('')
  const [newTime, setNewTime] = useState('')
  const [schedule, setSchedule] = useState<{ date: string; time: string } | null>(null)
  const [showActivity, setShowActivity] = useState(false)
  const [rename, setRename] = useState<string | null>(null)
  const [placeholder, setPlaceholder] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [membersLoading, setMembersLoading] = useState(false)
  const [loadedId, setLoadedId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [openDetails, setOpenDetails] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const busyRef = useRef(false)
  const listRef = useRef<HTMLOListElement | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const dragPointer = useRef<number | null>(null)
  const dragRaf = useRef<number | null>(null)
  const [drag, setDrag] = useState<{ fromRow: number; toRow: number; offsetY: number; shift: number } | null>(null)
  const members = selectedId ? membersBySetlist[selectedId] ?? [] : []
  // Rows actually shown: hidden pieces (mid-delete) and stale ids are skipped, but we keep the
  // original index so drag reordering still maps back onto the full member list.
  const visibleRows = members
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => {
      if (!entry.piece_id) return true
      return lib.pieces.some((piece) => piece.id === entry.piece_id) && !lib.hiddenIds.has(entry.piece_id)
    })

  const updateMembers = (setlistId: string, update: (current: SetlistEntry[]) => SetlistEntry[]) =>
    setMembersBySetlist((current) => ({ ...current, [setlistId]: update(current[setlistId] ?? []) }))

  useEffect(() => {
    let active = true
    void (async () => {
      const { data, error: loadError } = await supabase.from('sm_setlists').select('id, name, position, archived_at, event_date, event_time').order('position').order('created_at')
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
        .select('id, piece_id, position, placeholder, comment, score_id')
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

  useEffect(() => () => { if (dragRaf.current !== null) cancelAnimationFrame(dragRaf.current) }, [])

  const perform = async (action: () => Promise<void>) => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setError('')
    try { await action() } finally { busyRef.current = false; setBusy(false) }
  }

  const selectSetlist = (setlist: Setlist) => {
    setRename(null)
    setSchedule(null)
    setPlaceholder('')
    setOpenDetails(null)
    if (setlist.id === selectedId) return
    setLoadedId(null)
    setMembersLoading(true)
    setSelectedId(setlist.id)
  }

  const createSetlist = (event: FormEvent) => {
    event.preventDefault()
    const nextName = name.trim()
    if (!nextName) return
    void perform(async () => {
      const position = setlists.reduce((max, item) => Math.max(max, item.position), -1) + 1
      const { data, error: createError } = await supabase.from('sm_setlists')
        .insert({ name: nextName, position, event_date: newDate || null, event_time: newTime || null })
        .select('id, name, position, archived_at, event_date, event_time').single()
      if (createError || !data) { setError(createError?.message ?? 'Could not create setlist.'); return }
      const created = data as Setlist
      setSetlists((current) => [...current, created])
      setLoadedId(null)
      setMembersLoading(true)
      setSelectedId(created.id)
      setName('')
      setNewDate('')
      setNewTime('')
      setRename(null)
      setSchedule(null)
      setOpenDetails(null)
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

  const saveSchedule = (event: FormEvent) => {
    event.preventDefault()
    if (!selectedId || !schedule) return
    const values = { event_date: schedule.date || null, event_time: schedule.time || null }
    void perform(async () => {
      const { error: saveError } = await supabase.from('sm_setlists').update(values).eq('id', selectedId)
      if (saveError) { setError(saveError.message); return }
      setSetlists((current) => current.map((item) => item.id === selectedId ? { ...item, ...values } : item))
      setSchedule(null)
    })
  }

  /** "Name (copy)", then "Name (copy 2)" and so on while the name is taken. */
  const copyNameOf = (base: string) => {
    const taken = new Set(setlists.map((item) => item.name.trim().toLowerCase()))
    if (!taken.has(`${base} (copy)`.toLowerCase())) return `${base} (copy)`
    let counter = 2
    while (taken.has(`${base} (copy ${counter})`.toLowerCase())) counter++
    return `${base} (copy ${counter})`
  }

  const duplicateSetlist = (setlist: Setlist) => {
    void perform(async () => {
      const copy = copyNameOf(setlist.name)
      const { data, error: duplicateError } = await supabase.rpc('sm_duplicate_setlist', { source_id: setlist.id, new_name: copy })
      if (duplicateError || !data) { setError(duplicateError?.message ?? 'Could not duplicate the setlist.'); return }
      const position = setlists.reduce((max, item) => Math.max(max, item.position), -1) + 1
      const created: Setlist = { id: data as string, name: copy, position, archived_at: null, event_date: null, event_time: null }
      setSetlists((current) => [...current, created])
      setLoadedId(null)
      setMembersLoading(true)
      setSelectedId(created.id)
      setRename(null)
      setSchedule(null)
      setOpenDetails(null)
    })
  }

  const setArchived = (setlist: Setlist, archived: boolean) => {
    void perform(async () => {
      const archived_at = archived ? new Date().toISOString() : null
      const { error: saveError } = await supabase.from('sm_setlists').update({ archived_at }).eq('id', setlist.id)
      if (saveError) { setError(saveError.message); return }
      setSetlists((current) => current.map((item) => item.id === setlist.id ? { ...item, archived_at } : item))
      setOpenDetails(null)
      setRename(null)
      setSchedule(null)
      if (archived) setShowArchived(true)
    })
  }

  const removeSetlist = (setlist: Setlist) => {
    if (!confirmDelete(`setlist "${setlist.name}"`, 'Its entries and comments will also be deleted. The tunes and their scores will be kept.')) return
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
        setSchedule(null)
        setOpenDetails(null)
      }
    })
  }

  const moveSetlist = (index: number, offset: -1 | 1) => {
    const other = index + offset
    if (other < 0 || other >= activeSetlists.length) return
    void perform(async () => {
      const first = activeSetlists[index]
      const second = activeSetlists[other]
      const { error: moveError } = await supabase.rpc('sm_swap_setlists', { first_id: first.id, second_id: second.id })
      if (moveError) { setError(moveError.message); return }
      setSetlists((current) => current.map((item) => item.id === first.id ? { ...item, position: second.position }
        : item.id === second.id ? { ...item, position: first.position } : item).sort((a, b) => a.position - b.position))
    })
  }

  const addEntry = (pieceId: string | null, text: string | null) => {
    if (!selectedId || entriesDisabled) return
    void perform(async () => {
      const position = members.reduce((max, member) => Math.max(max, member.position), -1) + 1
      const { data, error: addError } = await supabase.from('sm_setlist_pieces')
        .insert({ setlist_id: selectedId, piece_id: pieceId, position, placeholder: text })
        .select('id, piece_id, position, placeholder, comment, score_id').single()
      if (addError || !data) { setError(addError?.message ?? 'Could not add setlist entry.'); return }
      updateMembers(selectedId, (current) => [...current, data as SetlistEntry])
      if (text !== null) setPlaceholder('')
    })
  }

  const removeEntry = (entry: SetlistEntry) => {
    if (!selectedId) return
    const title = lib.pieces.find((piece) => piece.id === entry.piece_id)?.title ?? entry.placeholder ?? 'this entry'
    if (!confirmDelete(`"${title}" from the setlist`, entry.piece_id
      ? 'Its setlist comment will also be deleted. The tune and its scores will be kept.'
      : 'Its setlist comment will also be deleted.')) return
    void perform(async () => {
      const { error: removeError } = await supabase.from('sm_setlist_pieces').delete().eq('setlist_id', selectedId).eq('id', entry.id)
      if (removeError) { setError(removeError.message); return }
      updateMembers(selectedId, (current) => current.filter((item) => item.id !== entry.id))
      setOpenDetails((current) => current === entry.id ? null : current)
    })
  }

  const moveEntry = (index: number, offset: -1 | 1) => {
    if (!selectedId) return
    const row = visibleRows.findIndex((item) => item.index === index)
    const neighbor = visibleRows[row + offset]
    if (!neighbor) return
    const other = neighbor.index
    void perform(async () => {
      const first = members[index]
      const second = members[other]
      const { error: moveError } = await supabase.rpc('sm_swap_setlist_entries', { list_id: selectedId, first_id: first.id, second_id: second.id })
      if (moveError) { setError(moveError.message); return }
      updateMembers(selectedId, (current) => current.map((item) => item.id === first.id ? { ...item, position: second.position }
        : item.id === second.id ? { ...item, position: first.position } : item).sort((a, b) => a.position - b.position))
    })
  }

  // Persist a drag: move the entry in the local list straight away, then send the whole
  // ordered list to the server. Revert the optimistic change if the save fails.
  const reorderEntries = (from: number, to: number) => {
    if (!selectedId || from === to || busyRef.current) return
    const previous = members
    const next = moveItem(previous, from, to).map((entry, position) => ({ ...entry, position }))
    updateMembers(selectedId, () => next)
    void perform(async () => {
      const { error: reorderError } = await supabase.rpc('sm_reorder_setlist_entries', { list_id: selectedId, entry_ids: next.map((entry) => entry.id) })
      if (reorderError) { updateMembers(selectedId, () => previous); setError(reorderError.message) }
    })
  }

  const startDrag = (event: ReactPointerEvent<HTMLButtonElement>, row: number) => {
    if (entriesDisabled || (event.pointerType === 'mouse' && event.button !== 0)) return
    const list = listRef.current
    if (!list) return
    const rows = Array.from(list.children).filter((child): child is HTMLLIElement => child instanceof HTMLLIElement)
    if (rows.length < 2 || row >= rows.length) return
    // Keep focus where it is so a focused comment is not saved (and the drag not blocked) mid-drag.
    event.preventDefault()
    const listTop = list.getBoundingClientRect().top
    const rects = rows.map((element) => element.getBoundingClientRect())
    const tops = rects.map((rect) => rect.top - listTop)
    const heights = rects.map((rect) => rect.height)
    const gap = tops.length > 1 ? Math.max(0, tops[1] - tops[0] - heights[0]) : 0
    dragRef.current = { pointerId: event.pointerId, fromRow: row, startY: event.clientY, startScrollY: window.scrollY, tops, heights, shift: heights[row] + gap }
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setDrag({ fromRow: row, toRow: row, offsetY: 0, shift: heights[row] + gap })
  }

  // Keep the dragged row under the finger, then work out which slot it covers.
  const dragOffsetY = (state: DragState, clientY: number) =>
    clientY - state.startY + (window.scrollY - state.startScrollY)

  const dragRowAt = (state: DragState, clientY: number) => {
    const center = state.tops[state.fromRow] + state.heights[state.fromRow] / 2 + dragOffsetY(state, clientY)
    return dropIndex(state.fromRow, state.tops, state.heights, center)
  }

  const applyDrag = () => {
    const state = dragRef.current
    const clientY = dragPointer.current
    if (!state || clientY === null) return
    setDrag({ fromRow: state.fromRow, toRow: dragRowAt(state, clientY), offsetY: dragOffsetY(state, clientY), shift: state.shift })
  }

  // Auto-scroll the page when the finger nears an edge so long setlists stay reachable.
  const autoScroll = () => {
    dragRaf.current = null
    const clientY = dragPointer.current
    if (clientY === null) return
    const margin = 90
    const max = 18
    let speed = 0
    if (clientY < margin) speed = -Math.ceil(((margin - clientY) / margin) * max)
    else if (clientY > window.innerHeight - margin) speed = Math.ceil(((clientY - (window.innerHeight - margin)) / margin) * max)
    if (!speed) return
    const before = window.scrollY
    window.scrollBy(0, speed)
    if (window.scrollY === before) return
    applyDrag()
    dragRaf.current = requestAnimationFrame(autoScroll)
  }

  const moveDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const state = dragRef.current
    if (!state || event.pointerId !== state.pointerId) return
    dragPointer.current = event.clientY
    applyDrag()
    if (dragRaf.current === null) dragRaf.current = requestAnimationFrame(autoScroll)
  }

  const stopDrag = () => {
    if (dragRaf.current !== null) { cancelAnimationFrame(dragRaf.current); dragRaf.current = null }
    dragPointer.current = null
  }

  const endDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const state = dragRef.current
    if (!state || event.pointerId !== state.pointerId) return
    dragRef.current = null
    setDrag(null)
    stopDrag()
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    const from = visibleRows[state.fromRow]?.index
    const to = visibleRows[dragRowAt(state, event.clientY)]?.index
    if (from !== undefined && to !== undefined) reorderEntries(from, to)
  }

  const cancelDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const state = dragRef.current
    if (!state || event.pointerId !== state.pointerId) return
    dragRef.current = null
    setDrag(null)
    stopDrag()
  }

  const saveComment = (entry: SetlistEntry, comment: string | null) => {
    if (!selectedId) return
    if (comment === entry.comment) return
    if (busyRef.current) { setError('Wait for the current change before editing a comment.'); return }
    void perform(async () => {
      const { error: saveError } = await supabase.from('sm_setlist_pieces').update({ comment }).eq('setlist_id', selectedId).eq('id', entry.id)
      if (saveError) { setError(saveError.message); return }
      updateMembers(selectedId, (current) => current.map((item) => item.id === entry.id ? { ...item, comment } : item))
    })
  }

  /** Choose which of a tune's scores this setlist entry plays. */
  const saveEntryScore = (entry: SetlistEntry, score_id: string | null) => {
    if (!selectedId) return
    if (score_id === entry.score_id) return
    if (busyRef.current) { setError('Wait for the current change before choosing a score.'); return }
    void perform(async () => {
      const { error: saveError } = await supabase.from('sm_setlist_pieces').update({ score_id }).eq('setlist_id', selectedId).eq('id', entry.id)
      if (saveError) { setError(saveError.message); return }
      updateMembers(selectedId, (current) => current.map((item) => item.id === entry.id ? { ...item, score_id } : item))
    })
  }

  const selected = setlists.find((setlist) => setlist.id === selectedId)
  const activeSetlists = setlists.filter((setlist) => !setlist.archived_at)
  const archivedSetlists = setlists.filter((setlist) => setlist.archived_at)
  const isArchived = Boolean(selected?.archived_at)
  const entriesReady = !busy && !membersLoading && loadedId === selectedId
  // Archived setlists stay readable — you can browse the tunes and play them — but not editable.
  const entriesDisabled = !entriesReady || isArchived
  const tuneCount = members.filter((member) => member.piece_id && lib.pieces.some((piece) => piece.id === member.piece_id && !lib.hiddenIds.has(piece.id))).length
  const availablePieces = lib.pieces.filter((piece) => !lib.hiddenIds.has(piece.id))
  // Placeholders are not tunes, so they do not take a number in the running tune count.
  let tuneNumber = 0
  const orderedRows = visibleRows.map(({ entry, index }) => {
    const piece = entry.piece_id ? lib.pieces.find((item) => item.id === entry.piece_id) ?? null : null
    return { entry, index, piece, number: piece ? ++tuneNumber : null }
  })
  const playerEntries: PlayerEntry[] = orderedRows.map(({ entry, piece }) => ({
    id: entry.id,
    title: piece?.title ?? entry.placeholder ?? '',
    subtitle: piece?.subtitle ?? null,
    composers: piece ? lib.composerNamesOf(piece) : '',
    comment: entry.comment,
    piece,
    scoreId: entry.score_id,
  }))
  const chosenPieceIds = orderedRows.flatMap(({ piece }) => piece ? [piece.id] : [])
  const datedSetlists = setlists.filter((setlist) => setlist.event_date)
  const todayCount = datedSetlists.filter((setlist) => setlist.event_date === todayISO()).length

  const setlistRow = (setlist: Setlist, index: number, moveable: boolean) => (
    <div className="setlist-tab-row" key={setlist.id}>
      <button type="button" className={`setlist-tab${setlist.id === selectedId ? ' on' : ''}`}
        aria-pressed={setlist.id === selectedId} disabled={busy}
        onClick={() => selectSetlist(setlist)}>{setlist.name}</button>
      {moveable ? <>
        <button type="button" className="icon-btn" aria-label={`Move setlist ${setlist.name} up`} disabled={busy || index === 0} onClick={() => moveSetlist(index, -1)}>↑</button>
        <button type="button" className="icon-btn" aria-label={`Move setlist ${setlist.name} down`} disabled={busy || index === activeSetlists.length - 1} onClick={() => moveSetlist(index, 1)}>↓</button>
      </> : (
        <button type="button" className="icon-btn" aria-label={`Restore setlist ${setlist.name}`} title="Restore this setlist" disabled={busy} onClick={() => setArchived(setlist, false)}>{ArchiveIcon}</button>
      )}
    </div>
  )

  return (
    <>
      <div className="library-intro"><div><span className="library-kicker">Plan your music</span><h2>Setlists</h2><p>Collect and order tunes for gigs and jam sessions.</p></div></div>
      {error && <div className="error" role="alert">{error}</div>}
      {!loading && <section className="practice-summary" aria-label="Setlist activity">
        <button type="button" className="practice-summary-toggle" aria-expanded={showActivity} aria-controls="setlist-activity" onClick={() => setShowActivity(!showActivity)}>
          <span className="practice-summary-icon" aria-hidden="true">✦</span>
          <span className="practice-summary-copy"><strong>Your setlists</strong><span>{todayCount} {todayCount === 1 ? 'setlist' : 'setlists'} today</span></span>
          <span className="practice-summary-action">{showActivity ? 'Hide activity' : 'View activity'} <span aria-hidden="true">{showActivity ? '↑' : '↓'}</span></span>
        </button>
        {showActivity && <div id="setlist-activity">
          <ActivityCalendar kind="setlist" entries={datedSetlists.flatMap((setlist) => setlist.event_date ? [{ id: setlist.id, date: setlist.event_date, title: setlist.name, subtitle: setlist.event_time?.slice(0, 5) }] : [])}
            selectionDisabled={busy} onSelectEntry={(id) => {
              const setlist = setlists.find((item) => item.id === id)
              if (setlist) { if (setlist.archived_at) setShowArchived(true); selectSetlist(setlist) }
            }} />
        </div>}
      </section>}
      <div className="setlist-layout">
        <aside className="setlist-sidebar" aria-label="Your setlists">
          <form className="setlist-create" onSubmit={createSetlist}>
            <label>Setlist name<input aria-label="Setlist name" placeholder="Friday jam session" value={name} onChange={(event) => setName(event.target.value)} required /></label>
            <label>Date (optional)<input type="date" aria-label="New setlist date" value={newDate} disabled={busy} onChange={(event) => { setNewDate(event.target.value); if (!event.target.value) setNewTime('') }} /></label>
            <label>Time (optional)<input type="time" aria-label="New setlist time" value={newTime} disabled={busy || !newDate} onChange={(event) => setNewTime(event.target.value)} /></label>
            <button type="submit" className="btn primary" disabled={busy || loading}>Create setlist</button>
          </form>
          {loading && <p className="muted">Loading setlists…</p>}
          {!loading && !setlists.length && <p className="muted">Create a setlist to start choosing tunes.</p>}
          <div className="setlist-tabs">
            {activeSetlists.map((setlist, index) => setlistRow(setlist, index, true))}
            {!loading && !activeSetlists.length && archivedSetlists.length > 0 && <p className="muted">No active setlists.</p>}
          </div>
          {archivedSetlists.length > 0 && (
            <div className="setlist-archived-group">
              <button type="button" className="link setlist-archived-toggle" aria-expanded={showArchived} disabled={busy}
                onClick={() => setShowArchived((current) => !current)}>{ArchiveIcon} Archived ({archivedSetlists.length})</button>
              {showArchived && <div className="setlist-tabs">{archivedSetlists.map((setlist, index) => setlistRow(setlist, index, false))}</div>}
            </div>
          )}
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
                  <p>{tuneCount} {tuneCount === 1 ? 'tune' : 'tunes'}{isArchived && <span className="setlist-badge">Archived</span>}</p>
                </div>
                <div className="setlist-heading-actions">
                  <button type="button" className="btn primary" disabled={!entriesReady || !orderedRows.length} onClick={() => setPlaying(true)}>{PlayIcon} Play</button>
                  {rename === null && !isArchived && <button type="button" className="link" disabled={busy} onClick={() => setRename(selected.name)}>Rename</button>}
                  <button type="button" className="link" disabled={busy} onClick={() => duplicateSetlist(selected)}>Duplicate</button>
                  {isArchived
                    ? <button type="button" className="link" disabled={busy} onClick={() => setArchived(selected, false)}>Restore</button>
                    : <button type="button" className="link" disabled={busy} onClick={() => setArchived(selected, true)}>Archive</button>}
                  <DeleteButton label="Delete setlist" disabled={busy} onClick={() => removeSetlist(selected)} />
                </div>
              </div>
              {schedule ? <form className="setlist-schedule" onSubmit={saveSchedule}>
                <label>Date (optional)<input type="date" aria-label="Setlist date" value={schedule.date} disabled={busy} onChange={(event) => setSchedule({ date: event.target.value, time: event.target.value ? schedule.time : '' })} /></label>
                <label>Time (optional)<input type="time" aria-label="Setlist time" value={schedule.time} disabled={busy || !schedule.date} onChange={(event) => setSchedule({ ...schedule, time: event.target.value })} /></label>
                <button type="submit" className="btn" disabled={busy}>Save date</button>
                <button type="button" className="link" disabled={busy} onClick={() => setSchedule(null)}>Cancel</button>
              </form> : <div className="setlist-schedule">
                <span className="muted">{selected.event_date
                  ? `${new Date(`${selected.event_date}T00:00:00`).toLocaleDateString()}${selected.event_time ? ` · ${selected.event_time.slice(0, 5)}` : ''}`
                  : 'No date scheduled'}</span>
                {!isArchived && <button type="button" className="link" disabled={busy} onClick={() => setSchedule({ date: selected.event_date ?? '', time: selected.event_time?.slice(0, 5) ?? '' })}>{selected.event_date ? 'Edit date' : 'Add date'}</button>}
              </div>}
              {isArchived && <p className="setlist-archived-note" role="status">Archived setlists are read-only. Restore this one to change its tunes.</p>}
              {membersLoading && <p className="muted">Loading entries…</p>}
              <ol className="setlist-order" aria-label="Tune order" ref={listRef}>
                {orderedRows.map(({ entry, index, piece, number }, row) => {
                  const title = piece?.title ?? entry.placeholder ?? ''
                  const dragging = drag?.fromRow === row
                  const transform = !drag ? undefined
                    : dragging ? `translateY(${drag.offsetY}px)`
                      : drag.fromRow < drag.toRow && row > drag.fromRow && row <= drag.toRow ? `translateY(${-drag.shift}px)`
                        : drag.fromRow > drag.toRow && row >= drag.toRow && row < drag.fromRow ? `translateY(${drag.shift}px)`
                          : undefined
                  const classes = [dragging ? 'dragging' : '', piece ? '' : 'placeholder'].filter(Boolean).join(' ')
                  const showingDetails = Boolean(piece) && openDetails === entry.id
                  const scoreOptions = piece ? scoresOf(piece) : []
                  const chosenScore = scoreOptions.find((score) => score.id === entry.score_id) ?? scoreOptions[0] ?? null
                  return (
                    <li key={entry.id} className={classes || undefined} style={transform ? { transform } : undefined}>
                      <button type="button" className="setlist-drag-handle" aria-label={`Reorder ${title}`} disabled={isArchived || membersLoading || loadedId !== selectedId || visibleRows.length < 2}
                        aria-disabled={entriesDisabled || undefined}
                        aria-keyshortcuts="ArrowUp ArrowDown" title="Drag or use arrow keys to reorder"
                        onKeyDown={(event) => {
                          if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                            event.preventDefault()
                            if (!entriesDisabled) moveEntry(index, event.key === 'ArrowUp' ? -1 : 1)
                          }
                        }} onPointerDown={(event) => startDrag(event, row)}
                        onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={cancelDrag}>
                        {GripIcon}
                      </button>
                      {piece ? <span className="setlist-number">{number}</span> : <span className="setlist-marker" aria-hidden="true">{PauseIcon}</span>}
                      <span className="setlist-piece-copy">
                        <strong>{title}</strong>
                        {piece ? <>
                          {piece.subtitle && <span>{piece.subtitle}</span>}
                          <small>{lib.composerNamesOf(piece)}{piece.musical_key ? ` · ${piece.musical_key}` : ''}</small>
                          <SetlistComment comment={entry.comment} title={title} disabled={entriesDisabled}
                            onSave={(value) => saveComment(entry, value)} />
                          {scoreOptions.length > 1 && (
                            <label className="setlist-score">
                              <span>Score</span>
                              <select aria-label={`Score for ${title}`} value={chosenScore?.id ?? ''} disabled={entriesDisabled}
                                onChange={(event) => saveEntryScore(entry, event.target.value)}>
                                {scoreOptions.map((score) => <option key={score.id} value={score.id}>{scoreLabel(score)}</option>)}
                              </select>
                            </label>
                          )}
                        </> : <small>Placeholder</small>}
                      </span>
                      <div className="setlist-piece-actions">
                        {piece && (
                          <button type="button" className="icon-btn" aria-label={`Open score for ${title}`} title={chosenScore ? 'Open the score' : 'No PDF attached to this tune'}
                            disabled={!chosenScore} onClick={() => void lib.openPdf(piece, chosenScore ?? undefined)}>{PdfIcon}</button>
                        )}
                        {piece && (
                          <button type="button" className="icon-btn" aria-label={`${showingDetails ? 'Hide' : 'Show'} details for ${title}`} aria-expanded={showingDetails} title="Tune details"
                            onClick={() => setOpenDetails(showingDetails ? null : entry.id)}>{InfoIcon}</button>
                        )}
                        <DeleteButton label={`Delete ${title} from ${selected.name}`} disabled={entriesDisabled} onClick={() => removeEntry(entry)} />
                      </div>
                      {showingDetails && piece && (
                        <SetlistTuneDetails piece={piece} composerNamesOf={lib.composerNamesOf} onOpenPdf={(target) => void lib.openPdf(target)} />
                      )}
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
                <SetlistTunePicker pieces={availablePieces} selectedIds={chosenPieceIds} setlistName={selected.name}
                  disabled={entriesDisabled} composerNamesOf={lib.composerNamesOf}
                  onAdd={(id) => addEntry(id, null)}
                  onRemove={(id) => { const entry = members.find((item) => item.piece_id === id); if (entry) removeEntry(entry) }} />
              </section>
            </>
          )}
        </section>
      </div>
      {playing && selected && (
        <SetlistPlayer name={selected.name} entries={playerEntries} pdfUrl={lib.pdfUrl}
          onClose={() => setPlaying(false)}
          onPages={(_piece, score, pages) => void lib.recordPdfPages(score.id, pages)} />
      )}
    </>
  )
}
