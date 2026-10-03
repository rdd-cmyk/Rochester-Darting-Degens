# League Board local handoff

Date: 2026-09-27; rebased and reverified on 2026-09-28. Branch:
`league-message-board`, originally based on `690a01b`, now based on
`origin/league-night-mode` at `6b11f7d`. The combined parent includes Plan & RSVP.
See [rebase verification](league-message-board-rebase-2026-09-28.md).
The later PR review and fixes are recorded in
[PR review verification](league-message-board-review-2026-09-28.md).
After PR #71 merged, read failure handling was corrected on `board-read-recovery`,
based on `origin/league-night-mode` at `1213878`. See
[read recovery verification](league-message-board-read-recovery-2026-09-28.md).

## Delivered behavior

`/board` provides one members-only feed with editable posting prompts, flat
replies, Cheers reactions, shareable `/board/[id]` conversations, and a genuine
empty state. Approved members see two recent conversations on the homepage.
The board supports light/dark appearance and narrow phone layouts.

Players request access after signing in. Organizers approve or revoke requests
and manage pinned/closed/hidden contributions and reports. Signup alone gives
no access. The first organizer is provisioned explicitly by the database owner.
Only one conversation can be pinned. Ordinary members cannot publish posts
labeled as announcements. Author deletion is confirmed in the UI; organizer
hiding is reversible. Editing and reactions do not bump conversations.

The server limits a member to five new posts and twenty new replies per ten
minutes, plus thirty writes per minute across board actions. Create retries use
stable UUIDs. Drafts are scoped to the signed-in account in session storage and
survive reload/sign-in in that browser tab; they clear after confirmed saves.
Delayed saves clear only the exact submitted draft, preserving newer writing
restored after navigation or an account change.
They are not synchronized across devices. If browser storage is unavailable,
the composer warns the writer to keep the page open.

An identical create retry returns the existing contribution. If an earlier
attempt saved but its response was lost, retrying with revised text or a changed
post type returns a conflict and keeps the revised draft. The writer can open
the saved conversation to edit it or explicitly prepare the draft as a separate
contribution; preparing it does not submit it. Replies use the same protection.

Refreshing a conversation revalidates every loaded reply page. Newly saved
replies beyond unopened pages remain visible under "Your recent replies" until
those pages are loaded. Revalidation removes hidden/deleted replies, including
for organizers, while retaining the loaded conversation window.
Feed refreshes also revalidate the previously loaded window and continue
through its prior boundary when new activity pushes it onto another page.
Open conversations and unfinished replies remain mounted through reactions
and edits, while hidden/deleted posts are removed.
Temporary refresh/pagination failures retain the last loaded conversations,
pin, replies and recently confirmed contributions. Retry revalidates that
window and removes hidden/deleted content. Explicit authentication or
permission failures and unavailable conversations clear the cached content;
sign-out, account changes and membership revocation still unmount private
board content.

Board access rechecks on sign-in changes, tab visibility, and every minute.
Server permissions apply to every request, including direct table/API access.
Previously rendered content can remain visible until the next client check;
revocation cannot erase content a member already saw. Board URLs and post IDs
remain outside the existing analytics allowlist. Post text is rendered as text,
without HTML, remote embeds, or attachments.

## Local setup and preview

Use the existing guarded local Supabase setup; do not reset its database.

```powershell
npm run ci:install
npm run board:setup:local
npm run test:board:local
node scripts/qa/board-preview.mjs
```

The setup command accepts only the inspected loopback stack, adds six new board
tables in a transaction, and refuses a partially installed board schema. It
does not replay existing fixtures or add memberships. It skips installation
when all six tables exist; schema changes after that require deliberate local
review rather than dropping or overwriting tables. The preview always builds
against local Supabase before serving at `http://127.0.0.1:3100`, leaving the
usual port 3000 free. Existing environment files remain unchanged.

The board test runner mounts the SQL tests read-only and runs pgTAP through the
inspected database container's network namespace at `127.0.0.1:5432`. This avoids
the CLI helper's shared `db` alias when another Supabase stack uses the same
Docker network. It does not change either stack's network configuration.
Board setup, preview and browser QA ignore an inherited `RDD_LOCAL_STACK`
selection in their own processes and always use the original board stack.

To rehearse the board alongside the parent League Night and planning SQL:

```powershell
node scripts/rehearse-board.mjs
```

