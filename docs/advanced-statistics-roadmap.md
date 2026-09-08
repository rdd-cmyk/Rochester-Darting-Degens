# Rochester Darting Degens Advanced Statistics Roadmap

Status: active implementation on `advanced-statistics`

Supabase project: `hrqsbzmsfichiimtxijj`

Last updated: 2026-09-08

## Implementation status

| Phase | Status | Notes |
| --- | --- | --- |
| 0 — Delivery guardrails | Implemented | Vitest, Testing Library, jsdom, and V8 coverage are configured. |
| 1 — Data foundation | Implemented in source | Editable match chronology and the additive migration are ready; hosted deployment remains gated on schema/RLS review. |
| 2 — Advanced statistics | Implemented | The pure rating and distribution engine is covered by deterministic tests. |
| 3 — Statistics experience | Implemented | The responsive `/stats` dashboard, filters, stories, trend chart, table, and methodology are in place. |
| 3A — Runtime and delivery contract | Complete | Local verification, GitHub Actions run `33327531198`, and Vercel deployment `7Q8bJBqSjuM3hhGKYkcPNomx7ADt` pass on commit `db5816d`. |
| Local Supabase readiness follow-up | User approved | Approved on 2026-09-07 before beginning 3B; reviewed baseline, loopback core services, local RLS/preservation tests, and synthetic browser acceptance. See `docs/local-approval-readiness-2026-09-07.md`. Hosted deployment remains gated. |
| 3B — Next.js security baseline | Implemented and locally verified | Next/eslint-config-next 16.3.4, React/DOM 19.2.8; production audit zero; 59 unit tests and two production-browser scenarios pass. CI/Vercel remain pending push. |
| 3C — Supabase client/auth reliability | Implemented and locally verified | Supabase JS 2.116.0; 59 unit tests, 25 local policy assertions and three production-browser scenarios pass, including local email recovery and token refresh. Hosted auth/RLS and CI/Vercel remain pending. See `docs/package-3c-verification-2026-09-07.md`. |
| 3D — Vercel observability SDKs | Implemented and locally verified | Analytics 2.0.1 / Speed Insights 2.0.0; URL privacy filtering, 81 unit tests and four browser scenarios pass. Hosted intake and CI/Vercel remain pending. See `docs/package-3d-verification-2026-09-07.md`. |
| 3E — Maintenance and pruning | Implemented and locally verified | Vitest/coverage 4.1.11, ESLint 9.39.5, Node types 24.13.3; unused direct declaration removed; full and production audits zero. See `docs/package-3e-verification-2026-09-07.md`. CI/Vercel remain pending. |
| ESLint compatible prerequisites | Implemented and locally verified | TypeScript ESLint 8.70.0 and Hooks 7.1.1; dynamic profile lint gap closed. Historical evidence: `docs/eslint-follow-up-2026-09-07.md`. |
| ESLint 10 bridge trial | Complete; superseded by approved adoption | 64 cross-engine proof checks passed; the original strict peer conflict motivated the separately approved exception. Historical record: `docs/eslint-bridge-trial-2026-09-07.md`. |
| ESLint 10 adoption | Implemented and locally verified | ESLint 10.10.0 / compat 2.1.1 with three approved exact-plugin peer overrides; strict clean install, 150 tests and three browser scenarios pass; independent review complete. Plugin support remains a project-owned exception. See `docs/eslint-10-adoption-2026-09-08.md`; CI/Vercel remain pending. |
| 3F — Optional CSS/tooling evaluation | Awaiting approval | Defined in `docs/dependency-modernization-plan.md`; not started. |

## Product goal

Turn the site into a trustworthy, mobile-first league broadcast: who is
strongest, who is improving, who is dangerous tonight, and why. Advanced
statistics must stay understandable to casual players, preserve the raw number
behind every interpretation, and make incomplete samples obvious.

## Non-negotiable measurement rules

