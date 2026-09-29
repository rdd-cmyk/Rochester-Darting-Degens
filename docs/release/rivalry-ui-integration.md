# Rivalry Room integration with the release UI

Completed locally on 2026-09-29. The owner authorized merging the ready
`rivalry-room` branch into the existing `release/next` candidate. Publication,
production deployment and hosted Supabase changes remain separate actions.

## Source and recovery identities

| Item | Identity |
| --- | --- |
| Release before this merge | `d667dbedd1aba79fdb395f0fe4ebd2bfb762872e`, containing the PR #75 UI integration |
| Reviewed feature source | Local `rivalry-room` at `5f9a24c7d79e7e91ad2227885373f09694916703` |
| Feature/release common ancestor | `16e58f991fb9e357c590e3959e0c00e1d9d568b1`, before the UI merge |
| Refreshed remote release | `42df060fdf7d26a63e00d00ccf0152a37f4abccb` |
| Refreshed `origin/main` | `690a01b84d96c55b8ec455a6e298c17ec6093b50` |
| Pre-merge recovery ref | `backup/release-next-pre-rivalry-20260929` at `d667dbe` |
| Preserved original planning/mockups | Scoped untracked-file stash `91210715f87b2f719fbb11f557f92ef9458f4567` |
| Destination checkout | `F:\RDD\Rochester-Darting-Degens-league-night-mode` |

The source checkout was clean and its feature chat idle. The ready source is
local; there is no remote-tracking `rivalry-room` branch. The merge commit
containing this record identifies the resulting candidate and both parents.
W7 must freeze the later final SHA after the remaining release work.

Before merging, the destination contained the original untracked Rivalry plan
and mockups. Ten of eleven files matched incoming content exactly; the plan
only gained implementation/handoff updates. The scoped stash preserves the
originals, and the reviewed incoming versions are now tracked. Do not blindly
pop that stash over the newly tracked files. Other worktrees were untouched.

## Integration decisions and confirmed fix

Five conflicts were resolved in Navbar, RootLayout, My Profile, player profile
and the profile directory. The PR #75 styles, access/loading/retry states,
profile behavior and shared shell remain. RootLayout adds AvatarProvider and
scoped Rivalry CSS. Profiles add the shared avatars and curated picker, with
small wrapping/flex rules for the new heading and directory content. Navbar
adds Rivalry Room while preserving all release links, current-page markers,
mobile selection, Escape closing and focus restoration.

The feature's League Night challenge recorder, private routes, Board link
rendering and reviewed recovery fixes are included. Sign-in captures its return
route before the asynchronous request, retaining invitation and Rivalry paths.
Public registration stays closed. No extra rating event is introduced by a
challenge; its linked games remain canonical match records.

An integration review reproduced an additional ordinary-Matches recovery gap.
The incoming shared rejection classifier distinguishes first-dispatch failures
from receipt checks after a lost response, but only League Night used that
argument. Ordinary Matches could release a pending operation after a later
`42501` admission denial or `PGRST202` endpoint failure. Those errors cannot
prove the earlier request did not commit. Ordinary Matches now persists the
dispatch marker, conservatively treats older unmarked records as dispatched,
and retains the exact ID/payload through those retry failures. Two regression
tests failed before the fix and pass after it, including reload and successful
same-operation reconciliation. A first request with a definite rejection can
still release its draft normally.

## Verification on the merged source

Node `24.20.0`; trusted installer npm `11.19.0`. No environment file was used.

