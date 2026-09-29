# W1: environment assessment and completed isolation gate

**Latest disposition: W1 passed on 2026-09-29.** The combined release's exact
Preview source, browser target and live client/server key agreement on RDD
Release Testing are verified in the [isolation completion record](w1-preview-gate-2026-09-29.md).
GitHub CI and Vercel passed. W0 remains passed; W2-W8 remain open.

## Earlier assessment and configuration snapshots

Later follow-up: the owner has provisioned and configured **RDD Release
Testing**. Its identity, Vercel scopes and disabled invitation flag were
[verified read-only](w1-testing-target-2026-09-29.md). The configuration
observations below describe the earlier snapshot; existing deployments retain
their old variables. A running isolated combined-candidate Preview is still
unverified.

Date: 2026-09-29. **All read-only assessment work is complete. W1's original
isolated-preview prerequisite remains blocked.** Vercel access and the unknown
configuration questions are resolved; the existing Preview uses production.
This is not hosted acceptance, a backup/restore pass or release authorization.

The [fresh facts](w1-environment-facts-2026-09-29.json) and
[SELECT-only catalog query](w1-hosted-catalog-2026-09-29.sql) supplement the
[2026-09-28 assessment](w1-environment-assessment.md). Historical observations
and manifests remain dated records. No hosted configuration, application data,
schema, Auth setting or migration history was changed. No credential was rotated,
data exported, branch pushed or application deployed. Docker was not operated.

## W0 refresh and source identity

W0 remains **passed**. Its scope now has a complete updated
[source manifest](w0-candidate-2026-09-29.json), including the PR #75 interface,
Rivalry Room, 24 avatars and challenge series. No additional product or SQL work
was needed to finish W0.

| Item | Refreshed identity |
| --- | --- |
| Assessed combined source | `51cc3c3c367a319787ebf1091187b9d2a415ac2a` |
| Merge parents | UI candidate `d667dbedd1aba79fdb395f0fe4ebd2bfb762872e`; reviewed Rivalry source `5f9a24c7d79e7e91ad2227885373f09694916703` |
| Refreshed remote release | `42df060fdf7d26a63e00d00ccf0152a37f4abccb`; local source ahead by 12 commits before this documentation change |
| Refreshed main / merge base | `690a01b84d96c55b8ec455a6e298c17ec6093b50` |
| Combined source versus main | 40 commits; 375 changed paths; 42,127 insertions and 2,896 deletions |
| SQL inputs | Ten, with committed Git blob identities and SHA-256 hashes in the manifest |
| Deployable migration files | None under `supabase/migrations/` |

The source was clean before this refresh. This package changes documentation and
read-only evidence only. The [Rivalry/UI integration results](rivalry-ui-integration.md)
remain dated local application evidence. There is no hosted CI/preview for the
combined source; older green deployments do not validate it. W7 must freeze the
later final app and reviewed SQL identities. The original
[W0 snapshot](w0-candidate.json) is preserved.

## Verified Vercel targets

Authenticated access now works for Tim's projects (`tims-projects-b7b7f743`,
Vercel Pro), project `rochester-darting-degens`, ID
`prj_TSqYW4vCRO1YSB5CBdTtyhYAke4J`. The connected repository is
`rdd-cmyk/Rochester-Darting-Degens`. Only Production, Preview and Development
environments exist; no custom environments or linked shared variables were shown.

| Target | Actual configuration / deployment | Testing eligibility |
| --- | --- | --- |
| Production | Branch `main`; current Ready deployment `dpl_9M4xdNKkAzTSnstEDA5cEjyJMdAD` is source `690a01b`, created 2026-09-25 21:15:45 UTC. Public DB URL is `https://hrqsbzmsfichiimtxijj.supabase.co`. | Production only; no release acceptance writes authorized. |
| Existing League Night Preview | Ready deployment `dpl_3gbqMKveFjGY2k7csxn3pGuZcgfv`, old branch `league-night-mode`, source `42df060`, created 2026-09-28 20:24:24 UTC. Reachable in this authenticated browser. Its running client makes a PostgREST read against `hrqsbzmsfichiimtxijj.supabase.co`. | **Not isolated. No saves, signup, invitations, email or destructive tests.** |
| Vercel Development | `NEXT_PUBLIC_SUPABASE_URL` and anon-key variable are scoped to All Environments, so its configured public target is production. No service-role variable is scoped here. | No running development client or local overrides were tested. The Vercel Development label does not establish isolation. |
| Combined UI/Rivalry candidate | Local `51cc3c3`; no published deployment for this source. | Use a guarded isolated local stack for W2/W3; hosted acceptance remains blocked. |

