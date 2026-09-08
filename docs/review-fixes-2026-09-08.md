# Local-main review corrections — 2026-09-08

Scope: the four P2 findings from the independent review of local `main`
(`8582570`) against fetched `origin/main` (`070a434`). No dependency upgrades,
hosted changes, push, or deployment are included.

## Corrections

1. Schedule strength now reads a numeric pre-match rating snapshot. Updating
   one participant no longer changes the opponent ratings read for the next.
   Two-player orderings, multiplayer orderings, and all six orderings with
   unequal prior ratings are tested. Matches retain equal schedule weighting.
2. Local Supabase start/stop/status/test commands and the readiness status
   probe explicitly pass this checkout's `--workdir`. Their child environment
   strips `SUPABASE_WORKDIR` without modifying the parent's environment.
   Mocked command-boundary tests use an unrelated inherited directory;
   no unrelated stack was started, stopped, or changed to test this case.
3. Chart numerical y-axis labels explicitly use `fill: var(--stats-muted)`
   through the SVG attribute, instead of inheriting SVG's default black fill.
4. The dark `--stats-navy-soft` text token is now `#8dbcf1`. Its only CSS
   consumer is the eyebrow text rule. Light-theme styling and the distinct
   methodology eyebrow override are preserved.

## Evidence

- Red/green: the targeted regression suite initially failed 23 cases across
  all four findings on the original implementation, then passed after fixes.
- Trusted clean install passed: 475 packages installed, zero audit findings.
- `npm test`: 166 tests across 17 files passed.
- `npm run test:coverage`: same 166 tests passed; scoped statistics coverage
  100% lines/functions, 99.28% statements, 91.35% branches.
- `npm run lint`, `npm run typecheck`, and `npm run build:local` passed.
  The latter runs the production `next build` with guarded local Supabase
  values; environment files and hosted settings were not changed.
- Standard Playwright/Chrome: four cases passed (desktop/mobile × light/dark).
  The cases check actual computed label colors against actual card/panel
  backgrounds for >=4.5:1 contrast, no document horizontal overflow, no page
  errors, and no attempted nonlocal requests. These are contrast checks, not
  golden-image comparisons. Screenshots were captured; desktop and mobile
  dark screenshots were visually inspected.
- Browser QA used the existing synthetic local captain/history, with no match
  writes, and a dedicated loopback production preview at `127.0.0.1:3001` to
  avoid interrupting the other worktree's preview.
- Independent source review of the fixes and regression coverage completed
  without additional actionable findings. The reviewer did not independently
  rerun the full test/build/browser gates; those results are from this delivery.

## Repeating the browser regression

After `npm run build:local`, start the verified local-only production bundle
on loopback port 3001 with the local Supabase environment and
`RDD_LOCAL_PREVIEW=1`. Use the existing synthetic captain/history from local
acceptance. Do not substitute a hosted account or hosted API.

```powershell
$env:RDD_PLAYWRIGHT_ROOT = '<installed Playwright package directory>'
node "$env:RDD_PLAYWRIGHT_ROOT/cli.js" test --config scripts/qa/review-contrast.config.mjs
```

Screenshots are ignored local artifacts under `test-results/review-contrast`.
The new tests do not overwrite the Package 3F visual baselines.

## Remaining boundaries

Local `main` contains the reviewed work; remote acceptance is still pending.
CI/Vercel, hosted Supabase schema/RLS/auth and observability acceptance remain
separate release gates. Browser checks are Chrome emulation, not physical
device/Safari/Firefox acceptance. The already-deferred Summer Off reload
hydration issue is outside these four findings and remains unchanged.
