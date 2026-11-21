# Improvement ideas

Backlog of proposed improvements, not a commitment to implement them. Effort: **S** (hours), **M** (a day or two), **L** (several days). Priority: 🔴 high, 🟡 medium, 🟢 nice to have.

## Current baseline

- The library has multiple scores per piece, score tags and keys, four views, search, filters, a practice calendar, and a PDF/image viewer with zoom and score navigation.
- Setlists support ordered tunes, comments, scheduling, archiving, duplication, keyboard reordering, and a live performance view.
- Lessons support groups, dated notes, linked tunes, and reusable teaching materials. Materials can be linked to individual lessons, tagged, filtered, scanned, and browsed together; the material section is collapsed by default.
- PDF/photo uploads and the iOS document scanner show preparation, upload, and save stages. Existing-score and material retries retain the document and reuse an upload identity; new-piece uploads report partial saves. Requests time out rather than waiting indefinitely.
- Page, selection, and filter state is stored in the URL. Settings sync theme and library defaults across devices; manual ZIP backups include data and documents.
- The installed iOS app loads the deployed website. Web-only updates do not normally require reinstalling; native or Capacitor changes do. See [the iOS guide](../app/README.md).

See the [README](../README.md) for the full feature overview.

## Security

| Pri | Effort | Item |
| --- | --- | --- |
| 🔴 | M | **Upload limits and validation.** Define and enforce size and type limits on the server, not just in the client. Account for existing image scores as well as PDFs, and avoid blocking existing files or backup/restore workflows. Inspect the deployed bucket configuration before changing it. |
| 🔴 | M | **Test account isolation.** The migrations scope the storage policy to the user's path prefix and enable row-level security. Add integration tests with two users for storage and all linked records, including lessons, materials, scores and setlists; verify the deployed policies match the migrations. |
| 🟡 | M | **Bound text and arrays.** Review missing server-side limits for titles, notes, tags, links and instruments; surface validation errors clearly in the app. |
| 🟡 | M | **Account recovery and authentication.** Review the deployed password and email-confirmation settings, add password reset, and consider MFA. |
| 🟡 | M | **Hosting security headers.** Evaluate CSP, content-type and referrer protections on the actual hosting layer. Preserve Supabase, document loading, and the YouTube player/referrer requirements. |
| 🟢 | M | **Rate limiting.** Review Supabase auth and upload limits; consider a server-side upload endpoint if finer controls are needed. |

## Reliability and data

- 🔴 **Reliable deletion and cleanup.** Piece deletion currently waits through an undo timer and removes score files before the database delete is confirmed; storage errors are not surfaced there. Design recoverable deletion and orphan cleanup for pieces, scores, composers and materials, including reloads and partial failures. (L)
- 🔴 **Investigate intermittent scan uploads.** Reproduce failures on physical iPad/iPhone and capture privacy-safe stage, timing and error diagnostics. The timeout and retry UI improve recovery, but do not establish the underlying cause. (M)
- 🟡 **Recover uploads after navigation or restart.** Persist enough retry identity and draft state to resume safely, without duplicating a record or discarding a request that may still complete. Protect unsaved scans and uploads before leaving or reloading. (L)
- 🟡 **Consistent practice dates.** The practice log and `last_practiced` are written separately and the latter update's error is not checked. Make them consistent together and report failures. (M)
- 🟡 **Complete practice history.** The client loads at most 5,000 practice entries; paginate or aggregate so history and streak calculations remain accurate for larger libraries. (M)
- 🟡 **Restore a backup.** Import the exported ZIP, including scores, materials, settings, lessons and setlists. Validate ownership and references, preview conflicts, and offer a safe recovery strategy. (L)
- 🟡 **Database performance.** Measure real queries and add indexes only where needed. The practice log already has a `(user_id, practiced_on)` index; review multi-composer, material and lesson queries as collections grow. (M)
- 🟡 **Normalise links.** If links need metadata such as title or added date, move them from the piece's array/JSON column into a related table. (M)
- 🟢 **Scheduled backups.** Automate database and bucket exports and periodically verify that a restore works. (M)
- 🟢 **Server-side search.** Consider Postgres full-text search or pagination if client-side filtering becomes slow for large libraries. (M)

## Teaching and practice

