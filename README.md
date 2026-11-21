# sheet-music

Web app (React + Vite + Supabase) to organise piano sheet music PDFs by composer, with metadata per piece: play progress (0/25/50/75/100%), difficulty (1-5), rating (1-5), instruments, free-form tags, notes and multiple YouTube/Spotify/Instagram/other links. A piece can hold several PDF scores, each with its own musical key and any combination of score tags, including Piano, Guitar, Lead sheet, Solo and custom tags. Scores can also have no tags. It also has an inline PDF preview with zoom in/out, a practice log with calendar, four switchable list views (grouped, table, grid, board), and setlists with ordered tunes, placeholders and per-tune comments (multi-line markdown). A manual **Download backup** exports all your data and every score PDF as a zip.

Setlists can be renamed, reordered, duplicated (with their tunes, placeholders, comments and order), archived when a gig is over, and searched for tunes with the same picker used for composers. Reorder entries by dragging their handles or focusing a handle and pressing the up/down arrow keys. Each entry links to the tune's score and can expand its details, and **Play** opens live mode: the score of the current tune full screen, with Previous/Next, a jump list and the `←` / `→` keys to move through the set. A tune's comment opens into a multi-line editor and is rendered as markdown, in the setlist and on stage — where it can sit above the score, in a left or right panel, in the footer, or be hidden. Zoom in/out is available in live mode and in the library's PDF viewer, which also lets you switch between a piece's scores; on stage a tune with several scores offers a picker to choose which one is shown, and a setlist entry can pre-select the score it plays.

Setlists can optionally have a date and time (stored as local calendar values, without a time zone). The activity heatmap shows past and upcoming dated setlists, including archived ones; use its navigation to browse other dates and select an entry to open it. Copies start without a date or time.

When adding a piece, a score to an existing piece, or teaching material, choose an existing PDF or use **Take photo** to capture pages one at a time. The photos are combined into a PDF on the device without automatic cropping. On supported iPhones and iPads, the installed app also offers **Scan document**: Apple's document scanner detects and crops pages, lets you review them, and combines them into a PDF on the device. The PDF contains scanned page images, without text recognition. The iOS app must be rebuilt and reinstalled to add the native scanner.

For score tags, tap an existing custom tag to select it, or type a new one.
The Library tag filter matches tags on pieces as well as tags on any of their scores.
Missing-data filters find pieces with neither a YouTube nor a Spotify link, without scores, or with at least one score missing a key or tags. Pieces with no scores are listed only by the missing-scores filter, not by the score key or tag filters.
Edit score tags directly in the PDF viewer. **Browse scores** opens all scores of the currently filtered pieces in their sorted order, including every score of a matching piece; Previous and Next retain that selection while you edit. Swipe left or right over the score to move between scores on touch devices. When the score is zoomed wider than the screen, swiping pans it instead; reset zoom to browse by swiping. In table view the table sort determines the order.

The **Videos** page shows YouTube links from the library. Turn on random order to shuffle the feed, shuffle again for a new order, or turn it off to return to the original order.

**Settings** stores each user's theme, library defaults (view, sort, filter and instrument), and video order in Supabase so they apply across devices. The default view can instead remember the last view on each device. Changes in the library and video pages are temporary, except for the remembered view. Settings also contains **Download backup**; the export includes saved preferences, or reports an error if they could not be included.

The **Lessons** page keeps dated lesson notes with a Markdown preview, links to library tunes, and reusable teaching-material PDFs. Create lesson groups for each teacher and instrument, then assign lessons to them and filter the lesson list and activity by group. Existing lessons remain unassigned until you assign them in the lesson editor. Move or delete a group's lessons before deleting the group. Add tags to materials when uploading or afterwards, filter the material library by tag, or search for materials by tag when linking them. Select a linked tune to see its details and score, or a linked material to open its PDF. Its activity heatmap shows past lessons and opens them by date; future lessons remain in the lesson list until their date arrives. The preview supports nested numbered and bulleted lists; indent subitems beneath their parent. Save note edits explicitly. Teaching materials are stored separately from scores and can be linked to multiple lessons; deleting a lesson leaves its tunes and materials intact. The backup includes lesson groups, lessons, links and material PDFs.

See [docs/improvements.md](docs/improvements.md) for the improvement backlog.

## Setup
1. Create a Supabase project and install the [Supabase CLI](https://supabase.com/docs/guides/cli).
2. From the repository root, authenticate and link the project:
   ```sh
   supabase login
   supabase link --project-ref <project-ref>
   ```
3. Apply migrations with `supabase db push`. The CLI applies pending files in `supabase/migrations` in order and records them in the remote migration history. For a fresh project, this creates the `sm_composers` and `sm_pieces` tables, row-level security, the private `sheet-music` storage bucket, and database validation for piece links.

   Apply `0018_setlist_planning.sql` before deploying the setlist planning features; it preserves existing setlists and entries. Apply `0019_reorder_setlist_entries.sql` for drag-and-drop reordering of setlist tunes, `0020_setlist_archive_and_duplicate.sql` for archiving and duplicating setlists, `0021_piece_scores.sql` for multiple PDF scores per piece (it moves each existing piece PDF, key and instrument into a score row and drops the old piece columns), `0022_setlist_entry_score.sql` to pre-select which score a setlist entry plays, `0023_score_lead_sheet.sql` to mark a score as a lead sheet, `0024_music_lessons.sql` before deploying lessons, `0025_teaching_material_tags.sql` before deploying material tags, `0026_lesson_groups.sql` before deploying lesson groups, `0027_setlist_schedule.sql` before deploying setlist scheduling, `0028_user_settings.sql` before deploying user settings, and `0029_score_tags.sql` before deploying score tags. The last migration converts existing instruments and lead sheets into tags.

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
