import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { PDF_STORAGE_BUCKET } from '../config'
import type { Library } from '../hooks/useLibrary'
import { todayISO } from '../lib/dates'
import { confirmDelete } from '../lib/confirmDelete'
import { Markdown } from '../lib/markdown'
import { supabase } from '../supabase'
import type { Instrument, Lesson, LessonGroup, TeachingMaterial } from '../supabase'
import { SetlistTunePicker } from './SetlistTunePicker'
import { SetlistTuneDetails } from './SetlistTuneDetails'
import { SearchPicker } from './SearchPicker'
import { TagInput } from './TagInput'
import { ActivityCalendar } from './ActivityCalendar'
import { DeleteButton } from './DeleteButton'
import { DocumentInput } from './DocumentInput'
import { EditIcon } from './icons'

type LessonPiece = { lesson_id: string; piece_id: string }
type LessonMaterial = { lesson_id: string; material_id: string }
type LibraryData = Pick<Library, 'pieces' | 'hiddenIds' | 'composerNamesOf' | 'openPdf' | 'openMaterialPdf'>

export function LessonsPage({ lib, onDirtyChange }: { lib: LibraryData; onDirtyChange: (dirty: boolean) => void }) {
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [groups, setGroups] = useState<LessonGroup[]>([])
  const [groupFilter, setGroupFilter] = useState('all')
  const [newLessonGroup, setNewLessonGroup] = useState('')
  const [teacherName, setTeacherName] = useState('')
  const [instrument, setInstrument] = useState<Instrument>('guitar')
  const [showGroupForm, setShowGroupForm] = useState(false)
  const [groupDraft, setGroupDraft] = useState<LessonGroup | null>(null)
  const [materials, setMaterials] = useState<TeachingMaterial[]>([])
  const [lessonPieces, setLessonPieces] = useState<LessonPiece[]>([])
  const [lessonMaterials, setLessonMaterials] = useState<LessonMaterial[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Lesson | null>(null)
  const [openPieceId, setOpenPieceId] = useState<string | null>(null)
  const [newDate, setNewDate] = useState(todayISO)
  const [newTitle, setNewTitle] = useState('')
  const [materialTitle, setMaterialTitle] = useState('')
  const [materialDraft, setMaterialDraft] = useState<{ id: string; title: string } | null>(null)
  const [materialError, setMaterialError] = useState('')
  const [newMaterialTags, setNewMaterialTags] = useState<string[]>([])
  const [materialTagFilter, setMaterialTagFilter] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [fileKey, setFileKey] = useState(0)
  const [processingPhotos, setProcessingPhotos] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showActivity, setShowActivity] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const selected = lessons.find((lesson) => lesson.id === selectedId)
  const dirty = Boolean(draft && selected && (draft.title !== selected.title || draft.lesson_date !== selected.lesson_date || draft.notes !== selected.notes || draft.group_id !== selected.group_id))
  const savedGroup = groups.find((group) => group.id === groupDraft?.id)
  const groupDirty = Boolean(groupDraft && savedGroup && (groupDraft.teacher_name !== savedGroup.teacher_name || groupDraft.instrument !== savedGroup.instrument))
  const savedMaterial = materials.find((material) => material.id === materialDraft?.id)
  const materialDirty = Boolean(materialDraft && savedMaterial && materialDraft.title !== savedMaterial.title)

  useEffect(() => { onDirtyChange(dirty || groupDirty || materialDirty) }, [dirty, groupDirty, materialDirty, onDirtyChange])

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const [l, m, p, lm, g] = await Promise.all([
          supabase.from('sm_lessons').select('id, lesson_date, title, notes, group_id').order('lesson_date', { ascending: false }),
          supabase.from('sm_teaching_materials').select('id, title, pdf_path, tags').order('title'),
          supabase.from('sm_lesson_pieces').select('lesson_id, piece_id'),
          supabase.from('sm_lesson_materials').select('lesson_id, material_id'),
          supabase.from('sm_lesson_groups').select('id, teacher_name, instrument').order('teacher_name'),
        ])
        const failure = [l, m, p, lm, g].find((result) => result.error)
        if (failure?.error) throw failure.error
        if (!active) return
        const loaded = ((l.data ?? []) as Lesson[]).map((lesson) => ({ ...lesson, group_id: lesson.group_id ?? null }))
        const loadedGroups = (g.data ?? []) as LessonGroup[]
        setLessons(loaded)
        setGroups(loadedGroups)
        if (loadedGroups.length === 1) setNewLessonGroup(loadedGroups[0].id)
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

  const perform = async (action: () => Promise<void>, onError?: (message: string) => void) => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setError('')
    try { await action() }
    catch (reason) {
      const message = reason instanceof Error ? reason.message : String((reason as { message?: string })?.message ?? 'Operation failed.')
      if (onError) onError(message)
      else setError(message)
    }
    finally { busyRef.current = false; setBusy(false) }
  }

  const choose = (lesson: Lesson) => {
    if (lesson.id === selectedId) return
    if (dirty && !window.confirm('Discard unsaved lesson changes?')) return
    setSelectedId(lesson.id)
    setDraft(lesson)
    setOpenPieceId(null)
  }

  const chooseGroup = (value: string) => {
    if (value === groupFilter) return
    const nextLesson = lessons.find((lesson) => value === 'all' || (value === 'unassigned' ? !lesson.group_id : lesson.group_id === value))
    if (dirty && nextLesson?.id !== selectedId && !window.confirm('Discard unsaved lesson changes?')) return
    if (groupDirty && !window.confirm('Discard unsaved group changes?')) return
    setGroupFilter(value)
    if (value !== 'all' && value !== 'unassigned') setNewLessonGroup(value)
    setGroupDraft(groups.find((group) => group.id === value) ?? null)
    if (nextLesson?.id !== selectedId) {
      setSelectedId(nextLesson?.id ?? null)
      setDraft(nextLesson ?? null)
      setOpenPieceId(null)
    }
  }

  const createGroup = (event: FormEvent) => {
    event.preventDefault()
    if (!teacherName.trim()) return
    void perform(async () => {
      const { data, error: failure } = await supabase.from('sm_lesson_groups')
        .insert({ teacher_name: teacherName.trim(), instrument }).select('id, teacher_name, instrument').single()
      if (failure) throw failure
      if (!data) throw new Error('Could not create lesson group.')
      const group = data as LessonGroup
      setGroups((current) => [...current, group])
      setNewLessonGroup(group.id)
      setTeacherName('')
      setShowGroupForm(false)
    })
  }

  const saveGroup = (event: FormEvent) => {
    event.preventDefault()
    if (!groupDraft?.teacher_name.trim()) return
    const group = { ...groupDraft, teacher_name: groupDraft.teacher_name.trim() }
    void perform(async () => {
      const { error: failure } = await supabase.from('sm_lesson_groups')
        .update({ teacher_name: group.teacher_name, instrument: group.instrument }).eq('id', group.id)
      if (failure) throw failure
      setGroups((current) => current.map((item) => item.id === group.id ? group : item))
      setGroupDraft(group)
    })
  }

  const deleteGroup = () => {
    if (!groupDraft) return
    if (lessons.some((lesson) => lesson.group_id === groupDraft.id)) {
      setError('Move or delete this group’s lessons before deleting the group.')
      return
    }
    if (!confirmDelete(`the lesson group for "${groupDraft.teacher_name}"`)) return
    void perform(async () => {
      const { error: failure } = await supabase.from('sm_lesson_groups').delete().eq('id', groupDraft.id)
      if (failure) throw failure
      setGroups((current) => current.filter((group) => group.id !== groupDraft.id))
      setNewLessonGroup((current) => current === groupDraft.id ? '' : current)
      setGroupFilter('all')
      setGroupDraft(null)
    })
  }

  const createLesson = (event: FormEvent) => {
    event.preventDefault()
    if (!newLessonGroup) return
    if (dirty && !window.confirm('Discard unsaved lesson changes?')) return
    if (groupFilter !== 'all' && groupFilter !== newLessonGroup && groupDirty && !window.confirm('Discard unsaved group changes?')) return
    void perform(async () => {
      const { data, error: failure } = await supabase.from('sm_lessons')
        .insert({ title: newTitle.trim(), lesson_date: newDate, notes: '', group_id: newLessonGroup }).select('id, lesson_date, title, notes, group_id').single()
      if (failure) throw failure
      if (!data) throw new Error('Could not create lesson.')
      const lesson = data as Lesson
      setLessons((current) => [...current, lesson])
      setSelectedId(lesson.id)
      setDraft(lesson)
      if (groupFilter !== 'all' && groupFilter !== lesson.group_id) { setGroupFilter('all'); setGroupDraft(null) }
      setOpenPieceId(null)
      setNewTitle('')
    })
  }

  const saveLesson = (event: FormEvent) => {
    event.preventDefault()
    if (!draft) return
    const saved = { ...draft, title: draft.title.trim() }
    if (!saved.title || !saved.lesson_date) { setError('A title and date are required.'); return }
    if (groupFilter !== 'all' && groupFilter !== (saved.group_id ?? 'unassigned') && groupDirty && !window.confirm('Discard unsaved group changes?')) return
    void perform(async () => {
      const { error: failure } = await supabase.from('sm_lessons').update({
        title: saved.title, lesson_date: saved.lesson_date, notes: saved.notes, group_id: saved.group_id,
      }).eq('id', saved.id)
      if (failure) throw failure
      setLessons((current) => current.map((lesson) => lesson.id === saved.id ? saved : lesson))
      setDraft(saved)
      if (groupFilter !== 'all' && groupFilter !== (saved.group_id ?? 'unassigned')) { setGroupFilter('all'); setGroupDraft(null) }
    })
  }

  const deleteLesson = () => {
    if (!selected || !confirmDelete(`lesson "${selected.title}"`, 'Its notes and links will also be deleted. Teaching materials and tunes will be kept.')) return
    void perform(async () => {
      const { error: failure } = await supabase.from('sm_lessons').delete().eq('id', selected.id)
      if (failure) throw failure
      const remaining = lessons.filter((lesson) => lesson.id !== selected.id)
      const next = remaining.find((lesson) => groupFilter === 'all' || (groupFilter === 'unassigned' ? !lesson.group_id : lesson.group_id === groupFilter))
      setLessons(remaining)
      setLessonPieces((current) => current.filter((link) => link.lesson_id !== selected.id))
      setLessonMaterials((current) => current.filter((link) => link.lesson_id !== selected.id))
      setSelectedId(next?.id ?? null)
      setDraft(next ?? null)
      setOpenPieceId(null)
    })
  }

  const changePiece = (pieceId: string, add: boolean) => {
    if (!selected) return
    const piece = lib.pieces.find((item) => item.id === pieceId)
    if (!add && !confirmDelete(`tune "${piece?.title ?? 'Unknown tune'}" from lesson "${selected.title}"`, 'The tune and its scores will be kept.')) return
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
    if (processingPhotos || !file || !materialTitle.trim()) return
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
        const result = await supabase.from('sm_teaching_materials').insert({ title: materialTitle.trim(), pdf_path: path, tags: newMaterialTags })
          .select('id, title, pdf_path, tags').single()
        if (result.error) throw result.error
        if (!result.data) throw new Error('Could not save material.')
        setMaterials((current) => [...current, result.data as TeachingMaterial].sort((a, b) => a.title.localeCompare(b.title)))
      } catch (reason) {
        const cleanup = await storage.remove([path])
        if (cleanup.error) throw new Error(`Could not save material; cleanup also failed for ${path}: ${cleanup.error.message}`)
        throw reason
      }
      setMaterialTitle('')
      setNewMaterialTags([])
      setFile(null)
      setFileKey((current) => current + 1)
    })
  }

  const saveMaterialTags = (material: TeachingMaterial, tags: string[]) => {
    void perform(async () => {
      const { error: failure } = await supabase.from('sm_teaching_materials').update({ tags }).eq('id', material.id)
      if (failure) throw failure
      setMaterials((current) => current.map((item) => item.id === material.id ? { ...item, tags } : item))
    })
  }

  const saveMaterialTitle = (event: FormEvent) => {
    event.preventDefault()
    if (!materialDraft || !savedMaterial) return
    const title = materialDraft.title.trim()
    if (!title) { setMaterialError('Enter a material title.'); return }
    if (title === savedMaterial.title) { setMaterialDraft(null); setMaterialError(''); return }
    setMaterialError('')
    void perform(async () => {
      const { data, error: failure } = await supabase.from('sm_teaching_materials')
        .update({ title }).eq('id', materialDraft.id).select('id').single()
      if (failure) throw failure
      if (!data) throw new Error('Could not rename material.')
      setMaterials((current) => current.map((item) => item.id === materialDraft.id ? { ...item, title } : item)
        .sort((a, b) => a.title.localeCompare(b.title)))
      setMaterialDraft(null)
    }, setMaterialError)
  }

  const deleteMaterial = (material: TeachingMaterial) => {
    if (!confirmDelete(`teaching material "${material.title}"`, 'Its PDF and links to all lessons will also be deleted.')) return
    void perform(async () => {
      const { error: failure } = await supabase.from('sm_teaching_materials').delete().eq('id', material.id)
      if (failure) throw failure
      setMaterials((current) => current.filter((item) => item.id !== material.id))
      setLessonMaterials((current) => current.filter((item) => item.material_id !== material.id))
      const removed = await supabase.storage.from(PDF_STORAGE_BUCKET).remove([material.pdf_path])
      if (removed.error) throw new Error(`Material deleted, but its PDF could not be deleted (${material.pdf_path}): ${removed.error.message}`)
    })
  }

  const selectedPieceIds = lessonPieces.filter((link) => link.lesson_id === selectedId).map((link) => link.piece_id)
  const selectedMaterialIds = lessonMaterials.filter((link) => link.lesson_id === selectedId).map((link) => link.material_id)
  const openPiece = selectedPieceIds.includes(openPieceId ?? '') ? lib.pieces.find((piece) => piece.id === openPieceId) : undefined
  const visibleLessons = lessons.filter((lesson) => groupFilter === 'all' || (groupFilter === 'unassigned' ? !lesson.group_id : lesson.group_id === groupFilter))
  const sortedLessons = [...visibleLessons].sort((a, b) => b.lesson_date.localeCompare(a.lesson_date) || a.title.localeCompare(b.title))
  const today = todayISO()
  const pastLessons = visibleLessons.filter((lesson) => lesson.lesson_date <= today)
  const todayCount = pastLessons.filter((lesson) => lesson.lesson_date === today).length
  const materialTags = [...new Set(materials.flatMap((material) => material.tags))].sort((a, b) => a.localeCompare(b))
  const filterTags = materialTagFilter && !materialTags.includes(materialTagFilter) ? [...materialTags, materialTagFilter] : materialTags
  const visibleMaterials = materialTagFilter ? materials.filter((material) => material.tags.includes(materialTagFilter)) : materials
  return (
    <div className="lessons-page">
      <div className="library-intro"><div><h2>Lessons</h2><p>Keep lesson notes, tunes and teaching materials together.</p></div></div>
      {error && <p className="lessons-error" role="alert">{error}</p>}
      {loading ? <p role="status">Loading lessons…</p> : loadFailed ? <p>Reload the app to try again.</p> : (
        <>
          <section className="lesson-groups" aria-label="Lesson groups">
            <div className="lesson-groups-toolbar">
              <label>Show lessons for<select value={groupFilter} disabled={busy} onChange={(event) => chooseGroup(event.target.value)}>
                <option value="all">All groups</option><option value="unassigned">Unassigned lessons</option>
                {groups.map((group) => <option key={group.id} value={group.id}>{group.teacher_name} · {group.instrument}</option>)}
              </select></label>
              <button type="button" className="link" aria-expanded={showGroupForm} aria-controls="new-lesson-group"
                disabled={busy} onClick={() => setShowGroupForm((visible) => !visible)}>
                {showGroupForm ? 'Cancel' : 'Add group'}
              </button>
            </div>
            {showGroupForm && <form id="new-lesson-group" className="panel lesson-group-form" onSubmit={createGroup}>
              <label className="grow">Teacher name<input required value={teacherName} disabled={busy} onChange={(event) => setTeacherName(event.target.value)} /></label>
              <label>Instrument<select value={instrument} disabled={busy} onChange={(event) => setInstrument(event.target.value as Instrument)}><option value="guitar">Guitar</option><option value="piano">Piano</option></select></label>
              <button type="submit" className="btn" disabled={busy || !teacherName.trim()}>Create group</button>
            </form>}
            {groupDraft && <form className="panel lesson-group-form" onSubmit={saveGroup}>
              <label className="grow">Edit teacher name<input required value={groupDraft.teacher_name} disabled={busy} onChange={(event) => setGroupDraft({ ...groupDraft, teacher_name: event.target.value })} /></label>
              <label>Edit instrument<select value={groupDraft.instrument} disabled={busy} onChange={(event) => setGroupDraft({ ...groupDraft, instrument: event.target.value as Instrument })}><option value="guitar">Guitar</option><option value="piano">Piano</option></select></label>
              <button className="btn" type="submit" disabled={busy || !groupDirty || !groupDraft.teacher_name.trim()}>Save group</button>
              {groupDirty && <span className="muted">Unsaved group changes</span>}
              <DeleteButton label="Delete group" disabled={busy} onClick={deleteGroup} />
            </form>}
          </section>
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
          <section className="teaching-materials" aria-label="Teaching materials">
            <div className="teaching-materials-heading">
              <div><h3>Teaching materials <span className="materials-count">{materials.length}</span></h3><p className="muted">Upload PDFs once and reuse them across lessons.</p></div>
              <button type="button" className="btn" disabled={!visibleMaterials.length || busy}
                onClick={() => void lib.openMaterialPdf(visibleMaterials[0], visibleMaterials)}>Browse materials</button>
            </div>
            <form className="panel" onSubmit={uploadMaterial}>
              <label className="grow">Material title<input required value={materialTitle} disabled={busy} onChange={(event) => setMaterialTitle(event.target.value)} /></label>
              <DocumentInput key={fileKey} label="PDF file" file={file} disabled={busy} onChange={setFile} onProcessingChange={setProcessingPhotos} />
              <div className="field-group"><span>Tags</span>
                <TagInput tags={newMaterialTags} suggestions={materialTags} label="Tags for new material" disabled={busy} onChange={setNewMaterialTags} />
              </div>
              <button type="submit" className="btn" disabled={busy || processingPhotos || !file || !materialTitle.trim()}>Upload PDF</button>
            </form>
            {filterTags.length > 0 && <div className="filter-bar" role="group" aria-label="Filter teaching materials by tag">
              <button type="button" className={`filter-pill${materialTagFilter === null ? ' active' : ''}`} aria-pressed={materialTagFilter === null} disabled={Boolean(materialDraft)} onClick={() => setMaterialTagFilter(null)}>All tags</button>
              {filterTags.map((tag) => <button key={tag} type="button" className={`filter-pill${materialTagFilter === tag ? ' active' : ''}`}
                aria-pressed={materialTagFilter === tag} disabled={Boolean(materialDraft)} onClick={() => setMaterialTagFilter(materialTagFilter === tag ? null : tag)}>#{tag}</button>)}
            </div>}
            {materialTagFilter && visibleMaterials.length === 0 && <p className="muted">No materials with this tag.</p>}
            {visibleMaterials.map((material) => {
              const linkedIds = new Set(lessonMaterials.filter((link) => link.material_id === material.id).map((link) => link.lesson_id))
              const linkedLessons = lessons.filter((lesson) => linkedIds.has(lesson.id))
                .sort((a, b) => b.lesson_date.localeCompare(a.lesson_date) || a.title.localeCompare(b.title))
              return <div className="material-row" key={material.id}>
                <div className="material-content">
                  <div className="material-info">
                    {materialDraft?.id === material.id ? (
                      <form className="material-rename" onSubmit={saveMaterialTitle} onKeyDown={(event) => {
                        if (event.key === 'Escape' && !busy) { setMaterialDraft(null); setMaterialError('') }
                      }}>
                        <input aria-label={`New name for ${material.title}`} autoFocus required value={materialDraft.title} disabled={busy}
                          onChange={(event) => { setMaterialDraft({ ...materialDraft, title: event.target.value }); setMaterialError('') }} />
                        <button type="submit" className="btn" disabled={busy}>Save</button>
                        <button type="button" className="link" disabled={busy} onClick={() => { setMaterialDraft(null); setMaterialError('') }}>Cancel</button>
                        {materialError && <p className="material-rename-error" role="alert">{materialError}</p>}
                      </form>
                    ) : <button type="button" className="link" onClick={() => void lib.openMaterialPdf(material, visibleMaterials)}>{material.title}</button>}
                    <TagInput tags={material.tags} suggestions={materialTags} label={`Tags for ${material.title}`} disabled={busy || Boolean(materialDraft)} onChange={(tags) => saveMaterialTags(material, tags)} />
                  </div>
                  {linkedLessons.length > 0 && <div className="material-lessons" aria-label={`Lessons using ${material.title}`}>
                    <span>Used in:</span>
                    <ul>{linkedLessons.map((lesson) => <li key={lesson.id}>{lesson.title} · {lesson.lesson_date}</li>)}</ul>
                  </div>}
                </div>
                <div className="material-actions">
                  <button type="button" className="icon-btn edit" aria-label={`Rename teaching material ${material.title}`} title="Rename"
                    disabled={busy || Boolean(materialDraft)} onClick={() => { setMaterialDraft({ id: material.id, title: material.title }); setMaterialError('') }}>{EditIcon}</button>
                  <DeleteButton label={`Delete teaching material ${material.title}`} disabled={busy || Boolean(materialDraft)} onClick={() => deleteMaterial(material)} />
                </div>
              </div>
            })}
            {!materials.length && <p className="muted">No teaching materials yet.</p>}
          </section>
          <form className="panel lesson-create" onSubmit={createLesson}>
            <label>Date<input type="date" value={newDate} required disabled={busy} onChange={(event) => setNewDate(event.target.value)} /></label>
            <label className="grow">Lesson title<input value={newTitle} required disabled={busy} placeholder="e.g. Guitar lesson" onChange={(event) => setNewTitle(event.target.value)} /></label>
            <label>Group for new lesson<select required value={newLessonGroup} disabled={busy} onChange={(event) => setNewLessonGroup(event.target.value)}><option value="">Choose a group</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.teacher_name} · {group.instrument}</option>)}</select></label>
            <button type="submit" className="btn primary" disabled={busy || !newTitle.trim() || !newLessonGroup}>Add lesson</button>
          </form>
          <div className="lessons-layout">
            <section aria-label="Your lessons" className="lessons-list">
              <h3>Your lessons</h3>
              {!visibleLessons.length && <p className="muted">{lessons.length ? 'No lessons in this group.' : 'No lessons yet.'}</p>}
              {[...groups.map((group) => ({ id: group.id, name: `${group.teacher_name} · ${group.instrument}` })), { id: null, name: 'Unassigned' }].map((group) => {
                const items = sortedLessons.filter((lesson) => lesson.group_id === group.id)
                return items.length > 0 && <div key={group.id ?? 'unassigned'} className="lesson-list-group">
                  <h4>{group.name}</h4>
                  {items.map((lesson) => <button key={lesson.id} type="button" className={`lesson-choice${selectedId === lesson.id ? ' on' : ''}`}
                    disabled={busy} aria-pressed={selectedId === lesson.id} onClick={() => choose(lesson)}><strong>{lesson.title}</strong><span>{lesson.lesson_date}</span></button>)}
                </div>
              })}
            </section>
            {selected && draft && <section className="lesson-detail" aria-label="Lesson details">
              <form className="lesson-editor" onSubmit={saveLesson}>
                <label>Title<input required disabled={busy} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
                <label>Lesson date<input type="date" required disabled={busy} value={draft.lesson_date} onChange={(event) => setDraft({ ...draft, lesson_date: event.target.value })} /></label>
                <label>Lesson group<select value={draft.group_id ?? ''} disabled={busy} onChange={(event) => setDraft({ ...draft, group_id: event.target.value || null })}><option value="">Unassigned</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.teacher_name} · {group.instrument}</option>)}</select></label>
                <label>Notes (Markdown)<textarea rows={10} disabled={busy} value={draft.notes} placeholder="What did you work on?" onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></label>
                <div className="lesson-actions"><button type="submit" className="btn primary" disabled={busy || !dirty || !draft.title.trim()}>Save lesson</button>
                  {dirty && <span className="muted">Unsaved changes</span>}
                  <DeleteButton label="Delete lesson" disabled={busy} onClick={deleteLesson} /></div>
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
                {!materials.length && <p className="muted">Upload teaching materials to link them here.</p>}
                <SearchPicker key={selected.id} items={materials.map((material) => ({ id: material.id, name: material.title, keywords: material.tags }))}
                  selectedIds={selectedMaterialIds} label={`Materials for ${selected.title}`} singular="material" plural="materials" disabled={busy}
                  onChange={(ids) => {
                    const added = ids.find((id) => !selectedMaterialIds.includes(id))
                    const removed = selectedMaterialIds.find((id) => !ids.includes(id))
                    if (added) return changeMaterial(added, true)
                    if (removed) return changeMaterial(removed, false)
                  }}
                  onOpen={(id) => { const material = materials.find((item) => item.id === id); if (material) void lib.openMaterialPdf(material, materials) }} />
              </section>
            </section>}
          </div>
        </>
      )}
    </div>
  )
}
