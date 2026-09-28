# Plan & RSVP implementation handoff

Date: 2026-09-27. Branch: `league-night-planning`.
Worktree: `F:\RDD\Rochester-Darting-Degens-league-night-planning`.
Status: implemented and locally verified; hosted rollout remains deferred.

Independent review and verified fixes are recorded in
[`league-night-planning-review-2026-09-27.md`](league-night-planning-review-2026-09-27.md).
The branch is rebased onto the published `league-night-mode` parent. Conflict
resolutions and repeated checks are recorded in
[`league-night-planning-rebase-2026-09-27.md`](league-night-planning-rebase-2026-09-27.md).

## Delivered behavior

- `/league-night/plan`, reachable through the new League Night lobby card.
  The card advances past started events against server-adjusted time without
  requiring a focus change. It refreshes the calendar at an event transition;
  cached following events still advance if that read fails.
- Organizer drafts, publication, date-only / venue-only / combined polls,
  fixed context, manual-only closure or an exact Rochester-time deadline,
  early closure, cancellation, and copying into a new draft.
  Cancelling an unpublished draft retains organizer history without exposing
  its contents or counting it in members' poll lists.
- Select-all-that-work ballots; one vote per profile per option. Ballot
  revisions prevent stale-device overwrites. Individual ballots are private;
  only own selections and aggregate totals are returned. Organizers can see
  combined support for a selected date/venue pair.
- Two member suggestions total per poll across categories. Duplicate venues
  normalize case/whitespace. Withdrawal keeps history and consumes its original
  allowance. New suggestions do not inherit votes.
- Explicit result review before scheduling, including a reason when selecting
  an option with fewer votes. One scheduled night per poll. Direct scheduling
  works without a poll, and several future nights can coexist.
- Going / Not going only. Missing responses remain unanswered. Each profile
  controls its own response; participants see profile names and response totals.
- Changes to date/time/venue require reconfirmation; old responses are retained
  but excluded from current totals. Cancellation and RSVP cutoffs stop writes.
  An event change requires a future RSVP cutoff or an empty cutoff (defaults
  to the new start). Title/notes corrections can retain an elapsed cutoff.
- The same night ID opens existing match entry. RSVP does not create actual
  attendance records or alter match-edit permissions.
- User-scoped pending requests survive interrupted confirmation and reloads.
  Retrying preserves operation ID and payload. Cross-tab storage reservation,
  server replay records, row locks and revisions prevent duplicate or stale
  mutations. A newer pending request cannot be erased by an older response.

## Server authority and time

`rdd_private.planning_organizers` is the trusted organizer source. It has no
client grants or policies. No profile field, signup metadata, or browser flag
grants organizer privileges. Signed-in profiles can participate. The separate
Board and invite-only branches were not imported.

All planning tables are in `rdd_private`, have RLS enabled and no client table
access. `rdd_planning_read` returns eligible drafts, public-to-signed-in planning
data, own ballot/RSVP state, and permitted aggregates. `rdd_planning_write`
checks authentication and action permissions, validates input, serializes
mutations and records idempotent outcomes. Both definer functions pin their
search path; grants are explicit. User identity comes from authentication.
`rdd_planning_night_status` provides authenticated lifecycle labels to the
existing lobby and direct night links, including cancelled historical nights.
It uses the same pinned search path and explicit permission boundary.

Poll deadline closure is derived from server time and checked after acquiring
the poll lock. It works without a cron job or an open browser. RSVP cutoff is
checked after locking the schedule. Times are interpreted in America/New_York;
DST gaps and ambiguous repeated hours are rejected with an explanatory error.

Lists page in groups of 20. Scheduled nights remain visible until 12 hours after
their start so the current night remains easy to open. Earlier match history
continues to live in League Night / Matches. No recurrence or outbound
notifications are included.

## Local preview

The dedicated stack is `rdd-league-planning`, API `http://127.0.0.1:55821`,
app `http://127.0.0.1:3030`, generated workdir `.local/league-planning`.
It does not reuse or reset the League Night, Board, or statistics databases.

