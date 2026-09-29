# W0 completion: scope and initial release candidate

Status: **passed**. Completed 2026-09-28.

Scope addendum, 2026-09-29: the owner authorized integrating PR #75's updated
interface branch into `release/next`, with release behavior taking precedence
over its older main-based workflows. [Integration evidence](pr75-ui-integration.md)
records this later candidate. The identities, counts and SQL hashes below remain
the historical initial snapshot; W0 does not need to be repeated.

Additional scope authorized 2026-09-29: Rivalry Room, 24 curated avatars and
challenge series join the candidate. The [integration record](rivalry-ui-integration.md)
identifies the reviewed source and checks. The live release inventory now adds
`rivalry_room.sql`; the nine SQL identities below and the original JSON remain
the dated W0 starting point. W3-W7 must use the expanded candidate.

## Candidate identity

| Item | Verified value |
| --- | --- |
| Integration branch | `release/next` |
| Worktree | `F:\RDD\Rochester-Darting-Degens-league-night-mode` |
| Initial application/SQL source SHA | `42df060fdf7d26a63e00d00ccf0152a37f4abccb` |
| Refreshed `origin/release/next` | Same source SHA; ahead/behind `0 / 0` before the W0 documentation commit |
| Refreshed `origin/main` and merge base | `690a01b84d96c55b8ec455a6e298c17ec6093b50` |
| Candidate compared with main | 28 commits; 199 changed files; 26,893 insertions and 856 deletions |
| Checked-in runtime contract | Node `24.20.0` in `.nvmrc`; trusted installer pins npm `11.19.0` |
| Application CI | [Run 36480187732](https://github.com/rdd-cmyk/Rochester-Darting-Degens/actions/runs/36480187732), completed successfully for the source SHA |
| Tracked deployment migrations | None under `supabase/migrations/` |
| Open PRs | None at this verification |

The source SHA identifies the initial implementation to assess. The local W0
documentation commit adds planning/evidence without changing that application or
SQL source. Later implementation fixes must record a new candidate SHA and rerun
affected gates; this initial snapshot is not the final release freeze.

The [machine-readable snapshot](w0-candidate.json) records the verification time,
all 28 commit identities/subjects, all 199 changed paths, runtime/configuration
identities, and Git blob IDs plus SHA-256 hashes for nine candidate SQL inputs.
Hashes use committed Git blob bytes so local CRLF conversion does not change the
comparison. They identify starting files; reviewed deployment hashes will be
recorded after W2 and the combined rehearsal.

## Confirmed product scope

| Included area | Source provenance |
| --- | --- |
| League Night Mode | Atomic saving/recovery, attendance, rematches and recap; initial commits `16a532f`, `d6557a6`, `ff7e0fe`. |
| Planning | PR #70, merged as `6b11f7d`; polls, scheduling and binary RSVPs. |
| Message Board | PRs #71/#72, merged as `1213878`/`0d40f83`; approval, moderation and save/read recovery. |
| Invite-only registration | PR #73, merged as `b9cd384`; admission and invitation/recovery workflows. |
| Game modes and team games/ratings | Included through PR #74; prerequisite commits `c2ded8f` and `1d4d28a`, plus combined admission fixes. |
| Solo Play | PR #74, merged as `42df060`; private practice, consented sharing and existing practice comparisons. |
| Future statistics storage | Owner confirmed inclusion on 2026-09-28; modernize the existing foundation in W2 before any rollout. |

Future statistics work is storage and compatibility only: seasons table/linkage,
optional detailed-stat columns, source/detail metadata, constraints, timestamp
behavior and a caller-permission query view that carries game/team context.
Current site statistics and calculation definitions are outside that preparation.

No new season-management UI, automatic season assignment/rating reset, enhanced
league-stat entry, additional statistics UI/calculations, imports, turn-level
scoring or unrelated dependency modernization is included. Historical season/raw
values remain unknown where there is no evidence; seasons may remain empty.

## Database scope and boundaries

The [release plan's SQL inventory](../release-next-readiness.md) contains the nine
starting inputs: statistics foundation, League Night, planning, Board,
invitations, parent admission, game modes, Solo, and separately staged direct-write
enforcement. Their exact identities are in `w0-candidate.json`.

The existing schema baseline is for local reconstruction; the game-mode enable
fixture is for local demos; the planning visibility upgrade is conditional on an
older installation. Synthetic seed/test SQL is excluded from production. None of
these is implicitly approved by appearing in the repository.

Known follow-up work remains assigned to later packages:

- W1 refreshes actual hosted schema, Auth, migration history and deployment
  integrations. W0 made no hosted Supabase inspection or configuration claim.
- W2 resolves foundation permissions, historical defaults/validation, game-aware
  view ordering and final-state tests. Invitation SQL's seasons dependency is
  retained in the accepted scope, not left as an undecided product question.
- W3 tests the full chain with preservation snapshots before any release SQL.
- W4/W5 prove protected backup restoration, production-shaped upgrade and
  compatible rollback; W6 settles membership, organizers and operational acceptance.
- W7/W8 govern release approval, staged cutover and live observation. A passing W0
  does not authorize a data export, hosted DB/Auth change, push, merge or deployment.

## W0 acceptance record

- [x] Owner's existing-feature and future-storage scope is recorded without adding
  new statistics features.
- [x] Remote refs refreshed; local candidate and remote release identity agree.
- [x] Initial main baseline, commit inventory and changed-path inventory recorded.
- [x] SQL input/exclusion inventory and reproducible source hashes recorded.
- [x] Runtime/configuration identities and exact-candidate CI evidence recorded.
- [x] Existing local changes accounted for: README and roadmap links plus the
  release plan drafted in this chat. Only documentation is included in W0.
- [x] Release-plan links, snapshot consistency and whitespace/source-scope checks
  passed. Application/DB suites are not required for this documentation package;
  their combined-release runs remain W3 gates.
- [x] W0 marked passed in the [execution table](../release-next-readiness.md),
  with W1-W8 still open.

The W0 exit gate is met: an inspectable plan, confirmed scope, complete starting
source/SQL inventory and initial candidate identity are available for the next
work package.
