# League Board read recovery verification

Date: 2026-09-28. Branch: `board-read-recovery`, based on
`origin/league-night-mode` at `1213878` after PR #71 merged.

## Reported defects

The Codex GitHub review reported two P2 issues in PR #71:

- [Feed content disappearing on failed follow-up reads](https://github.com/rdd-cmyk/Rochester-Darting-Degens/pull/71#discussion_r4124136562).
- [Loaded and confirmed recent replies disappearing on read errors](https://github.com/rdd-cmyk/Rochester-Darting-Degens/pull/71#discussion_r4124136570).

Both were reproduced against the merged source before implementation. New
component regressions also failed against the original error handlers.

## Resulting behavior

Refresh and pagination failures preserve the last successfully loaded feed,
pin and reply arrays, keeping open conversations, unfinished drafts and
recently confirmed replies visible. Errors include explicit Retry controls.
A successful retry replaces stale bodies and removes hidden/deleted content.
Unsuccessful reads do not change the loaded page count or pagination cursor.

Explicit access denials and unavailable conversations still clear cached
content. The shared error classifier recognizes the Board permission
exception, JWT authentication errors and HTTP
401/403 responses, including responses without a PostgREST code. API wrappers
retain HTTP status alongside existing error details. Concurrent feed/pin or
recent-reply failures prioritize access denial over network errors.
Identity/membership changes retain the existing private-content unmounting.

Authentication status mappings were checked against
[PostgREST error documentation](https://docs.postgrest.org/en/stable/references/errors.html).
No SQL, dependency versions, lockfile or hosted configuration changed.

## Local verification

- `npm run ci:install`: passed; trusted install-script approvals current and
  reported audit vulnerabilities zero.
- `npm test` and `npm run test:coverage`: 315 tests across 38 files passed;
  configured coverage gates passed. This adds 26 focused regression cases.
- `npm run lint`, `npm run typecheck` and `npm run build`: passed.
- The guarded local production preview build passed.
- Nine production-browser scenarios passed, including the six existing Board
  cases and three additions: feed refresh/pagination outages with draft/pin
  retention and retry; reply pagination/refresh/recent-read outages with a
  confirmed saved reply, hidden-content removal on retry and unavailable
  conversation invalidation; and uncoded HTTP authentication/access failures
  clearing cached feed and reply content.

The existing two-page browser scenario now starts its read after its fixtures
are inserted, avoiding an initial-read race that could remember an older
feed boundary and load all fixture rows before its pagination assertion.

Browser checks used fresh temporary local accounts, blocked nonlocal network
requests and removed only their own users/content afterward. Interactive demo
accounts and other worktrees' Supabase stacks were preserved. Database/Auth
and browser evidence is local; no hosted schema, policies or production data
was changed, and there is no deployable SQL under `supabase/migrations/`.
