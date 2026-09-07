# Local Supabase readiness — approval checkpoint

Status: ready for user review; NOT committed/pushed or approved for hosted deployment.

Follow-up: user approved the local result on 2026-09-07 and requested Package
3B. Preserve this readiness work as a separate prerequisite commit. The evidence
below describes the pre-upgrade checkpoint; hosted deployment remains unapproved.

Date: 2026-09-07. Branch: `advanced-statistics`, based on `b98415f`.
Package 3B and later dependency updates have not started. The lockfile is unchanged.

## What is ready

- Docker Desktop's supported localhost default was changed with explicit user
  approval, backed up, restarted, and checked using actual host listeners.
- The guarded Windows recovery launcher preserves only verified stale socket
  folders; it has independent review and executable safety tests.
- The original schema-only baseline and additive statistics migration replay
  locally. Existing hosted tables/history still require separate reconciliation.
- Local start/status/stop/test commands consistently target the local engine,
  clear remote/TLS overrides, and reject arbitrary extra flags.
- `dev:local` uses only local Supabase configuration without changing existing
  environment files. Local telemetry and the real GitHub integration are off.
- Synthetic accounts, sample matches, desktop/mobile screenshots, and standard
  browser acceptance are available for review.

## Verification performed

| Gate | Result |
| --- | --- |
| `npm run ci:install` | Passed from the unchanged lockfile; no dependency upgrades |
| `npm test` | 59 tests passed in 11 files |
| `npm run test:coverage` | Passed; configured statistics/match-state scope: lines/functions 100%, branches 91.35%, statements 99.28% |
| `npm run lint`, `npm run typecheck` | Passed |
| `npm run build:local` | Fresh Next.js production build passed with local-only environment |
| Windows Pester 3.4.0, Windows PowerShell 5.1 | 29 passed; mocked safety fixtures, no real engine operations in unit tests |
| `npm run test:db:local` | 25 pgTAP policy/constraint assertions passed |
| `node scripts/rehearse-local-migration.mjs` | 7 staged legacy-value/relationship preservation assertions passed |
| Playwright Test 1.62.1 with installed Chrome | One end-to-end scenario with five steps passed in 11.3 seconds total; all browser requests remained local |
| Independent review | SQL coverage, command-target isolation, TLS sanitization, and wrapper-boundary test findings fixed; no remaining actionable findings in final review |
| `git diff --check` | Passed |

Browser checks exercised signed-out denial; browser signup; sign-out/sign-in;
session reload; saving and editing a match with database readback; another
user's missing Edit controls and denied API update/spoofed insert; anonymous
read denial; 501/Cricket, board, and sample-size filters; and 1440px/390px
desktop/mobile layouts. No uncaught main-page JavaScript errors or attempted
external requests remained in the passing run. Test fixtures use ordinary
authenticated application APIs, not a service-role bypass.

Published Supabase ports 54321, 54322, 54323, 54324 and 54327 were verified as
127.0.0.1/::1. The web preview listens only on 127.0.0.1:3000. Reverify after
restarting/upgrading Docker; a local URL alone is not proof of port isolation.

## Review it yourself

The local app and core Supabase services were left running for this checkpoint.
If stopped, follow `docs/supabase-local-development.md` and use `npm run dev:local`.

1. Open <http://127.0.0.1:3000/auth>.
2. Use synthetic account `demo-captain@example.test` with password
   `Local-Darts-Demo-2026!`. These are intentionally public localhost fixtures,
   not credentials for any real account. Do not reuse this password elsewhere.
3. Visit `/stats`, compare All/501/Cricket and the minimum-games filter, inspect
   the rating-history details and methodology, and try the mobile layout.
4. Visit `/matches`, save/edit a synthetic result, then check the statistics.
   `demo-rival@example.test` uses the same fixture password and demonstrates
   the noncreator experience. Both accounts can read league data by design.

The 18 seeded history matches and additional browser-test matches/accounts are
synthetic and retained locally. Repeated browser runs add their own uniquely
identified fixtures. Screenshot artifacts (ignored by Git):

- `test-results/statistics-desktop.png`
- `test-results/statistics-mobile.png`

Screenshots have the existing Summer decoration toggle off for readability.
On a narrow phone, chart/table detail areas scroll horizontally; the document
itself does not overflow. Ratings in this preview describe fake demo matches,
not real league skill.

## Limitations and deliberately deferred work

- Optional Windows Vector container-log ingestion is excluded because the
  pinned CLI expects unsecured Docker TCP 2375. That endpoint was not enabled.
  Core Auth/REST/Storage/Realtime/Studio/Mailpit/database services are available;
  this is not an all-integrations acceptance test.
- Local Auth has email confirmation disabled. The existing signup UI still
  shows its verify-email page even when local Auth already supplied a session;
  navigation to Matches works. Real email delivery, confirmation, password
  recovery, and hosted Auth have not been accepted in this run.
- Existing match edits are multiple separate requests, not a single database
  transaction. Success was tested, but atomic recovery after partial failure
  remains a separate follow-up; no RPC/schema redesign was introduced here.
- No production player records were exported. Synthetic preservation tests
  cannot prove real rows satisfy every new constraint. Managed Auth ownership
  and grants are not cloned into the dedicated preservation database.
- Hosted backup/recovery, migration-history reconciliation, fresh drift review,
  owner approval, and deployment remain required. No hosted migration, data
  edit, history repair, or persistent checkout linking was performed.
- Existing dependency audit findings remain (install reported 1 moderate and
  3 high). The baseline-browser-mapping warning also remains. These were not
  silently changed or treated as fixed; dependency packages require approval.
- Database/Windows/browser suites are local gates, not newly configured CI
  jobs. GitHub Actions and Vercel have not run these uncommitted changes.

The original isolated container `rdd-schema-rehearsal-20260907` remains STOPPED;
it shares the active CLI database volume and must never run concurrently.
Dedicated `rdd_rehearsal_*` databases and data-free loopback probe containers
from this investigation are retained for inspection; no broad cleanup/reset
was performed. Docker's settings backup and socket-folder backups remain on
the host, outside Git.

## Approval boundary

Review this local result before authorizing commit/push. Approval of local
readiness is not approval for hosted migration or Package 3B. Those remain
separate decisions. No new commit or push was made at this checkpoint.
