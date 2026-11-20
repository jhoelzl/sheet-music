# sheet-music

Web app (React + Vite + Supabase) to organise piano sheet music PDFs by composer, with metadata per piece: play progress (0/25/50/75/100%), difficulty (1-5), rating (1-5), instruments, free-form tags, notes and multiple YouTube/Spotify/Instagram/other links. A piece can hold several PDF scores — for example a piano and a guitar version — each with its own musical key and instrument, or marked as a lead sheet (chords only, for no particular instrument). It also has an inline PDF preview with zoom in/out, a practice log with calendar, four switchable list views (grouped, table, grid, board), and setlists with ordered tunes, placeholders and per-tune comments (multi-line markdown). A manual **Download backup** exports all your data and every score PDF as a zip.

Setlists can be renamed, reordered, duplicated (with their tunes, placeholders, comments and order), archived when a gig is over, and searched for tunes with the same picker used for composers. Each entry links to the tune's score and can expand its details, and **Play** opens live mode: the score of the current tune full screen, with Previous/Next, a jump list and the `←` / `→` keys to move through the set. A tune's comment opens into a multi-line editor and is rendered as markdown, in the setlist and on stage — where it can sit above the score, in a left or right panel, in the footer, or be hidden. Zoom in/out is available in live mode and in the library's PDF viewer, which also lets you switch between a piece's scores; on stage a tune with several scores offers a picker to choose which one is shown, and a setlist entry can pre-select the score it plays.

The **Lessons** page keeps dated lesson notes with a Markdown preview, links to library tunes, and reusable teaching-material PDFs. Select a linked tune to see its details and score, or a linked material to open its PDF. Its activity heatmap shows past lessons and opens them by date; future lessons remain in the lesson list until their date arrives. The preview supports nested numbered and bulleted lists; indent subitems beneath their parent. Save note edits explicitly. Teaching materials are stored separately from scores and can be linked to multiple lessons; deleting a lesson leaves its tunes and materials intact. The backup includes lessons, links and material PDFs.

See [docs/improvements.md](docs/improvements.md) for the improvement backlog.

## Setup
1. Create a Supabase project and install the [Supabase CLI](https://supabase.com/docs/guides/cli).
2. From the repository root, authenticate and link the project:
   ```sh
   supabase login
   supabase link --project-ref <project-ref>
   ```
3. Apply migrations with `supabase db push`. The CLI applies pending files in `supabase/migrations` in order and records them in the remote migration history. For a fresh project, this creates the `sm_composers` and `sm_pieces` tables, row-level security, the private `sheet-music` storage bucket, and database validation for piece links.

   Apply `0018_setlist_planning.sql` before deploying the setlist planning features; it preserves existing setlists and entries. Apply `0019_reorder_setlist_entries.sql` for drag-and-drop reordering of setlist tunes, `0020_setlist_archive_and_duplicate.sql` for archiving and duplicating setlists, `0021_piece_scores.sql` for multiple PDF scores per piece (it moves each existing piece PDF, key and instrument into a score row and drops the old piece columns), `0022_setlist_entry_score.sql` to pre-select which score a setlist entry plays, `0023_score_lead_sheet.sql` to mark a score as a lead sheet, and `0024_music_lessons.sql` before deploying lessons.

   If the project already has these migrations applied manually, **do not run `db push` until its migration history is reconciled**. Verify that the remote database reflects every migration, then mark those versions as applied:
   ```sh
   supabase migration repair --status applied 0001 0002 0003 0004 0005 0006 0007 0008 0009 0010 0011 0012 0013 0014
   supabase migration list
   ```
   Only include versions that have actually been applied to that database. This records history; it does not execute the migration SQL.

4. For future schema changes, create a migration with `supabase migration new <description>`, add its SQL, and apply it with `supabase db push`. Use `supabase db push --dry-run` to preview pending migrations. Migration `0015` requires resolving any existing duplicate composer names per user (ignoring case and surrounding spaces) before it can create the unique index; it does not delete or merge existing data.
5. In `app/`, copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
6. From inside `app/`: `npm install && npm run dev`

Sign up with email/password; each user only sees their own data. Click a piece title to open its PDF.
