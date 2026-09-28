# PR #74 independent review

An independent agent reviewed the full PR from League Night Mode `b9cd384`
through Solo Play `78b7cb6`, including game-mode prerequisites, team ratings,
privacy/admission, recovery, profile/night projections, practice comparisons,
corrections and integration tooling. The review was read-only and found two
actionable P2 issues. Both were personally verified before fixing them.

| Finding | Personal reproduction and fix |
| --- | --- |
| Fresh League Night games inherited tied/abandoned status | Two actual-page regressions failed: after Save & Rematch the next status was still tied/abandoned, hiding winner controls. Fresh post-save scorecards now reset to completed while preserving game rules, format and practice context. Original submitted statuses remain intact, and the next completed game requires a winner. |
| Fresh Solo games inherited stopped status | An actual-component regression failed: after Save & play again the next game remained stopped and therefore excluded from summaries/analysis. Matching confirmed saves now reset the next entry to completed, retaining inclusion, rules, board and night consent. The next save uses a distinct game ID; unrelated recovered drafts remain protected by the existing ID guard. |

The independent agent re-reviewed both fixes and their regressions, with no
additional actionable finding. Its attempted test run was blocked by sandbox
child-process `EPERM`; the parent ran the component and full checks successfully.
No agent performed database mutations or hosted actions.

## Verification

- Trusted pinned install passed: 572 packages, audit reported zero vulnerabilities.
- Both result-state suites passed: 17 tests. All three new regressions failed
  against the original implementation and passed with the fixes.
- Full unit suite and coverage passed: 428 tests across 51 files, 98.31% lines
  and 91.28% branches. Lint, TypeScript and isolated production build passed.
- The first full check caught a CommonJS lint annotation missing from an ignored
  local browser fixture left by the preceding bot-review task. That local-only
  script annotation was corrected, then the affected gates were rerun.
- Diff whitespace check passed.

The fixes affect only fresh entry state after a confirmed save. They do not
change existing results, SQL, dependencies or admission/visibility rules. The
earlier local database/API and browser evidence remains in the
[integration verification](solo-play-rebase-2026-09-28.md) and
[bot-review verification](solo-play-bot-review-2026-09-28.md).
Hosted schema/RLS, backup/restore and rollout gates remain separate.