The inspected old [Preview deployment](https://vercel.com/tims-projects-b7b7f743/rochester-darting-degens/3gbqMKveFjGY2k7csxn3pGuZcgfv)
and [app URL](https://rochester-darting-degens-6mv1s2los-tims-projects-b7b7f743.vercel.app/)
are retained for identification, not as approved test targets. The browser's
observed resource inventory supplied the runtime DB hostname; no response rows
were exported and no authenticated application session was created.

No branch-specific variable row appeared in the consolidated All Environments
inventory, and no `release/next` override was observed. The runtime target was
checked on the old preview only. A future preview must be inspected again after
configuration changes and a fresh build: settings alone do not establish the
database used by an already built browser or a deployed server function.

## Deployment controls and variable scopes

The [production environment](https://vercel.com/tims-projects-b7b7f743/rochester-darting-degens/settings/environments/production)
confirms `main` and automatic assignment of production domains. Production domains
are `www.rocdartdegens.com` and `rochester-darting-degens.vercel.app`;
`rocdartdegens.com` redirects with HTTP 307 to the `www` domain.
Pushing/merging to `main` is therefore a production deployment path. Manual
production deployment is another available path; source restrictions inherit
the team's No restrictions setting. Keep both controlled during W7/W8.

There are no Git deploy hooks or configured Deployment Checks. Ignored Build
Step is Automatic and Rolling Releases is disabled. The framework is Next.js,
root directory is the repository root, Node major is `24.x`, and `vercel.json`
sets `installCommand` to `npm run ci:install`. The current Production deployment's
override also shows that trusted installer. The new candidate's actual hosted
Node patch and build logs remain W3/W7 acceptance, not a W1 build claim.

| Variables | Observed scope and meaning |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | All Environments. These are the names the current browser client actually reads; the URL is production. The anon-key value was not retained or validated. |
| `SUPABASE_SERVICE_ROLE_KEY` | Production and Preview. Displayed legacy JWT metadata identifies project `hrqsbzmsfichiimtxijj`, role `service_role`, matching the current invitation server's URL. This identifies its intended project; no privileged API call or credential-validity test was made. |
| `NEXT_PUBLIC_SITE_URL` | All Environments, value `https://rochester-darting-degens.vercel.app`; differs from Supabase Auth's Site URL. It is not `RDD_INVITE_ORIGIN`. |
| Managed Supabase keys and Postgres settings | Thirteen Production-only integration variables; managed `SUPABASE_URL` also identifies production. The new publishable/secret key names do not replace the actual client/invitation variable names in source. Unused opaque secret values were not inspected. |
| Invitation controls | `RDD_INVITES_ENABLED`, `RDD_INVITE_ORIGIN`, `RDD_INVITE_SECRET`, `RESEND_API_KEY`, `RDD_INVITE_FROM` absent from the project inventory; no shared variables linked. The source enable condition is unmet, so hosted invitations are disabled. No request was sent to exercise them. |
| Local fixture controls | `RDD_LOCAL_PREVIEW`, `RDD_VISUAL_FIXTURE`, `NEXT_PUBLIC_RDD_VISUAL_FIXTURE` absent. |
| GitHub configuration | `GITHUB_TOKEN`, repository name and owner variables scoped to All Environments. No token value was inspected. |

Vercel labels the legacy service-role key and GitHub token as Config with
Needs Attention because they look like secrets. Their handling/scope needs an
owner review before hosted acceptance; do not copy production privileged
credentials into a rehearsal target.

During the service-role identity check, one browser accessibility response
unexpectedly included the key in this chat's tool output. It was remasked. No
key was written to repository files, copied to the clipboard or submitted to
another service. **Owner-approved rotation and verification of affected
consumers are now a prerequisite before hosted acceptance and release.**
Rotation was not performed during this read-only package; changing its display
classification to Secret alone would not address that disclosure.

## Refreshed Supabase facts

The CLI read-only catalog snapshot is **2026-09-29 12:59:46 UTC**, from RDD Main
Project `hrqsbzmsfichiimtxijj`, `us-west-2`, Postgres 17.6. Project/branch/backups
lists were also refreshed. The dashboard still shows the organization on Free,
one default production branch, no migrations and no backups. CLI returns
`backups: null` and PITR disabled. This establishes availability, not backup proof.

The installed Supabase CLI was 2.116.0. The catalog command was:

```powershell
node_modules/.bin/supabase db query --linked --project-ref hrqsbzmsfichiimtxijj --file docs/release/w1-hosted-catalog-2026-09-29.sql -o json
```

It used the CLI's normal login-role flow; no repository project link was created.
The retained facts contain only schema metadata, settings and aggregate counts.

There is no drift in the 15 comparable catalog/aggregate fields from the previous
snapshot: three RLS-enabled public tables, 22 columns, two sequences, 14 validated
constraints, three primary-key indexes, ten policies and no custom application
functions. `rdd_private`, `invite_private`, `rivalry_private` and migration history
are absent. None of the ten release SQL inputs has been applied.

Counts remain five Auth users, five profiles, ten matches, 22 participants and
zero Storage buckets/objects. All six grouped integrity checks return zero
exceptions. These observations do not prove individual record preservation,
semantic scoring correctness or restoration. Broad table/default grants remain
a W3 security-review item. The query now covers Rivalry private objects too.

The dashboard refresh confirms:

- Supabase GitHub integration targets the same repository, workdir `.`, branch
  `main`, with Deploy to production on. Automatic branching remains off and
  unavailable on the Free plan. Production Vercel credential sync is on;
  Preview/Development sync is off. Manual Vercel variables still target production.
- Public signup is enabled, email confirmation is on, and anonymous sign-in and
  manual linking are off. Email is enabled; other displayed providers are disabled
  and no custom providers exist. Secure email/password changes are on;
  current-password requirement and leaked-password protection are off. Email OTP
  duration/length remain 3600 seconds/eight digits. The numeric minimum-password
  field was redacted by the browser tool; its prior value of 16 is retained as
  **2026-09-28 evidence**, not falsely presented as refreshed.
- Auth Site URL remains `https://rocdartdegens.com`, with the same eight allowed
  redirects in the facts file. Custom SMTP remains disabled. These differ from
  local synthetic settings and still require W6 delivery/recovery acceptance.

There is also a production-origin discrepancy to resolve in W6: Vercel redirects
the apex to `www.rocdartdegens.com`, but the Auth allowlist has no explicit
`https://www.rocdartdegens.com/reset-password`. The application's recovery source
uses `window.location.origin`. This is a configuration risk inferred from those
verified settings/source, not a reproduced hosted recovery failure. Choose the
intended canonical origin, prepare matching redirects and test real recovery on
the approved isolated target before the production transition.

The original migration-history proposal remains applicable: checked legacy
preconditions/history anchor, reviewed incremental SQL, separately bootstrapped
fresh test DB, exact-chain rehearsal and one deployment authority. Do not replay
the baseline or repair history just to make a push look current. Supabase and
Vercel can both react to `main`; W7 must settle the coordinated release path before
SQL is promoted into a deployable directory.

## Gate disposition and required next work

| Original W1 requirement | Disposition |
| --- | --- |
| Actual repo, production branch, hooks/domains and build controls | Verified. |
| Production/Preview/Development public targets and current variable scopes | Verified; currently shared production target. Development runtime/local overrides untested. |
| Current invitation server URL and service-role project agreement; fixture/enable controls | Configuration/metadata verified; credential validity and deployed server behavior untested. |
| Exact preview source and **isolated** browser/server DB pair | **Failed precondition:** inspected preview is old source and points to production. No isolated hosted pair is available; no mutation allowed. |
| Node major/trusted install/current domains | Verified settings; final candidate patch/build acceptance remains open. |

W1's read-only deliverables are finished. Its original isolated-preview gate is
**not passed, waived or silently converted into acceptance**. Close it with the
approved W6 target preparation before any hosted test. W2/W3 can continue locally.

The concrete configuration work to prepare for owner review is:

1. Select/provision an explicitly isolated compatible Supabase project and app
   preview with approved ownership/cost; record its real ref and URL. Do not reset
   production, reuse another feature stack implicitly or assume Vercel Pro
   supplies a Supabase DB branch. W3 remains a dedicated synthetic local stack;
   W4/W5 protected restoration is separate from hosted email acceptance.
2. Use only that target's client and server credentials for the release preview.
   Remove production privileged access from test Preview scope under the approved
   configuration change. Review GitHub-token scope/Secret handling separately.
   Rotate the disclosed service credential with an owner-reviewed impact and
   consumer update plan; do not perform an unreviewed credential change.
3. Prepare matching exact origins/redirects, invitation flags/secret/sender and
   Auth delivery settings. Keep invitation enabling and test email delivery
   controlled and tied to that isolated project. Production signup transition,
   membership and organizers remain coordinated W6/W8 decisions.
4. Build/deploy the intended combined candidate after setting the isolated
   values. Verify its source SHA, compiled browser target and server project
   agreement, absence of local fixture flags, and then run approved W6 tests.
   Keep every old production-connected preview out of mutation testing.

W4 backup/restore, W5 rehearsal, W6 account/delivery/owner acceptance and W7/W8
release approval/cutover remain mandatory. No configuration task above has been
executed or authorized by this read-only assessment.

## Verification

The fresh SELECT-only query succeeded on the named project; catalog comparison
found no drift. Query SHA-256 is
`4cea4cda02350d5dd81e2aa27c2560cda20417c69c798002665cefb771d15dcd`.
The source manifest identifies all ten committed SQL inputs. Verification passed
for two JSON artifacts, all ten SQL source hashes, 61 relative links, the query
hash/scope, sensitive-content scan and Git whitespace/source scope across nine
files. No deployable SQL, application code,
dependency, workflow or hosting configuration changed; application/DB suites
were not rerun for documentation-only changes.
