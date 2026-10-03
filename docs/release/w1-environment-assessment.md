# W1: historical environment assessment (2026-09-28)

Date: 2026-09-28. Read-only assessment and migration-history proposal complete.
This dated assessment is supplemented by the
[2026-09-29 refresh and gate disposition](w1-completion-2026-09-29.md) and
[fresh facts](w1-environment-facts-2026-09-29.json). Vercel access/configuration
inspection is now complete. **W1's original isolated-preview prerequisite is
blocked because the existing Preview uses production.** The owner checklist and
unknowns below describe the earlier state; they are preserved as historical
evidence. No hosted test, backup/restore or deployment gate has passed. W2 can
proceed locally.

Candidate addendum, 2026-09-29: the local release now includes the PR #75 UI and
reviewed Rivalry Room/avatars. This assessment remains the dated hosted baseline;
no new hosted inspection or write was performed for those merges. Add
`rivalry_private` and its public RPCs/save wrapper to W3's schema/grants comparison
and W4/W5's backup/restore and rehearsal manifest. No additional hosted credential
is required by Rivalry Room. The Vercel owner gate remains open. See the
[integration evidence](rivalry-ui-integration.md).

## Evidence and boundaries

Inspected `release/next` at `31cf034e98d49e3569eab34e42509110dec998af` (W0's
documentation commit). The implementation and remote release tip remain
`42df060fdf7d26a63e00d00ccf0152a37f4abccb`; `origin/main` remains
`690a01b84d96c55b8ec455a6e298c17ec6093b50`. The working tree was clean before W1.
The existing [W0 source manifest](w0-candidate.json) still identifies the SQL
inputs; W1 changes documentation/evidence only.

Used the installed Supabase CLI 2.116.0 to list the authorized project, branches
and backups and run [this SELECT-only query](w1-hosted-catalog.sql). Reviewed the
authenticated Supabase dashboard, GitHub deployment/status metadata and the live
site's public bundle. The [sanitized facts snapshot](w1-environment-facts.json)
records the catalog, settings and observation limits. Its SQL snapshot was taken
at 2026-09-28 21:53:45 UTC. Only schema metadata and aggregate counts were read;
no player/account rows, credentials or private contact details are included.

No hosted application data, schema, policy, migration history, Auth, integration
or hosting settings were changed. The CLI used its normal login-role flow; no
project link was created. No real-data export, restore, app test suite, migration
dry run, commit publication or deployment was performed. Docker was not needed
or operated for W1; the isolated stack work belongs to W3-W5.

## Current targets

