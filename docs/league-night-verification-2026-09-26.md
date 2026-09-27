# League Night local verification — 2026-09-26

Status: Ben reported local demo testing complete on 2026-09-27; not approved for
hosted rollout. See the [read-only hosted audit](league-night-hosted-audit-2026-09-27.md)
for the subsequent database/integration inspection and remaining release gates.

Branch: `league-night-mode`; base/HEAD `690a01b` before uncommitted implementation.
Fresh `git fetch origin` at handoff still resolves `origin/main` to that base.
No implementation commit, push, PR, hosted SQL, production export or deployment
was performed in this build turn. The previous advanced-statistics stack/data
were preserved.

## Targets and checks

Windows; Node 24.20.0; npm 11.19.0; lockfile-pinned Supabase CLI 2.116.0.
The isolated `rdd-league-night` Docker stack uses loopback ports 55420–55429;
the app is bound to `127.0.0.1:3010`. All accounts and matches are synthetic.

| Check | Evidence/outcome |
| --- | --- |
| Baseline | Trusted `npm run ci:install`, 183 pre-change tests, lint, typecheck and build passed; install audit reported zero vulnerabilities. No library versions or lockfile changed. |
| Source tests | `npm test` and `npm run test:coverage`: 26 files, 221 tests passed in both final runs. |
| Coverage | Scoped existing stats/match-state and new League Night pure calculation, validation, recovery and export modules: 99.53% lines, 91.58% branches, 100% functions. This is not whole-app/UI coverage. Existing thresholds remain unchanged. |
| Static checks | `npm run lint` and `npm run typecheck` passed without warnings/errors. |
| Production build | `npm run night:local -- build` passed: same Next production build with guarded local configuration and integrations disabled. `/league-night` is included. |
| Database rehearsal | `node scripts/rehearse-league-night.mjs`: 36 pgTAP checks passed on a new database containing only the legacy baseline plus both pending League Night SQL files. Latest retained DB: `rdd_night_rehearsal_1790457681542`. |
| Browser integration | Seven Playwright scenarios passed against `night:local -- serve`, using headless Edge and a network allowlist containing only app/API loopback origins. |
| Visual/export review | Inspected desktop/mobile entry, recap and downloaded awards image; verified no horizontal overflow at 320/390/768/1440, light/dark, reduced motion, long combined names and ten players. The exported PNG is byte-identical to the on-screen canvas. |

Database checks cover authentication/ownership, shared nights and attendance,
typed validation, alternate UUID spellings, cross-timezone canonical retry,
duplicate warnings/intentional rematches, stale revisions, direct-write
enforcement, stable participant IDs, unknown legacy participant preservation,
and injected participant failures rolling back whole creates/edits.

Browser scenarios cover:

1. Concurrent same-ID RPCs, independent recorders, ownership and stale edits.
2. Two phones, shared attendance/results, new registrations, recovered drafts,
   lost-response reconciliation (including recovery older than 24 hours), and
   interrupted intentional-duplicate overrides.
3. Existing Matches editing across pagination, rejection after reload, retained
   input while advancing a recovery queue, and independent edits not deleting
   a released entry.
4. Dismissed duplicate warnings, cross-tab sign-out/account changes, and
   ownership of a subsequently reconciled result.
5. Two simultaneous Matches submissions preserving separate operation records.
6. Earned awards with full prior history, long names, exact preview/download,
   and edits retaining an intentionally null venue.
7. Ten-player mobile entry, the eleventh-player guard, and absent optional
   scores remaining null rather than fabricated zeros.

## Independent review

Independent read-only reviews covered the SQL/security/rollout contract and the
frontend/calculation/recovery code. Findings were fixed, including canonical
UUID/time handling, legacy-row preservation, staged enforcement, auth-bound
submissions, edit snapshots, unknown duplicate outcomes, late-arrival profiles,
incomplete-history awards, shared-night qualification cutoff, attendance
revision races, per-operation recovery and retained rejected entries. Focused
re-review checked those fixes; the last independent-edit/recovery finding was
fixed and included in the passing production-browser regression.

## Recovery review correction — 2026-09-27

A subsequent independent review found that rejecting pending save A left its
corrections only in the common draft slot; reopening and restoring pending save B
could overwrite them. The new component regression reproduced this loss before
the fix and passes after it.

Rejected and duplicate-dismissed entries now have separate user/night-scoped
recovery records, with visible Restore/Discard controls. Edits to a retained
entry stay with that entry; confirming an unrelated save does not clear it.
The existing 24-hour unsent-entry retention applies. Unknown submitted outcomes
remain pending until reconciled, and a storage failure cannot erase their only
recovery record. No SQL, dependency, hosted configuration or permission changes.

