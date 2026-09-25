# Package 3F — Tailwind/PostCSS tooling verification

Date: 2026-09-08. Branch: `advanced-statistics`. Baseline commit: `f22ece9`.
Status: implemented, locally verified and independently reviewed.
The user authorized 3F after deferring the bridge-free ESLint evaluation.
No push, hosted changes or deployment is included.

## Decision and exact scope

Adopt the paired Tailwind CSS / `@tailwindcss/postcss` update from 4.1.17 to
exact **4.3.3**. The supporting Node integration, Oxide scanner and platform
packages follow the same version. This is a maintenance update, not a redesign
or a claim of measured speed improvements. Application TSX, custom CSS and
PostCSS configuration are unchanged. ESLint and its approved exceptions remain.

The refreshed registry still selects 4.3.3. Upstream changes include scanner
and import-resolution fixes, PostCSS rebuild fixes and a Firefox iframe-focus
correction. Extra utility/color features are available but not used by this
package. The small, explained CSS delta and passing comparisons justify taking
the update despite the site's heavy use of custom CSS.

Primary release evidence:
[4.2.0](https://github.com/tailwindlabs/tailwindcss/releases/tag/v4.2.0),
[4.3.0](https://github.com/tailwindlabs/tailwindcss/releases/tag/v4.3.0),
[4.3.3](https://github.com/tailwindlabs/tailwindcss/releases/tag/v4.3.3).
Exact npm manifests and audit evidence were refreshed at package entry.

Reviewed supporting changes:

- Tailwind's Lightning CSS: 1.30.2 → 1.32.0 and matching native packages.
  Vite's separate 1.33.0 copy stays unchanged.
- enhanced-resolve 5.18.3 → 5.24.5, jiti 2.6.1 → 2.7.0 and tapable 2.3.0 → 2.3.3.
- Six nested WASM support records disappear from the lockfile because the new
  Oxide WASM package lists them as bundled dependencies. They are not supplied
  by compatible root copies; several root versions do not satisfy its ranges.
- PostCSS itself stays 8.5.26 in the adapter graph, and Next's internal copy
  stays 8.5.23. No standalone PostCSS dependency or override was added.
- Oxide's Node floor becomes >=20, satisfied by the unchanged Node 24 contract.

Resolution used `npm install --package-lock-only --ignore-scripts --no-audit`
after editing only the two direct version declarations. Trusted clean install
added 475 packages, passed install-script policy, and rebuilt only the unchanged
approved unrs-resolver 1.11.1. No new script approval or peer exception.

## Production CSS comparison

Both builds used `npm run build:local`: optimized Next production builds with
guarded loopback Supabase, telemetry disabled and process-only integration
overrides. No environment files changed.

| Artifact | Tailwind 4.1.17 | Tailwind 4.3.3 |
| --- | --- | --- |
| Production CSS file | `3odz1k71wobwz.css` | `2ptlsde7rm2af.css` |
| Bytes | 24,374 | 24,514 |
| Gzip bytes (Node zlib) | 6,086 | 6,157 |

The comparison parsed both generated stylesheets with PostCSS and inspected
changed rules and declarations. Changes consist of whitespace serialization in
custom-property values, the upstream default fallback font list, and replacing
`:-moz-focusring` with `:-moz-focusring:where(:not(iframe))`. The application's
defined font variables take precedence over the changed fallback. No custom
layout, palette, breakpoint or utility-selector addition/removal was found.
This is not a claim of byte-identical CSS or cross-browser visual certification.

## Visual and functional acceptance

Environment: Windows, Node 24.20.0, npm 11.19.0, supplied Playwright runtime and
installed Chrome. Only localhost app/API origins are allowed by browser routing.

- Before upgrade: fresh production build and 12 visual scenarios captured,
  then all 12 repeated without updating snapshots (14.4s).
- Initial candidate: 12 scenarios passed (13.2s).
- Independent review identified three test weaknesses: focus snapshots selected
  links and clipped their rings; home could capture a skeleton; another suite
  could erase baselines. All three were corrected before acceptance.
- Final coverage: main, match-entry and statistics pages at 1440×1000 and
  390×844, in light and dark themes. Populated synthetic leaderboard assertions,
  full statistics pages, whole match-entry forms, padded keyboard-focus captures
  for real input/select controls, mobile menus and viewport overflow checks.
- For the improved assertions, the original saved production CSS was replayed
  through Playwright on the unchanged application source. All 12 baseline cases
  passed (17.1s); the actual candidate CSS then passed all 12 (13.0s) with replay
  disabled and no snapshot updates. **34 screenshot comparisons passed** with
  zero differing pixels permitted under Playwright's comparator threshold.
  Representative form/focus captures were also visually inspected.
- No uncaught page errors or external browser request attempts in those final
  visual runs. CSS replay asserts that exactly one production CSS URL is used;
  review the harness before adopting CSS splitting or an app-source migration.
- Standard local Auth/match/profile/recovery browser suite is run after the
  comparisons, because it mutates synthetic fixtures and invalidates old visual
  expectations. See final gate results below.

## Standard gates

- `npm run ci:install`: passed under the unchanged trusted installation policy.
- `npm test`: 150 tests in 16 files passed.
- `npm run test:coverage`: passed, unchanged scope/thresholds; 100% lines and
  functions, 91.35% branches, 99.28% statements for the configured stats scope.
- `npm run lint`, `npm run typecheck`: passed.
- `npm run build:local`: passed; this exercises the production build command
  with guarded local overrides instead of using hosted environment values.
- Full and production npm audits: zero reported vulnerabilities.
- Standard local browser acceptance: three scenarios passed in 13.7s, including
  signup, persisted/denied match writes, profiles, image optimization, password
  recovery and renewed sessions. No uncaught page errors or nonlocal browser
  requests recorded. Synthetic fixtures remain local; hosting was not tested.
- After visual-test corrections, all 150 unit/regression tests and lint passed
  again. Independent review completed; three QA findings and one WASM dependency
  documentation finding were corrected. Reviewer inspection did not rerun QA.
- The recording-only replay guard was exercised: ordinary comparison with
  replay enabled fails before navigation as intended. Explicit
  `--update-snapshots=all` recording then passed 12 cases (18.0s), followed by
  actual candidate verification with replay unset: 12 cases / 34 comparisons
  passed (13.1s). This refreshed pair follows the functional suite's fixture
  changes; it does not compare different datasets or overwrite candidate deltas.
- A final documentation-inclusive build retained the candidate CSS SHA-256
  `7ca79500c37e5d48c4fd15da4a07c45c888df954a9c503347c49aacc1bfac685`.

## Reproducing the visual check

Use the project's existing supplied Playwright runtime via
`RDD_PLAYWRIGHT_ROOT` (the directory containing `cli.js` and `test.js`). This
package does not install or upgrade Playwright. Start a fresh loopback-only
production preview built by `npm run build:local`; never serve an unchecked
bundle that could embed hosted credentials/URLs. Existing local-acceptance
synthetic captain/rival/history fixtures are required. Missing fixtures fail.

```powershell
node "$env:RDD_PLAYWRIGHT_ROOT/cli.js" test --config scripts/qa/css-visual.config.mjs --update-snapshots=all
# After the scoped update/rebuild, with the SAME fixtures and browser:
node "$env:RDD_PLAYWRIGHT_ROOT/cli.js" test --config scripts/qa/css-visual.config.mjs
```

Record the first command against the pre-upgrade build, not the candidate.
Alternatively, preserve the single pre-upgrade CSS artifact as
`.qa-artifacts/css-build-before/baseline.css` and set
`RDD_CSS_REPLAY_BASELINE=1` only while explicitly recording its baseline.
Remove that variable before candidate verification. The harness rejects replay
unless explicit snapshot-recording mode is selected, preventing an ordinary
comparison from silently exercising old CSS. Never update snapshots to conceal
an unexplained delta.
For an application/JS change, use separate actual before/after builds instead
of this CSS-only replay technique.

Baselines live under ignored `.qa-artifacts/css-baselines`, outside every
Playwright output directory. They are machine/fixture-specific local evidence,
not portable committed goldens or an automatically enabled CI gate. Candidate
failure output is under `test-results/css-run`. Reseeding or changing fixture
history requires a new before/after pair; do not compare stale match counts.

## Existing issue observed, not changed here

The original baseline emits React hydration error #418 when Summer is disabled
and a full document navigation/reload follows: LayoutShell defaults to `true`
on the server but reads persisted `false` in the browser's initial state.
The visual harness disables the animation after the last navigation; it does
not suppress page errors. This excludes that known path from 3F acceptance,
not a fix or proof of error-free reload behavior. Track as a separate app fix.
The known anonymous profile-metadata RLS fallback also remains unchanged.

## Remaining gates and rollback

CI/Vercel and hosted Supabase/telemetry acceptance remain pending separately
authorized push/release. Chrome desktop emulation is not physical-device,
Firefox or Safari acceptance; the Firefox-specific upstream fix was source
reviewed, not executed here. No hosted data or migration changes.

Revert this isolated 3F commit, rerun trusted installation and rebuild. The
paired versions/lockfile restore together; no database rollback is required.
The saved ESLint candidate document is independent of this CSS dependency
decision and does not authorize future plugin replacement. Phase 4 has not begun.