1. Every displayed statistic has a documented definition and denominator.
2. Every ranking exposes games played and supports a minimum-games filter.
3. Ratings remain provisional until ten matches in the selected discipline.
4. 501, 301, Cricket, soft-tip, and steel-tip can be filtered independently.
5. Match averages from legacy records remain usable, but exact aggregate 3DA
   and MPR require raw points/marks and darts thrown.
6. Imported or enhanced records retain their input source and detail level.
7. Database migrations are reviewed in source control before being applied to
   the hosted Supabase project.

## Phase 0 — Delivery guardrails

### Scope

- Replace the ad hoc `node:test` entry point with Vitest.
- Add React Testing Library and jsdom for user-facing component tests.
- Add V8 coverage reporting for the statistics engine.
- Keep `npm test`, `npm run lint`, and `npm run build` as required gates.

### Acceptance

- Existing tests run under Vitest.
- Pure statistics calculations have deterministic unit tests.
- Interactive stat components can be tested by role and visible content.
- Coverage thresholds protect the calculation layer.

## Phase 1 — Trustworthy data foundation

### Schema

- Add `seasons` and an optional `matches.season_id` relationship.
- Record `detail_level` (`summary`, `enhanced`, or `turn`) and `entry_source`
  (`manual`, `csv`, `scoreboard_image`, or `integration`).
- Add optional raw fields needed for exact weighted calculations:
  - darts thrown and X01 points scored;
  - Cricket marks scored;
  - First 9 average;
  - checkout attempts, checkouts made, and highest checkout;
  - 100+, 140+, and 180 counts;
  - Cricket miss, triple/bull, and high-mark counts;
  - throw order and legs won/lost.
- Keep all additions nullable so historical rows remain valid.
- Add a security-invoker match-facts view after hosted policies are reviewed.

### Application foundation

- Make `played_at` editable so delayed entry does not corrupt chronology.
- Centralize stat calculations in `lib/stats` instead of duplicating them in
  page components.
- Preserve the current tables and queries until the migration is applied.
- Move match and participant writes into one database transaction after the
  existing hosted RLS policies have been inspected.

### Deployment gate

The migration is deliberately not applied from this branch. Before applying it:

1. Sign into the Supabase dashboard and export the current schema and policies.
2. Compare the export with the additive migration.
3. Verify a backup exists.
4. Test the migration against a local or branch database.
5. Apply it to the hosted project only after review.

## Phase 2 — Immediate-value advanced statistics

Phase 2 uses fields already present in `matches`, `match_players`, and
`profiles`, so it can ship before the Phase 1 migration is deployed.

### RDD Power Rating

- Initial rating: `1500`.
- Per-match expected win probability for player `i`:

  `q_i = 10 ^ (rating_i / 400)`

  `expected_i = q_i / sum(q for every participant)`

- Rating update:

  `new_rating_i = rating_i + 32 * (result_i - expected_i)`

  where `result_i` is `1` for the winner and `0` otherwise.

This softmax form works for both two-player and winner-takes-all multiplayer
matches and remains zero-sum for every match.

### Expected record

- Expected wins are the sum of pre-match win probabilities.
- Win delta is actual wins minus expected wins.
- Positive values indicate results above opponent-adjusted expectation.

### Strength of schedule

- For each appearance, calculate the mean pre-match rating of every opponent.
- A player's strength of schedule is the mean of those match-level values.

### Form

- Track rating after every appearance.
- Five-match form is current rating minus rating before the last five
  appearances.
- Show the last-five record next to the change so the value is interpretable.

### Consistency

- Only compare scores when one compatible game type is selected.
- Show median, best, 25th–75th percentile band, and median absolute deviation.
- Use normalized median absolute deviation to compare consistency between
  players in the same discipline.

### Stories

- Power leader: highest current rating above the selected minimum sample.
- On fire: largest positive five-match rating change.
- Most improved: largest rating gain from the 1500 baseline.
- Giant killer: win with the lowest pre-match probability.
- Most consistent: lowest normalized median absolute deviation with at least
  three scored matches.

