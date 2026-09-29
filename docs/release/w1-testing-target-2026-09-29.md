# W1 follow-up: isolated testing target configured

Latest: [W1's running isolation gate passed](w1-preview-gate-2026-09-29.md).
The pending items below describe the earlier configuration/publication snapshot.

Observed: 2026-09-29, approximately 14:37 UTC. The owner created the testing
project and changed Vercel variables. This follow-up verifies those changes
read-only; it supersedes the earlier missing-project/configuration observations
in [the W1 assessment](w1-completion-2026-09-29.md), not its historical evidence.
W1's running combined-preview isolation gate remains open.

## Verified target and configuration

- Supabase project **RDD Release Testing**, ref `uepayhdrgzrxhkqbwebo`, URL
  `https://uepayhdrgzrxhkqbwebo.supabase.co`, in the existing organization
  `tnmzrkfyfecvmzrdhqab`; Free plan, `us-west-2`, ACTIVE_HEALTHY.
- CLI metadata reports PostgreSQL 17, platform version `17.6.1.171`, versus the
  earlier production observation `17.6.1.054`. Compare platform/schema defaults
  during rehearsal; the same major version is not proof of identical defaults.
- Its dashboard reports no GitHub repository connected, no migrations and no
  backups. No application table inventory, credentials or data were queried.
  The label `main / PRODUCTION` belongs to this testing project's default
  branch and does not identify the live application's production database.
- In the existing Vercel project `rochester-darting-degens`:

| Variable | Observed scope/type | Verified value or limitation |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | All Pre-Production Environments; Config | Matches the testing project's URL above. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | All Pre-Production Environments; Config | Present; value not revealed or exercised. |
| `SUPABASE_SERVICE_ROLE_KEY` | Preview; Secret | Present; write-only value not revealed or exercised. Its project identity and validity still need runtime evidence. |
| `RDD_INVITES_ENABLED` | Preview; Config | `0`, verified; invitation delivery remains disabled. |
| Existing production versions of client URL/key and service-role variable | Production only | Scope verified; values not revealed or changed by this inspection. |
| Integration-managed Supabase/Postgres variables | Production only | Scope verified; no new testing integration required. |

No local fixture flags were present in the displayed variable inventory.
`NEXT_PUBLIC_SITE_URL` and the GitHub variables remain All Environments;
their values were not inspected in this follow-up. The existing production
service-role variable and GitHub token still show Config/Needs Attention.
The previously documented production credential retirement remains a separate,
controlled owner action; removing Preview scope does not retire an exposed key.

## Remaining gate and boundaries

1. Prepare the reviewed legacy bootstrap and combined SQL chain under W2/W3's
   local gates. A new project alone does not contain the release schema.
2. Publish/build the intended combined `release/next` source as a Preview using
   the new variables, preserving the production branch and production settings.
   This checkout remains at `438f32c` (documentation), with implementation
   manifest source `51cc3c3`; the previously verified remote tip was `42df060`.
   Refresh remote state and inspect every outgoing commit before publication.
3. Verify the new deployment's exact source SHA, compiled browser target and
   server target/key agreement. Configuration presence alone is insufficient.
   Do not use historical production-connected deployments for mutation tests.
4. Before email/Auth acceptance, configure matching testing origins/redirects
   and delivery controls under W6. Keep invitations disabled until that gate.

This inspection applied no SQL, changed no hosted settings, revealed no API
keys, exported/restored no data, and pushed/deployed no source. W0 remains
passed. W1's read-only findings and target selection are complete; the running
isolated combined-preview prerequisite remains unverified. W2-W8 gates remain.

Evidence: authenticated Vercel variable inventory and public URL/flag reveals;
authenticated Supabase project overview; `supabase projects list --output json`.
Only nonsecret identities, scopes and observation limits are recorded here.

## Authorized preview publication and runtime check

The owner requested the remaining W1 gate on 2026-09-29. Publication of
`release/next` as a Preview is authorized for this gate; SQL and production
deployment remain deferred. The 13 pre-existing outgoing commits were reviewed:
they contain W0/W1 documentation, the requested PR #75 UI and its fixes, and
the requested Rivalry integration and reviewed fixes. No unrelated package,
workflow, lockfile, Supabase configuration or deployable migration is included.
Remote `main` remains `690a01b`, already an ancestor; no rebase is necessary.
Vercel's current environments page confirms Production tracks `main` and Preview
tracks all unassigned Git branches.

`GET /api/release-readiness` is a temporary release diagnostic, unavailable
outside Vercel Preview on `release/next`. It requires the exact testing URL,
both configured keys, invitations disabled and local fixture flags disabled.
It reads Auth settings with the client key and performs one bounded Auth admin
read with the server key. It never queries production, writes Auth/data/schema,
sends email, returns user fields/counts or returns/logs credentials or upstream
errors. Its response identifies the deployed SHA/ref and successful key checks.
It does not establish schema, application behavior or email acceptance. Remove
the diagnostic when no longer needed; Production requests are rejected before
any connection is made.

Pre-publication checks pass: trusted locked install; 526 tests in 67 files
(including 18 diagnostic assertions); coverage 96.53% statements, 90.90% branches,
97.76% functions, 97.59% lines; lint; typecheck; production build. The local build
uses nonsecret local fallbacks and is not hosted credential evidence. The
existing moderate development-only advisory remains a W3 item. Hosted build,
runtime key checks and browser-target evidence are pending publication.
