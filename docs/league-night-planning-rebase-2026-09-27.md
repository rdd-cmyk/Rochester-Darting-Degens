# Planning rebase onto League Night Mode

Target: `origin/league-night-mode` at
`ff7e0fe94c1233dc58572b89c22bd9570fed83bb`.
Planning branch: `league-night-planning`. PR preparation was authorized by the
owner on 2026-09-27, including rebase and conflict resolution.

The original planning commit copied an uncommitted League Night snapshot.
Rebasing onto the published parent therefore produced 12 conflicting files.
Resolved shared application/configuration files by retaining the planning
integration on top of the parent implementation. Kept the parent's three newer
publication/audit documents unchanged. Removed formatting-only edits from the
shared League Night page; its planning delta is now 10 added lines. The parent's
database contract, match entry, recovery and recap implementation are unchanged.

Validation after resolution:

- Trusted clean lockfile installation passed; zero audit vulnerabilities.
- `npm test` and `npm run test:coverage`: 251 tests in 30 files passed in each.
  Coverage thresholds passed: 98.13% lines, 91.62% branches.
- Lint, type checking and the guarded local production build passed.
- Fresh database rehearsal: 67 planning and 36 inherited League Night checks.
  Retained local database: `rdd_planning_rehearsal_1790552739834`.
- Production-build browser acceptance passed, including parent-page integration,
  concurrent suggestions, response-loss replay, rescheduling, cancellation
  labels, and widths 320/390/768/1440. Ignored results are in
  `.qa-artifacts/planning/results.json`.
- No unresolved conflict markers or diff whitespace errors. Dependency versions
  and lockfile are unchanged; no SQL is under `supabase/migrations/`.

The PR target is `league-night-mode`. Branch publication and PR creation do not
apply hosted SQL or authorize merging into main. Hosted schema, backup/restore,
organizer assignment and deployment gates remain deferred.
