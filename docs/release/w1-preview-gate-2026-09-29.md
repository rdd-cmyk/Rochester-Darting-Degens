# W1 complete: isolated combined release preview

Accepted: 2026-09-29, approximately 14:56 UTC. **W1 passed. W0 remains passed.**
The owner authorized publication and completion of the remaining isolation gate.
The combined release has a Ready Vercel Preview, and its running browser and
server both use **RDD Release Testing**, including verified client/server keys.
This is connection-isolation evidence, not database/gameplay/email acceptance
or permission to deploy SQL or release to production.

## Exact accepted candidate

| Item | Verified identity |
| --- | --- |
| App source SHA | `25317dcaa675feeff324e108733df70d73101d76` |
| Branch | `release/next`, published; remote matched local, ahead/behind `0 0` |
| Vercel deployment | `dpl_GcTRGxjgG8eaZoUMZZkh5FmGadX3`, Preview, Ready; 47-second build |
| Deployment detail | [Exact candidate](https://vercel.com/tims-projects-b7b7f743/rochester-darting-degens/GcTRGxjgG8eaZoUMZZkh5FmGadX3) |
| Immutable preview | [Combined release](https://rochester-darting-degens-nmbghxxqk-tims-projects-b7b7f743.vercel.app/) |
| Stable branch preview | [release/next preview](https://rochester-darting-degens-git-rele-684da0-tims-projects-b7b7f743.vercel.app/) (moves with later pushes) |
| Runtime server proof | [Read-only isolation page](https://rochester-darting-degens-nmbghxxqk-tims-projects-b7b7f743.vercel.app/release-readiness) |
| Supabase target | RDD Release Testing, `uepayhdrgzrxhkqbwebo`, `us-west-2`, PostgreSQL 17, platform `17.6.1.171`, ACTIVE_HEALTHY |
| GitHub CI | [Run 36585993718](https://github.com/rdd-cmyk/Rochester-Darting-Degens/actions/runs/36585993718), Node 24 verification **success** for the exact SHA |
| Supabase Preview check | Skipped; no automatic DB preview or SQL deployment was relied upon |
| Live production source | Latest Production deployment `6670280076` remains `690a01b84d96c55b8ec455a6e298c17ec6093b50`, created 2026-09-25 21:15:45 UTC |

Later documentation-only publication does not change this accepted app revision.
Use the immutable preview above when reproducing this record; a later branch
preview must identify its own SHA and receive the appropriate subsequent checks.

## Browser/server agreement

The server-rendered `/release-readiness` page returned the accepted commit and
testing ref, with `clientCredentialVerified: true`,
`serverCredentialVerified: true`, `invitationsEnabled: false`,
`fixtureFlagsEnabled: false`, and `schemaAcceptance: not_exercised`.

The check makes two bounded reads: Auth settings with the configured client key,
and Auth admin `listUsers({ page: 1, perPage: 1 })` with the configured server key.
It discards user fields/counts and never returns/logs keys or upstream errors.
Both use only the fixed testing URL; production/other targets are rejected
before any connection. It is unavailable outside Vercel Preview on `release/next`.
The HTML page uses the identical server check; direct non-HTML navigation was
blocked by the browser tooling and was not counted as successful evidence.

On this same immutable preview's Home page, the observed browser request was:

```text
https://uepayhdrgzrxhkqbwebo.supabase.co/rest/v1/match_players?select=player_id%2Cis_winner%2Cscore%2Cmatch_id%2Cprofiles%28id%2Cdisplay_name%2Cfirst_name%2Cinclude_first_name_in_display%29%2Cmatches%21inner%28game_type%2Cgame_config%2Cplayed_at%29
```

This independently establishes the compiled browser's testing target. No
production Supabase request appeared in that observed page inventory. This is
a focused connection observation, not a network audit of every application route.

The testing project's Table Editor reports **No tables or views** in `public`.
Its Home leaderboard read fails as expected before application schema setup.
Do not treat this preview as ready for gameplay or apply SQL merely to hide the
error. Prepare/rehearse the reviewed chain under W2/W3 and the later hosted gates.

Sanitized local evidence (ignored, no credentials):

- `.local/release/w1-isolation-25317dc.json`: observed runtime response.
- `.local/release/w1-browser-25317dc.json`: observed browser request inventory.
- `.local/release/w1-isolation-25317dc.png`: screenshot of the live result.
- [Tracked sanitized facts](w1-preview-gate-2026-09-29.json).

## Verification and scope

Trusted locked install passed; all 530 tests in 68 files passed; coverage passed
at 96.53% statements, 90.90% branches, 97.76% functions and 97.59% lines; lint,
typecheck and production build passed. The diagnostic has 22 focused tests for
production/other-branch rejection, fixed target enforcement, missing/wrong keys,
disabled fixture/invitation controls, sanitized failures and escaped rendering.
Local builds use nonsecret local defaults; live key validity was established by
the deployed check, not by local builds. Exact-source GitHub CI and Vercel passed.
The existing moderate development-only advisory remains a W3 follow-up.

All 13 pre-existing outgoing commits were reviewed before publication and were
within the requested UI/Rivalry integrations and W0/W1 records. Three subsequent
commits prepare/adjust the read-only diagnostic and its browser rendering. No
rebase was needed: unchanged remote `main` was already an ancestor. No PR was
created or merged. No deployable migration SQL was added; the ten W0 SQL inputs
remain unchanged relative to the assessed combined implementation `51cc3c3`.

The owner made the credential scope changes; this work published only the
authorized Preview branch. No hosted SQL/schema, application records, Auth
configuration, membership, invitations or email were changed. No production
data was exported/restored; no backup/restore or production release was attempted.

## Next packages

W2 statistics storage preparation and W3 full synthetic-chain rehearsal remain
next. W4 backup/restore, W5 production-shaped rehearsal, W6 delivery/Auth/phone
acceptance, W7 release approval and W8 cutover remain open. Retire the previously
disclosed production legacy service key through the controlled consumer-update
plan before hosted acceptance; the isolated preview does not perform that task.
Review GitHub token Secret/scope handling separately. Remove the temporary
diagnostic when no longer needed, with its production guard retained until then.