Verification: full coverage run passed 229 tests in 27 files; lint, typecheck and
the guarded local production build passed. Tests cover the two-operation
regression, duplicate dismissal, interrupted replacement/retry, unrelated edits,
explicit discard, storage failures, expiry and malformed stored entries.
Earlier database/browser rehearsal results above remain dated 2026-09-26; those
suites were not rerun for this browser-storage-only correction. Hosted rollout
and publication remain gated; this fix is local and uncommitted.

## Branch-publication checks — 2026-09-27

Ben authorized committing the implementation locally and pushing only
`league-night-mode` to origin. This does not authorize merging main, exporting
production data or applying hosted SQL.

Fresh pre-publication checks passed:

- Trusted `npm run ci:install`: 571 packages installed, zero audit vulnerabilities;
  approved install-script check and resolver rebuild passed. The first clean
  install encountered the running demo's Windows SWC file lock; the task-owned
  demo server was stopped and the full clean install then passed.
- `npm test` and `npm run test:coverage`: 229 tests in 27 files passed in each run.
  Scoped coverage: 99.55% lines, 92.89% branches, 99.28% functions, 99.01% statements.
- `npm run lint`, `npm run typecheck` and `npm run night:local -- build` passed.
  The last command runs the Next production build with guarded local Supabase
  configuration and hosted integrations disabled.
- Publication candidates contain no detected high-confidence credential patterns,
  no environment files or generated artifacts, and no deployable migrations.
  `package-lock.json` and dependency versions are unchanged.

The database/browser rehearsal results above remain dated 2026-09-26; neither
suite was rerun for publication. The hosted inspection is recorded separately
in the [read-only audit](league-night-hosted-audit-2026-09-27.md).

## Review it locally

Start or resume with:

```powershell
npm run night:local -- start
npm run night:local -- build
npm run night:local -- serve
```

Open `http://127.0.0.1:3010/league-night` and sign in with the **local-only** demo
account `night-ben@example.test`, password `Local-Darts-Demo-2026!`. These are
synthetic test credentials, not a hosted account. The demo server was stopped
for the publication clean install; the commands above restart it when needed.

A seeded review night is available at
`http://127.0.0.1:3010/league-night?night=cb3be0f3-605f-4eb7-846f-de3c1dfeda92`.
After login, reopen that link and select Night recap to see all five award types.
This illustrative dataset does not describe any real league performance.

Browser rerun (use your installed Playwright path; no new dependency required):

```powershell
$env:RDD_LOCAL_STACK = 'league-night'
$env:RDD_PLAYWRIGHT_ROOT = 'C:\Users\linfo\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\playwright'
node "$env:RDD_PLAYWRIGHT_ROOT\cli.js" test --config scripts/qa/league-night.config.mjs
```

Screenshots/export files are ignored local artifacts under `.qa-artifacts/`:
`league-night-1440-light.png`, `league-night-390-dark.png`,
`league-night-awards-1440.png`, `league-night-awards-390.png`, and
`league-night-awards-card.png`. Browser artifacts use synthetic data only.

Observed outside the new feature: production-server logs include `PGRST116`
profile-metadata fallbacks during profile-link prefetch. The metadata code in
`app/profiles/[id]/layout.tsx` is unchanged from main and queries using the
shared client without the browser's local auth session. It falls back to the
generic Profile title. No public-profile/RLS relaxation was made to suppress
those logs; hosted metadata behavior was not evaluated by this feature suite.

## Remaining gates — do not mark these passed

- Ben's local demo review is complete. Specific real-phone keyboard/landscape/zoom
  and assistive-technology checks were not reported; the 15-second rematch target
  is not measured.
- Hosted schema/RLS/grant, migration-history and integration metadata were inspected
  read-only on 2026-09-27. Owner-approved protected backup, isolated restoration
  rehearsal and migration-history adoption remain open. Local fixtures and
  read-only metadata checks are not proof of production preservation/write behavior.
- Approval of [the SQL/app/enforcement sequence](league-night-database-rollout.md),
  coordinated old-tab transition and RPC-capable rollback release.
- Branch commits/push were authorized on 2026-09-27; GitHub CI, a deliberately
  configured Vercel preview and hosted multi-user/auth/telemetry checks remain
  separate gates. Merge and production deployment are not authorized.
  **Do not merge or deploy this app against an unchanged hosted schema.**

`supabase/migrations/` still contains no deployable SQL. Pending SQL must not be
promoted into automatic deployment until those release gates are met.
