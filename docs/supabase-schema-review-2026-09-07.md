# Supabase schema inspection and local rehearsal

Status: hosted schema inspected; local database rehearsals and core stack
startup passed; independent review findings resolved. No hosted migration or
application-data write was performed. This is not production acceptance.

## Evidence

- Project: `hrqsbzmsfichiimtxijj` / `RDD Main Project`, `ACTIVE_HEALTHY`.
- Authenticated CLI: repository-pinned `2.116.0`. Its `2.117.0` update notice
  did not prevent project listing, export, or metadata inspection. No upgrade
  was made and no claim about the newer release's fixes is implied.
- Hosted PostgreSQL: major 17, reported platform version `17.6.1.054`.
- `db dump --project-ref ... --file ...` captured schema only. Its default
  excludes row data, custom roles, and Supabase-managed schemas. Catalog-only
  queries supplemented the export for auth/storage triggers and policies.
- Original export SHA-256:
  `9A08C1EF351B724C84CE8188388CA65AC2880B280DAE696B8C8755A4C89B8400`.
- `migration list --project-ref ...` returned no remote migration entries;
  the advanced-statistics migration was local-only.
- The CLI reported initializing its login role as part of authenticated access.
  This used the normal platform authentication mechanism; no application schema,
  policies, player records, or migration history were intentionally modified.
- No `.env.local` changes or persistent checkout linking were required. The
  explicit project reference selected the remote inspection target.

## Existing schema and policy behavior

The original application has three public tables: `profiles`, `matches`, and
`match_players`. All have RLS enabled. Their ten policies allow signed-in reads,
own-profile insertion/update, creator-owned match insertion/update, and
creator-controlled participant insertion/update/deletion. There is no match
DELETE policy. Do not infer match-deletion support from the foreign-key cascade.

There are no non-internal public/auth triggers and no auth/storage policies in
the catalog result. Four storage triggers refer to Supabase's managed storage
functions; they are not copied as application migrations. The export contains
no public custom functions. Auth user-to-profile creation is not supplied by a
hosted database trigger in this snapshot.

Preserved constraints include positive non-null scores/Cricket points and strict
length limits (notes <100, venue <50, display name <35, first/last name <30).
Nullability and existing grants are preserved, not silently hardened.

Important boundaries for subsequent review:

- The signed-in profile SELECT policy is row-level, not column-level: profile
  fields such as last name and sex are not protected by UI display preferences.
  Decide any column-level privacy changes with the owner separately.
- `GRANT ALL` on tables/sequences is inherited from the hosted setup. The tested
  row operations remain subject to RLS, but these tests are not an audit of every
  SQL privilege or service-role behavior.
- The new statistics view is security-invoker: granting it to `anon` does not
  bypass the original signed-in-only row policies.
- The additive seasons table has public SELECT and no client write policy.

## Local baseline and verification

`supabase/migrations/20260829210000_existing_schema_baseline.sql` is the reviewed
export with excess blank lines removed and a provenance/safety header added.
Its filename sorts before the existing additive migration; it is NOT a claim
about when production was created. It retains the original schema and policies.

Both baseline and `20260829214500_advanced_statistics_foundation.sql` replayed
successfully into a fresh local Supabase PostgreSQL 17 database. The local image
was `public.ecr.aws/supabase/postgres:17.6.1.165`, digest
`sha256:28f0e16a019e648089fc1a6d333549a55548f6019c15ae4bd7cd58b989027518`.
This matches the hosted major, not its exact platform patch.

`supabase/tests/database/statistics_foundation.test.sql` initially passed 20 pgTAP
assertions. They cover schema existence, RLS enabled, security-invoker behavior,
legacy insert defaults, invalid denominators/checkouts, anonymous denial,
creator updates, noncreator denial, and season read/write behavior. Synthetic
auth/profile/match fixtures are wrapped in a rolled-back transaction. Afterward
local `matches` and `auth.users` each contained zero rows.

Tests used Supabase's standard `pg_prove:3.36` runner (not a custom parser), pinned
to Linux amd64 digest
`sha256:715739e7fdd07a8631c36ea2f1c88fc0144f99a8f5eaa6c3a9799be377f94f2c`.
They are separate from Vitest and are not yet wired into CI. A passing database
test is not a pass for hosted auth, browser flows, full-stack startup, backup,
rollback recovery, or production data compatibility.

## Local networking exception and retained state

