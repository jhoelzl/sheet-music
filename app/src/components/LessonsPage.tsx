import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { PDF_STORAGE_BUCKET } from '../config'
import type { Library } from '../hooks/useLibrary'
import { todayISO } from '../lib/dates'
import { Markdown } from '../lib/markdown'
import { supabase } from '../supabase'
import type { Lesson, TeachingMaterial } from '../supabase'
import { SetlistTunePicker } from './SetlistTunePicker'
import { SetlistTuneDetails } from './SetlistTuneDetails'
import { SearchPicker } from './SearchPicker'
import { ActivityCalendar } from './ActivityCalendar'

type LessonPiece = { lesson_id: string; piece_id: string }
type LessonMaterial = { lesson_id: string; material_id: string }
type LibraryData = Pick<Library, 'pieces' | 'hiddenIds' | 'composerNamesOf' | 'openPdf' | 'openMaterialPdf'>

export function LessonsPage({ lib, onDirtyChange }: { lib: LibraryData; onDirtyChange: (dirty: boolean) => void }) {
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [materials, setMaterials] = useState<TeachingMaterial[]>([])
  const [lessonPieces, setLessonPieces] = useState<LessonPiece[]>([])
  const [lessonMaterials, setLessonMaterials] = useState<LessonMaterial[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Lesson | null>(null)
  const [openPieceId, setOpenPieceId] = useState<string | null>(null)
  const [newDate, setNewDate] = useState(todayISO)
  const [newTitle, setNewTitle] = useState('')
  const [materialTitle, setMaterialTitle] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [fileKey, setFileKey] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showActivity, setShowActivity] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const selected = lessons.find((lesson) => lesson.id === selectedId)
  const dirty = Boolean(draft && selected && (draft.title !== selected.title || draft.lesson_date !== selected.lesson_date || draft.notes !== selected.notes))

  useEffect(() => { onDirtyChange(dirty) }, [dirty, onDirtyChange])

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const [l, m, p, lm] = await Promise.all([
          supabase.from('sm_lessons').select('id, lesson_date, title, notes').order('lesson_date', { ascending: false }),
          supabase.from('sm_teaching_materials').select('id, title, pdf_path').order('title'),
          supabase.from('sm_lesson_pieces').select('lesson_id, piece_id'),
          supabase.from('sm_lesson_materials').select('lesson_id, material_id'),
        ])
        const failure = [l, m, p, lm].find((result) => result.error)
        if (failure?.error) throw failure.error
        if (!active) return
        const loaded = (l.data ?? []) as Lesson[]
        setLessons(loaded)
        setMaterials((m.data ?? []) as TeachingMaterial[])
        setLessonPieces((p.data ?? []) as LessonPiece[])
        setLessonMaterials((lm.data ?? []) as LessonMaterial[])
        setSelectedId(loaded[0]?.id ?? null)
        setDraft(loaded[0] ?? null)
      } catch (reason) {
        if (active) {
          setLoadFailed(true)
          setError(reason instanceof Error ? reason.message : String((reason as { message?: string })?.message ?? 'Could not load lessons.'))
        }
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [])

  const perform = async (action: () => Promise<void>) => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setError('')
    try { await action() }
    catch (reason) { setError(reason instanceof Error ? reason.message : String((reason as { message?: string })?.message ?? 'Operation failed.')) }
    finally { busyRef.current = false; setBusy(false) }
  }

  const choose = (lesson: Lesson) => {
    if (lesson.id === selectedId) return
    if (dirty && !window.confirm('Discard unsaved lesson changes?')) return
    setSelectedId(lesson.id)
    setDraft(lesson)
    setOpenPieceId(null)
  }

  const createLesson = (event: FormEvent) => {
    event.preventDefault()
    if (dirty && !window.confirm('Discard unsaved lesson changes?')) return
    void perform(async () => {
      const { data, error: failure } = await supabase.from('sm_lessons')
        .insert({ title: newTitle.trim(), lesson_date: newDate, notes: '' }).select('id, lesson_date, title, notes').single()
      if (failure) throw failure
      if (!data) throw new Error('Could not create lesson.')
      const lesson = data as Lesson
      setLessons((current) => [...current, lesson])
      setSelectedId(lesson.id)
      setDraft(lesson)
      setOpenPieceId(null)
      setNewTitle('')
    })
  }

  const saveLesson = (event: FormEvent) => {
    event.preventDefault()
    if (!draft) return
    const saved = { ...draft, title: draft.title.trim() }
    if (!saved.title || !saved.lesson_date) { setError('A title and date are required.'); return }
    void perform(async () => {
      const { error: failure } = await supabase.from('sm_lessons').update({
        title: saved.title, lesson_date: saved.lesson_date, notes: saved.notes,
      }).eq('id', saved.id)
      if (failure) throw failure
      setLessons((current) => current.map((lesson) => lesson.id === saved.id ? saved : lesson))
      setDraft(saved)
    })
  }

  const deleteLesson = () => {
    if (!selected || !window.confirm(`Delete "${selected.title}" and its links? Teaching materials and tunes will be kept.`)) return
    void perform(async () => {
      const { error: failure } = await supabase.from('sm_lessons').delete().eq('id', selected.id)
      if (failure) throw failure
      const remaining = lessons.filter((lesson) => lesson.id !== selected.id)
      setLessons(remaining)
      setLessonPieces((current) => current.filter((link) => link.lesson_id !== selected.id))
      setLessonMaterials((current) => current.filter((link) => link.lesson_id !== selected.id))
      setSelectedId(remaining[0]?.id ?? null)
      setDraft(remaining[0] ?? null)
      setOpenPieceId(null)
    })
  }

  const changePiece = (pieceId: string, add: boolean) => {
    if (!selected) return
    void perform(async () => {
      const link = { lesson_id: selected.id, piece_id: pieceId }
      const result = add
        ? await supabase.from('sm_lesson_pieces').insert(link)
        : await supabase.from('sm_lesson_pieces').delete().eq('lesson_id', selected.id).eq('piece_id', pieceId)
      if (result.error) throw result.error
      setLessonPieces((current) => add ? [...current, link] : current.filter((item) => item.lesson_id !== selected.id || item.piece_id !== pieceId))
      if (!add) setOpenPieceId((current) => current === pieceId ? null : current)
    })
  }

  const changeMaterial = (materialId: string, add: boolean) => {
    if (!selected) return Promise.resolve()
    return perform(async () => {
      const link = { lesson_id: selected.id, material_id: materialId }
      const result = add
        ? await supabase.from('sm_lesson_materials').insert(link)
        : await supabase.from('sm_lesson_materials').delete().eq('lesson_id', selected.id).eq('material_id', materialId)
      if (result.error) throw result.error
      setLessonMaterials((current) => add ? [...current, link] : current.filter((item) => item.lesson_id !== selected.id || item.material_id !== materialId))
    })
  }

  const uploadMaterial = (event: FormEvent) => {
    event.preventDefault()
    if (!file || !materialTitle.trim()) return
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) { setError('Choose a PDF file.'); return }
    void perform(async () => {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError) throw authError
      if (!user) throw new Error('Sign in to upload teaching materials.')
      const path = `${user.id}/materials/${crypto.randomUUID()}.pdf`
      const storage = supabase.storage.from(PDF_STORAGE_BUCKET)
      const upload = await storage.upload(path, file, { contentType: 'application/pdf' })
      if (upload.error) throw upload.error
      try {
        const result = await supabase.from('sm_teaching_materials').insert({ title: materialTitle.trim(), pdf_path: path })
          .select('id, title, pdf_path').single()
        if (result.error) throw result.error
        if (!result.data) throw new Error('Could not save material.')
        setMaterials((current) => [...current, result.data as TeachingMaterial].sort((a, b) => a.title.localeCompare(b.title)))
      } catch (reason) {
        const cleanup = await storage.remove([path])
        if (cleanup.error) throw new Error(`Could not save material; cleanup also failed for ${path}: ${cleanup.error.message}`)
        throw reason
      }
      setMaterialTitle('')
      setFile(null)
      setFileKey((current) => current + 1)
    })
  }

  const deleteMaterial = (material: TeachingMaterial) => {
    if (!window.confirm(`Delete "${material.title}" and remove it from all lessons?`)) return
    void perform(async () => {
      const { error: failure } = await supabase.from('sm_teaching_materials').delete().eq('id', material.id)
      if (failure) throw failure
      setMaterials((current) => current.filter((item) => item.id !== material.id))
      setLessonMaterials((current) => current.filter((item) => item.material_id !== material.id))
      const removed = await supabase.storage.from(PDF_STORAGE_BUCKET).remove([material.pdf_path])
      if (removed.error) throw new Error(`Material removed, but its PDF could not be deleted (${material.pdf_path}): ${removed.error.message}`)
    })
  }

  const selectedPieceIds = lessonPieces.filter((link) => link.lesson_id === selectedId).map((link) => link.piece_id)
  const selectedMaterialIds = lessonMaterials.filter((link) => link.lesson_id === selectedId).map((link) => link.material_id)
  const openPiece = selectedPieceIds.includes(openPieceId ?? '') ? lib.pieces.find((piece) => piece.id === openPieceId) : undefined
  const sortedLessons = [...lessons].sort((a, b) => b.lesson_date.localeCompare(a.lesson_date) || a.title.localeCompare(b.title))
  const today = todayISO()
  const pastLessons = lessons.filter((lesson) => lesson.lesson_date <= today)
  const todayCount = pastLessons.filter((lesson) => lesson.lesson_date === today).length
  return (
    <div className="lessons-page">
      <div className="library-intro"><div><h2>Lessons</h2><p>Keep lesson notes, tunes and teaching materials together.</p></div></div>
      {error && <p className="lessons-error" role="alert">{error}</p>}
      {loading ? <p role="status">Loading lessons…</p> : loadFailed ? <p>Reload the app to try again.</p> : (
        <>
          <section className="practice-summary" aria-label="Lesson activity">
            <button type="button" className="practice-summary-toggle" aria-expanded={showActivity} aria-controls="lesson-activity" onClick={() => setShowActivity(!showActivity)}>
              <span className="practice-summary-icon" aria-hidden="true">✦</span>
              <span className="practice-summary-copy"><strong>Your lessons</strong><span>{todayCount} {todayCount === 1 ? 'lesson' : 'lessons'} today</span></span>
              <span className="practice-summary-action">{showActivity ? 'Hide activity' : 'View activity'} <span aria-hidden="true">{showActivity ? '↑' : '↓'}</span></span>
            </button>
            {showActivity && <div id="lesson-activity">
              <ActivityCalendar kind="lesson" entries={pastLessons.map((lesson) => ({ id: lesson.id, date: lesson.lesson_date, title: lesson.title }))}
                selectionDisabled={busy} onSelectEntry={(id) => { const lesson = lessons.find((item) => item.id === id); if (lesson) choose(lesson) }} />
            </div>}
          </section>
          <form className="panel lesson-create" onSubmit={createLesson}>
            <label>Date<input type="date" value={newDate} required disabled={busy} onChange={(event) => setNewDate(event.target.value)} /></label>
            <label className="grow">Lesson title<input value={newTitle} required disabled={busy} placeholder="e.g. Guitar lesson" onChange={(event) => setNewTitle(event.target.value)} /></label>
            <button type="submit" className="btn primary" disabled={busy || !newTitle.trim()}>Add lesson</button>
          </form>
          <div className="lessons-layout">
            <section aria-label="Your lessons" className="lessons-list">
              <h3>Your lessons</h3>
              {!lessons.length && <p className="muted">No lessons yet.</p>}
              {sortedLessons.map((lesson) => <button key={lesson.id} type="button" className={`lesson-choice${selectedId === lesson.id ? ' on' : ''}`}
                disabled={busy} aria-pressed={selectedId === lesson.id} onClick={() => choose(lesson)}><strong>{lesson.title}</strong><span>{lesson.lesson_date}</span></button>)}
            </section>
            {selected && draft && <section className="lesson-detail" aria-label="Lesson details">
              <form className="lesson-editor" onSubmit={saveLesson}>
                <label>Title<input required disabled={busy} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
                <label>Lesson date<input type="date" required disabled={busy} value={draft.lesson_date} onChange={(event) => setDraft({ ...draft, lesson_date: event.target.value })} /></label>
                <label>Notes (Markdown)<textarea rows={10} disabled={busy} value={draft.notes} placeholder="What did you work on?" onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></label>
                <div className="lesson-actions"><button type="submit" className="btn primary" disabled={busy || !dirty || !draft.title.trim()}>Save lesson</button>
                  {dirty && <span className="muted">Unsaved changes</span>}
                  <button type="button" className="link danger" disabled={busy} onClick={deleteLesson}>Delete lesson</button></div>
              </form>
              {draft.notes && <section className="lesson-preview" aria-label="Notes preview"><h3>Notes preview</h3><Markdown text={draft.notes} /></section>}
              <section className="lesson-section"><h3>Tunes</h3>
                <SetlistTunePicker key={selected.id} pieces={lib.pieces.filter((piece) => !lib.hiddenIds.has(piece.id))} selectedIds={selectedPieceIds}
                  setlistName={selected.title} context="lesson" disabled={busy} composerNamesOf={lib.composerNamesOf}
                  onAdd={(id) => changePiece(id, true)} onRemove={(id) => changePiece(id, false)}
                  openPieceId={openPieceId} onSelectPiece={(piece) => setOpenPieceId((current) => current === piece.id ? null : piece.id)} />
                {openPiece && <section aria-label={`Details for ${openPiece.title}`}>
                  <h4>{openPiece.title}</h4>
                  <SetlistTuneDetails piece={openPiece} composerNamesOf={lib.composerNamesOf} onOpenPdf={(piece) => void lib.openPdf(piece)} />
                </section>}
              </section>
              <section className="lesson-section"><h3>Materials in this lesson</h3>
                {!materials.length && <p className="muted">Upload teaching materials below to link them here.</p>}
                <SearchPicker key={selected.id} items={materials.map((material) => ({ id: material.id, name: material.title }))}
                  selectedIds={selectedMaterialIds} label={`Materials for ${selected.title}`} singular="material" plural="materials" disabled={busy}
                  onChange={(ids) => {
                    const added = ids.find((id) => !selectedMaterialIds.includes(id))
                    const removed = selectedMaterialIds.find((id) => !ids.includes(id))
                    if (added) return changeMaterial(added, true)
                    if (removed) return changeMaterial(removed, false)
                  }}
                  onOpen={(id) => { const material = materials.find((item) => item.id === id); if (material) void lib.openMaterialPdf(material) }} />
              </section>
            </section>}
          </div>
          <section className="teaching-materials" aria-label="Teaching materials">
            <h3>Teaching materials</h3><p className="muted">Upload PDFs once and reuse them across lessons.</p>
            <form className="panel" onSubmit={uploadMaterial}>
              <label className="grow">Material title<input required value={materialTitle} disabled={busy} onChange={(event) => setMaterialTitle(event.target.value)} /></label>
              <label>PDF file<input key={fileKey} type="file" accept="application/pdf,.pdf" disabled={busy}
                onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>
              <button type="submit" className="btn" disabled={busy || !file || !materialTitle.trim()}>Upload PDF</button>
            </form>
            {materials.map((material) => <div className="material-row" key={material.id}>
              <button type="button" className="link" onClick={() => void lib.openMaterialPdf(material)}>{material.title}</button>
              <button type="button" className="link danger" disabled={busy} onClick={() => deleteMaterial(material)}>Delete</button>
            </div>)}
          </section>
        </>
      )}
    </div>
  )
}
