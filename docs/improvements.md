# Improvement ideas

Backlog of open improvements, grouped by area. Effort: **S** (hours), **M** (a day or two), **L** (several days). Priority: 🔴 high, 🟡 medium, 🟢 nice to have.

## Security

| Pri | Effort | Item |
| --- | --- | --- |
| 🔴 | S | **Upload limits.** Restrict the `sheet-music` bucket to `application/pdf` with a max file size (bucket `file_size_limit` / `allowed_mime_types`). Today only the client checks the type. |
| 🔴 | S | **Verify storage policy scoping.** Confirm the `own pdfs` policy ties objects to `auth.uid()` via the path prefix for select, insert, update and delete. Add a test with a second user. |
| 🟡 | S | **Bound text fields.** Add length checks (title, notes, composer name) and array-size limits where still missing (links, instruments). |
| 🟡 | M | **Password policy and email confirmation.** Enforce a minimum password length and require email confirmation. Add a password reset flow and optionally MFA. |
| 🟡 | S | **Security headers.** Set CSP (`default-src 'self'`, allow the Supabase host and the required YouTube player and thumbnail hosts), `X-Content-Type-Options`, `Referrer-Policy` and `frame-ancestors 'none'` on the hosting layer. Preserve the referrer required by YouTube playback. |
| 🟢 | M | **Rate limiting** on auth and upload endpoints (Supabase auth rate limits, plus an Edge Function for uploads if added). |

## UI / UX

- 🟡 **Keyboard accessibility.** Make every icon button reachable and labelled. Add arrow-key support to the progress slider and `Esc` to close inline editors; check focus trapping and restoration in the PDF modal. Run an axe / Lighthouse pass. (M)
- 🟡 **Remember filters and sort.** The view is stored in `localStorage['sm:view']`; do the same for filter, sort and search. (S)
- 🟡 **Find composers and videos.** Add search and filtering to the Composers and Videos pages so larger collections remain easy to navigate. (M)
- 🟡 **Protect unfinished work.** Warn before reload or sign-out when a form has unsaved changes or an undoable deletion is pending. (M)
- 🟡 **Drag and drop.** Drop a PDF anywhere to add a piece. Drag cards between Board columns to change progress. (M)
- 🟡 **Bulk actions.** Multi-select pieces to change progress or instrument, or to delete. (M)
- 🟢 **Thumbnails.** Render page 1 of each PDF as a cover for the Grid view. (M)
- 🟢 **Undo for more actions.** Extend the undo toast to rename, progress changes and composer delete. (S)
- 🟢 **Language switch** (EN/DE). Move strings to a small i18n layer. (M)

## Features

- 🔴 **Practice sessions with duration.** Store minutes per practice entry, not only a date, and show weekly/monthly totals. (M)
- 🟡 **Goals and reminders.** Weekly practice goal, plus an optional "not practised in N days" nudge. (M)
- 🟡 **Setlists / playlists.** Group pieces for a concert or lesson independent of the composer. (L)
- 🟡 **Import / export.** Export the library as JSON/CSV and import it back, so the data is never locked in. (M)
- 🟡 **Metadata fields.** Key, tempo, opus number, year, and source (book / IMSLP). Add them to search. (M)
- 🟢 **Multiple files per piece.** Score, parts, fingering versions. (L)
- 🟢 **IMSLP lookup.** Search by title and composer to prefill metadata and link. (L)
- 🟢 **PDF annotations / bookmarks** in the preview modal, or at least a "jump to page" bookmark. (L)
- 🟢 **Sharing.** Read-only public link to a composer or setlist. (L)
- 🟢 **Installable PWA** with offline access to recently opened PDFs. (M)

## Refactoring

- 🟡 **Data layer.** Move Supabase calls out of hooks/components into one `api/` module with typed return values and a single error-handling path. Consider TanStack Query for caching, optimistic updates and retries. (M)
- 🟡 **Typed database client.** Generate types with `supabase gen types typescript` instead of the hand-written `Piece` type in `supabase.ts`. Also replace `select('*')` with explicit columns. (S)
- 🟡 **Split `App.css`.** Use CSS modules or one file per component. Extract repeated colours (progress levels) into tokens. (M)
- 🟡 **Fix the `set-state-in-effect` lint warning** around data loading by reducing synchronous `setState` work inside effects. (S)

## Data and backend

- 🔴 **Make deletion and PDF cleanup reliable.** A deletion currently removes PDFs before confirming the database delete, and its delayed timer can be interrupted. Keep records and files consistent on failure or reload, and surface cleanup errors. Coordinate with the orphan-cleanup work below. (L)
- 🟡 **Keep practice dates consistent.** The practice log and `last_practiced` are written separately, and the latter update's error is ignored. Make the updates reliable together and report failures. (M)
- 🟡 **Complete practice history.** The client loads at most 5,000 practice entries but calculates the best streak from that result. Paginate or aggregate history so streaks remain accurate and load failures are visible. (M)
- 🟡 **Indexes.** Add indexes on `sm_pieces(user_id, composer_id)` and the practice log `(user_id, practiced_on)`. (S)
- 🟡 **Normalise links.** If links need metadata (title, added date), move them from an array/JSON column to a `sm_piece_links` table. (M)
- 🟡 **Orphan cleanup.** Deleting a piece removes its PDF from the client; do this server-side (trigger or Edge Function) so storage never leaks files. (M)
- 🟢 **Backups.** Schedule exports of the database and bucket. (S)
- 🟢 **Server-side search.** Use Postgres full-text search if the library grows beyond what client filtering handles. (M)

## Quality and tooling

- 🟡 **Video player resilience.** Show an actionable error and retry or YouTube link when the iOS player cannot load a video; ensure browser embeds meet YouTube's 200 × 200 minimum on narrow screens. (M)
- 🟡 **iOS build checks.** Add a macOS CI job that builds the Capacitor iOS app without production credentials, and cover native player presentation and dismissal with an iOS UI test. (M)
- 🟡 **Expand component tests.** Add coverage for the progress slider, calendar, filters, and `practicedText`. (M)
- 🟡 **End-to-end tests** (Playwright): login, add piece with PDF, change progress, practise today, delete with undo. (M)
- 🟡 **Error monitoring** (e.g. Sentry) for failed uploads and saves. (S)
- 🟢 **Formatter and pre-commit hooks** (Prettier or Biome, lint-staged). (S)
- 🟢 **Documentation.** Add a short architecture note and a deploy guide (`env`, Supabase migrations, hosting headers, storage policies). (S)

## Suggested order

1. Security basics: bucket limits and storage policy test; prevent data loss during deletion.
2. Make practice records and history reliable, then improve video error recovery.
3. Expand automated coverage, including iOS builds and the main user workflows.
4. Add a data layer (`api/` module) with centralized error handling.
5. Features with the most daily value: practice duration, remembered filters, bulk actions.
6. Polish: accessibility pass and PWA/offline.
