# Independent planning review and fixes

Branch: `league-night-planning`. Initial review scope: the then-uncommitted
Plan & RSVP implementation and its League Night integration. The review itself
made no hosted changes or publication. Subsequent parent-branch rebase and
verification are recorded in
[`league-night-planning-rebase-2026-09-27.md`](league-night-planning-rebase-2026-09-27.md).

An independent agent performed a read-only review, then reviewed the fixes
twice. The implementing agent verified findings against the source and focused
regressions. The final independent review reported no remaining blockers in
the reviewed fixes; this is not a claim that all possible defects are excluded.

## Verified findings

| Finding | Verification | Fix |
| --- | --- | --- |
| P2: stale draft/night editors keep obsolete revisions after Refresh | Component regression reproduced the stale night form; equivalent draft path verified and covered | Preserve entered fields, block stale submits, explicitly offer loading the latest version with discard wording. Changed lifecycle states cannot be resubmitted. |
| P2: an elapsed RSVP cutoff prevents future-night corrections | New pgTAP correction test failed with `22023`; correction and stored-notes assertions passed after the fix | Under the schedule row lock, allow title/notes corrections to retain the identical elapsed cutoff. A different past cutoff is rejected; time/venue changes require a future reconfirmation window as documented below. |
| P2: replaying another tab's request discards an unrelated editor | Component regression lost the unsaved title before the fix and retains it afterward | Bind successful recovery to the original local request/editor identity; guard form completion callbacks against replacing a different editor. |
| P2: cancelled nights are unmarked in the lobby and direct links | Both rendering regressions failed before the fix; API, database and production-browser checks passed afterward | Add bounded authenticated status reads for requested night IDs; display cancellation in both views while retaining history. Non-missing-function read errors are surfaced. Legacy installations without planning remain supported. |
| P2 follow-up: edited records outside the current feed page bypass stale recovery | Poll and night disappearance regressions failed before the fix and passed afterward | Pause pagination during editing. Missing records block submits and show recovery guidance while keeping fields editable/copyable. The user can explicitly close the editor and locate the current item. |

## Final local verification

- All **251 application tests across 30 files** passed in the coverage run.
  Configured coverage thresholds passed: 98.13% lines and 91.62% branches.
  The final focused editor suite also passed all 10 tests.
- Fresh legacy-schema rehearsal: **67 planning + 36 League Night checks**.
  Rehearsal database: `rdd_planning_rehearsal_1790546616116` (retained locally).
- `npm run lint`, `npm run typecheck`, `npm run plan:local -- build` passed.
- Production-build browser acceptance passed on the isolated planning stack,
  including authenticated organizer/member flows, concurrent suggestions,
  replay after committed response loss, RSVP reconfirmation, cancellation in
  the lobby and direct link, and responsive widths 320/390/768/1440.
  The ignored `.qa-artifacts/planning/results.json` records the run.
- `git diff --check` passed. Dependencies and lockfile were not changed by
  this review; the trusted clean installation from implementation still applies.

The status RPC returns only schedule lifecycle labels for up to 40 night IDs.
Private ballots and RSVP records remain inaccessible through it. The local
rehearsal refreshes its explicit authenticated-only grant along with the four
planning function bodies. SQL remains in the deferred fixture, outside
`supabase/migrations/`. Hosted release and organizer assignment remain deferred.

## PR #70 diff review follow-up

The independent review of the rebased PR found two further P2 issues. Both
were reproduced by failing regressions before fixing them:

- Cancelling an unpublished draft exposed it to member reads and counts.
  Publication is now recorded separately from lifecycle status, and both read
  filters use that marker. Previously published cancelled polls remain visible.
  The deferred local preview upgrade uses successful publication replay records
  to recognize old cancelled polls; unknown cancelled history stays private.
- Changing a date/time or venue while retaining an elapsed RSVP cutoff
  invalidated previous responses but blocked reconfirmation. The write now
  rejects that combination under the schedule lock before changing revisions
  or responses. The form explains the requirement and blocks submission until
  the organizer chooses a future cutoff or clears it. Title/notes corrections
  still preserve an unchanged elapsed cutoff and existing responses.

Independent source re-review confirmed both fixes with no actionable introduced
issues. The reviewer passed `git diff --check`. Its initial focused test attempt
did not start during the concurrent clean dependency install; after installation
it independently reran all 12 editor tests successfully and reviewed the browser
regressions and recorded results. Database and browser execution below were
performed by the implementing agent.

Implementing-agent verification on 2026-09-27:

- Trusted clean installation passed; no audit vulnerabilities or lockfile change.
- `npm test` and coverage each passed **253 tests in 30 files**. Configured
  thresholds passed: 98.13% lines and 91.62% branches. Both new UI regressions
  passed in the 12-test editor suite.
- Fresh legacy-only rehearsal passed **85 planning + 36 inherited checks**;
  retained database `rdd_planning_rehearsal_1790553966667`. The tests include
  publication backfill, cancelled draft privacy, rejected expired-cutoff event
  edits, unchanged responses after rejection and successful reconfirmation
  after explicitly reopening the response window.
- Lint, TypeScript and the guarded production build passed.
- Production-browser acceptance passed all previous scenarios plus cancellation
  of an unpublished draft through organizer controls and a time/venue edit
  blocked until its elapsed cutoff was explicitly cleared. The member then
  reconfirmed successfully. Widths 320/390/768/1440 passed without overflow and
  there were no page JavaScript errors. Ignored results remain in
  `.qa-artifacts/planning/results.json`.

SQL remains deferred outside `supabase/migrations/`; this follow-up applies no
hosted schema, organizer assignment or merge.
