# Project Information Registry

Status: active

Last reviewed: 2026-09-07

## Purpose

This registry preserves durable, non-obvious information that is likely to
change a future technical or product decision. It exists so contributors can
verify useful project knowledge instead of repeatedly rediscovering it.

The registry is not a changelog, backlog, scratchpad, replacement for code
comments, or store for secrets. Code-local reasoning should remain near the
code; only broadly reusable constraints and evidence belong here.

## Admission rules

An entry may become **active** only when all of the following are true:

1. It is likely to influence a future decision, investigation, or safety gate.
2. It is non-obvious from the immediately relevant code or primary document.
3. Its scope and evidence are specific enough for another contributor to
   verify.
4. Its validation method matches its information type.
5. It includes an invalidation trigger or review condition.

Validation by type:

- **Repository fact:** verify the current path, revision, configuration, or
  executable result.
- **Decision or constraint:** link the approving document, issue, commit, or
  explicit user direction and record its scope.
- **Procedure:** reproduce it successfully and record the environment and
  stopping conditions.
- **External fact:** use a dated primary source and set a refresh trigger.
- **User preference:** require explicit user confirmation; do not infer it from
  one isolated action.

Never record credentials, tokens, private personal data, or copied environment
files. Do not promote speculation, a one-time test result, transient status, an
unreviewed workaround, or an unresolved to-do as an active fact.

## Entry format

Each entry contains:

- **ID and title**
- **Status:** candidate, active, superseded, or retired
- **Type:** repository fact, decision, constraint, procedure, external fact, or
  user preference
- **Scope**
- **Statement**
- **Evidence**
- **Validation method and verified date**
- **Invalidation trigger or refresh-by condition**
- **Related records and supersession history**, when applicable

Git history is the edit log. Do not erase a previously relied-on record; mark
it superseded or retired and point to the replacement.

## Use and maintenance

- Read relevant entries before planning work, but reverify anything
  inexpensive or likely to drift.
- Update an entry in the same change that invalidates it.
- Add a candidate when evidence is incomplete; candidates cannot justify an
  irreversible or hosted action.
- Prefer a concise registry pointer over copying the same rule into many
  documents.
- Review related entries at every delivery-package boundary.

## Active records

### RDD-INFO-001 — npm lockfile is canonical

- **Status:** active
- **Type:** repository fact and delivery constraint
- **Scope:** dependency installation and lockfile generation
- **Statement:** Use npm and commit `package-lock.json`; do not generate a Yarn,
  pnpm, or Bun lockfile without an approved package-manager migration.
- **Evidence:** root `package.json` and `package-lock.json`; no alternate
  lockfile was present in the 2026-08-30 repository inspection.
- **Validation:** repository file inspection on 2026-08-30.
- **Invalidation trigger:** an approved package-manager migration or a changed
  root lockfile contract.
- **Related:** dependency modernization Package 3A.

### RDD-INFO-002 — Node runtime precedes the Supabase client upgrade

- **Status:** active
- **Type:** external fact and delivery decision
- **Scope:** dependency modernization Packages 3A and 3C
- **Statement:** Establish and verify the planned Node.js 24 runtime before
  upgrading Supabase JS; Supabase JS releases from `2.110.0` no longer support
  Node.js 20.
