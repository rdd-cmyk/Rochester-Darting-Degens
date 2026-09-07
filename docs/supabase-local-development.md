# Supabase Local Development

Status: core local stack running with verified loopback-only ports; 25 pgTAP
policy tests and 7 staged legacy-preservation assertions passed. Optional
Windows Vector collector excluded; hosted deployment remains gated.

Supabase project: `hrqsbzmsfichiimtxijj`

Last reviewed: 2026-09-07

## Tooling contract

- Use npm and the checked-in `package-lock.json`.
- The Supabase CLI is pinned as a development dependency. Run it through the
  package scripts so contributors use the repository version.
- The local Supabase stack requires Docker Desktop or another compatible
  Docker runtime.
- Never commit access tokens, database passwords, service-role keys, or local
  environment files.

## Machine setup

The repository contract is Node.js `>=24.15.0 <25` and npm 11; `.nvmrc` pins
Node.js `24.20.0`, while `npm run ci:install` safely bootstraps npm `11.19.0`
for local development, CI, and hosted builds. After Docker Desktop is installed,
launch it once and complete its Windows setup. A reboot may be required when
Windows enables WSL 2 or virtualization features.

Verify the machine layer before starting Supabase:

```powershell
node --version
npm --version
docker version
npm run supabase -- --version
```

## Local stack

### Baseline and loopback networking verified

Authenticated inspection and a schema-only export on 2026-09-07 supplied the
missing original baseline. The new
`20260829210000_existing_schema_baseline.sql` and the additive
`20260829214500_advanced_statistics_foundation.sql` replayed locally; 25 pgTAP
tests passed with rolled-back synthetic fixtures. Hosted Postgres is major 17,
matching the local configuration. The observed hosted migration history is empty.
See [the inspection and rehearsal record](supabase-schema-review-2026-09-07.md)
for evidence, limitations, and the host-specific isolated test commands.

Do not push the baseline into production: its tables already exist. Hosted
migration-history reconciliation, backup, rollback, and independent review
remain explicit gates. No production player data was exported.

The dedicated loopback network alone did not prevent Docker Desktop from
publishing on all interfaces. With explicit user approval, the supported
Desktop port-binding default was set to localhost and Desktop restarted.
Actual Docker publications and Windows listeners on 54321/54322/54323/54324/
54327 were then verified as 127.0.0.1 and ::1. This machine-wide default affects
new containers in all projects; explicitly requested LAN bindings still work.
The former isolated container `rdd-schema-rehearsal-20260907` remains stopped
and shares the active CLI database's volume. NEVER start both at once.

On the development host checked 2026-09-07, Docker's supported Settings >
Resources > Advanced workflow moved its WSL storage to
`F:\DockerDesktop\DockerDesktopWSL` with user approval. The data disk is now
`F:\DockerDesktop\DockerDesktopWSL\disk\docker_data.vhdx`; the old C: data-disk
path is absent. After relocation, C: had approximately 12.0 GiB free and F:
69.9 GiB free. The existing `hello-world` image remained available and passed
`docker run --rm --pull=never hello-world` against the explicit local Linux
engine pipe. No containers or volumes remained after that smoke test, matching
the pre-move inventory. Storage headroom is no longer the immediate blocker;
recheck it before full-stack downloads. Do not manually move or delete a live
VHDX.

Verified locally: Docker Desktop 4.90.0 / Linux engine 29.7.2, container
execution, and the repository's pinned Supabase CLI 2.116.0. A full Desktop
quit/relaunch previously failed on this host; use the
[guarded recovery launcher](windows-docker-recovery.md) when necessary. The
settings-driven engine restart during relocation succeeded, but does not
establish that the full Desktop relaunch issue is fixed. The subsequent database
rehearsal downloaded Supabase database/service initialization images and a
standard pg_prove runner; it did not validate the full web stack. No `.env.local`
values were changed and no persistent checkout linking or hosted migration
occurred. Recheck disk space after these image downloads.

### Safe local commands

Start, inspect, and stop the repository-local services with the following
commands after Docker is healthy and disk space is adequate:

```powershell
npm run supabase:start
npm run supabase:status
npm run supabase:stop
npm run test:db:local
node scripts/rehearse-local-migration.mjs
npm run dev:local
```

