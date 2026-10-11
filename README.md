# sheet-music

Web app (React + Vite + Supabase) to organise piano sheet music PDFs by composer, with metadata per piece: can play, learned, favorite, difficulty (1-5), rating (1-5) and notes.

## Setup
1. Create a Supabase project and run `supabase/migrations/0001_init.sql` in the SQL editor (creates tables, row-level security and a private `sheet-music` storage bucket).
2. `cd app && cp .env.example .env` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. `npm install && npm run dev`

Sign up with email/password; each user only sees their own data. Click a piece title to open its PDF.
