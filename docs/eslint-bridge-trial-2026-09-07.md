# ESLint 10 compatibility bridge trial

Date: 2026-09-07. Baseline: `085f7c7`, branch `advanced-statistics`.
Scope: user-approved bounded trial of the recommendation in
`eslint-follow-up-2026-09-07.md`, not automatic approval of peer overrides,
plugin replacements, hosted changes or deployment.

## Decision: runtime proof passes; adoption remains gated

| Gate | Result |
| --- | --- |
| Official bridge runtime, ESLint 10.10.0 + @eslint/compat 2.1.1 | Pass: isolated installation with scripts disabled and strict peers |
| Existing plugin checks under the bridge | Pass: 64 opt-in Vitest checks; same 68-file corpus passes on both engines |
| Combined application dependency resolution | Fail: npm ERESOLVE with strict peers, unchanged published plugin peer ranges |
| Working application baseline | Preserved: ESLint 9.39.5, original manifest, lockfile and lint config unchanged |

The bridge fixes the observed removed-API crash and preserves the tested lint
behavior. It does **not** change what plugin maintainers declare supported.
We have not adopted ESLint 10, bypassed npm's peer checks or disabled any rules.

## Refreshed upstream facts

Exact npm registry metadata was rechecked at trial entry:

- ESLint latest: 10.10.0; @eslint/compat latest: 2.1.1, peer ESLint 8/9/10.
- eslint-plugin-react 7.37.5, eslint-plugin-import 2.32.0 and
  eslint-plugin-jsx-a11y 6.10.2 remain latest; all three peer ranges end at 9.
- @eslint/compat's Node engine includes >=24; the unchanged Node 24.20.0 host
  and repository Node >=24.15.0 <25 contract satisfy it.