| Target | Identity and observed connection | Evidence / acceptance limit |
| --- | --- | --- |
| Production app | `https://rocdartdegens.com`; Vercel project `rochester-darting-degens` in `tims-projects-b7b7f743`. Latest GitHub Production deployment `6670280076` succeeded for `690a01b`. | The live public bundle contains `hrqsbzmsfichiimtxijj.supabase.co`. This confirms the browser target, not every server environment value or the Vercel production-branch setting. |
| Production DB | RDD Main Project, `hrqsbzmsfichiimtxijj`, `us-west-2`, Postgres 17.6 / platform `17.6.1.054`, `ACTIVE_HEALTHY`, Free plan. | Authenticated CLI/catalog and dashboard. Only the default `main` DB branch was listed. |
| Release preview | [Deployment for `42df060`](https://rochester-darting-degens-6mv1s2los-tims-projects-b7b7f743.vercel.app); GitHub Preview deployment `6719765660` succeeded. | Protected by Vercel login. DB target and server configuration are unverified; no save/signup/email tests may run here yet. |
| Vercel Development | Same Vercel project; actual environment values unavailable. | Supabase Development sync is off. A local or isolated DB cannot be inferred. |
| This checkout | No root `.env.local` exists. Checked-in default Supabase project ID is `Rochester-Darting-Degens-advanced-statis`, loopback API 54321. | Do not use a generic dev command as evidence of the combined release target. Use an explicit guarded local launcher. |
| W3 combined synthetic rehearsal | Proposed dedicated `rdd-release-next` stack/workdir `.local/release-next`, with distinct loopback ports assigned and verified before startup. | Not provisioned in W1. Existing League Night/planning/game-mode/Solo/invitation stacks must not be reset or reused implicitly. |
| W4-W5 protected restoration | A separate isolated restore target, distinct from the synthetic stack and production. | Exact storage/target approval and provisioning belong to W4; no production copy was made. |
| W6 hosted email/Auth acceptance | Explicit isolated DB/project and matching app preview, selected before real delivery tests. | No hosted test target has been provisioned or approved; preview access alone does not establish one. |

The owner confirmed on 2026-09-28 that their account cannot access the owning
Vercel project; their friend's account has access and can share particular
previews. The accessible `rdd7` team has no projects and is not the release's
hosting target. Do not move/duplicate the project, buy a subscription or request
the friend's credentials to close this gap. Obtain the non-secret owner evidence
listed below. No message was sent to another person.

## Hosted schema and permissions

The production app schema still matches the legacy
[`existing_schema_baseline.sql`](../../supabase/tests/fixtures/existing_schema_baseline.sql)
for the inspected tables, columns/defaults, keys/checks, indexes and policies:

- Three public tables: `profiles`, `matches`, `match_players`; 22 columns total,
  two bigint sequences, 14 validated constraints and three primary-key indexes.
- RLS is enabled on all three tables. Ten permissive policies implement
  authenticated reads, self-owned profile writes and creator-owned match/roster
  writes. No `rdd_private`, `invite_private` or migration-history schema exists.
- No custom public/private application functions or noninternal public/Auth
  triggers were returned. Seven current managed Storage triggers were listed;
  they are platform objects, not application migration inputs.
- Existing client table/sequence grants and public-schema default privileges
  remain broad. `anon` and `authenticated` have no role memberships, superuser
  access or RLS bypass; `service_role` has its expected bypass. RLS metadata does
  not replace a final API/role test. Review unnecessary table privileges
  (including TRUNCATE) and future-object defaults in W3's combined security pass.
- Extensions: `pg_stat_statements` 1.11, `pgcrypto` 1.3, `plpgsql` 1.0,
  `supabase_vault` 0.3.1 and `uuid-ossp` 1.1.

None of the future statistics, League Night, planning, Board, invitations,
game-mode or Solo SQL is installed. In particular, there is no `seasons`,
`stats_match_facts`, membership storage, `game_config` or `rdd_save_match`.
The new application requires the ordered DB preparation before production
deployment. No conflicting feature objects were found in this catalog scope.

Counts were 10 matches, 22 participant rows and 5 profiles, unchanged from the
2026-09-27 audit. W1 also counted 5 Auth users and zero Storage buckets/objects.
Six grouped integrity checks returned zero exceptions: roster/winner validity, orphan participants,
missing creators, timestamps, game/board labels and summary score/Cricket values.
These are compatibility observations, not record-level preservation, semantic
score accuracy or restore proof. Refresh them before cutover; legitimate entries
can change counts.

## Deployment paths and configuration differences

Supabase's GitHub integration remains linked to
`rdd-cmyk/Rochester-Darting-Degens`, working directory `.`, production branch
`main`, **Deploy to production on**. Automatic branching is off and unavailable
on the current plan. Vercel credential sync is on for Production and off for
Preview/Development, with prefix `NEXT_PUBLIC_`. Those sync switches do not
describe any manually configured environment values or server credentials.

There are still zero tracked migration, Edge Function, seed or custom-role files.
The repository's CI only installs/verifies/builds the app; it does not push SQL.
GitHub records nevertheless show that branch publication creates Vercel previews.
The production-branch setting and any Vercel build/deploy hooks require owner
verification. Keep the current combined branch unmerged while its DB is absent.

Supabase documents production GitHub deployment of migrations, declared Edge
Functions and Storage buckets; other configuration, including Auth, is ignored
by default. Preview branches build schema from migrations instead of cloning
production schema. Local Auth settings must not be pushed wholesale to hosting.
[GitHub integration documentation](https://supabase.com/docs/guides/deployment/branching/github-integration)

| Setting | Current hosted fact | Source assumption / required follow-up |
| --- | --- | --- |
| Public signup | Enabled | Release local config disables it globally. W6 prepares and tests coordinated closure while retaining email login; W8 applies the approved production change. |
| Email provider / confirmation | Email enabled; confirm email on; anonymous login/manual linking off; other displayed providers disabled. | Local email confirmations are off for synthetic testing. Keep the hosted security contract deliberate. |
| Password rules | Minimum 16; no required character classes; secure email and password changes on. Current-password requirement and leaked-password protection off. OTP expires in 3600 seconds, length 8. | Minimum matches local source. Secure password change differs from the local test config; verify actual recovery/re-authentication behavior in W6. |
| Site / redirects | Site URL `https://rocdartdegens.com`; eight allowed redirects, including localhost, production reset and Vercel URLs/wildcards. | Checked-in config instead uses loopback Site URL and two loopback recovery redirects. Current hosted list is in the facts snapshot. Confirm the intended preview/reset origins and narrow obsolete entries during W6; none were edited. |
| Auth email delivery | Custom SMTP disabled | Do not assume member password recovery/email changes work from the built-in sender. Supabase documents restrictions to project-team recipients and low limits. Prepare and test approved Auth delivery in W6. |
| Invitation mail | Candidate uses a server-only Resend adapter with its own flags/origin/secret/sender settings. | This is separate from Supabase Auth SMTP. Vercel variable presence/scope and delivery have not been verified. |
| Backups | CLI `backups: null`, PITR off; dashboard states Free has no project backups. | No accessible scheduled restore point or tested owner backup was established. W4 still requires the protected backup/restore proof. |

Auth SMTP's current documented default restrictions are described in
[Supabase SMTP documentation](https://supabase.com/docs/guides/auth/auth-smtp).
Invitation configuration requirements remain in the
[invitation handoff](../invite-only-registration-handoff.md).

## Proposed migration-history adoption

Recommend a deliberate manual CLI release with one deployment authority during
cutover, after W4-W7. Keep all SQL deferred now. The existing production schema
has no migration history; do not replay the historical fixture or run repair to
make an unreviewed push appear current.

1. Treat the refreshed schema/permission snapshot as the legacy starting
   contract. In W3, validate the fresh-only legacy fixture against that contract,
   including platform defaults which a schema dump alone may omit. Repeat against
   the protected restore in W5. Managed Auth/Storage/extension internals stay out
   of application baseline SQL.
2. Prepare a reviewed first release **history anchor**: assertions of the legacy
   schema/permissions preconditions, with no replacement of existing tables or
   data. Follow it with only reviewed incremental release migrations. Normal
   migration execution can establish the history table and record the anchor and
   successful increments; no historical migration repair is needed for this
   proposed path.
3. For fresh synthetic databases, bootstrap the legacy fixture separately, then
   exercise the identical anchor/incremental chain. This deliberately does not
   make migrations alone a complete empty-project install. Automatic Supabase
   branching remains unsuitable until a separate reviewed full-bootstrap strategy
   exists. Never ship the old fixture to the current project's migration path.
4. Rehearse the exact timestamps, SQL hashes, transaction boundaries, interruption
   handling and history contents in W3/W5. Re-read history before every attempt;
   do not mark a failed or partly applied step successful. Place new feature
   storage, membership backfill, final game-aware view and later direct-write
   enforcement in the order specified by the combined release manifest.
5. At W7, approve the exact deployment mechanism and owner/operator assignments.
   For the proposed manual path, the owner coordinates pausing automatic Supabase
   production deployment before migration promotion/publication, so it cannot
   race the operator. The Vercel owner also confirms the controlled app release
   path. This configuration change is proposed, not executed or authorized here.
6. Review a dry run on the exact approved target/checkout: only the anchor and
   approved incremental files may be pending. No baseline replay, fixture/seed,
   demo activation or unreviewed role/config push is permitted. Refresh schema,
   backup and history before the owner-approved W8 execution.

Supabase's CLI records applied versions and provides a dry run; history repair
changes records without executing migration SQL. The above approach avoids that
repair operation for the current empty-history state.
[CLI migration behavior](https://supabase.com/docs/reference/cli/supabase-db-push)

This is a proposal for W3/W5/W7, not a new deployable migration or an exemption
from the existing [release gate](../supabase-github-integration-release-gate.md).
If a fully self-contained fresh-project migration chain becomes required, review
that alternative separately before changing the proposal or adoption records.

## Historical Vercel owner checklist (current disposition linked above)

Provide non-secret settings/evidence for the owning project. Screenshots should
keep API keys, tokens, personal contact details and variable values hidden; report
only public DB hostnames/origins and variable presence/scope.

- [ ] Confirm the connected repository, actual production branch, automatic
  deployment/build hooks, and which app action publishes to production.
- [ ] Confirm the public Supabase hostname for Production, Preview and Development,
  including any branch-specific Preview overrides for `release/next`. A missing
  value must be recorded as missing, not assumed isolated.
- [ ] Confirm each environment's server DB/privileged credential belongs to the
  same intended project as its public URL. Record presence/scope only for
  `SUPABASE_SERVICE_ROLE_KEY`, `RDD_INVITES_ENABLED`, `RDD_INVITE_ORIGIN`,
  `RDD_INVITE_SECRET`, `RESEND_API_KEY` and `RDD_INVITE_FROM`. Confirm
  `RDD_LOCAL_PREVIEW`, `RDD_VISUAL_FIXTURE` and
  `NEXT_PUBLIC_RDD_VISUAL_FIXTURE` are absent/disabled in hosted environments.
  PR #75 adds the latter two local-only fixture controls; this checklist addition
  does not change the dated hosted observations. Do not share keys.
- [ ] Share the exact preview for later testing, identify its source SHA and its
  isolated DB ref, and verify the compiled browser and server targets match that
  ref. Do not grant a preview production credentials to make it work.
- [ ] Confirm Node major 24, the trusted install command and the production
  domain/approved preview origins. Runtime patch/build-log acceptance is repeated
  for the final release in W3/W7, not inferred from this successful deployment.

Access to a preview can close the preview inspection gap; it cannot by itself
confirm project settings, server variable scopes or DB isolation. Until this
evidence arrives, mark W1's exit gate open and keep hosted preview mutations
blocked. Do not carry that gap forward as a passed gate.

## Verification and next packages

The SELECT-only catalog query ran successfully on the named authorized project;
the catalog was compared with the legacy fixture. GitHub reports successful CI
[36480187732](https://github.com/rdd-cmyk/Rochester-Darting-Degens/actions/runs/36480187732)
and a successful Vercel Preview for implementation `42df060`. These are existing
app/build results, not combined DB or owner acceptance. The W0/W1 documentation
commits have no separately published CI result.

Documentation verification passed: valid facts JSON, matching query SHA-256,
catalog totals, 34 relative links, one SELECT-only query statement, sensitive
content scan and Git whitespace review. No deployable SQL was added under
`supabase/migrations/`; application suites were not rerun for this evidence-only
change. W2 may begin locally on the future stats SQL. W3 must use a dedicated
synthetic stack; W4-W8 retain their backup, restore, configuration, acceptance
and release gates.
