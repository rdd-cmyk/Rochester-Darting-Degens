# League Board PR review verification

Date: 2026-09-28. PR #71, `league-message-board` into `league-night-mode`.
Reviewed head: `fc513de`; parent base: `6b11f7d`.

## Verified findings and fixes

An independent agent reviewed the full PR without changing files, databases or
services. The primary agent reproduced each finding before applying a fix.

1. **Delayed saves could erase replacement drafts.** A pending create followed
   by navigation away/back restores the same draft key. Revising it before the
   old promise resolves previously let the old composer remove the new writing
   from session storage. The remount regression failed before the fix. Storage
   cleanup now compares the submitted UUID, body and topic; an unmounted
   composer cannot update UI state. Matching confirmed drafts still clear when
   the writer has navigated away. Separate tests cover both ownership and
   successful cleanup, including normal edit saves in the browser.
2. **Action refreshes discarded loaded feed pages.** Loading conversation 21
   and typing a reply before Cheers previously refreshed only conversations
   1-20, unmounting the open thread. The second-page regression failed before
   the fix. Refresh now revalidates the loaded window and replaces stale rows.
   Further review reproduced new activity pushing conversation 40 onto page
   three; reads now continue through the previously loaded activity/UUID
   boundary. This comparison preserves PostgreSQL's six fractional timestamp
   digits before its UUID tie-break. A neighboring-microsecond regression also
   failed before correction. Equal timestamps, refreshed deletion/body changes
   and pagination continuation are covered.

The independent agent re-reviewed the final fixes and tests and found no
remaining actionable issues. Existing generation guards discard obsolete
reads before state or loaded-window references change.

## Validation

- `npm run ci:install`: trusted lockfile install passed, zero reported audit
  vulnerabilities. No dependency versions or lockfile changed.
- `npm test`: 289 tests across 37 files passed, including eight new regression
  cases. The 17 focused composer/feed tests also passed.
- `npm run test:coverage`: all 289 tests and configured coverage gates passed.
- `npm run lint` and `npm run typecheck`: passed.
- `npm run build` and guarded local production preview build: passed.
- `npm run test:board:local`: all 60 transactional Board database checks passed
  against the inspected original loopback stack. Existing tables were detected;
  no schema fixture was replayed.
- Six production-browser scenarios passed: revised create retries after a lost
  response; loaded reply retention; organizer hiding of recent replies;
  navigation with a delayed save and a revised persisted draft; second-page
  reactions/edits after new activity, using actual neighboring PostgreSQL
  microsecond timestamps; and desktop/mobile Board, League Night and planning
  navigation. The browser allowed only the local app and local API. Fresh
  temporary identities and their content were removed afterward, preserving
  existing demo records and other worktrees' stacks.

SQL and the hosted rollout boundary are unchanged. All database/Auth/browser
acceptance evidence above is local. No hosted schema or production data was
changed. Deferred Board SQL remains outside `supabase/migrations/`.
