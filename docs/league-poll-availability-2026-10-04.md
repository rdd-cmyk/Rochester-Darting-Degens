# League night date availability

Prepared on `feat/rivalry-power-rating`, 2026-10-04, from `7c1dcfb`.

## Delivered behavior

Date/time options use Preferred, Can attend, Maybe and Can't attend. Preferred
includes attendance. Clear response restores an unanswered date. Venue options
retain select-all-that-work checkboxes. One save writes both categories with
the existing ballot revision and recoverable operation identifier.

Members see their own selections while a poll is open. Date/venue totals,
participation counts and date recommendations are withheld; organizers can
inspect totals. Everyone sees date and venue totals after closure, including
deadline closure. Suggestion-author masking and admission checks are retained.

Best availability and the scheduling default prioritize can-attend totals,
then preferred totals. Ties use chronological order for display. An organizer
must explain choosing lower attendance/preference or a venue with fewer votes.
The organizer makes the final selection; scheduling never happens automatically.
Maybe is separate from confirmed attendance. Unanswered totals count people who
saved a ballot, not all league members. RSVP remains a separate subsequent step.

## Storage and compatibility

The additive fixture is
[`planning_availability.sql`](../supabase/tests/fixtures/planning_availability.sql).
It follows planning and parent-admission SQL and updates the private planning
implementation without replacing public admission wrappers. It adds a JSON
date-response map to private ballots; existing positive votes stay in the vote
table for venue counts and date/venue overlap. Existing date votes become Can
attend, never Preferred; missing votes stay unanswered. Ballot revisions and
original replay receipts are preserved.

Old clients can still submit checkbox ballots. A still-selected preferred date
keeps its preference, and explicit Maybe/Can't attend answers are retained when
an old client cannot edit them. A newly selected date becomes Can attend.
New writes reject invalid responses, non-date keys, withdrawn/foreign options,
UUID aliases for the same date, stale revisions and mismatched actor identities.

The new read advertises `availability_enabled`. On an older server the app
keeps existing checkboxes, avoiding unsupported responses silently being lost.
No SQL is under `supabase/migrations/`.

## Verification

- Locked installation, all 671 application tests, coverage, lint, typecheck and
  production build passed. Installation still reports the existing five high
  dependency findings; dependencies were not changed.
- 46 local pgTAP checks passed in a fresh synthetic temporary database, plus
  interrupted-upgrade rollback, exact original-vote preservation and successful
  reapplication. Checks cover private access, membership, all response states,
  unknown/clear semantics, venue voting, old clients, canonical UUIDs, stale
  ballots, request replay, closed results and scheduling support rules.
- Production-build browser checks with synthetic responses passed in both
  themes at 1440, 390 and 320px: member privacy, response saving alongside venue
  checkboxes, organizer totals, closed controls/results and attendance-first
  scheduling. Screenshots were visually reviewed; no page errors or horizontal
  overflow were observed. These are local browser results, not hosted acceptance.
- React state/accessibility review retained draft responses across feed refresh,
  explicit stale-ballot recovery, native radio/checkbox semantics, surface focus
  tokens, shared actions and 44px control targets.

Run `node scripts/rehearse-planning-availability.mjs` against the inspected
loopback W3 database container. It creates a separate temporary database and
does not change the interactive stack or any hosted project.

## Preview activation and rollback

The intended Preview database was freshly verified as **RDD Release Testing**,
`uepayhdrgzrxhkqbwebo`; the production project is outside this activation scope.
Read-only inspection confirmed the existing admission wrappers, original private
functions, private-table RLS/grants, three ballot columns, and the two existing
ballots/four votes. An affected-data/function snapshot was prepared in session.

**Hosted SQL has not been applied.** Automatic approval review rejected writing
that private snapshot to `F:\DB backups` and `D:\DB BackupsHD`, requiring explicit
approval of payload and destinations. No files were written by that rejected
command. The recovery-backup gate therefore remains open. Obtain that approval,
save/read/hash-check both copies, then prove recovery in an isolated database
before applying the additive fixture to Release Testing and verifying live RPCs.
The application changes alone retain checkbox voting until that update is active.

For application rollback, deploy `7c1dcfb` and retain the additive database
column/functions: tested old checkbox clients remain supported. Do not drop
date-response data after people have used the new controls. Database recovery
must reconcile writes made after the snapshot; restoring a stale snapshot must
never erase later responses. Production activation needs its own refreshed
backup, schema/RLS, rehearsal and rollback gate.
