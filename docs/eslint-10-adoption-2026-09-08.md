# ESLint 10 adoption with an approved compatibility exception

Date: 2026-09-08. Branch: `advanced-statistics`. Prerequisite: `e972176`.
User approved the narrowly scoped three-plugin peer override following the
successful bridge trial. No push, deployment, broader override or plugin
replacement was included in that approval.

## Implemented scope

- ESLint **10.10.0**, replacing 9.39.5; exact direct development dependency.
- Official **@eslint/compat 2.1.1**, exact direct development dependency.
- The exported lint config uses `fixupConfigRules(baseConfig)`; rule definitions,
  severities, options, Next settings and ignores are retained. `baseConfig` is
  exposed for configuration-parity tests, not used by the lint command directly.
- Only these exact plugin versions override their ESLint dependency/peer:

  ```json
  {
    "eslint-plugin-react@7.37.5": { "eslint": "$eslint" },
    "eslint-plugin-import@2.32.0": { "eslint": "$eslint" },
    "eslint-plugin-jsx-a11y@6.10.2": { "eslint": "$eslint" }
  }
  ```

`$eslint` references the root's exact ESLint declaration. This is not a global
override and does not automatically cover future plugin versions. No `--force`,
`--legacy-peer-deps`, shared npm policy, install-script approval, application,
SQL, CSS, environment-file or provider configuration change was made.

The three published plugin versions and peer ranges were refreshed on this date;
all still exclude ESLint 10. Successful npm resolution is **under the approved
exception**, not new upstream support. The core now uses the supported major,
while the project owns this tested legacy-plugin compatibility bridge.
[npm overrides](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#overrides),
[official compatibility utilities](https://github.com/eslint/rewrite/tree/main/packages/compat).

## Dependency and installation evidence

The exact overrides first passed strict resolution in the retained external
`F:\RDD\eslint-bridge-trial-085f7c7\peer-resolution` copy. They were then applied
to the worktree and verified with:

```powershell
npm install --package-lock-only --ignore-scripts --strict-peer-deps --no-audit
$env:npm_config_strict_peer_deps='true'
npm run ci:install
```

The environment setting applied only to the verification shell; the repository's
install policy is unchanged. The trusted clean install passed (475 packages,
476 audited); only previously approved `unrs-resolver@1.11.1` was rebuilt.
`npm ls eslint @eslint/compat eslint-plugin-react eslint-plugin-import
eslint-plugin-jsx-a11y --all` exits successfully, shows the three overrides and
one deduplicated ESLint 10.10.0. No hidden ESLint 9 installation remains.

Reviewed lockfile changes are ESLint/compat and their development dependencies:
ESLint core 1.2.1, config-array 0.23.5, config-helpers 0.7.0, object-schema 3.0.5,
plugin-kit 0.7.3, espree 11.2.0, eslint-scope 9.1.2, visitor-keys 5.0.1,
esquery 1.7.0, file-entry-cache 11.1.5 and flat-cache 6.1.23 with their required
cacheable/keyv helpers. Obsolete legacy-config/chalk/yaml dependencies leave the
graph; visitor-keys 5 is deduplicated. Humanfs remains patched at 0.16.8.
Framework, React, TypeScript, Supabase, observability, CSS and test-runner versions
remain unchanged. New transitive majors are part of the approved lint-major
migration, not unannounced runtime upgrades.

## Durable test protection

The 64-check opt-in trial was promoted to
`scripts/eslint-compatibility.test.mjs`, included in ordinary `npm test` and
coverage runs. It now uses the actual installed ESLint and default lint config;
it needs no external runtime, environment variable or ESLint 9 dependency.
The obsolete opt-in config was removed. Git history at `e972176` retains the
original cross-engine trial and its reproduction instructions.

The installed suite checks exact versions and override scope, all effective
config settings before/after wrapping, the profile route's inclusion, generated
output ignores, and the 15 reporting React rules plus Import, all six enabled
accessibility checks (including Next Image), and representative Hooks/Next/TS
rules using invalid/corrected fixture pairs. Target severities remain asserted.
All 17 React rules remain configured. The two JSX usage rules still have only
combined-behavior/config-retention evidence: the explicit mutation test records
their overlap with parser/core behavior, not independent rule execution.

This is installed-stack regression protection, **not a fresh ESLint 9-versus-10
comparison**. The reviewed historical trial supplies that comparison. Corrected
fixtures assert absence of the target diagnostic, not whole-snippet cleanliness;
the separate full-repository lint assertion requires zero errors and warnings.

## Verification

Windows, Node 24.20.0, canonical npm 11.19.0:

- Strict clean trusted install and installed dependency-tree checks passed.
- `npm test`: **150 tests in 16 files passed** (86 prior tests + 64 installed
  compatibility checks).
- `npm run test:coverage`: all 150 passed; unchanged coverage scope/thresholds:
  100% lines/functions, 91.35% branches, 99.28% statements for the configured
  statistics/match-state scope, not the whole application.
- Lint and type-check passed.
- `npm run build:local`: fresh optimized production build passed, using guarded
  loopback Supabase and process-local configuration without modifying env files.
- Full and production npm audits: **zero reported vulnerabilities**.
- Standard Playwright/Chrome production acceptance: **three scenarios passed in
  14.4s**, covering local signup/recovery/session refresh, allowed and denied
  match writes, statistics and desktop/mobile profile history. Tests recorded
  no uncaught browser errors or nonlocal browser requests. Synthetic fixtures
  remain local; hosted services received no test writes.
- Independent code/lockfile review found no actionable findings and reran all
  64 compatibility checks plus dependency-tree/whitespace checks. Final
  documentation consistency review is complete with no actionable findings.

CI, Vercel deployment and hosted Supabase acceptance remain pending a separately
authorized push/release. Local success is not hosted deployment evidence.

## Removal and review policy

Owner: contributors maintaining this branch's dependency plan. Recheck before
Phase 4 entry and by the existing 2026-09-14 checkpoint if delivery pauses; no
background monitor is scheduled. At each plugin, Next config, ESLint, compat or
npm upgrade:

1. Refresh all three plugin peer ranges and release notes. Exact-version
   overrides deliberately stop matching changed plugin versions.
2. Remove an override only when that published plugin version declares the
   target ESLint supported and the strict install plus regression checks pass.
3. Remove the bridge when all relevant legacy APIs have compatible replacements
   in the installed plugins and the same tests pass unwrapped. Retain every
   existing rule unless a separately reviewed replacement/retirement is approved.
4. No widening override scope or relaxing install policy without new approval.

## Rollback

Revert this adoption commit as a unit, then run `npm run ci:install`. This restores
ESLint 9.39.5 and the historical opt-in trial, while retaining the profile lint
fix from `085f7c7`. Record that a rollback returns to an end-of-life core version.
No database or environment rollback is required.
