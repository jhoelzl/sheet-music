# Improvement ideas

Backlog of open improvements, grouped by area. Effort: **S** (hours), **M** (a day or two), **L** (several days). Priority: 🔴 high, 🟡 medium, 🟢 nice to have.

## Security

| Pri | Effort | Item |
| --- | --- | --- |
| 🔴 | S | **Server-side link validation.** `safeUrl` only runs in the browser. Add a `check` constraint or trigger on the piece links so only `http(s)` URLs can be stored, even through direct API calls. |
| 🔴 | S | **Upload limits.** Restrict the `sheet-music` bucket to `application/pdf` with a max file size (bucket `file_size_limit` / `allowed_mime_types`). Today only the client checks the type. |
| 🔴 | S | **Verify storage policy scoping.** Confirm the `own pdfs` policy ties objects to `auth.uid()` via the path prefix for select, insert, update and delete. Add a test with a second user. |
| 🟡 | S | **Bound text fields.** Add length checks (title, notes, composer name) and array-size limits where still missing (links, instruments). |
| 🟡 | M | **Password policy and email confirmation.** Enforce a minimum password length and require email confirmation. Add a password reset flow and optionally MFA. |
| 🟡 | S | **Security headers.** Set CSP (`default-src 'self'`, allow the Supabase host), `X-Content-Type-Options`, `Referrer-Policy` and `frame-ancestors 'none'` on the hosting layer. |
| ✅ | S | **Dependency hygiene.** `npm audit --audit-level=high` runs on every pull request. |
| 🟢 | M | **Rate limiting** on auth and upload endpoints (Supabase auth rate limits, plus an Edge Function for uploads if added). |

## UI / UX

- 🟡 **Keyboard accessibility.** Make every icon button reachable and labelled. Add arrow-key support to the progress slider and `Esc` to close the PDF modal and inline editors. Run an axe / Lighthouse pass. (M)
- 🟡 **Remember filters and sort.** The view is stored in `localStorage['sm:view']`; do the same for filter, sort and search. (S)
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
- 🟢 **Replace magic values** (`WEEKS = 26`, signed URL TTL `3600`, bucket name) with named constants in one config file. (S)

## Data and backend

- 🔴 **Migration workflow.** Migrations are run by hand. Adopt the Supabase CLI (`supabase db push`) so they are applied in order and tracked. (S)
- 🟡 **Indexes.** Add indexes on `sm_pieces(user_id, composer_id)` and the practice log `(user_id, practiced_on)`. (S)
- 🟡 **Normalise links.** If links need metadata (title, added date), move them from an array/JSON column to a `sm_piece_links` table. (M)
- 🟡 **Orphan cleanup.** Deleting a piece removes its PDF from the client; do this server-side (trigger or Edge Function) so storage never leaks files. (M)
- 🟢 **Backups.** Schedule exports of the database and bucket. (S)
- 🟢 **Server-side search.** Use Postgres full-text search if the library grows beyond what client filtering handles. (M)

## Quality and tooling

- ✅ **Unit and component tests.** Vitest and Testing Library cover login/account creation, URL safety and provider detection, progress cycling, sorting and tag normalization. Run locally with `cd app && npm test`. (Initial coverage)
- 🟡 **Expand component tests.** Add coverage for the progress slider, calendar, filters, and `practicedText`. (M)
- 🟡 **End-to-end tests** (Playwright): login, add piece with PDF, change progress, practise today, delete with undo. (M)
- ✅ **CI.** GitHub Actions runs lint, tests and a production build on every PR. The `tests` and `dependency-audit` checks are required by the `main` ruleset before merging. (Implemented)
- 🟡 **Error monitoring** (e.g. Sentry) for failed uploads and saves. (S)
- 🟢 **Formatter and pre-commit hooks** (Prettier or Biome, lint-staged). (S)
- 🟢 **Documentation.** Add a short architecture note and a deploy guide (`env`, Supabase migrations, hosting headers, storage policies). (S)

## Suggested order

1. Security basics: server-side link check, bucket limits, storage policy test.
2. Expand automated coverage with interaction tests, then add Playwright end-to-end tests for the main user workflows.
3. Adopt Supabase CLI migrations and add a data layer (`api/` module) with centralized error handling.
4. Features with the most daily value: practice duration, remembered filters, bulk actions.
5. Polish: accessibility pass and PWA/offline.