| Check | Result |
| --- | --- |
| `npm run ci:install` | Passed; 572 locked packages and approved resolver rebuild |
| `npm test` | 508 tests passed in 66 files |
| `npm run test:coverage` | 508 passed; configured thresholds passed at 96.53% statements, 90.90% branches, 97.76% functions and 97.59% lines |
| `npm run lint` / `npm run typecheck` | Passed; added browser script also linted after creation |
| `npm run rivalry:local -- build` | Passed optimized Next build and route generation against verified loopback Supabase settings |
| `node scripts/qa/rivalry-api.mjs` | 65 actual local Auth/PostgREST/API checks passed |
| `RDD_REVIEW_ARTIFACTS=1 node scripts/qa/rivalry-browser.cjs` | 22 production-browser assertions passed, including avatar interrupted-save/reload replay, challenge acceptance/recording/correction, restored accepted terms and PPD input, completed-series headline, TV mode, poster export and keyboard dialog behavior; zero browser exceptions |
| `node scripts/qa/rivalry-ui-integration.mjs` | 96 actual local DB-backed renders: 12 routes, both OS color schemes and widths 320/390/1024/1440; HTTP 200, admitted session retained, no document overflow or render failure |
| Shared-page assertions | Home leaderboard order, all directory avatars, owner roster of 24 choices plus initials, player heading avatar, visible image loading, retained release links and mobile Escape focus passed |
| Visual inspection | Statistics and directory at 320px/1440px, plus avatar picker at 320px, inspected in light/dark; no merge layout regression found |
| Git checks | No remaining conflicts/markers or whitespace errors; lockfile, Next config, workflows and deployable migration directory unchanged |

The Rivalry browser script has one conditional extra assertion when duplicate
confirmation is triggered. That branch did not trigger in this run, hence 22
rather than the source review's 23. The API/unit duplicate checks remain passing.
The new shared-page harness was corrected to wait for visible lazy images and
compare equivalent compiled CSS hex forms; neither issue required an app fix.

Synthetic evidence is ignored under `.local/rivalry-room/`: `api-evidence.json`,
`browser-evidence.json`, `browser-review/` screenshots and
`ui-integration/evidence.json` with the current screenshot matrix. Browser
requests were restricted to app port 3040 and API port 56621. This reused the
idle, verified loopback `rdd-rivalry-room` fixture containing invented accounts.
The API/feature-browser scripts mutate only that synthetic fixture; the shared
page matrix reads app data. Existing tracked feature screenshots were preserved.
The preview process started for this check was stopped; the Docker stack remains
available to its feature checkout.

The clean install reported the existing moderate development-only `undici`
advisory documented in the PR #75 integration. No dependency upgrade or lockfile
change was bundled; its W3 follow-up remains open.

## SQL and remaining release gates

The added source is `supabase/tests/fixtures/rivalry_room.sql`, outside automatic
deployment migrations. Committed Git blob: `7b856dda85d38eafa1dc44a18732f5a8b8b3e4bb`.
SHA-256 of committed bytes:
`4640de1b46210adf05e7f2d99676666a85a07327b14dbc4b53db8b4641a34853`.
This identifies reviewed fixture input, not an approved deployment script.

It creates `rivalry_private` avatar/catalog, challenges, canonical game links,
audit events and replay receipts. It requires invitation admission, planning and
the final game-mode `rdd_save_match` implementation. It moves the public save
implementation into `rivalry_private.base_save_match` and adds an outer atomic
challenge-link wrapper. Private tables/functions remain inaccessible directly
to anonymous/authenticated callers. The release manifest must install the
final parent/game-mode implementation first and preserve this outer wrapper;
blind repeat installation is unsafe. Solo does not replace that save RPC.

W0 stays passed with the recorded scope addition. W1 remains the dated hosted
baseline, with owner Vercel target/configuration verification open. W2's future
statistics storage scope remains unchanged. W3 must still run the dedicated
full release upgrade and legacy-record preservation/security matrix, including
ordinary/team/Solo workflows through the final chain. W4/W5 add Rivalry private
data, grants, triggers and receipts to protected backup/restore, production-shaped
upgrade and compatible-app rollback. W6 adds avatar/challenge/TV/phone acceptance.
W7/W8 retain final freeze, approval, cutover and observation gates.

These checks did not recreate the full chain from the hosted legacy baseline,
copy production data, prove a backup/restore, exercise hosted email/configuration,
run CI on the new merge SHA or deploy anything. No branch was pushed and no
hosted SQL, Auth, Supabase or Vercel setting was changed.
