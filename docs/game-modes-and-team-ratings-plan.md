# Game modes and team Power Rating

Created: 2026-09-27

Status: first batch implemented and locally verified on 2026-09-27 after the
user requested "Build it". See the [implementation and verification handoff](game-modes-verification-2026-09-27.md)
for shipped scope, resolved choices, evidence and hosted release gates. The
design below retains the original planning rationale and future extensions.

## Outcome and first batch

Support eight additional game choices, with named Half-It/Bermuda variants,
useful records for each discipline, and an explicit path for shared 2v2 and
3v3 games to contribute to individual Power Rating.

Keep 301, 501, standard Cricket, and Other. The first batch is:

| Addition | Rules that must be recorded | Useful initial score or result | Later optional detail |
| --- | --- | --- | --- |
| 701 | In/out rules, bull scoring, round limit, handicap status | Result; optional reported 3DA/PPD using existing conversion | Raw points/darts, checkout attempts and finishes |
| Cut-Throat Cricket | Target set, bull rules, round/point limits, scoring variant | Result; optional reported MPR and separately labelled penalty points | Marks/darts, closure rounds, penalties dealt/received |
| No-Score Cricket | Targets, closure requirements, round limit | Result; optional darts to complete for finishers | Target-by-target closure and misses |
| Count-Up / High Score | Fixed rounds/dart allowance, bull scoring; distinguish fixed-round play from a race to a target | Final points, with higher better within the same rules | Actual darts thrown, round scores, bull/triple hits |
| Around the Clock / Around the World | Target order, bull finish, singles/doubles/triples requirements, whether multipliers advance targets | Result; optional darts to complete for finishers | Target attempts, misses, progress for nonfinishers |
| Shanghai | Round sequence; whether a single-double-triple combination wins immediately | Result and optional points; record a Shanghai finish separately | Target hits, Shanghai finishes, round scores |
| Gotcha | Target total, bust behavior, out rule, bull scoring, round limit, reset timing | Result; optional darts/rounds to win | Resets inflicted/suffered, points erased, wins after a reset |
| Halve-It / Bermuda Triangle | Named target-sequence preset, starting score, bull scoring, halving/rounding rules | Final points within the same preset | Successful rounds, halvings, points lost, target results |

Half-It and Bermuda Triangle share a family but do not automatically share a
record leaderboard. Offer recognizable names in the picker and save a stable
variant identity. For example, GRANBOARD documents a nine-round Half-It sequence;
Arachnid documents a thirteen-target Bermuda sequence. Confirm the actual board
or house preset before making it the league's default. Use manufacturer rules
as presets, not as proof that all machines implement identical rules.

Default Gotcha to a proposed 301 target, but do not silently choose bust rules
for historical records. Its winning final total is not a useful performance
average; resets also make final net score unsuitable as a scoring-rate proxy.

Additional X01 totals, Random Cricket, Baseball, Killer, Golf, and Scram remain
follow-ups. Do not delay this batch to build a live dart-by-dart scoring app.

## Inspected baseline and integration boundaries

Inspected local main at `690a01b` on 2026-09-27:

- `lib/stats/engine.ts` starts ratings at 1500, uses K=32, and supports one
  winner among two or more individual competitors. It skips multiple winners.
- `MatchFact` has no team membership. Teammates cannot safely be represented
  by marking several players as winners in the existing algorithm.
- Other can already affect Power Rating; comparable-score analysis is separate.
- Score distributions assume higher is better. New completion metrics need
  lower-is-better handling, and a missing value must remain distinct from zero.
- The exported legacy schema fixture requires positive scores. Zero is valid
  in several new modes; the implementation must reconcile database constraints
  as well as browser validation. This is a local source finding, not a fresh
  hosted-schema verification.

