# Game modes and team ratings: local implementation

Date: 2026-09-27. Branch: `game-modes-team-ratings`.

Implemented in `F:\RDD\Rochester-Darting-Degens-game-modes`. No hosted
database changes, pushes, merges or deployments occurred.

## What is available

- Eight additions: 701, Cut-Throat Cricket, No-Score Cricket, Count-Up, Around
  the Clock, Shanghai, Gotcha, and Halve-It / Bermuda Triangle. The last choice
  has separate nine-round Halve-It and thirteen-round Bermuda presets.
- Versioned, selectable rule presets; unspecified historical rules stay
  unspecified. Existing 301, 501, Cricket and Other remain available. Other
  can include a descriptive name for later classification.
- Individual, 2v2 and 3v3 entry in Matches and League Night. Explicit teams,
  winning side, optional shared score, optional personal 3DA/MPR, rematches,
  recovery, atomic saves, revision conflicts and exact retries.
- Points and finishing-dart metrics, including legitimate zeros and missing
  values. Finishing-dart scores belong only to finishers. Cut-Throat points
  are labelled as penalties. Shanghai combination wins are explicit.
- Power Rating policy `team-split-v1`: average teammate ratings to predict
  the winning side, then divide its K=32 adjustment among actual teammates.
  Equal sides move each player by 8 in doubles or approximately 5.33 in triples.
  No synthetic singles games or extra fixture bonus are created.
- Actual appearances and evidence games are separate. Singles/FFA contribute
  1 evidence game, doubles 1/2, triples 1/3; provisional threshold remains 10.
  Practice, handicapped, tied and abandoned results are retained but unrated.
- Overall and format-filtered rankings, compatible score cohorts, rating
  explanations, team-aware results and recaps. Score groups separate game,
  preset, board and format. Shared scores never become individual averages.
- Corrections preview overall rating effects, clear incompatible scores,
  preserve original values in an owner-readable audit and replay chronology.
  Matches has an explicit preview button. A League Night reclassification
  shows its preview on the first save attempt and requires saving again.

Home/profile headline averages retain their legacy individual, unspecified-rule
cohort. Advanced Statistics contains the new preset and format comparisons.
The older aggregate 301/501 headline is retained with an explicit legacy label.
New named-preset and team results still contribute to eligible win/loss records.

## Dependency and scope

This work starts from main `690a01b` plus local dependency snapshot `76913ce`
(`chore: snapshot local League Night dependency for game modes`). That snapshot
copies the existing League Night changes into this isolated worktree. It does
not modify the original League Night, scheduling, Board or main worktrees.
Before any integration, reconcile this dependency with the final League Night
branch instead of publishing a second diverging copy.

This batch records shared games. Club fixture schedules, best-of-series
orchestration, permanent partnership leaderboards, bulk historical correction
and dart/round-level metrics remain follow-ups. Only recorded summary inputs
are used; there are no inferred checkouts, resets or exact weighted team
averages. No hosted historical records were automatically reclassified.

## Verification

All data used below are synthetic and local.

| Check | Result |
| --- | --- |
| `npm run ci:install` | Passed; pinned dependency installation, audit reported zero vulnerabilities |
| `npm test -- --reporter=dot` | 253 tests across 32 files passed after independent review |
| `npm run test:coverage` | 253 tests passed; 99.25% lines and 90.46% branches across configured modules, including the game catalog and correction module; repository thresholds passed |
| `npm run lint` and `npm run typecheck` | Passed |
| Production build | Passed via `node scripts/game-modes-local.mjs build`, which runs the same Next build command with isolated local Supabase values |
| `node scripts/game-modes-local.mjs test` | 36 transaction/access-control checks plus 11 preservation, activation and retry assertions passed against a fresh legacy-only database |
| `node scripts/qa/game-modes-api.mjs` | 30 real local API assertions passed |
| `node scripts/qa/game-modes-browser.cjs` | Headless Edge at 390px: all modes, doubles save/reload/edit, committed-but-unconfirmed retry, correction preview/save, filtered ratings, triples save/rematch, no horizontal page overflow or uncaught page errors |

The clean database rehearsal starts from the exported legacy schema and the
League Night fixtures, with no advanced-statistics foundation dependency. It
compares every original profile, match and participant value, leaves historical
rules null, verifies the disabled default gate, verifies old-style saving while
disabled, and confirms that an already committed new-format operation can be
retried even after the gate closes. The latest rehearsal is retained locally
as `rdd_games_rehearsal_1790544562306` for inspection. The demo function is
refreshed only after the clean rehearsal passes.