- 🟡 **Materials by lesson group.** Optionally associate a material with one or more groups, while keeping unassigned materials shared. With a group selected, show its materials plus shared ones; retain optional lesson-level links and do not delete documents when a group is removed. (M)
- 🟡 **Practice sessions with duration.** Record minutes per practice entry and show weekly/monthly totals without losing existing date-only history. (M)
- 🟡 **Goals and reminders.** Offer an optional weekly practice goal and a configurable reminder for pieces not practised recently. (M)
- 🟡 **Lesson follow-up.** Add optional homework or action items to a lesson, with completion state and a way to carry unfinished items forward. (M)
- 🟢 **Material discovery.** Search material titles as well as tags, and optionally show recently used documents or the lessons that reference them. Keep the compact collapsed view. (M)
- 🟢 **Scan enhancements.** Offer optional OCR/searchable text, page rotation and reordering after capture, and clear size/quality guidance. Keep document processing private and avoid implying existing scans already contain text. (L)
- 🟢 **Practice aids.** Consider a metronome and per-piece tempo target, with an unobtrusive layout suitable for iPad. (M)

## Library, scores and setlists

- 🟡 **PDF annotations and bookmarks.** Add page bookmarks and annotations with a clear save/export model, without altering the original file unexpectedly. (L)
- 🟡 **More metadata.** Add optional tempo, opus number, year and source fields, and include them in search. Musical key already exists per score. (M)
- 🟡 **Bulk actions.** Multi-select pieces to change progress or instrument, add tags, or delete with a clear confirmation and recovery path. (M)
- 🟡 **Drag and drop.** Drop a document to add a piece or score, and optionally move Board cards between progress columns. Setlist reordering already supports drag and keyboard. (M)
- 🟡 **Offline performance.** Make explicitly selected scores and setlists available offline, with storage limits, sync status and a clear way to remove cached files. The current iOS app requires internet on launch. (L)
- 🟢 **Thumbnails.** Render the first page of a PDF or image as a Grid cover, with sensible memory and storage limits. (M)
- 🟢 **Duplicate detection.** Identify possible duplicate documents or pieces during import without silently blocking deliberate duplicates. (M)
- 🟢 **IMSLP lookup.** Search by title and composer to prefill metadata and link to a source. (L)
- 🟢 **Sharing.** Explore explicit, revocable read-only sharing for a setlist or document, with access controls and copyright considerations. (L)
- 🟢 **Setlist rehearsal.** Track rehearsal notes or readiness per tune separately from performance comments. (M)

## UI / UX

- 🟡 **Accessibility audit.** Check keyboard operation, labelled controls, focus management, touch targets, contrast and screen-reader announcements across pages and viewers; run an axe/Lighthouse pass. The viewer already handles focus and Escape, and the progress control is a native range input. (M)
- 🟡 **Find composers and videos.** Add search and filtering on those pages for larger collections. (M)
- 🟡 **Protect unfinished work.** Extend the existing lesson-edit warnings to other drafts, pending uploads and undoable deletions on navigation, reload and sign-out. (M)
- 🟡 **Remember more preferences.** URL state already restores filters and sort on refresh; consider explicitly saving additional personal defaults across devices without overriding a shared URL. (M)
- 🟢 **Undo for more actions.** Extend undo to selected renames and edits where recovery is safe. (M)
- 🟢 **Language switch.** Move user-facing strings into an EN/DE internationalisation layer. (M)

## Engineering and quality

- 🟡 **iOS build and device checks.** Add a macOS CI build without production credentials and device/UI coverage for scanner, upload recovery, player presentation and viewer navigation. (M)
- 🟡 **End-to-end tests.** Cover login, score/material upload and retry, lesson links, setlist playback, backup, and deletion/undo in a dedicated test environment. (L)
- 🟡 **Video player resilience.** The app already shows a YouTube link and reports native player-opening failures. Detect playback/load failures where possible, offer retry, and check embed sizing on narrow screens. (M)
- 🟡 **Privacy-aware error monitoring.** Report actionable upload and save failures without collecting document contents, private filenames, credentials or sensitive URLs. (M)
- 🟡 **Data layer and types.** Consolidate Supabase access and error handling where useful; generate database types and replace remaining broad `select('*')` queries with explicit columns. (L)
- 🟡 **Maintainability.** Split `App.css` where it improves ownership, and address existing `set-state-in-effect` lint warnings without changing behaviour. (M)
- 🟢 **Formatter and pre-commit hooks.** Evaluate a formatter and targeted staged checks without disrupting the existing toolchain. (S)
- 🟢 **Architecture and operations guide.** Document major data flows, deployment, migration reconciliation, backup/restore and the distinction between web and native device updates. (M)

## Suggested order

1. Investigate upload failures and make deletion/cleanup recoverable; verify account isolation and upload limits.
2. Make practice records consistent and plan safe backup restoration.
3. Add lesson-group material associations and improve protection for unsaved work.
4. Expand end-to-end and iOS coverage, then address video recovery and accessibility.
5. Prioritise practice duration, annotations and offline setlists according to daily use.