The separate `league-night-mode` worktree already contains transactional
`rdd_save_match` work, revision/retry handling, shared nights, and recaps. Its
write validation and recap still contain single-winner and fixed-game assumptions.
The `league-night-planning` worktree also has scheduling work in progress.
Refresh their integration status before implementation, extend the accepted
shared contracts, and preserve unrelated work. Do not build another independent
save path or silently change those worktrees during this planning task.

This plan extends the [statistics roadmap](advanced-statistics-roadmap.md),
especially its game filters and enhanced-metric phases. Dated dependency and
deployment statuses in other documents must be refreshed before implementation.

## Data and entry design

Create one game catalog consumed by match entry, League Night, filters, profiles,
imports, recaps, and statistics. Each definition declares its family, variants,
allowed formats, score units, comparison direction, and optional metric fields.
Use stable IDs and rule versions; changing a display name must not change history.

Separate four concepts:

1. Game and rules: for example, 701 with double-out and split bull.
2. Competition format: individual head-to-head, individual free-for-all,
   shared 2v2, or shared 3v3.
3. Context: league/casual/practice, board, date, night/fixture, handicap status.
4. Outcome and measurements: winning side, completion status, and optional
   typed statistics with units and ownership (player or team).

Logical additive schema, with exact table/column choices settled against the
accepted League Night schema:

- Match game/variant ID and versioned rules snapshot; explicit format and
  completed/tied/abandoned status; rated eligibility and reason.
- Match-side records for shared games, participant-to-side membership, and a
  winning-side reference. Match-specific sides need not be permanent clubs.
- Optional league-fixture association, separate from the game outcome.
- Typed summary statistics owned by a participant or side. Preserve existing
  reported averages and their units; do not reinterpret legacy numeric fields.
- Audit metadata for corrections/reclassification, plus deterministic chronology
  and a versioned rating policy.

Entry should read: choose game/preset, choose format, select players, assign
Team A/Team B when applicable, choose winning side, optionally enter scores,
save. Reuse night defaults and rematch controls. In shared games, the common
score belongs to the team; never copy it into every player's personal stats.

Enforce unique participants, exactly two equally sized sides for v1 team games,
and one winning side for rated completed games. Reject malformed team results
explicitly. Practice, unresolved ties, forfeits, handicapped games, substitutions,
unequal teams, and unsupported rule combinations remain recordable where the
schema supports them but unrated with a visible explanation in v1. Keep current
legacy individual behavior through a compatibility adapter; do not infer teams
from player count or invent old rule settings.

New records can be result-only. Optional scores enable score records; raw darts,
marks, attempts, and round events enable deeper metrics. A missing score must
not prevent an otherwise valid match result from being rated.

## Recommended team rating baseline

Start with a transparent extension of the present model. This is a proposed
RDD policy for evaluation, not a validated estimate of darts skill or a claim
that a team result reveals each player's contribution.

For two equal-sized teams, take each side's arithmetic mean of its members'
pre-match ratings. For team A and B:

```text
teamA = mean(pre-match ratings of A's players)
teamB = mean(pre-match ratings of B's players)
expectedA = 1 / (1 + 10 ^ ((teamB - teamA) / 400))
resultA = 1 if A wins, otherwise 0
transfer = 32 * (resultA - expectedA)
each A player changes by +transfer / teamSize
each B player changes by -transfer / teamSize
```

Compute every update from the same pre-match snapshot, without rounding stored
ratings. Round only display values. Preserve the existing free-for-all path.
With one player per side, this formula matches the current head-to-head update.

For equally rated sides, the expected result is 50/50:

| Format | Each winner gains | Each loser loses |
| --- | ---: | ---: |
| 1v1 | 16 | 16 |
| 2v2 | 8 | 8 |
| 3v3 | about 5.33 | about 5.33 |

Example: players rated 1600 and 1400 have a team mean of 1500, equal to a pair
both rated 1500. Either winning pair gains eight points per member in this
baseline. A win over a stronger opposing side earns more; an expected win earns
less. Both teammates receive the same change because only the shared outcome
has been observed.

