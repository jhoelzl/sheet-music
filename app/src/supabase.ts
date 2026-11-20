import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL ?? 'http://localhost:54321',
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'missing-key',
)

export type Composer = {
  id: string
  name: string
  born_year: number | null
  died_year: number | null
  notes: string | null
}

export type Instrument = 'piano' | 'guitar'

export type LinkType = 'youtube' | 'spotify' | 'instagram' | 'other'

export type PieceLink = { type: LinkType; url: string }

/** One PDF of a piece, with the key it is written in and the instrument it is for. */
export type PieceScore = {
  id: string
  piece_id: string
  pdf_path: string
  pdf_pages: number | null
  musical_key: string | null
  /** null for a lead sheet (chords only). */
  instrument: Instrument | null
  /** Chords only, for no particular instrument. */
  lead_sheet: boolean
  position: number
}

export type Piece = {
  id: string
  composer_id: string
  composer_ids?: string[]
  title: string
  subtitle?: string | null
  tags?: string[]
  /** The piece's PDFs. A piece can have several, e.g. a piano and a guitar score. */
  scores?: PieceScore[]
  // Read-only values derived from `scores` when the library loads.
  instruments: Instrument[]
  musical_key?: string | null
  pdf_path: string | null
  pdf_pages?: number | null
  play_progress: number
  difficulty: number | null
  rating: number | null
  notes: string | null
  links?: PieceLink[]
  created_at?: string
  last_practiced?: string | null
}

/** Piece columns the client writes directly. Derived fields (scores, instruments, key, pages) are not here. */
export type PiecePatch = Partial<Pick<Piece,
  'composer_id' | 'title' | 'subtitle' | 'tags' | 'play_progress' | 'difficulty' | 'rating' | 'notes' | 'links' | 'last_practiced'>>

export type PracticeLog = { id: string; piece_id: string; practiced_on: string }

export type Lesson = { id: string; lesson_date: string; title: string; notes: string }
export type TeachingMaterial = { id: string; title: string; pdf_path: string }
