# ESLint follow-up: compatible updates and separate major migration

Date: 2026-09-07. Branch: `advanced-statistics`. Prerequisite: `9134249`.
User approved compatible TypeScript ESLint/Hooks updates, closing the profile
lint gap, then evaluating the remaining plugins separately. This is not approval
to force ESLint 10, replace the plugin stack, push or deploy.

## Delivered compatible update

| Package | Before | After |
| --- | --- | --- |
| typescript-eslint and coordinated @typescript-eslint packages | 8.48.1 | 8.70.0 |
| eslint-plugin-react-hooks | 7.0.1 | 7.1.1 |
| ESLint | 9.39.5 | Unchanged |
| TypeScript compiler | 5.9.3 | Unchanged |

These are existing dependencies of `eslint-config-next@16.3.4`, updated within
its declared ranges and fixed by the canonical lockfile. No redundant root
dependency, override or install-policy change was needed. Both updated lint
packages declare ESLint 9 and 10 compatibility; this does not make the rest of
Next's plugin stack compatible with 10.

Resolution command:

```powershell
npm update typescript-eslint eslint-plugin-react-hooks --package-lock-only --ignore-scripts --no-audit
npm run ci:install
```

Reviewed development-only transitive changes: ignore 7.0.8, ts-api-utils 2.5.0,
the parser's minimatch 10.2.6/brace-expansion 5.0.9/balanced-match 4.0.4,
semver 7.8.5 and visitor-keys' nested eslint-visitor-keys 5.0.1. Graphemer is
no longer required. These transitive majors are expected parser dependencies,
not application/runtime upgrades; their engines fit the Node 24 contract.
Humanfs remains patched at 0.16.8. No compiler, framework, SDK, CSS, database,
environment-file or approved install-script change.