Dividing by team size keeps total transferred points per contest consistent
with singles and reduces how strongly one team result changes an individual.
It also slows learning for team-only players, especially in 3v3. Compare this
choice with a less conservative weight during offline evaluation before
activating it. Do not describe conservation of points as proof of fairness.

Do not create four synthetic 1v1 results from a 2v2 game, or nine from a 3v3.
Do not award an extra rating bonus to the player who throws the finishing dart.
Scoring contributions can be displayed independently when actually recorded.

Persistent teammates may be indistinguishable from results alone. Changing
partners and playing singles adds useful evidence; extra mathematical complexity
cannot identify contributions the data never separates. TrueSkill is a possible
later comparison model because it explicitly handles team results and skill
uncertainty, but adopting it is not required for this first implementation.

## What counts as a league match

Support both concepts in the design; implementation priority depends on the
league's intended entry flow:

- Shared game: two or three teammates participate in one game against another
  side. Apply the team formula once to that completed contest.
- League fixture: two league teams play a schedule of singles/doubles/triples.
  Rate the eligible underlying contests using their actual participants. Use
  the fixture total for club standings; do not also rate the fixture in the
  individual ladder.

If a contest is a best-of series, agree on one recording/rating unit for that
competition. Either rate the completed series or its constituent games, never
both. Store the parent-child relationship so later imports cannot double count.
Do not weight by victory margin or leg count in v1. Record only actual players,
not every attendee or registered member of a league team.

## Rankings and specialized statistics

Proposed default: one overall player Power Rating includes eligible individual
and team results after the model review, with visible format breakdowns. Retain
discipline and board views and add Singles, Free-for-all, Doubles, and Triples
filters. Label filtered ratings as recalculated in that selected history, as
the current engine does; they are not slices of an unchanged overall number.

Every rating history event should explain the game, format, opposing side,
expected result, and actual rating change. Team victories give each participant
one team appearance and one win. Expected wins use the side's probability;
strength of schedule uses the opposing side, never teammates. Team upset cards
identify the whole side, and comparisons use compatible formats/field sizes.
Show pairs/trios records when useful without treating a partnership rating as
another bonus to its members' ratings.

Keep the existing ten-match provisional behavior for legacy individual views.
For combined views, evaluate a clearly labelled evidence counter: an individual
appearance contributes 1, doubles 1/2, triples 1/3, with a proposed threshold of
10. Display actual games separately. This is a conservative product heuristic,
not a statistical confidence interval; fixed partnerships still limit inference.

Separate raw score leaderboards by discipline, rule preset, board, format, and
score ownership. Unknown legacy rules stay in a visible legacy/unspecified
cohort rather than being silently mixed with a known preset. Never pool 3DA,
MPR, points, and darts-to-finish. Do not average individual averages and call
the result an exact weighted team average without raw denominators.

For completion records, include only finishers in darts-to-complete distributions
and disclose that denominator; nonfinishers retain their result and optional
progress. Shanghai instant wins and Cricket closure conditions mean points
alone must not determine the recorded winner. Allow legitimate zeros and use
defined null/zero handling for normalized consistency measures.

## Historical Other records

Add a previewable correction flow: select a known game and rules if supported
by evidence, preserve the match ID/date/participants/result, and retain the
original classification and value. An old generic score is not automatically
MPR, 3DA, or darts-to-finish. Reclassify the game while leaving incompatible or
unknown measurements unclassified. Never guess a mode or team from a number.

Show affected records and projected ranking/filter changes before applying a
batch correction. Recompute affected rating histories chronologically; do not
append compensating points. Require explicit team rosters/outcomes to recover
historical team matches. Keep an optional game-name field for future Other
entries so frequently played formats become identifiable.

## Delivery packages and acceptance

