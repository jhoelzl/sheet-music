import type { PieceScore, TeachingMaterial } from '../supabase'
import { scoreLabel } from './scores'

/** A full, self-contained dump of one user's library. */
export type BackupPayload = {
  app: 'sheet-music'
  version: number
  exported_at: string
  composers: unknown[]
  pieces: unknown[]
  piece_composers: unknown[]
  scores: unknown[]
  setlists: unknown[]
  setlist_pieces: unknown[]
  practice_log: unknown[]
  lessons: unknown[]
  teaching_materials: unknown[]
  lesson_pieces: unknown[]
  lesson_materials: unknown[]
}

export type BackupTables = Omit<BackupPayload, 'app' | 'version' | 'exported_at'>

export function buildBackup(tables: BackupTables): BackupPayload {
  return { app: 'sheet-music', version: 1, exported_at: new Date().toISOString(), ...tables }
}

export function backupFileName(date = new Date()): string {
  return `sheet-music-backup-${date.toISOString().slice(0, 10)}.zip`
}

/** A filesystem-safe file name for a score PDF inside the backup. */
export function scoreFileName(score: PieceScore, pieceTitle?: string): string {
  const base = sanitize([pieceTitle, scoreLabel(score)].filter(Boolean).join(' - ')) || 'score'
  return `scores/${base} (${score.id}).pdf`
}

export function materialFileName(material: TeachingMaterial): string {
  return `teaching-materials/${sanitize(material.title) || 'material'} (${material.id}).pdf`
}

function sanitize(value: string): string {
  return value.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100)
}

/** Hand a generated file to the browser as a download. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