`db start --network-id rdd-local-loopback` successfully replayed migrations but
published `0.0.0.0:54322` and `[::]:54322`, even though the network had
`com.docker.network.bridge.host_binding_ipv4=127.0.0.1`. The actual binding check
caught this and the database container was immediately stopped. Only the empty
schema was present at that point; no production player data was imported. LAN
reachability was not tested, so neither exposure nor firewall protection is
assumed beyond the observed Docker bindings.

The preserved local volume was then used by
`rdd-schema-rehearsal-20260907` with `--network none` and no port publications.
The pg_prove runner shared only that container's network namespace and accessed
PostgreSQL on its internal loopback. At that stage both database containers were
stopped. The CLI database is now running; the old isolated container remains
stopped. Their shared volume remains intact. Never run both at once.

The initial investigation changed no firewall or machine-wide defaults. In the
subsequent approved work below, Docker's default was changed and actual binding
was verified. A localhost URL in CLI output or the network option alone is not proof.

Historical commands, NOT the current workflow while the CLI stack is running:
for this host's isolated rehearsal only (PowerShell, Docker on PATH),
first confirm the original `supabase_db_Rochester-Darting-Degens-advanced-statis`
container is stopped. Then:

```powershell
docker --host npipe:////./pipe/dockerDesktopLinuxEngine start rdd-schema-rehearsal-20260907
docker --host npipe:////./pipe/dockerDesktopLinuxEngine exec rdd-schema-rehearsal-20260907 pg_isready -U postgres
docker --host npipe:////./pipe/dockerDesktopLinuxEngine run --rm --pull=never --network container:rdd-schema-rehearsal-20260907 --mount "type=bind,src=$((Get-Location).Path)\supabase\tests\database,dst=/rdd-tests,readonly" -e PGPASSWORD=postgres ghcr.io/supabase/pg_prove:3.36@sha256:715739e7fdd07a8631c36ea2f1c88fc0144f99a8f5eaa6c3a9799be377f94f2c pg_prove --host 127.0.0.1 --port 5432 --username postgres --dbname postgres /rdd-tests/statistics_foundation.test.sql
docker --host npipe:////./pipe/dockerDesktopLinuxEngine stop rdd-schema-rehearsal-20260907
```

Run from the worktree root; the password above is the local CLI fixture default,
not a hosted credential. Require the runner's exit code 0 AND `Result: PASS`.
These commands reuse existing host-specific containers; they are not portable
fresh-machine setup instructions. Stop on any prerequisite failure.

## Follow-up: loopback core stack and stronger local tests

With explicit user approval, Docker Desktop's supported default was changed
to localhost (`PortBindingBehavior=default-local-port-binding`). The settings
backup remains beside the original in the user's Docker configuration folder;
no private machine settings were copied into Git. After a guarded restart,
actual publications and Windows listeners were restricted to 127.0.0.1/::1.

Core Supabase services started successfully. Optional Vector log collection
is excluded on Windows because the pinned CLI config expects unsecured Docker
TCP 2375; that endpoint was not enabled. See the updated
[local setup guide](supabase-local-development.md) for guarded commands.

The normal CLI `test db --local` suite now passes **25 assertions**, adding
successful authenticated profile/match/participant inserts (including generated
sequence IDs) and spoofed-owner insert denials. Fixtures roll back; sequence
increments need not. The runner remains standard pg_prove 3.36.

`node scripts/rehearse-local-migration.mjs` creates a separate database, imports
only local managed Auth definitions without data/ownership/grants, and supplies
the required extension schemas and Realtime publication. It applies the exact
baseline, inserts a synthetic legacy fixture, applies the additive migration,
and passes **7 preservation assertions** comparing complete original row values,
relationships, and new-column defaults. It retains the database for inspection.
This is an application-migration rehearsal, not full managed-schema equivalence,
a production-data audit, or backup/rollback recovery proof.

## Production gate remains closed

Do not push the new baseline into the existing hosted database: its tables
already exist. Before any remote application, independently review the baseline,
refresh schema drift evidence, verify a real backup/recovery path, and agree on
an owner-approved migration-history reconciliation. Do not automatically run
`migration repair`, `db pull`, `db push`, or any linked reset to reconcile it.

No production player data was exported, so this rehearsal cannot prove that
existing rows satisfy new constraints. Backup and rollback rehearsal remain
unverified. Package 3B and later dependency upgrades were not started here.

## References

- [Supabase schema-only export behavior](https://supabase.com/docs/reference/cli/supabase-db-dump)
- [Supabase local development networking guidance](https://supabase.com/docs/guides/local-development)
- [Supabase pg_prove runner](https://github.com/supabase/cli/pkgs/container/pg_prove)
