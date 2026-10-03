# PR 75 integration into the combined release

Completed locally on 2026-09-29. This records the owner-authorized merge into
`release/next`; it is not production release or DB acceptance.

## Source identity

| Item | Identity |
| --- | --- |
| Release before merge | `16e58f991fb9e357c590e3959e0c00e1d9d568b1`, including the W0 and W1 documentation commits |
| Updated UI source | `origin/sitewide-design-upgrade-review` at `804b74f68885fe3f2cbd998992da2aac33e858ea` |
| UI review | [PR 75](https://github.com/rdd-cmyk/Rochester-Darting-Degens/pull/75); includes the latest profile-access and recovery-retry fixes |
| Remote release at inspection | `42df060fdf7d26a63e00d00ccf0152a37f4abccb` |
| Pre-merge recovery ref | `backup/release-next-pre-ui-20260929`, pointing at `16e58f9` |
| Checkout | `F:\RDD\Rochester-Darting-Degens-league-night-mode` |

Both remote tips were rechecked before committing and still matched the values
above. The local merge commit containing this record identifies the combined
candidate; W7 must freeze the later final app SHA after W2-W6 fixes/rehearsals.
The original W0 JSON and SQL hashes remain the initial snapshot.

## Conflict decisions and preservation

The redesigned interface wraps the newer release behavior. Public account
creation and main's split match/participant writes were excluded. Sign-in keeps
the invitation return path; recovery keeps the current-origin redirect. The
Matches workspace retains atomic `rdd_save_match`, operation IDs, durable
pending entries, duplicate handling, correction previews, revision checks,
game presets, eligibility and team controls. Shared team scores remain separate
from personal statistics, and both winning teammates are submitted.

Navigation retains Solo, League Night, the Board, and member-only Invites, with
the new styles/current-page markers and Escape focus behavior. The release
branch's Summer hydration and storage-failure fixes remain. Home's overall
leaderboard precedes the Board preview. Profile Solo controls, game-aware
history and tied-result filtering remain. Zero-match Statistics guidance now
mentions format filters while retaining the valid player/team requirement.

Invitation security headers and `agentRules: false` remain alongside the opt-in
visual-fixture rewrite. No SQL, deployment migration, dependency manifest,
lockfile or workflow changed. The existing League Night, game, Solo, invitation,
planning and Board library/API implementations are unchanged from the release
parent. The unrelated untracked Rivalry Room mockups/planning and its running
Docker stack were preserved and excluded from the commit.

## Local verification

Node `24.20.0`; trusted installer npm `11.19.0`. No environment file was loaded.

| Check | Result |
| --- | --- |
| `npm run ci:install` | Passed locked install, install-script approval check and the allowed resolver rebuild |
| `npm test` | 461 tests passed in 58 files |
| `npm run test:coverage` | 461 tests passed; configured coverage 97.29% statements, 91.28% branches, 98.88% functions, 98.31% lines; thresholds passed |
| `npm run lint` | Passed; ignored `.local` and `.qa-artifacts` scratch output is excluded, consistent with Git ignores |
| `npm run typecheck` | Passed |
| `npm run build` | Optimized build and route generation passed with local Supabase defaults |
| Optimized-build browser | 128 synthetic renders: 16 routes, dark/light, widths 320/390/1024/1440; HTTP 200, no document overflow, no error fallback or uncaught/caught render failures |
| Browser interactions | Retained release navigation, Escape close/focus, same-ID/same-payload interrupted atomic retry, Change Log pages 1/2, signed-out profile access state passed |
| Screenshot inspection | Home, Matches and Statistics inspected in both themes at 390px; retained game controls, contained tables and leaderboard-first ordering |

The combined unit fixtures retain both branches' meaningful tests. New Matches
regressions exercise a pending/uncertain atomic save and locked form, identical
retry payload/operation, 2v2 winner submission and separation of shared/personal
scores, plus sign-in-only guest access. Merge-fixture problems were corrected:
duplicate Navbar mocks, the existing game-catalog metric label, and TypeScript
query options. Browser fixtures use the real planning response shape and check
caught render failures as well as `pageerror`; an empty array is not a valid
planning feed.

The reproducible browser harness is `scripts/qa/release-ui-merge.mjs`. It uses
`RDD_PLAYWRIGHT_ROOT` and optional `RDD_UI_MERGE_ORIGIN` (default loopback port
3215). Run the synthetic fixture with `--mutable` on a free port 54321, build
the app with only loopback Supabase URL/dummy credentials, and serve it locally
on 3215 before running the harness. Review [fixture setup](../../scripts/qa/visual-preview.md)
before starting it; do not stop a different task's stack. The harness blocks
external browser requests and mocks membership, planning, invitation reads and
save RPC responses. It does not write a real match or prove RLS, persistence,
mail delivery or recovery Auth. Ignored evidence is under
`.qa-artifacts/pr75-merge/` (`summary.json` and screenshots).

Locked installation reported one pre-existing moderate audit finding:
`undici@8.10.0`, brought in only by development `jsdom@30.0.1`.
`npm audit --json` identifies `GHSA-3wwx-pv8p-q78v`; `npm explain undici`
confirms the development-only chain. This merge does not change the lockfile.
Review the finding and a scoped remediation in W3 before the final freeze;
dependency modernization was not bundled into the UI merge.

## Effect on the release packages

- **W0 stays passed.** This is a recorded scope/candidate addition; the initial
  inventory is historical evidence rather than the final freeze.
- **W1 assessment remains useful and its exit gate stays open.** Owner Vercel
  target/variable evidence is still needed. Its checklist now requires
  `RDD_VISUAL_FIXTURE` and `NEXT_PUBLIC_RDD_VISUAL_FIXTURE`, as well as
  `RDD_LOCAL_PREVIEW`, to be absent/disabled on hosted targets.
- **W2 SQL work is unchanged.** The UI adds no SQL dependencies or new stats UI.
- **W3 uses this combined app.** Repeat the full database-backed API/browser
  rehearsal, including redesigned forms, game/team filters, Solo, planning,
  Board, invitations, auth transitions and interrupted saves. Resolve the
  development-dependency audit item before the final candidate freeze.
- **W4-W8 stay required.** Protected backup/restore, production-shaped SQL and
  rollback rehearsal, real-service/account/phone acceptance, exact freeze and
  owner release approval remain separate gates. Carry forward the UI project's
  real recovery/email/GitHub API, keyboard/screen-reader, native zoom and OS
  preference acceptance limits into W3/W6.

No push, merge to `main`, hosted SQL/Auth change, real-data export, deployment,
or production acceptance was performed. Local app/fixture processes were stopped
after verification; the unrelated Docker stack was left running.
