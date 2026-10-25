# sheet-music

Web app (React + Vite + Supabase) to organise piano sheet music PDFs by composer, with metadata per piece: play progress (0/25/50/75/100%), difficulty (1-5), rating (1-5), instruments, free-form tags, notes and multiple YouTube/Spotify/Instagram/other links. It also has an inline PDF preview, a practice log with calendar, and four switchable list views (grouped, table, grid, board).

See [docs/improvements.md](docs/improvements.md) for the improvement backlog.

## Setup
1. Create a Supabase project and install the [Supabase CLI](https://supabase.com/docs/guides/cli).
2. From the repository root, authenticate and link the project:
   ```sh
   supabase login
   supabase link --project-ref <project-ref>
   ```
3. Apply migrations with `supabase db push`. The CLI applies pending files in `supabase/migrations` in order and records them in the remote migration history. For a fresh project, this creates the `sm_composers` and `sm_pieces` tables, row-level security, the private `sheet-music` storage bucket, and database validation for piece links.

   If the project already has these migrations applied manually, **do not run `db push` until its migration history is reconciled**. Verify that the remote database reflects every migration, then mark those versions as applied:
   ```sh
   supabase migration repair --status applied 0001 0002 0003 0004 0005 0006 0007 0008 0009 0010 0011 0012 0013 0014
   supabase migration list
   ```
   Only include versions that have actually been applied to that database. This records history; it does not execute the migration SQL.

4. For future schema changes, create a migration with `supabase migration new <description>`, add its SQL, and apply it with `supabase db push`. Use `supabase db push --dry-run` to preview pending migrations.
5. In `app/`, copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
6. From inside `app/`: `npm install && npm run dev`

Sign up with email/password; each user only sees their own data. Click a piece title to open its PDF.
