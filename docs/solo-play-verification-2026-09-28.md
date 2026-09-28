# Solo Play and Practice & Performance

Local implementation dated 2026-09-28, authorized by the user's “Let's build it.”
Branch `solo-play`, worktree `F:\RDD\Rochester-Darting-Degens-solo-play`,
starting at game-modes review commit `24ff15e`.

## Available behavior

- `/solo` logs 501, 301 and Cricket anywhere, with board and rule presets,
  3DA/PPD/MPR, optional scores, raw totals, dates, completion times, private
  notes and a general location. Stopped games remain in history.
- Save and play again preserves format and context. Drafts have a per-tab,
  user and environment identity and a 24-hour expiry. Submitted operations
  are retained until their exact payload is confirmed, including after an
  interrupted response. Editing requires a revision; deletion can be undone.
- Profile statistics open on League, including when navigating to another
  profile. Solo and All play are deliberate alternatives. Compatible scoring
  cohorts separate game, board and rules. Competitive records stay in League.
- Individual history is private. Sharing profile aggregates and showing a
  linked game's night activity are independent controls. Notes and locations
  never enter either shared projection. Unconfirmed visibility changes are
  labelled and require reconciliation before another change.
- League Night recap contains a separate **Solo at the venue** section.
  Solo entries add no attendance, rating, wins/losses or awards. Night sharing
  uses the current signed-in League Night audience. If night access becomes
  more restrictive, the projection's authorization must change too.
- Practice & Performance is private, with two scoring series, aligned practice
  volume, score coverage, selectable night details, baseline evidence and
  accessible tables. Missing data and failed requests have distinct states.
- Navy, orange and cream styling uses the existing tokens, including dark mode.
  The saved seasonal-overlay preference now hydrates without a text mismatch.

## Frozen calculation contract

Reported scoring is the arithmetic **average of game averages**, with scored
games and total eligible games disclosed. All play weights source summaries
by scored-game count. Missing scores remain null. PPD converts to 3DA by
multiplying by three; original inputs remain stored.

Exact solo 3DA/MPR uses `3 * sum(valid raw total) / sum(darts)` only over
compatible games with complete raw evidence. It is separate from reported
averages and from league summary records. X01 raw totals are net points;
Cricket totals are valid marks. Darts include bust darts. Neither is inferred.

Practice comparison uses individual, completed, competitive league results,
with no handicap, duplicate players, invalid chronology or incompatible rules.
Practice counts completed, included, nondeleted solo games, even without a
score. One observation represents one player/night.

- Prior practice window: seven America/New_York calendar days before the
  night's date, excluding the same day.
- Baseline: the previous five eligible night averages, weighted equally by
  night; each needs three scored games and at least 80% scoring coverage.
  The current night and other nights on its date do not enter the baseline.
- Insight: fixed 0–2 versus 3+ logged-game groups, at least five eligible nights
  in each, three distinct practice counts, full baselines and nonoverlapping
  practice windows. It reports the difference in mean baseline-adjusted
  scoring. It is descriptive, with no significance or causal claim.
- Same-day chronology: completed solo games before the first **recorded league
  result**, plus unknown completion-order counts. Actual league start times
  are unavailable, so this does not claim confirmed pre-game warmups.

Zero logged practice does not establish no practice. Opponent mix, ordinary
improvement and selective logging can affect the comparison. Sparse or constant
practice histories receive an insufficient/variation message. Unrounded values
are used for calculation; only presentation is rounded.

## Verification

All database and browser data are fictional and loopback-only.

| Check | Result |
| --- | --- |
| `npm run ci:install` | Passed; pinned installation, audit reported zero vulnerabilities |
| `npm test` | 277 tests across 37 files passed, including the hydration regression |
| `npm run test:coverage` | 277 tests passed; 99.24% lines and 91.29% branches; repository thresholds passed |
| `npm run lint` / `npm run typecheck` | Passed |
| `npm run build` via `solo:local build` | Passed against isolated local Supabase |
| `node scripts/rehearse-solo.mjs` | 23 pgTAP assertions passed in a fresh retained rehearsal database |
| `npm run solo:local -- test` | 36 API checks passed, including concurrent saves/edits, privacy, retries, raw bounds and unchanged competitive rows |
| `node scripts/qa/solo-browser.cjs` | Save/reload, interrupted committed response, exact retry, edit, delete/undo, night sharing, Cricket history-only, profile scopes, sharing/revocation, keyboard night details and mobile/desktop light/dark checks |

The rehearsal installs the fixture after the baseline, League Night and game
modes. It compares complete existing profile, match, participant and night rows.
A fault injected into the replay-log insert proves that the session, game and
operation roll back together. Concurrent API checks prove a single committed
create and one successful edit for the same expected revision.

Browser evidence in [testing/solo](testing/solo/) includes entry and progress
screenshots and separate night activity. Width checks cover 320, 390, 768 and
1440 pixels. Night details and replay work from the keyboard. Dark control text
contrast is checked after the theme transition settles. Browser script errors
are treated as failures, including hydration errors.

## Local review

The subsequent [independent code review and verified fixes](solo-play-review-2026-09-28.md)
record five corrected issues and updated final checks (284 tests). Its timeline
includes compatible historical ranked games without a night link; night
comparisons exclude mismatched played dates, and scoring excludes invalid
historical values while retaining game counts.

From this worktree:

```powershell
npm run solo:local -- start
node scripts/rehearse-solo.mjs
npm run solo:local -- test
npm run solo:local -- build
npm run solo:local -- serve
```

Open `http://127.0.0.1:3016/solo`. The isolated database uses port 56321 and
project `rdd-solo-play`; the scripts reject other targets and non-loopback
bindings. Demo users are fictional. Their generated sign-in details live in
the ignored `.local/solo/demo.json`, never in tracked documentation or real
account configuration. Stop only this stack with `npm run solo:local -- stop`.

## Integration and release boundary

The branch was subsequently rebased onto `origin/league-night-mode` at `b9cd384`.
The duplicate local League Night snapshot was omitted. The PR includes Solo's
game-mode prerequisites and preserves planning, Board and invitation admission.
See [rebase fixes and updated verification](solo-play-rebase-2026-09-28.md).
It is not a feature-only diff from `main`. Other active worktrees were not changed.

SQL remains in `supabase/tests/fixtures/solo_play.sql`; there is no deployable
Solo SQL in `supabase/migrations/`. Branch publication and a PR to League Night
Mode were later authorized; merge and hosted deployment remain separate. Follow the repository's
[Supabase release gate](supabase-github-integration-release-gate.md): current
schema/RLS and audience review, backup/restore, migration-history adoption,
representative rehearsal and rollback, then owner-approved rollout. Deploying
the app before the schema shows an unavailable message and preserves drafts.

V1 has no live scorer, import, bot results, automatic location association or
background offline synchronization. Shared night moderation awaits a defined
organizer role. The existing competitive share-card export stays competitive;
practice is presented separately in the on-page recap. A practice-inclusive
export can follow a separate audience/content decision. Owner device review,
full assistive-technology review and hosted behavior remain release acceptance
work; local automated checks do not substitute for them.
