# Rivalry Room local handoff

Implemented on branch `rivalry-room` in `F:\RDD\Rochester-Darting-Degens-rivalry-room`.
Base: `release/next` at `16e58f991fb9e357c590e3959e0c00e1d9d568b1`.
At worktree creation, an authenticated fetch confirmed remote `release/next`
at `42df060fdf7d26a63e00d00ccf0152a37f4abccb`; the two newer local commits
were release-preparation documentation. Their tracked content is included.
The original worktree and its untracked plan/mockup were preserved.

## Delivered

- `/rivalries`: featured faceoff, evidence-based rivalry stories, lifetime
  results, scoped game/board views, recent encounters, rival discovery and
  challenge inbox/archive. Low-data cases show a new chapter without invented
  accomplishments. Historical unknown rules and boards stay unknown.
- Stable `/rivalries/pair/<player>/<player>` and
  `/rivalries/challenges/<id>` pages. Public metadata is generic; data requires
  active league admission. Sign-in preserves only explicitly allowed routes.
- 24 curated avatars, initials and image-failure fallbacks, independent
  revision-checked owner saves, and shared profile/list, Board author/reply,
  player-selection and faceoff rendering. No upload or runtime image generator.
- Singles challenges for 301, 501 and standard Cricket; known rules/board,
  best of 3/5/7 **games**, first to 2/3/4, an upcoming scheduled night,
  recipient acceptance, expiry, three outgoing pending invites, pair
  uniqueness and decline/withdraw cooldown. Acceptance does not RSVP or mark
  attendance.
- Existing League Night recorder with fixed challenge participants and
  accepted terms. Canonical game save and link are one transaction. Normal
  creator corrections remain possible and recompute series truth. No bonus
  rating event or duplicated personal score is introduced.
- Schedule changes require both players to reconfirm. Unstarted cancellation,
  proposed/agreed abandonment, withdrawal of a proposal, explicit audited
  link repair and server-owned organizer resolution preserve recorded games.
- Derived completion, invalid/post-clinch game review and canonical source
  change triggers. A correction can remove a winner and reopen the series.
- Explicit fullscreen TV view, responsive dark/light layouts, reduced-motion
  behavior, poster preview/download and editable Board drafts. Board posts are
  sent only by the user through the existing approved-member composer. Exact
  private rivalry routes render as authenticated links. No image upload or
  automatic posting is assumed.
- Durable per-operation recovery slots, exact-payload replay, cross-tab
  preservation, revision conflicts, focus/poll refresh and visible stale-data
  recovery. Export previews reset if their source names, avatars or result
  change.

Avatar selections live in a private profile-linked table instead of adding
client-writable profile columns. This prevents the existing whole-profile
upsert from accidentally overwriting avatar state or bypassing catalog and
revision checks. Only the avatar RPC changes that state.

## Local preview

From this worktree:

```powershell
npm run rivalry:local -- start
npm run rivalry:local -- test
npm run rivalry:local -- dev
```

Open `http://127.0.0.1:3040/rivalries`. The isolated project is
`rdd-rivalry-room`, workdir `.local/rivalry-room`, API port `56621`, app port
`3040`. Docker ports bind only to loopback. The runner checks the project,
services and target URL; it does not use hosted credentials or modify other
local stacks.

The API test seeds fictional Demo Ben/Mike/Alex/Sam accounts and a few
scheduled nights. Their local password is in the **ignored**
`.local/rivalry-room/demo.json`; no credentials are tracked. Demo Ben has
local-only organizer authority for resolution testing. All preview results
are synthetic. `test` resets only challenges owned by those explicitly
synthetic accounts on this isolated project.

`build` and `serve` use the same local configuration. The generated SQL stays
in [the local fixture](../supabase/tests/fixtures/rivalry_room.sql), outside
`supabase/migrations/`. Apply it after admission, planning and game modes in
an approved rollout; it wraps the existing recorder rather than replacing
its canonical validation/correction implementation.

## Verification

Verified on 2026-09-28 in America/New_York (final evidence timestamps extend
into 2026-09-29 UTC):

| Check | Result |
| --- | --- |
| Trusted locked install | `npm run ci:install` passed; lockfile and dependency versions unchanged |
| Full unit/integration suite | 57 files, 465 tests passed |
| Coverage | 96.50% statements, 90.47% branches, 98.07% functions, 97.56% lines; all required thresholds passed |
| TypeScript and ESLint | Passed |
| Production Next build | Passed against isolated local configuration; all three Rivalry routes generated |
| Local database/API | 56 checks passed: admission, forged actors, whitelist, avatar conflicts/replay, atomic rollback, acceptance, attendance separation, series/correction/reopening, concurrent games/invitations, caps, cooldown, expiry, schedule reconfirmation, revocation, audited repair and organizer resolution |
| Real Edge browser | 19 checks passed, no page exceptions: 320/390/768/1440 widths, dark/light, reduced motion, fullscreen, dialog keyboard focus, reviewed download, avatar save and deliberately lost response followed by reload/replay, invitation/acceptance, locked recorder, duplicate confirmation, canonical series progress |
| Final production preview | Admitted room, private pair page and all 24 avatar choices plus initials loaded against the isolated database; no page exceptions |
| Art export | 24 individual transparent 512px portraits plus 256px/96px variants; all master alpha minima 0; IDs agree with the server whitelist and all exported files exist |

[Desktop](testing/rivalry-room/lobby-dark.png),
[production desktop](testing/rivalry-room/production-desktop.png),
[phone](testing/rivalry-room/lobby-390.png),
[TV](testing/rivalry-room/tv-view.png),
[series](testing/rivalry-room/series-desktop.png) and
[poster export](testing/rivalry-room/export-poster.png) are synthetic visual
evidence. [Art provenance and prompts](art/rivalry-avatars/README.md) and
[asset catalog](art/rivalry-avatars/catalog.json) are retained.

Browser testing exposed a pre-existing sign-in timing race: delayed initial
auth verification could read the URL after navigation and redirect again to
Matches. Both paths now capture the allowed return destination before waiting.

## Remaining acceptance and publication

Owner visual/play acceptance is still required, including the expanded avatar
roster on actual phones and a real league-night TV. The loopback browser run
is not device, production-performance, hosted authentication or production
database evidence.

Hosted SQL, backup/restore, migration history, production configuration,
release integration, publication and deployment remain deferred under the
repository release gates. This feature has not been added silently to the
active release candidate. No hosted data, organizer assignments or messages
were changed, and no push/deployment was performed.