## Phase 3 — Initial advanced-statistics experience

### Dashboard

- Add `/stats` and a primary navigation link.
- Add filters for game type, board type, and minimum games.
- Lead with four story cards instead of a wall of tables.
- Add a rating-history chart with direct player labels.
- Add an exact lookup table for rating, record, expected wins, win delta,
  schedule strength, and form.
- Add consistency cards when the selected discipline has compatible scores.
- Include a visible methodology section and provisional-rating explanation.

### Visual language

- Use the logo palette: Rochester navy, dartboard orange, cream, charcoal, and
  restrained tungsten silver.
- Do not rely on color alone; use labels, ordering, line markers, and signed
  values.
- Use tabular numerals for statistics.
- Keep charts readable on mobile and preserve exact values in the table.
- Avoid radar charts; percentile/range bars are easier to compare accurately.

## Delivery packages between Phase 3 and Phase 4

Dependency modernization is the next delivery stage. It is intentionally
inserted after the implemented Phase 3 experience and before Phase 4 feature
work. The detailed scope, acceptance checks, rollback boundaries, and explicit
deferrals live in `docs/dependency-modernization-plan.md`.

- **Package 3A — Runtime and delivery contract:** establish the supported Node
  and npm contract before dependency work.
- **Package 3B — Next.js security baseline:** update the framework, paired
  configuration, React runtime, and matching types as one reviewed unit.
- **Package 3C — Supabase client and authentication reliability:** update only
  after the runtime contract and verify hosted auth/RLS behavior without
  applying a migration.
- **Package 3D — Vercel observability SDKs:** update analytics and performance
  instrumentation together and verify authorized preview data flow.
- **Package 3E — Low-risk maintenance and pruning:** apply compatible patches
  and remove the unused direct dependency if verification confirms it.
- **Package 3F — Optional CSS/tooling evaluation:** take the paired Tailwind
  update only if its value justifies the visual regression surface.

Packages are implemented and committed separately. Phase 4 starts only after
Packages 3A–3E are complete or individually deferred with evidence and the plan's
Phase 4 entry gate is satisfied. Package 3F may remain deferred.

## Later phases

### Phase 4 — League Night Mode

- Enter date, venue, board, and roster once per session.
- Add recent-player chips, same-players/rematch shortcuts, draft autosave, and
  duplicate warnings.
- Keep enhanced fields collapsed by default.

### Phase 5 — Enhanced darts metrics

- Add First 9, checkout conversion, average/high finish, hold/break rate,
  100+/140+/180 counts, and Cricket accuracy/high-mark metrics.
- Add scoring-versus-finishing profiles and clutch/deciding-leg views.

### Phase 6 — Imports and turn-level analysis

- Start with reviewed CSV import.
- Collect real scoreboard-result samples before designing image extraction.
- Never auto-save OCR output; require a confirmation screen.
- Add optional legs/turns only when the league wants win-probability replays,
  checkout maps, or visit-level momentum.

## Verification matrix

| Area | Required verification |
| --- | --- |
| Rating engine | Two-player, multiplayer, zero-sum, chronology, upset tests |
| Derived stats | Expected wins, schedule strength, form, quantiles, missing scores |
| Dashboard | Empty, loading, error, filtered, provisional, and mobile states |
| Database | Additive migration test, policy review, backup, rollback rehearsal |
| Accessibility | Keyboard filters, semantic tables, chart text alternative, contrast |
| Release | `npm test`, coverage, lint, production build, browser smoke test |

## Deferred decisions

- Exact season boundaries and the initial active-season name.
- Whether all-format Power Rating should be promoted alongside discipline
  ratings or remain a novelty view.
- Which scoreboard or app formats should receive the first import adapter.
- Whether authenticated league members may correct any match or only matches
  they submitted.