- **Evidence:** the [Supabase JS runtime support policy](https://github.com/supabase/supabase-js/blob/master/packages/core/supabase-js/README.md#support-policy)
  and [Vercel supported Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions),
  reviewed 2026-08-30.
- **Validation:** dated primary-source review; confirm with the target package's
  `engines` metadata during implementation.
- **Invalidation trigger:** refresh immediately before Packages 3A and 3C, or
  when the hosting/runtime target changes.
- **Related:** `docs/dependency-modernization-plan.md`.

### RDD-INFO-003 — Hosted Supabase schema remains an explicit gate

- **Status:** active
- **Type:** constraint
- **Scope:** database migrations, match writes, and statistics schema
- **Statement:** The additive advanced-statistics migration has not been applied
  to hosting. Do not apply it to project `hrqsbzmsfichiimtxijj` until the hosted
  schema, Row Level Security policies, backup, and rollback path are reviewed.
- **Evidence:** `docs/advanced-statistics-roadmap.md` and the migration under
  `supabase/migrations/`.
- **Validation:** hosted schema/policy inspection and local database-only
  rehearsal on 2026-09-07; backup, rollback and production acceptance remain
  pending. See `docs/supabase-schema-review-2026-09-07.md`.
- **Invalidation trigger:** a reviewed deployment with recorded schema/policy
  evidence and rollback result.
- **Related:** Phase 1 deployment gate and Package 3C.

### RDD-INFO-004 — Dependency security baseline is dated evidence

- **Status:** active
- **Type:** repository fact
- **Scope:** dependency modernization Package 3B
- **Statement:** The 2026-08-30 npm audit reported three high-severity findings
  in the Next.js `16.0.7` production dependency chain. This count is a baseline,
  not a permanent claim.
- **Evidence:** complete npm audit against the branch lockfile on 2026-08-30;
  affected chain included Next.js, its internal PostCSS version, and Sharp.
- **Validation:** lockfile audit and dependency-tree inspection.
- **Invalidation trigger:** any lockfile change or the start of Package 3B;
  rerun the complete audit.
- **Related:** dependency modernization Package 3B.

### RDD-INFO-005 — No project skill is currently justified

- **Status:** active
- **Type:** decision
- **Scope:** repository-local automation and agent guidance
- **Statement:** The current preparation work is represented by plans,
  registry entries, and contributor guidance. It has not yet produced a
  repeated, validated, fragile workflow that warrants an executable skill.
- **Evidence:** assessment against `docs/skill-governance.md` on 2026-08-30.
- **Validation:** review of current workflows and skill admission rules.
- **Invalidation trigger:** a procedure is repeated successfully, has
  non-obvious branching or safety constraints, and would materially benefit
  from a reusable skill.
- **Related:** possible future candidates in `docs/skill-governance.md`.

### RDD-INFO-006 — The current test stack has a pending Node runtime floor

- **Status:** superseded by RDD-INFO-007
- **Type:** repository fact and delivery constraint
- **Scope:** required test gate and dependency modernization Package 3A
- **Statement:** jsdom `30.0.1` requires Node.js `22.22.2+`, `24.15.0+`, or
  `26+`, while the root package does not yet declare a Node engine. Package 3A
  must establish and verify the runtime contract before this branch merges.
- **Evidence:** jsdom's `engines.node` metadata in `package-lock.json`; the
  remediation suite passed under Node.js `24.19.0` on 2026-08-30.
- **Validation:** lockfile inspection and executable test run.
- **Invalidation trigger:** Package 3A changes the declared runtime or jsdom
  version; recheck the installed package metadata and clean test gate.
- **Related:** superseded by RDD-INFO-007 on 2026-08-30;
  `docs/dependency-modernization-plan.md`, Package 3A.

### RDD-INFO-007 — Node 24 and npm 11 are the delivery contract

- **Status:** active
- **Type:** repository fact, delivery decision, and external fact
- **Scope:** local development, clean installs, GitHub Actions, and Vercel
- **Statement:** Use Node.js `>=24.15.0 <25` and npm 11. `.nvmrc` pins Node.js
  `24.20.0` for local development and GitHub Actions; the lower bound preserves
  the installed jsdom requirement while allowing Vercel's provider-managed Node
  24 patch. `npm run ci:install` bootstraps npm `11.19.0` with scripts disabled
  before entering the trusted install. Clean installs suppress all dependency
  scripts, verify exact approvals, and rebuild only the reviewed Sharp and
  unrs-resolver versions.
- **Evidence:** root `package.json`, `.nvmrc`, `.npmrc`, and
  `.github/workflows/ci.yml`; [Node.js releases](https://nodejs.org/en/about/previous-releases),
  [Vercel supported Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions),
  and [npm package metadata](https://docs.npmjs.com/files/package.json),
  reviewed 2026-08-30.
- **Validation:** clean install and complete repository verification under
  Node.js `24.20.0` and npm `11.19.0`; GitHub Actions run `33327531198` and
  Vercel deployment `7Q8bJBqSjuM3hhGKYkcPNomx7ADt` passed for commit `db5816d`.
- **Invalidation trigger:** a Node.js 24 security release, Vercel runtime support
  change, npm major migration, or a dependency engine requirement outside this
  contract.
- **Related:** `docs/dependency-modernization-plan.md`, Package 3A.

### RDD-INFO-008 — Hosted runtimes require major-line engine contracts

- **Status:** active
- **Type:** delivery decision, external fact, and failure lesson
- **Scope:** Vercel previews and future runtime upgrades
- **Statement:** Keep `.nvmrc` exact for reproducible local and CI validation,
  but let the package engine accept Vercel's provider-managed Node patch without
  dropping below dependency requirements. Vercel guarantees the configured
  major, not a particular patch. Do not combine an exact `packageManager` value
  with a different `devEngines.packageManager` range: current package-manager
  tooling treats those declarations as conflicting and can ignore the exact
  value. The shared install command must bootstrap the reviewed npm version with
  package scripts disabled so every supported local or hosted npm 11 patch can
  enter the same trusted workflow.
- **Evidence:** failed Vercel deployment `dpl_4CCpKcCiT9zXwsccPdvbP8QJ5nWU`
  for commit `71dccac` (the provider log requires authentication, so the exact
  failing check remains unconfirmed); Vercel CLI `59.10.0` compatibility warning
  observed 2026-08-30; a local Node `24.19.0`/npm `11.12.1` simulation reproduced
  the missing `npm install-scripts` command, while bootstrapping npm `11.19.0`
  passed the trusted install; replacement Vercel deployment
  `7Q8bJBqSjuM3hhGKYkcPNomx7ADt` passed for corrective commit `db5816d`;
  [Vercel supported Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions),
  [Vercel package managers](https://vercel.com/docs/package-managers), and
  [pnpm issue 12797](https://github.com/pnpm/pnpm/issues/12797).
- **Validation:** run the complete local gate under the exact `.nvmrc` release,
  then require both GitHub Actions and a Vercel preview to pass after runtime
  contract changes.
- **Invalidation trigger:** Vercel begins guaranteeing patch-level runtimes or
  package-manager tooling defines compatible precedence for exact and ranged
  declarations.
- **Related:** RDD-INFO-007; `docs/dependency-modernization-plan.md`, Package 3A.

### RDD-INFO-010 — The original Supabase schema is not in the migration chain

- **Status:** superseded by RDD-INFO-011
- **Type:** repository fact and validation constraint
- **Scope:** fresh local database startup and advanced-statistics rehearsal
- **Statement:** The only checked-in SQL migration is additive. It alters
  `matches` and `match_players` and reads `profiles`, but no checked-in baseline
  creates those tables. A fresh local replay requires a reviewed original schema
  and policies; do not treat a fabricated fixture as production equivalence.
- **Evidence:** `supabase/migrations/20260829214500_advanced_statistics_foundation.sql`;
  repository-wide SQL file inventory and empty declarative `schema_paths` in
  `supabase/config.toml`, inspected 2026-09-07.
- **Validation:** source inspection only. Docker and CLI readiness do not
  constitute successful application-local migration or hosted RLS validation.
- **Invalidation trigger:** a reviewed baseline is added and the complete
  migration chain passes against an authorized local database.
- **Related:** RDD-INFO-003; `docs/supabase-local-development.md`.

### RDD-INFO-011 — Existing hosted tables need baseline history reconciliation

- **Status:** active
- **Type:** repository fact and deployment constraint
- **Scope:** local schema replay versus existing hosted migration history
- **Statement:** A schema-only export now supplies the original baseline before
  the additive statistics migration. The original hosted tables already exist
  but no remote migration entries were observed. Do not push the baseline into
  that database or repair its history without fresh schema comparison, backup
  verification and explicit owner approval. Local tests do not satisfy that gate.
- **Evidence:** `supabase/migrations/20260829210000_existing_schema_baseline.sql`;
  `docs/supabase-schema-review-2026-09-07.md` records export provenance, catalog
  inspection, migration listing and local-only pgTAP results.
- **Validation:** authenticated schema inspection and successful two-migration
  local replay on 2026-09-07; independent baseline/policy review and expanded
  25-assertion RLS suite plus 7-assertion staged preservation rehearsal passed.
- **Invalidation trigger:** any hosted schema/history change or before a remote
  deployment; refresh the snapshot and approve reconciliation separately.
- **Related:** supersedes RDD-INFO-010; RDD-INFO-003 remains in force.

### RDD-INFO-012 — Desktop port proxy needs its own localhost default

- **Status:** active
- **Type:** procedure, decision, and failure lesson
- **Scope:** local Docker Desktop/Supabase only; never hosted access
- **Statement:** A bridge's `host_binding_ipv4=127.0.0.1` did not constrain
  Docker Desktop 4.90.0 publications on this host. Use the supported localhost
  default with explicit machine-wide approval, and verify actual bindings.
  All repository start/status/stop/test wrappers must select the same local
  engine and strip remote/TLS overrides. Optional Windows Vector is excluded
  because the pinned CLI expects unsecured Docker TCP 2375; do not enable it.
- **Evidence:** user approved defaulting new containers to localhost on
  2026-09-07; `scripts/local-environment.mjs`, `scripts/supabase-local.mjs`;
  [Docker settings reference](https://docs.docker.com/enterprise/security/hardened-desktop/settings-management/settings-reference/);
  [pinned CLI Vector source](https://github.com/supabase/cli/blob/v2.116.0/apps/cli/src/legacy/commands/start/services/vector.service.ts).
- **Validation:** Docker publications and Windows listeners verified as
  127.0.0.1/::1 after approved restart; mocked command-boundary tests check
  local target selection and environment sanitization without engine access.
- **Invalidation trigger:** Desktop/CLI updates, network/default changes,
  switched container engines, changed published services, or a preflight failure.
- **Related:** RDD-INFO-011; `docs/supabase-local-development.md`.

## Reviewed host workaround

### RDD-INFO-009 — Windows Docker socket recovery must preserve runtime folders

- **Status:** active (narrow, opt-in local workaround)
- **Type:** procedure and failure lesson
- **Scope:** Windows per-user Docker Desktop; local development only
- **Statement:** On the observed host, Docker 4.90.0 still failed to recover
  inaccessible socket files after shutdown. The opt-in guarded launcher can
  preserve only verified runtime socket folders while Desktop is fully stopped,
  then start the local engine. Do not broaden this into recursive deletion,
  factory reset, settings changes, or a hosted database action.
- **Evidence:** `scripts/windows/Start-DockerDesktop.ps1`, its Pester safety
  tests, and `docs/windows-docker-recovery.md`; Docker 4.90.0 startup logs showed
  the failed `.stale` rename despite its published fix.
- **Validation:** 2026-09-07 independent review, 29 Pester safety tests under
  Windows PowerShell 5.1, and a graceful stop, dry run,
  preservation/start, and `hello-world` test; healthy-engine invocation was a
  no-op. This does not verify the local Supabase stack or hosted project.
- **Invalidation trigger:** Docker/Windows updates, changed runtime socket
  names or layout, redirected installation paths, or a failed safety test.
  Re-review before adapting this workaround to a changed installation/layout.
- **Related:** RDD-INFO-003; no dependency package was started by this work.
