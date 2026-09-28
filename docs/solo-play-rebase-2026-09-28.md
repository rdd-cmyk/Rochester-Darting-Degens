# Solo Play integration with League Night Mode

The user authorized local commits, publication to `origin/solo-play`, and a PR
targeting `origin/league-night-mode`, with rebase and integration fixes first.
The remote parent inspected for this rebase was `b9cd384`, including planning,
the Board, read recovery and invite-only registration through PRs #70–#73.

The reviewed pre-rebase branch is preserved locally at
`backup/solo-play-pre-league-night-rebase-20260928` (`b5a23cb`). Rebase started
after snapshot `76913ce`: its application/schema tree matched the real League
Night parent `ff7e0fe`, with only three documentation differences. Omitting the
snapshot retains the actual parent history instead of replaying duplicate code.

## Final scope and integration fixes

The PR includes the existing game-mode/rule/cohort and team-rating prerequisites,
Solo Play, the hydration repair, and the independently verified review fixes.
All outgoing commits were inspected. The game-mode prerequisites are included
because Solo uses their catalog, scoring contracts, `game_config` column and
compatible league queries. This is broader than the `/solo` page alone.

Conflicts were resolved by retaining both sides' behavior: planning-status
loading plus `game_config`, independent local stack routing, invite and Solo
scripts, and planning/game/Solo coverage. The equivalent hydration fixes were
combined with the reviewed failed-write override and the parent's recoverable
hydration-error assertion. Board/invite/planning feature code, the parent's
dependency lockfile, and CI workflow remain unchanged.

Integration inspection identified an admission issue beyond textual conflicts:
replacing `rdd_save_match` could bypass the parent's invitation wrapper. The
game-mode fixture now upgrades its private implementation and restores the
checked public wrapper atomically, keeping private execution revoked. Correction
snapshots add restrictive membership RLS. All four Solo RPCs check active league
membership before writing, replaying or projecting; all three Solo read tables
have restrictive membership policies. Profile consent and owner isolation still
apply independently of admission.

The isolated Solo setup/rehearsal now includes the complete parent fixture chain.
Only explicitly fictional QA accounts are admitted, with no general account
grandfathering. An independent source re-review found no remaining actionable
issue in these admission fixes or the merged parent UI paths.

## Verification after rebase

- Trusted pinned install passed: 572 packages; audit reported zero vulnerabilities.
- 419 application tests across 51 files passed, including parent invitation,
  Board and planning tests and Solo regressions.
- Coverage passed: 98.31% lines, 90.8% branches; repository thresholds passed.
- Lint, typecheck and production build passed with isolated loopback configuration.
- Fresh combined-schema rehearsal passed 47 pgTAP assertions: original 23 plus
  24 admission assertions. Legacy rows, atomic rollback, owner privacy, projections,
  valid saves/replays, provisional denials and non-vacuous revoked-owner reads are
  covered. A revoked owner cannot replay a previously committed operation.
- 36 real local API checks passed, including concurrency, retry/undo, validation,
  consent and exact preservation of existing competitive rows.
- Production-browser verification passed for save/reload, interrupted committed
  responses, exact retry, edits, delete/undo, night sharing, profile consent,
  keyboard details, 320/390/768/1440 layouts and dark appearance. No browser script
  errors. Generated rebase screenshots stay ignored under `.local/solo/rebase-screenshots`.
- The QA login selector was updated for the parent's current Sign in form.
- Targeted production-browser regressions also passed for failed preference
  writes and hiding cached Solo metrics while a fresh consent check is pending
  or denied, without changing database consent. No browser script errors.

SQL remains entirely outside deployable `supabase/migrations/`. Hosted schema,
Auth/RLS, backup, restore, rollout and production behavior have not been exercised
or changed. Creating the requested PR is separate from merge or hosted rollout.
The repository's existing [release gate](supabase-github-integration-release-gate.md)
still applies before either. The game-mode enable fixture is local-only.
