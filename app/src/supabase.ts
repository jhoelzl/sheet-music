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

export type Piece = {
  instruments: Instrument[]
  id: string
  composer_id: string
  title: string
  pdf_path: string | null
  pdf_pages?: number | null
  can_play: boolean
  learned: boolean
  favorite: boolean
  learn_later: boolean
  difficulty: number | null
  rating: number | null
  notes: string | null
  links?: PieceLink[]
  created_at?: string
  last_practiced?: string | null
}