The first start downloads Supabase container images and can take several
minutes. It applies migrations under `supabase/migrations/` only to the local
database.

Before the first start, create the dedicated network (do not replace an
existing network without inspecting it):

```powershell
docker --host npipe:////./pipe/dockerDesktopLinuxEngine network create --driver bridge --opt com.docker.network.bridge.host_binding_ipv4=127.0.0.1 rdd-local-loopback
```

On Windows, additionally select Docker Desktop's supported localhost default
in Settings > Resources > Network. The persisted setting observed on Desktop
4.90.0 is `PortBindingBehavior: default-local-port-binding`. Changing it is a
machine-wide choice requiring user approval. The scripts only check it; they
never change settings. Layout/location can vary across Desktop releases.

`supabase:start` selects the local engine explicitly, strips remote Docker
overrides, requires the network, checks the Windows default before startup,
and checks actual publications afterward. If the post-start binding check
fails, stop the local stack immediately and correct the configuration; this
check cannot undo a publication that already happened. It excludes only
Vector on Windows: CLI 2.116.0's collector expects an unsecured Docker TCP
endpoint on port 2375. Do not enable that endpoint. Auth, REST, Storage,
Realtime, Studio, Mailpit and the database remain available; container-log
ingestion through Vector is not verified/supported by this setup.

`dev:local` verifies local core health and loopback publications, reads the
local anon key privately, sets process-only app variables, and binds Next.js
to 127.0.0.1:3000. Existing `.env.local` is untouched. `build:local` validates
a production build with those same local settings. Do not serve an arbitrary
previous production bundle as a local preview: public variables are embedded
at build time. Local mode disables the real GitHub change-log integration
and Vercel Analytics/Speed Insights via server-only `RDD_LOCAL_PREVIEW=1`.
Ordinary hosted builds retain their existing telemetry behavior.
`supabase:status` prints privileged local keys; do not share its raw output.

The staged rehearsal creates a uniquely named separate database and retains
it for inspection. It imports Auth definitions without data/ownership/grants,
scaffolds required managed schemas/publication, then applies baseline, legacy
fixture, additive migration, and standard pgTAP tests in that order. It does
not reset the app database. This validates application-row preservation, not
all managed platform configuration or production data compatibility.

Browser acceptance uses standard Playwright Test from an installed QA runtime
with Chrome (no dependency changes in this delivery):

```powershell
$env:RDD_PLAYWRIGHT_ROOT='<absolute path to the installed playwright package>'
node "$env:RDD_PLAYWRIGHT_ROOT\cli.js" test --config scripts/qa/playwright.config.mjs
```

The reviewed host uses bundled Playwright 1.62.1. Start `dev:local` first.
Tests validate the backend target, block nonlocal browser requests, create
synthetic `example.test` accounts/matches, and retain them for manual review.
Screenshots/results are ignored by Git. These tests are not yet a CI gate.

The `supabase/config.toml` Postgres major 17 matches the hosted major observed
2026-09-07. Local and hosted platform patches differ; refresh this comparison
after upgrades before treating a rehearsal as representative.

The experimental pg-delta schema-diff engine is disabled. Do not enable it for
`db diff`, `db pull`, or remote comparison until the project evaluates and tests
its generated SQL.

## Hosted authentication and linking

Complete these steps only while the project member is present:

```powershell
npm run supabase -- login
npm run supabase -- link --project-ref hrqsbzmsfichiimtxijj
```

Use the browser login flow and enter any requested database password directly
at the local prompt. Do not paste credentials into chat or save them in tracked
files.

This host's CLI login was verified on 2026-09-07. For an interactive terminal
where agent detection disables prompts, use
`npm run supabase -- login --agent no --output-format text`. Run it in a terminal
the user can actually interact with. Inspection can select the project explicitly
without persistent linking; `db query` in CLI 2.116.0 requires both `--linked`
and `--project-ref` for that target. Use catalog-only SELECT statements for
inspection, not application-row queries or remote test fixtures.

Linking authorizes inspection; it does not authorize applying migrations. The
deployment gate in `docs/advanced-statistics-roadmap.md` still requires hosted
schema and Row Level Security review, backup verification, local rehearsal,
rollback review, and explicit approval.

Never run `supabase db reset --linked`. It resets the linked hosted database.
