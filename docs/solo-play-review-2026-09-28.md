# Solo Play independent code review

Reviewed `24ff15e..425aad5` on branch `solo-play`, then fixed verified findings
in the same isolated worktree. The user explicitly requested an independent
agent review, personal verification of its findings, and fixes.

## Verified findings and fixes

| Priority | Finding | Verification and resulting behavior |
| --- | --- | --- |
| P2 | Historical ranked games without a night ID vanished from Practice & Performance | Personally loaded the original TypeScript module from `425aad5` in memory: a compatible legacy league score of 60 produced an empty timeline. The fixed function plots 60 on its actual date. Only per-night comparisons require a night association. A regression covers this case. |
| P2 | A result's linked night date could disagree with its actual played date | The existing match RPC accepts this association. A regression failed against the original implementation: a March 26 result linked to March 5 created a March 5 comparison. The fix excludes date mismatches from night windows, baselines and chronology, retains the actual-date timeline result, and explains the exclusions. |
| P2 | Invalid historical league scores contaminated averages and score coverage | Personally reproduced failing 501, 301 and Cricket cases with above-cap, negative, nonfinite and missing scores. Shared score validation now accepts finite 0–180 3DA or 0–9 MPR, including valid zero. Invalid scores are excluded from averages and scored coverage, with an explanation; eligible games remain in total counts. |
| P2 | Returning to Solo reused a cached response while fresh consent was pending | An actual-component regression failed after Solo → League → Solo with a delayed response. Every activation now has its own request envelope. Cached metrics are hidden until that request settles; a fresh denial displays the private state. This was cached-data resurfacing, not an RLS bypass. |
| P3 | The seasonal toggle did not respond when storage reads worked but writes failed | An actual-component regression failed with `setItem` throwing `QuotaExceededError` while `getItem` returned Off. Failed writes now preserve an in-memory override. Both toggle directions work and a later successful write persists the choice; hydration remains covered. |

All five findings were personally verified. The independent agent reviewed the
fixes and ran 20 focused regression tests across three files, with no additional
actionable findings. The agent made no file, dependency or database changes.

## Final verification

| Check | Result |
| --- | --- |
| `npm run ci:install` | Passed; trusted pinned install, 571 packages, audit reported zero vulnerabilities |
| `npm test` | 284 tests across 37 files passed |
| `npm run test:coverage` | 284 tests passed; 99.26% lines, 91.43% branches; repository thresholds passed |
| `npm run lint` | Passed, including the new browser regression script |
| `npm run typecheck` | Passed |
| `node scripts/solo-local.mjs build` | Passed; invokes `npm run build` with isolated loopback configuration |
| `node scripts/qa/solo-review-browser.cjs` | Passed against the production preview: failed-storage toggles, scope reactivation pending fresh consent, fresh denial, no browser script errors |
| `git diff --check` | Passed |

The browser test uses fictional existing demo credentials from the ignored
local demo file and allows only app/API loopback origins. It simulates a denial
in the browser without modifying database consent or game records. Test output
is retained in ignored `.local/solo/review-*-output.txt` files.

These fixes change application reads and presentation only; SQL and competitive
records are unchanged. The earlier database/API rehearsal evidence remains
documented in [the implementation verification](solo-play-verification-2026-09-28.md)
and was not rerun for this review. No push, merge, deployment or hosted database
change was performed. The existing integration and hosted release gates remain.