This creates a new local database from Auth DDL and the legacy baseline, applies
all three additive features, and runs their transactional test suites. It retains
the rehearsal database for inspection and does not refresh any development
functions or change existing demo records.

The browser acceptance test uses the installed Playwright runtime:

```powershell
$env:RDD_PLAYWRIGHT_ROOT='<installed playwright package directory>'
node "$env:RDD_PLAYWRIGHT_ROOT\cli.js" test --config scripts/qa/board.config.mjs
```

It creates explicitly synthetic `board-*@example.test` accounts against the
verified local API. It resets board rows only for its three fixture identities
and retains them for inspection. `board-organizer@example.test` is its local
organizer; the synthetic password is defined in the QA script. Never use these
identities or credentials on hosting. Screenshots are under `test-results/board`.

The separate review regression suite creates fresh temporary identities and
removes only its own data afterward, preserving the interactive demo accounts:

```powershell
node "$env:RDD_PLAYWRIGHT_ROOT\cli.js" test --config scripts/qa/board-regressions.config.mjs
```

## Hosted rollout boundary

The additive SQL is `supabase/tests/fixtures/league_board.sql`. There is no SQL
under `supabase/migrations/`, so merging application code does not install the
board schema. When it is absent, the UI reports that the board is not ready;
it does not pretend the feed is empty.

Before rollout, follow `supabase-github-integration-release-gate.md`: refresh the
hosted schema/policies and migration history, establish a recoverable backup
and reviewed rollback, rehearse the additive fixture, and obtain authorization
for the exact database/application deployment. Do not apply the historical
baseline to an existing hosted database.

After the reviewed schema is installed, verify the intended organizer's Auth
UUID and profile, then have the database owner add exactly that identity:

```sql
insert into public.board_members (user_id, status, role)
values ('<verified-organizer-profile-uuid>', 'approved', 'organizer');
```

Do not derive organizer privileges from an email supplied in the browser,
profile fields, or user-editable Auth metadata. Further organizer changes also
require the database owner; ordinary access approvals are handled in the UI.
Before any rollback that removes board tables, preserve their content and
membership records. Reverting the application alone can leave the additive
schema and records intact while the feature is investigated.

## Verification

- Trusted lockfile install completed; no dependency versions changed.
- Initial application suite and configured coverage gate passed: 207 tests on
  2026-09-27. The combined rebased suite passes 281 tests on 2026-09-28.
  After the subsequent PR review fixes, all 289 tests and coverage pass.
- ESLint and TypeScript checks passed.
- Local-target production build passed with `/board` and `/board/[id]`.
- All 60 local board database checks passed, covering policy, ownership,
  moderation, pagination, deletion, rate limits, and identical/conflicting
  create retries. They roll back all synthetic SQL fixtures. The existing 25
  statistics database checks passed during the initial 2026-09-26 acceptance.
- Initial production-browser acceptance on 2026-09-26 covered sign-out privacy, access request and
  organizer approval, saved drafts, post/reply persistence, reactions, edits,
  homepage discovery, direct links, close/report/hide/restore, revocation, and
  375px light/dark layouts. The browser blocks nonlocal requests.
- The reload flow exposed and corrected an existing Summer setting hydration
  mismatch in the shared layout. A focused hydration regression test covers it.
- All three production-browser review regressions passed on 2026-09-27:
  committed creates with lost responses and revised retries (posts and replies),
  loaded reply pages retained after saves/reactions, and organizers hiding recent
  replies beyond unopened pages. Temporary test identities/content were removed.
- Independent source re-review found all three reported defects resolved and no
  additional actionable findings. The existing local database received only a
  backed-up replacement of `board_write`; its tables and demo data were preserved.
- Post-rebase verification on 2026-09-28 passes the trusted install, combined
  tests/coverage, lint, typecheck, standard and local production builds, 181 fresh
  combined database checks, 60 existing-board database checks, and four browser
  regression/navigation checks. Independent integration review found no
  actionable issues. The Board and parent organizer authorities stay separate.
- The subsequent independent PR review reported delayed-save draft loss and
  feed refresh truncation. Both were independently reproduced before fixing.
  Re-review expanded feed coverage to new activity and PostgreSQL microsecond
  cursor precision; final independent review found no actionable issues.
  Required application checks, 60 local Board database checks and six
  production-browser regression/navigation scenarios pass. Temporary browser
  identities/content were removed; existing demo accounts were preserved.

All evidence is local. No hosted schema, hosted auth/RLS, deployed application,
production data, or publication is claimed verified.
