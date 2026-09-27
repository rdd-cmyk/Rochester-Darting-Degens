# League Night hosted readiness audit — 2026-09-27

Status: read-only audit complete; **not approved for database or app deployment**.
Ben reported local demo testing complete on this date. That completes his local
review checkpoint, not every unreported real-device/accessibility test.

## Scope and evidence

- Target: **RDD Main Project**, `hrqsbzmsfichiimtxijj`, production `main`,
  Postgres 17.6, `us-west-2`. Supabase reported `ACTIVE_HEALTHY`.
- Branch at audit time: `league-night-mode`, implementation still uncommitted. A live
  `git ls-remote origin refs/heads/main` returned
  `690a01b84d96c55b8ec455a6e298c17ec6093b50`, matching local HEAD and origin/main.
- Used the existing authenticated, pinned Supabase CLI 2.116.0: project,
  branch and backup listings, plus `db query --linked --project-ref
  hrqsbzmsfichiimtxijj --output json` with SELECT-only catalog/aggregate queries.
  Inspected the authenticated dashboard's integration and backup settings.
- No application data/schema/policy writes, migration-history repair, production
  export, backup/restore, integration changes, commit, push or deployment.
  The CLI used its normal authentication flow; no project link was created.
- Only schema/permission metadata and aggregate counts were retrieved from SQL.
  No individual player names, emails, credentials or match notes are recorded.

## Verified hosted state

| Area | Observed result | Release implication |
| --- | --- | --- |
| Existing schema | Only `profiles`, `matches`, `match_players` in public. Columns, defaults, primary/foreign/check constraints match the legacy rehearsal fixture. Constraints are validated; only the three primary-key indexes exist. No custom public functions or user triggers on public/auth tables were returned. | No conflicting League Night objects or relevant schema drift found in these checks. |
| League Night | No night tables, match `night_id`/`revision`, private operation log or new RPCs installed. | The new app cannot deploy against this unchanged database. |
| Row-level security | Enabled on all three tables. Authenticated reads, creator-owned match/participant writes and self-owned profile writes match the fixture. | Metadata checked; no production write or impersonation test was performed. |
| Grants | Existing broad anon/authenticated table grants remain, with no role memberships or RLS bypass for those roles. Existing public-schema default grants are broad too. | The pending SQL explicitly restricts its new objects. Existing direct match writes remain until the separate enforcement stage; no permissions were changed by this audit. |
| Migration history | Neither `supabase_migrations` nor its `schema_migrations` table exists; dashboard says no migrations. | Existing schema has not been adopted into a migration history. Agree on the first tracked migration/baseline strategy before enabling a deployment path; never replay the fixture over production. |
| Backups | CLI returned `backups: null` and `pitr_enabled: false`. Dashboard explicitly says the Free plan does not include project backups. | No accessible scheduled backup or tested restore point established. This does not rule out a separately held owner backup. |
| GitHub integration | `rdd-cmyk/Rochester-Darting-Degens`, working directory `.`, production branch `main`, Deploy to production **on**. | Adding migrations to main would be a deployment action. |
| Preview databases | Automatic branching **off**, unavailable on the current plan. CLI lists only the default main branch. | Do not assume a Vercel preview will receive an isolated database automatically. |
| Vercel integration | Connected to `rochester-darting-degens`; production credential syncing **on**, Preview/Development syncing **off**. | This does not establish actual manually configured Vercel environment values. Verify the exact preview target before any hosted save tests. |

## Aggregate integrity checkpoint

At the time of the SELECT snapshot: **10 matches, 22 participant rows, 5 profiles**.
All of the following counts were zero:

- Matches with no participants, fewer than two or more than ten participants,
  duplicate/unidentified players, or other than exactly one winner.
- Null winner flags, missing match creators, null/non-finite match timestamps,
  timestamps more than five minutes in the future, unsupported game/board labels.
- Unattached participant rows, orphaned match references or orphaned player references.
- Scores/Cricket points outside the pending save RPC's ranges and format rules.
- Matches in the preceding seven days flagged by the roster/winner checks.

This establishes structural compatibility for the checks listed, not the accuracy
of every historical score or a restore/preservation test. Counts are a dated
snapshot, not permanent release assertions; legitimate new entries can change them.

## Exact pending SQL inspected

Both files remain outside `supabase/migrations/`. The migration directory is
absent in the working tree and has no tracked files in the verified main commit.
No promotion to automatic deployment was made.

| File | SHA-256 |
| --- | --- |
| `supabase/pending/league_night.sql` | `E94BA4BD37B11F76FC1486C4B4C498BEE2FEAB84E303CBDBE2BD134E7790FC82` |
| `supabase/pending/league_night_enforce.sql` | `B162EE8ECFAFCE0FF83D9FC242791B14C1ED7D45331BADE935E2918E6C01ED81` |

The first file adds shared night/attendance storage, match revisions and the
transactional save RPC. The second removes direct client writes to matches and
participants. They must not be deployed together before the compatible app is
ready; follow the [ordered rollout](league-night-database-rollout.md).

## Next gates requiring separate approval

1. Obtain a protected production backup and prove restoration into an isolated
   target. A manual logical backup is available without a plan upgrade. Agree on
   exact schemas/data, auth foreign-key dependencies, restricted local storage
   outside Git, retention and restore target before exporting. Do not copy
   production data into the synthetic demo or publish it in fixtures/logs.
2. Resolve the untracked baseline/history strategy with the owner and rehearse
   the exact additive/enforcement SQL against the restored schema/data. Check
   record preservation, not only counts. Keep baseline replay and unreviewed
   migration repair prohibited.
3. Approve the hosted target and deployment mechanism; inspect its dry run and
   use a deliberate preview target. Publish reviewed commits/PR only when asked.
4. Apply additive SQL first, deploy/verify the RPC-capable app, then coordinate
   a short match-entry pause, drain legacy saves, inspect incomplete records and
   enforce RPC-only saving. Keep the RPC-capable app as the rollback release.

The existing [local verification](league-night-verification-2026-09-26.md) remains
dated evidence. No application or database rehearsal suites were rerun for this
read-only audit and documentation update.

References checked 2026-09-27:
[Supabase backups](https://supabase.com/docs/guides/platform/backups),
[GitHub integration](https://supabase.com/docs/guides/deployment/branching/github-integration).
