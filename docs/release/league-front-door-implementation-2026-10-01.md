# League front door implementation

Owner accepted the [mockup](../mockups/league-front-door.html) and authorized
implementation with a local test version first. Do not push to origin or
publish to Vercel. Current local provisional-rating work is preserved.

1. Make League Night the root/logo destination; retain existing night URLs,
   recording workspace, challenge deep links and password-recovery handling.
2. Rework the lobby around tonight/next plan, a power snapshot, latest recap,
   Board preview and previous nights. Do not infer that old nights are active.
3. Add linked Stats views: Power & Performance, Records and Head to Head.
   Preserve the current engine, local provisional changes, score-cohort
   boundaries and every former Home leaderboard category.
4. Rebuild Matches as a filtered archive. Make League Night recording primary;
   explicitly choose standalone entry. Preserve permissions, corrections,
   pending saves, device drafts, duplicate checks and safe retries.
5. Review desktop/phone, loading/access/empty/error states, root/auth links and
   recording/recovery paths. Run the complete application gate locally.
6. Open the working app against a loopback-only synthetic fixture so the owner
   can explore safely. Keep hosted data and production untouched.

W6 needs an affected-journey recheck before closeout. W7/W8 remain unstarted.
This revision supersedes the old leaderboard-first Home requirement and the
separate Home navigation item only; shared design tokens and page frames stay.

Status: implementation complete locally; owner visual acceptance remains open.
No release or database gate is closed by this redesign.


## Preservation and verification

- League Night's `NightSession` is byte-for-byte identical to the captured
  pre-redesign working source after normalizing line endings. Shared attendance,
  participant selection, formats/presets, game-specific scores, Save & Rematch,
  corrections, duplicate handling, durable receipts/drafts, challenges, recap,
  awards, practice separation and share-card logic remain in that workspace.
  Lobby navigation now refreshes when the root/logo route changes; a regression
  test covers returning from a selected night to the root lobby.
- Power & Performance retains every existing filter, eligibility/cohort boundary,
  story, rating chart, exact history, evidence table, consistency/distribution,
  explanations and methodology. The locally edited provisional schedule engine
  was preserved without further changes. Landing ratings use this same engine
  and complete ordered loader, not an independent approximation.
- Records retains the former Home overall, game-type, legacy 3DA and Cricket MPR
  tables with sorting, streaks and recent form. Head to Head retains its player
  selection and opponent tables. Data loading now reads every page rather than
  stopping at the default API limit. Guests do not query these private records.
- Matches retains the existing save/recovery/correction handlers and permission
  checks. The player filter uses a separate joined alias so opponents remain in
  the displayed result. Query shape is source-reviewed and fixture-tested;
  actual hosted PostgREST execution remains an affected-flow acceptance gate.
- Root recovery links preserve their hash for the reset page. Ordinary login and
  successful reset continuation now lead to League Night, with existing private
  Board/Rivalry return destinations retained.

Final local gates: trusted locked install passed; 80 test files / 609 tests
passed; coverage passed (96.44% statements, 90.19% branches, 97.82% functions,
97.54% lines, for the configured coverage scope); ESLint, typecheck, production
build and `git diff --check` passed. Build worker sandbox `spawn EPERM` was
resolved by an approved worker run. No dependency or SQL changes were made.

Browser checks used synthetic data at 1440x1000 and 390x844, including light and
dark views. Checked landing content/logo, route return, all Stats views,
records game selection and opponent lookup, Power filters and comparable 3DA
consistency, archive participant filtering (opponents retained), details and
standalone choice/editor. Created a disposable in-memory night, selected two
players, saved with Save & Rematch, and opened awards/recap. Original recovery,
team-result, calendar-boundary and stats tests also passed. This is not hosted
DB/RLS, email, physical-phone or production release evidence.

## Local exploration

Open http://127.0.0.1:3065. The app uses an in-memory fixture API on loopback
port 3059; no real Supabase project or email provider is connected. The visible
browser is signed in as a synthetic demo captain. If signing in again, use
`demo-captain@example.test` and `local-only-demo` (demonstration values only).
Edits are disposable; restarting the fixture resets its results. Other pages
outside this redesign may have limited synthetic behavior. Launchers and
screenshots are retained under ignored `.local/` directories.

## Release checkpoint

Nothing was committed, pushed or deployed during implementation. Owner local
acceptance comes next; preview publication is separately authorized. W6 must
recheck affected navigation, archive query/permissions, Stats completeness and
night recording/recovery on RDD Release Testing before closeout. W7 must use the
final accepted app and SQL packet for its rehearsal/rollback evidence. W8 stays
unstarted. Prior dated W0-W5 evidence is retained with its original scope.

The locked install audit reported existing advisories: critical Next.js
`next/og` ImageResponse (GHSA-vcvr-r3jv-pc5j; installed 16.3.4) and high
brace-expansion in development tooling. These are not introduced or remediated
by this UI change. Resolve through the dependency release gate before hosted
publication; build/test success does not clear the audit gate.


### Independent review follow-up

All three independently reported findings were verified and fixed on October 1:
superseded night reads, archive choices beyond forty nights, and options retry.
The [review and repairs](league-front-door-review-2026-10-01.md) records red/green
regression evidence, independent repair review and final 614-test verification.
The earlier 609-test result remains dated implementation evidence; this review
provides the later repair gate. Owner local acceptance remains open.