The [official bridge documentation](https://github.com/eslint/rewrite/tree/main/packages/compat)
describes wrapping existing configs with `fixupConfigRules`, including older
rule APIs, but explicitly does not guarantee all plugins work. The
[ESLint 10 migration guide](https://eslint.org/docs/latest/use/migrate-to-10.0.0)
documents removed context APIs and parser scope-manager changes. This trial uses
the already upgraded TypeScript ESLint 8.70.0 and Hooks 7.1.1 from the baseline.

## Isolation and peer-install evidence

Scratch directory: `F:\RDD\eslint-bridge-trial-085f7c7`, outside the Git worktree.
It contains no copied environment files, credentials, application data or source.
Its disposable manifests, lockfiles and runtime are retained for reproduction;
they are not committed or imported by the running application.

1. `runtime` contains only ESLint 10.10.0 and @eslint/compat 2.1.1 plus their
   dependencies. `npm install --ignore-scripts --strict-peer-deps --no-audit`
   passed (78 packages installed). This is a clean **runtime-only** install.
2. `peer-resolution` contains copies of the baseline package.json/package-lock.
   Only the manifest's ESLint version was changed to 10.10.0 and exact
   @eslint/compat 2.1.1 added. The attempted command was:

   ```powershell
   npm install --package-lock-only --ignore-scripts --strict-peer-deps --no-audit
   ```

   It failed with `ERESOLVE` while resolving eslint-config-next 16.3.4 and
   eslint-import-resolver-typescript 3.10.1 against eslint-plugin-import 2.32.0's
   peer requirement ending at ESLint 9. React and accessibility also exclude 10
   in their published metadata; the resolver stopping at Import does not clear
   those other gates.
3. No `--force`, `--legacy-peer-deps`, overrides, vendored plugin patch, alternate
   package manager or shared npm-policy change was attempted.

The execution proof deliberately loads plugins from the existing valid ESLint 9
application tree and the candidate engine/bridge from the independent runtime.
That separation is what permits diagnostic execution despite the combined-tree
peer conflict. It is **not** a deployable or supported dependency layout claim.

## Regression proof

`scripts/qa/eslint-bridge.test.mjs` runs with standard Vitest through its own
opt-in config. It neither replaces ordinary application tests nor changes lint
configuration. Its exact-version assertions prevent accidentally testing the
installed ESLint 9 in place of the candidate.

All **64 checks passed in 6.45s**, including the additional redundancy check
prompted by independent review and the narrower claim for two JSX usage rules.

- Every effective rule severity and enabled option is equal between the original
  and wrapped config on TSX and JS, as are Next settings and parser metadata.
  ESLint 10 materializes defaults on the already disabled core `no-unused-vars`;
  the comparison normalizes only disabled options, not enabled rules. The active
  TypeScript unused-variable rule still has a deliberate-defect test.
- All 17 enabled React rules remain configured. The 15 reporting rules each
  have invalid/corrected pairs. The two JSX usage rules are retained at error
  severity, but the combined usage assertions also pass when they are disabled
  in a diagnostic-only mutation: parser/core behavior already handles the
  bindings. We therefore prove combined unused-variable behavior and config
  retention, not independent execution or necessity of those two rules.
- The active Import check and all six active accessibility checks have paired
  fixtures. A separate pair proves Next `Image` still requires alt text.
- Representative Hooks, Next and TypeScript defects still report with the same
  target rule/message ID/severity as ESLint 9. The Hooks cases include both rules
  previously suppressed on the dynamic profile page.
- The entire current **68-file** repository lint corpus, including the new QA
  files, is identical between engines and produces zero errors/warnings. The
  profile page remains included and generated output remains ignored.

Each corrected fixture asserts absence of its **target** diagnostic; it is not
claimed to be clean under every other rule. Whole-corpus cleanliness is tested
separately. These are regression checks for the current configuration, not an
exhaustive proof of all behaviors or future plugin versions.

Initial harness runs identified a package-export restriction when reading the
bridge version and the disabled-rule default expansion described above. Both
assertions were corrected without relaxing any enabled lint rule; all 63 checks
then passed. Review's JSX-usage finding was addressed by adding an explicit
redundancy/mutation check and narrowing the claim, not by removing a real rule.

### Reproduction

Use a separate empty directory for the candidate runtime, never the application
checkout. On this host, with the retained runtime installed:

```powershell
$env:RDD_ESLINT_BRIDGE_ROOT='F:\RDD\eslint-bridge-trial-085f7c7\runtime'
npx --no-install vitest run --config scripts/qa/eslint-bridge.vitest.config.mjs
```

Run from the advanced-statistics worktree. To reproduce elsewhere, create a
separate private package with exact devDependencies `eslint: 10.10.0` and
`@eslint/compat: 2.1.1`, install with scripts disabled and strict peers, and set
the variable to that directory. Do not point it at arbitrary untrusted packages.
The suite deliberately fails rather than silently skips when the variable is
missing or does not point to the expected versions.

Ordinary `npm test` still runs the unchanged application suite independently:
**86 tests in 15 files passed**. Lint and type-check also passed. Coverage passed
with unchanged configured scope/thresholds (100% lines/functions, 91.35% branches,
99.28% statements for statistics/match-state, not the entire application). Full
npm audit reported zero vulnerabilities. Final independent review is complete:
the reviewer reran all 64 checks and closed the JSX-coverage finding; no
actionable findings remain. The reviewer did not rerun app coverage/audit.

No app/runtime dependency or build input changed. A fresh application clean
install, production rebuild, browser run, CI or Vercel deployment was therefore
not performed for this diagnostic-only delivery. These are required again for
an actual migration; prior delivery evidence is not presented as a new pass.

## Concrete next decision

Prefer compatible published releases when available. If those peers remain
blocked, my recommendation after this successful execution trial is to request
approval for a **narrow, explicit development-tooling peer override**:

- Pin ESLint 10.10.0 and @eslint/compat 2.1.1; wrap the current config using the
  exact official `fixupConfigRules` approach exercised here.
- Trial overrides limited to the ESLint peer of exact React 7.37.5, Import 2.32.0
  and JSX accessibility 6.10.2. Do not set a global override or relax npm's
  install policy. This is an intentional exception to upstream peer declarations,
  even if npm then resolves without errors.
- Require a new strict clean install, dependency-tree inspection, audit, these
  regression checks and the full app/build/browser/review gates. The override
  shape and clean installation have **not** been tested or approved in this
  bounded trial; stop again if broader exceptions prove necessary.
- Record an owner-visible removal trigger: remove the override/bridge when
  compatible published plugins are verified. Recheck before Phase 4 entry and
  at the existing 2026-09-14 checkpoint if work pauses.

Why consider the exception: we now have concrete behavior evidence, and the
current ESLint 9 baseline is already end-of-life. Why require approval: the
project would own the compatibility exception instead of relying solely on
maintainers' declared support. The bridge cannot promise behavior beyond the
tested surface. Choosing to wait for published support remains available; this
trial has not silently chosen either policy.

## Rollback and delivery boundary

This commit contains only opt-in diagnostic tests/config and evidence/planning
updates. Reverting it does not change the application dependency tree or the
profile lint fix from `085f7c7`. Any later adoption/override must be a separate
revertible commit. No push, deployment, hosted schema/auth action or background
monitor is included.
