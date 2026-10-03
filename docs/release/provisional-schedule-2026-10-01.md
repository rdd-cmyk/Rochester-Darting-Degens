# Provisional schedule implementation evidence

Date: 2026-10-01. Status: implemented and verified locally; publication and
isolated Preview/owner acceptance remain open.

Base branch: `release/next`, commit
`a5dbf31cda1ac7bfee004d95d8fe7b7d42c5773b`. A fresh fetch confirmed local HEAD
and `origin/release/next` equal before implementation. The initial sandboxed
fetch failed to connect; the permitted retry succeeded. Changes remain in the
working tree; this record does not identify a committed or deployed candidate.

The owner authorized implementation of the
[provisional replacement proposal](../provisional-schedule-proposal.md).
Schedule now replaces ratings for opponents provisional before an encounter
with their first post-graduation rating, including the graduation encounter.
Established encounters retain their pre-match rating. An opponent who never
graduates retains the original pre-match estimates. Graduation uses the existing
ten-evidence-game threshold and tolerance, within the selected match history.

The engine resolves schedule contributions after ordinary rating replay.
The Stats methodology disclosure explains the replacement, fallback, filter
scope, and separation from power updates. The roadmap and release readiness
plan record the calculation amendment. SQL, persisted records, API contracts,
dependencies, credentials, and hosted configuration are unchanged.

## Local verification

| Check | Result |
| --- | --- |
| `npm run ci:install` | Passed; trusted install-script approvals current. The existing dependency audit reported one high and one critical finding; no dependency remediation is bundled. |
| Focused stats regressions | 44 tests passed across provisional schedule, engine, and team ratings. |
| Comparison against original engine | Passed on 90 mixed singles/doubles/triples matches. Entire output equal after removing only `strengthOfSchedule`; Schedule itself differed. |
| `npm test` | 77 files, 599 tests passed. |
| `npm run test:coverage` | 599 tests passed; coverage gate passed. Overall lines 97.63%, branches 90.87%; stats engine lines 100%, branches 95.2%. |
| `npm run lint` | Passed. |
| `npm run typecheck` | Passed. |
| `npm run build` | Passed with Next 16.3.4. Missing Supabase environment variables used local defaults; this is compile/static-generation evidence, not hosted data acceptance. |
| Diff review | No whitespace errors; only intended application, test, and documentation paths changed. |

Focused regressions cover replacement through the graduation match, ordinary
pre-match contributions after graduation, incomplete/narrower histories, an
early opponent who never meets the graduate again, subsequent growth and slumps,
doubles/triples fractional evidence and opposing-side selection, mixed established
and graduating opponents, input-order independence, historical correction, and
deletion moving the graduation point. Existing page tests also passed; the
minimum-games display filter remains unchanged.

The original-engine comparison used a temporary copy of the exact base engine
and a temporary differential test; both were removed after the passing check.
It verified unchanged ratings/history, rankings, expected results, quality wins,
upsets, form, evidence, score distributions, and analyzed/ignored match counts.
The permanent regressions are in `lib/stats/provisional-schedule.test.ts`.

Vitest required process spawning outside the sandbox after a startup `EPERM`;
the permitted retry passed. This was an execution restriction, not a failed
calculation assertion. No hosted writes or database rehearsal were performed.

## Release follow-up

This is the scoped exception to W0's original calculation-preservation decision.
Existing W1 environment, W2 storage, W4 backup/restore, and W5 SQL/data-preservation
evidence remains applicable within its dated scope. The local application gates
above supplement affected W3 application evidence; they do not rerun or close
the entire combined browser/database package.

Before release, publish the authorized application candidate to the isolated
Preview and review populated Schedule values, graduation behavior, filters, and
the explanation on mobile and in both themes. Record owner acceptance in W6.
Refresh the W0 candidate manifest and W7 exact application/compatible rollback
artifacts when a commit exists. Preserve the existing W6 SQL supplements and
final W7 chain requirements. W8 should verify Schedule during live application
acceptance; this change introduces no extra database step.
