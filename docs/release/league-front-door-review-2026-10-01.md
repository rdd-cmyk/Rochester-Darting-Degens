# Local front door independent review and repairs

Date: 2026-10-01. Branch: `release/next`. Review base:
`a5dbf31cda1ac7bfee004d95d8fe7b7d42c5773b`.

The owner requested an independent code review, primary-agent verification,
and fixes for every verified finding. The independent agent reviewed tracked
and untracked application changes versus HEAD, including the pre-existing
provisional schedule amendment. It made no changes or hosted requests.
The primary agent verified all three findings and implemented the repairs.
The independent agent then reviewed the repairs and found no further actionable
issue. Owner local visual acceptance remains open; nothing was pushed/deployed.

## Findings and independent verification

| Finding | Primary verification | Repair and regression evidence |
| --- | --- | --- |
| P2: an older lobby response can reopen a night after root/back navigation | A deferred `loadNight` completed after returning to root; the regression test failed because the old night heading reappeared. | Capture the route before awaiting, use a request generation, invalidate reads on cleanup and explicit selection. The same test now passes. Added offline-root coverage: leave the selected night immediately even if the new lobby request fails. |
| P2: archived night choices omit all but the latest forty | Inspected the existing `loadNights` query's `.limit(40)` and confirmed the new archive reused it. | A dedicated complete ordered loader reads every visible page, leaving the lobby's bounded query unchanged. A test simulates an API cap of forty rows and verifies all forty-one nights are returned. A later-page error rejects the whole list instead of presenting an incomplete filter. |
| P2: Refresh does not retry unavailable night choices | The regression test failed: after the promised Refresh, the options read count remained one and the options stayed unavailable. | Refresh now triggers both archive and night-option reads; successful options loading clears the error. The same test verifies the second read, restored choice and cleared error. |

Files: `app/league-night/page.tsx`, `app/matches/page.tsx`,
`lib/matches/archive.ts` and their regression tests. `NightSession` itself
remains identical to the captured pre-redesign source; save, recovery, team,
challenge, attendance and recap handlers were not changed. Existing provisional
schedule source and owner local edits were preserved.

## Final verification

- Trusted locked install and install-script checks: passed.
- Full tests: 80 files, 614 tests passed (five new regressions beyond 609).
- Coverage: passed; configured scope 96.44% statements, 90.19% branches,
  97.82% functions and 97.54% lines.
- ESLint: clean with no warnings. Typecheck and local production build: passed.
- Diff whitespace and NightSession preservation checks: passed.
- Browser smoke check: selected an existing night, returned through the logo,
  opened Matches, refreshed it and verified its night choices on the synthetic
  loopback app. No hosted data, RLS, migrations or email behavior was exercised.

Exact final check logs are retained under ignored `.local/front-door-review/`:
`install.log`, `tests.log`, `coverage.log`, `lint.log`, `typecheck.log`,
`build.log`. The original failures were reproduced before their fixes; final
logs contain the passing reruns. Initial sandbox worker restrictions were
resolved through approved runs. Existing dependency audit advisories remain
in the separately recorded release dependency gate; no dependencies changed.

The local app was reopened at http://127.0.0.1:3065 with the same synthetic API
on port 3059. Owner acceptance/publication and affected hosted W6 journeys
remain open. W7/W8 were not started, and production/hosted Supabase were untouched.