| Package | Deliverable | Acceptance |
| --- | --- | --- |
| A: Catalog and rule presets | Eight additions, typed metrics, shared validation/display definitions, legacy adapter | All consumers use the catalog; existing 301/501/Cricket/Other behavior and history preserved; named variants and zero/missing values represented correctly |
| B: Entry and useful stats | Matches/League Night entry, filters, per-mode records, result-only saves, reviewed Other correction | Mobile create/edit/rematch/recovery works; incompatible units and rules never pooled; historical corrections previewable and auditable |
| C: Team data and entry | Explicit sides, shared 2v2/3v3 results, fixture linkage where accepted planning already provides it | Atomic save, membership/outcome validation, idempotent retry/conflict handling, team-owned versus player-owned stats preserved |
| D: Rating preview | Versioned team engine, combined/format views, event explanations, recalculated recaps | Unchanged legacy replay; conservation, permutations, chronology, corrections, no duplicate events; offline model review completed |
| E: Enable and deepen | Accepted policy activated; selected optional detailed stats added progressively | Rating changes understandable; data and deployment gates satisfied; optional metrics only shown when their inputs exist |

Finalize the additive data contract for A and C together, even if their UI
packages ship separately. Until D/E acceptance, team results may be saved but
must visibly say they are excluded from the active rating; never silently omit
them. New game result rankings need not wait for turn-level statistics.

Rating verification should include synthetic equal/unequal-strength sides,
underdog wins, fixed versus rotating partners, new players, singles-only and
team-only populations, 2v2/3v3 mixing, malformed/duplicate outcomes, and a
corrected old result. Test bounded updates, zero-sum changes, and order-independent
roster membership with deterministic chronological replay. Compare proposed
weights using simulations; use held-out chronological outcome prediction if
sufficient authorized real team history becomes available. Report sample limits
and do not tune a model merely to produce a preferred leaderboard.

Implementation checks follow AGENTS.md: relevant unit/integration tests, full
application checks before an implementation commit, local database preservation
and RLS tests, mobile/browser entry and recap review. Include retry after unknown
save confirmation, concurrent edits, legacy-client compatibility, and mixed
deployment versions. Unknown newer formats must fail visibly in old clients,
not masquerade as individual games. Feature-gate team writes until all live
readers can display them correctly.

Keep SQL local under fixtures until the existing hosted schema, RLS, backup,
migration-history, rollout, and rollback gates are met. Respect the
[Supabase integration release gate](supabase-github-integration-release-gate.md).
No hosted changes, pushes, merges, or deployments are authorized by this plan.
Rollback of rating activation restores the prior engine/view without deleting
new matches; newer records stay available with explicit eligibility notices.

## Decisions to resolve during implementation design

- Shared team games, a fixture of individual games, or both as the first UI.
- Actual board/house presets, including Gotcha busts and Half-It/Bermuda targets.
- The previewed team weighting and provisional-evidence policy before activation.
- Integration order with accepted League Night entry and scheduling work.

Recommended starting assumptions are shared team games first, standard unhandicapped
completed contests only, equal participation, conservative split updates, and
separate compatible score cohorts. These are recommendations, not claims of
owner approval or facts about historical matches.

## External references

Reviewed 2026-09-27; revisit exact rule presets against the league's board:

- [DARTSLIVE game guide](https://www.dartslive.com/pdf/gameguide/gameguide_en.pdf)
- [GRANBOARD Half-It](https://store.gran-darts.com/en/pages/half-it)
- [Arachnid Galaxy II.5 manual: Gotcha and Bermuda](https://www.arachnid360.com/wp-content/uploads/2011/08/G2.5manrevC.pdf)
- [Autodarts Gotcha settings](https://docs.autodarts.com/game-modes/party/gotcha/)
- [New Zealand Darts Council game rules](https://www.dartsnz.co.nz/darts-games/)
- [Microsoft Research TrueSkill](https://www.microsoft.com/en-us/research/project/trueskill-ranking-system/)

The proposed split-update formula and provisional evidence weights above are
RDD design recommendations, not formulas attributed to these rulebooks or to
TrueSkill.