```powershell
npm run ci:install
npm run plan:local -- start
node scripts/rehearse-planning.mjs
npm run plan:local -- build
node scripts/planning-demo.mjs
npm run plan:local -- serve
```

Open `/league-night/plan`. Synthetic organizer/member login details are in
`.local/planning-demo.md`, ignored by Git. All demo venues and accounts are
fictional. Browser acceptance also leaves explicitly named QA fixtures dated
2090. `plan:local -- stop` stops only this stack.

The local runner checks stack identity, loopback bindings and the expected API
port before accessing credentials or applying fixtures. Fresh rehearsal creates
a uniquely named database, applies the legacy schema and both feature schemas,
runs planning and existing League Night tests, then refreshes the tested
planning functions, publication metadata and reviewed venue constraint on this
task's preview. The local-only publication upgrade recognizes cancelled polls
as published only when successful publication replay records establish it;
unknown cancelled history stays private.
Rehearsal databases are retained as evidence; no reset or hosted command occurs.

## Verification

- Trusted clean lockfile installation passed; dependency audit reported zero
  vulnerabilities. `package-lock.json` is unchanged.
- Application suite after PR review fixes: **257 tests, 31 files passed** in
  the coverage run. Coverage includes the new
  planning module and passes the configured thresholds: 98.13% lines,
  91.62% branches overall. This is instrumented application coverage, not a
  database or accessibility coverage measure.
- Fresh legacy-only rehearsal: **85 planning checks + 36 League Night checks**.
  Covers permissions, draft privacy, spoofed identity, unchanged legacy schema,
  DST handling, publication, replay, immutable published polls, manual and
  deadline closure, suggestion normalization/cap/withdrawal, private ballots,
  stale revisions, scheduling, binary RSVPs, reconfirmation, and late writes.
  Review regressions also cover title/notes edits retaining elapsed RSVP
  cutoffs, a future reconfirmation window for event changes, authenticated
  cancellation status reads, cancelled draft privacy and publication backfill.
- Browser acceptance on the production build: organizer publication/closure/
  scheduling; separate member account; actual concurrent suggestions (exactly
  two of three accepted); private ballots/aggregate overlap; RSVP changes;
  lost response after a committed write followed by safe replay; rescheduling;
  same-night handoff without fabricated attendance; date-only, venue-only and
  direct scheduling; cancellation and replay. PR follow-up scenarios verify
  cancelled unpublished drafts and explicitly reopening an elapsed cutoff
  before an event change. Automatic lobby-card rollover was also verified with
  a mocked browser response whose server clock is an hour ahead; no near-start
  database records were written for that scenario. No page JavaScript errors.
- Layout checks at 320, 390, 768 and 1440 pixels; desktop/mobile/dark screenshots
  reviewed. Browser artifacts are ignored under `.qa-artifacts/planning`.
- Lint, TypeScript and production build passed. The full screen-reader and
  human usability acceptance remain owner review, not an automated claim.

## Deployment and integration boundary

The branch is published in [PR #70](https://github.com/rdd-cmyk/Rochester-Darting-Degens/pull/70),
targeting `league-night-mode`. No merge or hosted database rollout was performed.
No hosted SQL, hosted accounts, real player data, or production configuration
was changed. The original League Night worktree was not modified; its copied
source provenance is recorded in `league-night-planning-source.json`.

Before release, reconcile the parent League Night work and any chosen account
integration, follow `supabase-github-integration-release-gate.md` and the parent
League Night rollout document, confirm backup/restore and migration-history
adoption, approve exact SQL and target, and assign organizers using trusted
database administration. Never infer a real organizer from profile metadata.

SQL stays at `supabase/tests/fixtures/league_planning.sql`; no deployable
migration was added. Real organizer assignment is intentionally unperformed.
An authorized administrator can insert a reviewed profile UUID into the private
organizer table when the hosted rollout is separately approved. There is no
public self-enrollment endpoint.

The implementation uses additive schedule metadata on existing night IDs.
Rollback planning routes/RPC permissions rather than dropping shared night or
match records. Preserve replay records for outstanding clients until requests
are reconciled. Review this against the eventual deployment plan.