Sources: [TypeScript ESLint 8.70.0 release](https://github.com/typescript-eslint/typescript-eslint/releases/tag/v8.70.0),
[Hooks changelog](https://github.com/facebook/react/blob/main/packages/eslint-plugin-react-hooks/CHANGELOG.md),
exact npm registry package metadata and the resulting lockfile.

## Profile lint gap corrected

Removed both whole-file ignores and both file-specific Hooks rule exemptions
from `eslint.config.mjs`. The old apparent lint pass did not cover the dynamic
profile page. Restoring coverage found a redundant state-setting effect plus
its missing dependency warning.

History now renders its settled server-filtered result directly, preserving the
previous page under the loading overlay until a request settles. Filtering still
happens before server pagination; recent-match filtering is unchanged. Effect
cleanup prevents obsolete history responses from replacing a newer filter/page
result. No rule is disabled to obtain a clean pass.

Five new Vitest regressions cover actual ESLint inclusion/rule enforcement,
recent filtering, pagination/filter reset/loading retention, out-of-order
history results and error/empty-result recovery. The lint test deliberately
submits invalid source at the dynamic route path and requires both Hooks rules
to report it. This guards against accidentally restoring the silent ignore.

## Local verification

Environment: Windows, Node 24.20.0, npm 11.19.0.

- Trusted clean install passed; only existing `unrs-resolver@1.11.1` rebuilt.
- Vitest: **86 tests in 15 files passed**, including the five new regressions.
- Coverage passed with unchanged scope/thresholds: 100% lines/functions,
  91.35% branches, 99.28% statements for the configured statistics/match-state
  scope, not the entire application.
- Lint, type-check and guarded local production build passed. The build uses
  process-local loopback Supabase configuration, leaving environment files alone.
- Full and production npm audits: zero reported vulnerabilities.
- Standard Playwright/Chrome production acceptance: the final complete run
  passed all three scenarios in **14.6s**, including local Auth/recovery, match
  persistence and denied access,
  profile pagination, Cricket/win filters, empty results and desktop/mobile
  layouts. The expanded profile flow produced no uncaught browser errors,
  nonlocal browser requests or mobile horizontal overflow.
- Independent review then identified a browser-test fixture-isolation gap. The
  profile scenario now creates its own fresh synthetic profile and 12 matches,
  with consistent Auth/profile display metadata. The standalone profile scenario
  passed in **6.1s** before the final full-suite rerun above. Independent code,
  fixture and documentation review is complete; all findings are resolved.

Initial verification caught an unsupported Testing Library query option in the
new test; it was corrected and the full suite/build rerun successfully. The first
browser runs caught an overly strict new test label selector and an incorrectly
nested relative winner-row locator. Both were corrected, then all three browser
scenarios rerun successfully. No failure was suppressed or treated as a pass.

Independent implementation/lockfile review found no actionable findings and
reran all five new tests. It noted the preexisting initial profile/stats/recent
fetch lacks cancellation; that separate route-change issue is not claimed fixed.

## Remaining plugins: separate migration assessment

The target reviewed is **ESLint 10.10.0**, not ESLint 20. ESLint 9 reached
end-of-life on 2026-08-06. A zero audit does not mean ongoing maintenance.
[Upstream support policy](https://eslint.org/version-support/).

After the compatible updates, running the cached ESLint 10 CLI against the
repository with `--no-cache` gets past the previous `scopeManager.addGlobals`
parser crash but fails loading `react/display-name`:
`contextOrFilename.getFilename is not a function`. ESLint 10 removed that API.
[Migration guide](https://eslint.org/docs/latest/use/migrate-to-10.0.0).

Read-only isolation probes disabled other rule namespaces only in an in-memory
override, never in the checked-in config, and ran against all 49 files under
`app`, `components` and `lib`. Enabled rule counts below are from the resolved
dynamic-profile configuration, not all rules shipped by each plugin.

| Plugin and current latest version | Active rules | ESLint 10 evidence | Decision |
| --- | ---: | --- | --- |
| react 7.37.5 | 17 | Reproduced removed-API crash; peer range ends at 9 | Runtime blocker; keep separate from compatible update |
| import 2.32.0 | 1 | Corpus passes in isolation; anonymous-export defect still reported; peer range ends at 9 | Support/installation gate, not a reproduced active-rule crash |
| jsx-a11y 6.10.2 | 6 | Corpus passes in isolation; missing-alt and invalid-ARIA defects still reported; peer range ends at 9 | Preserve accessibility checks; compatibility not established for every rule |

Hooks and Next's own plugin also passed isolated corpus probes. This is limited
diagnostic evidence, not a clean ESLint 10 install or a complete migration pass.
Import's upstream changelog places ESLint 10 support under **Unreleased**; do not
treat main-branch code as a published compatible release.
[Import changelog](https://github.com/import-js/eslint-plugin-import/blob/main/CHANGELOG.md),
[React source](https://github.com/jsx-eslint/eslint-plugin-react),
[accessibility manifest](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/package.json).

### Recommendation and options

Prefer published compatible releases of the existing plugins if available at
migration entry. Recheck all three together; a React fix alone does not resolve
the other peer ranges. Until then, retain the explicit ESLint 9 temporary
baseline rather than silently dropping rule coverage.

The next separately approved package should be a bounded ESLint 10 compatibility
bridge proof, followed by a go/no-go decision. `@eslint/compat@2.1.1` declares
ESLint 10 support and offers wrappers for older rule APIs. It could preserve the
existing rule set with less semantic churn than replacements, but is **not yet
tested here** and cannot itself fix the older plugins' npm peer declarations.
Its upstream documentation explicitly does not guarantee every plugin works.
[Official compatibility utilities](https://github.com/eslint/rewrite/tree/main/packages/compat).

Replacement candidates were evaluated at the metadata/documentation level only:

- `eslint-plugin-import-x@4.17.1` explicitly supports ESLint 10 and provides a
  potential replacement for the single active import check. Validate resolver
  settings and rule behavior, not just renamed imports.
  [Maintainer documentation](https://github.com/un-ts/eslint-plugin-import-x).
- `@eslint-react/eslint-plugin@5.19.0` is a candidate React replacement, but its
  broad peer range is not proof of parity. Its migration table distinguishes
  replacements, partial equivalents and omissions. Map all 17 enabled rules;
  do not adopt a new recommended preset and assume equivalent protection.
  [Migration table](https://eslint-react.xyz/docs/migrating-from-eslint-plugin-react).
- No wholesale accessibility-plugin replacement is recommended from this
  evidence. Keep all six checks and the Next `Image` mapping. Require compatible
  published support or a specifically tested bridge with an approved peer policy.

### Separate package acceptance and stopping rules

1. Refresh versions, peer ranges, Node engines and Next config composition.
2. Prefer supported releases. If still blocked, trial the official bridge in
   isolation and record a rule-by-rule map for any proposed replacement.
3. Prove positive/negative fixtures for React checks, import defaults, all six
   accessibility checks, Hooks, Next rules and the restored profile route.
4. Require clean peer resolution and trusted install without `--force` or
   `--legacy-peer-deps`. A bridge does not waive this. If no supported resolution
   exists, return the blocker and a concrete exception/replacement proposal for
   approval; do not change shared install policy automatically.
5. Run full lint, unit/coverage, type-check, build, browser acceptance and
   independent review before committing a migration. No loss of lint coverage
   without an explicit reviewed replacement or documented justified retirement.
6. Reassess before Phase 4 entry, or by 2026-09-14 if work pauses. This is a
   documented checkpoint, not a scheduled background monitor.

ESLint 10, compatibility wrappers and replacement plugins are **not installed
in the project** by this delivery. Optional 3F and hosted/CI/Vercel gates remain
separate. Hosted data and authentication were not tested or changed here.

## Rollback

Revert this follow-up commit as a unit and run the trusted install. This restores
the previous dependency graph and profile implementation, but also restores the
known lint gap; record that regression if rollback is necessary. No database
rollback is required. A later ESLint 10 migration must be its own revertible
commit and must not discard this delivery's profile regression protection.
