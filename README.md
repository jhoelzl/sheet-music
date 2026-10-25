# sheet-music

Web app (React + Vite + Supabase) to organise piano sheet music PDFs by composer, with metadata per piece: play progress (0/25/50/75/100%), difficulty (1-5), rating (1-5), instruments, free-form tags, notes and multiple YouTube/Spotify/Instagram/other links. It also has an inline PDF preview, a practice log with calendar, and four switchable list views (grouped, table, grid, board).

See [docs/improvements.md](docs/improvements.md) for the improvement backlog.

## Setup
1. Create a Supabase project and run the SQL files in `supabase/migrations` in order (creates the `sm_composers` and `sm_pieces` tables, row-level security, a private `sheet-music` storage bucket, and database validation for piece links). On an existing project, run any migrations not yet applied; run `0002_prefix_tables.sql` to rename the existing tables without losing data.
2. `cd app && cp .env.example .env` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. From inside `app/`: `npm install && npm run dev`

Sign up with email/password; each user only sees their own data. Click a piece title to open its PDF.