API checks cover every new game and both Halve-It/Bermuda presets, doubles and
triples, zero scores, correct score ownership, malformed teams, cross-game
presets, completion-only metrics, duplicate warning, exact retries, altered
retry rejection, stale revision, another recorder's edit, direct-write denial,
anonymous denial, original-value audit and audit privacy. The old test's
out-of-range average is now 181 instead of 168 because X01 entry supports
up to 180, including open-out presets. Existing stored scores are unchanged.

## Independent code review and repairs

An independent agent reviewed the committed implementation without editing it.
I reproduced or checked each finding against the code, added focused regression
coverage, and repaired the five verified issues:

1. Completion-score chart positions used the minimum as their maximum and
   could exceed the chart width. The scale now uses the upper displayed range.
2. Valid practice/handicapped/unresolved results were mistaken for missing
   history, withholding unrelated competitive recap awards. They remain
   unrated without being counted as incomplete evidence.
3. The ordered League Night recap named only one member of a winning team.
   It now names every winner and the team format.
4. Profile loss filters counted tied and abandoned games as losses. Both recent
   and paginated views now require a completed result; the local PostgREST
   filter was checked against legacy null, completed and unresolved rows.
5. The Cricket points field announced a literal code expression to screen
   readers. Its accessible label now names points or penalty points correctly.

My own regression pass also found that an excluded practice game could hide
otherwise compatible score comparisons; score cohorts now use only analyzed
results. The independent reviewer rechecked the fixes and found no remaining
concrete defect in those paths. This is a local source and synthetic-data
review, not hosted acceptance.

Mobile screenshots: [doubles](testing/game-modes/doubles-mobile.png),
[correction](testing/game-modes/correction-mobile.png),
[rankings](testing/game-modes/rankings-mobile.png),
[triples](testing/game-modes/league-night-mobile.png). Screenshots contain only
synthetic names. Summer decorations are an existing user preference.

The local production server still logs the existing signed-out profile metadata
lookup warning during navigation/prefetch; authenticated client data and saves
passed the browser checks. This is not a claim of hosted metadata verification.

## Rating sensitivity experiment

Run `node scripts/qa/team-rating-simulation.mjs`. Twenty fixed seeds each use
24 synthetic players, 4,000 training contests and 1,000 subsequent evaluation
contests with frozen ratings. Compare division by team size against division
by its square root. Outcomes are generated from fixed skill and team-mean
logistic probabilities, so this experiment assumes the model's basic structure.

| Schedule | Split Brier score | Square-root Brier score | Split skill RMSE | Square-root skill RMSE |
| --- | ---: | ---: | ---: | ---: |
| Mixed singles/doubles/triples | 0.1999 | 0.2013 | 53.9 | 62.6 |
| Rotating triples | 0.2166 | 0.2189 | 51.7 | 70.0 |
| Fixed triples with varied member strength | 0.2401 | 0.2435 | 172.8 | 174.9 |

Lower is better for both metrics. These synthetic runs support retaining the
conservative initial split, not a claim that it is optimal or fair for this
league. Fixed partners still have substantial individual error because their
results do not separate contributions. Real chronological team outcomes are
needed before league-specific calibration; none were fetched or invented.

## Run the local preview

From this worktree:

```powershell
node scripts/game-modes-local.mjs start
node scripts/game-modes-local.mjs test
node scripts/qa/game-modes-api.mjs
node scripts/game-modes-local.mjs build
node scripts/game-modes-local.mjs serve
```

Open `http://127.0.0.1:3013`. The isolated Supabase stack uses port 55721 and
project `rdd-game-modes`; it does not use the separate League Night stack.
Synthetic demo account: `games-ace@example.test`, password
`Local-Games-Demo-2026!`. This password is only for the disposable local account.
The browser QA uses the bundled Playwright runtime and installed Microsoft Edge.

## Hosted release remains gated

1. Reconcile and approve the League Night dependency and final application diff.
2. Refresh hosted schema, policies and migration history; verify backup/restore,
   a compatible rollback and the existing Supabase integration release gate.
3. Apply the approved additive fixture after League Night. Keep
   `rdd_private.game_modes_control.enabled = false` initially. No SQL has been
   placed under `supabase/migrations/`.
4. Deploy all readers supporting `game_config`; verify entry, profiles, home,
   stats and recaps before enabling new writes. New application queries require
   the additive column, so application deployment alone is insufficient.
5. Review board presets and the rating policy, then explicitly enable writes.
   The local-only enable fixture is not an authorized hosted deployment script.

Closing the gate pauses new configuration writes while preserving records and
exact retries. Keep compatible readers available during rollback: an old client
must not silently treat a team result as free-for-all or discard new modes.
Do not delete new match data to roll back the feature.
