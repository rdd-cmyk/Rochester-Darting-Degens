# Next release: readiness and rollout plan

Updated: 2026-09-30. Status: W0 complete and manifest refreshed; W1 read-only
assessment complete, Vercel access resolved, isolated-preview gate passed;
W2 statistics foundation and W3 combined synthetic rehearsal passed locally;
W5's production-shaped local rehearsal has passed; W6-W8 release gates remain open.

Current resume point: P01-P07 are owner-accepted and P08 is awaiting owner review in the
page-by-page consistency and wording pass before returning to W7 (and affected
W6 closeout). The [September 30 checkpoint](release/pre-consistency-checkpoint-2026-09-30.md)
records accepted results, candidate `351a4b0`, remaining dependency/credential
controls and both W6 SQL supplements. It supersedes stale summary wording below;
earlier dated evidence remains intact. No production approval is implied.
The detour is tracked in the [page consistency and wording plan](page-consistency-and-copy-plan.md):
one page per package, with owner acceptance before proceeding to the next.

## Candidate and scope

The integration branch is now `release/next`, renamed from `league-night-mode`
on GitHub and locally. Both refs were verified at
`42df060fdf7d26a63e00d00ccf0152a37f4abccb`. The existing worktree remains
`F:\RDD\Rochester-Darting-Degens-league-night-mode`. `main` remains the default
branch. No open PRs existed at rename time. Historical documents retain their
original branch names and dated results.

This candidate includes League Night Mode, planning (PR #70), the Board and its
recovery fixes (#71/#72), invite-only registration (#73), and Solo Play plus
game-mode/team-rating prerequisites (#74). Review the complete diff from `main`,
not just the latest feature PR. Omni imports are outside this release.

Scope addition authorized 2026-09-29: integrate the latest PR #75 interface
branch (`804b74f`) into `release/next`, preserving the newer release behavior.
The original W0 snapshot remains the initial candidate record. See the
[UI integration record](release/pr75-ui-integration.md) for the new source
parents, conflict decisions, checks and remaining acceptance gates. The merge
adds no SQL or dependency changes. W1 now verifies both visual-fixture flags are
absent in Vercel. W3 must test this combined interface
and feature set; W4-W8 backup, rehearsal and release gates still apply.

Scope addition authorized 2026-09-29: merge the reviewed local `rivalry-room`
branch at `5f9a24c` onto the combined UI candidate at `d667dbe`. Rivalry Room,
24 curated player avatars and accepted challenge series are now included.
See the [Rivalry/UI integration record](release/rivalry-ui-integration.md).
W0 remains passed with this scope addendum and its refreshed manifest; the
[W1 refresh](release/w1-completion-2026-09-29.md) covers Vercel and Rivalry's
absence from hosting. The new private schema and save wrapper must
join W3-W5's full-chain tests, backup inventory and rollback rehearsal. Local
feature checks do not close those packages or authorize hosted changes.

Scope decision confirmed by the owner on 2026-09-28: prepare the deferred
statistics SQL as useful future infrastructure during this release's DB work.
Do not add new statistics to the site. Include the reviewed seasons storage,
optional detailed-stat columns, metadata, constraints and query view; keep the
current dashboard, scoring entry and calculations unchanged unless correcting a
verified regression in the existing release features. There is no season setup
UI, automatic season assignment/rating reset, new raw-stat entry, enhanced-stat
dashboard, import pipeline or turn-by-turn scoring in this release. Existing
matches retain null season/raw-stat values where no evidence exists.

Writing this plan does not execute its packages. Source corrections, test harness
work, protected exports and release actions below are upcoming work, with their
completion recorded against actual evidence rather than this scope decision.

This document coordinates the combined release. The existing
[Supabase release gate](supabase-github-integration-release-gate.md) and
[League Night rollout](league-night-database-rollout.md) remain constraints.
The earlier application-only release instructions do not make this combined
application safe to deploy against the old database.

Completed in this planning pass: fetched remote state, fast-forwarded the clean
local checkout, inspected source/dependencies and handoffs, renamed the branch,
and confirmed no tracked SQL under `supabase/migrations/`. No application/DB test
suite, hosted audit, export, restore, migration, Auth change or deployment was run.
The rename triggered [CI run 36480187732](https://github.com/rdd-cmyk/Rochester-Darting-Degens/actions/runs/36480187732),
which passed for `42df060`. This is application CI evidence, not DB/browser,
backup/restore or hosted acceptance. W0 now records the confirmed scope and
initial source identities in its [completion evidence](release/w0-scope-and-candidate.md)
and [candidate snapshot](release/w0-candidate.json). W0 documentation is local;
publication and later-package work are separate actions.

The [2026-09-29 W0 manifest](release/w0-candidate-2026-09-29.json) now identifies
combined source `51cc3c3`, 40 commits / 375 paths versus main and ten SQL inputs.
At that original snapshot, remote release was `42df060` and the combined source
was unpublished; W1 later published it as recorded below. The
[W1 completion record](release/w1-completion-2026-09-29.md) and
[fresh facts](release/w1-environment-facts-2026-09-29.json) resolve Vercel access,
production/build controls and the earlier targets. The owner subsequently
created **RDD Release Testing** (`uepayhdrgzrxhkqbwebo`) and split Vercel
credential scopes: new client variables target testing in pre-production,
the testing server key is a Preview-only Secret, old credentials are
Production-only, and invitations are disabled. See the
[verified configuration follow-up](release/w1-testing-target-2026-09-29.md).
Existing deployments retain their old values. The new combined-candidate
Preview at `25317dc` passed its original isolation prerequisite: both deployed
keys and the browser request target are verified on RDD Release Testing. See the
[W1 completion evidence](release/w1-preview-gate-2026-09-29.md). Its application
schema remains empty; schema/gameplay/email acceptance and hosted mutation gates
are still separate packages.

## Execution sequence and completion records

Work through these packages in order. W1 inspection and W2 source preparation
can overlap; finish the synthetic rehearsal before copying real data. W6
prepares the hosted configuration and performs acceptance on an explicitly
approved isolated target; actual production changes belong to W8. Do not hold
up independent local preparation while a hosted decision remains outstanding.

| Package | Work and deliverable | Exit gate | Status |
| --- | --- | --- | --- |
| W0: Scope and candidate | This plan, feature/SQL inventory and an initial candidate SHA. Keep subsequent fixes scoped on `release/next`. | Future stats storage included; no new stats UI. | Passed; refreshed 2026-09-29 for UI/Rivalry. [Completion evidence](release/w0-scope-and-candidate.md) and [current source manifest](release/w0-candidate-2026-09-29.json); initial snapshot preserved. |
| W1: Refresh environment facts | Read-only hosted/schema/Auth/integration assessment and differences from checked-in assumptions; target map and migration-history proposal. See section 1. | Every intended app/DB target is identified; drift, automatic deployment paths and baseline adoption are understood. The original isolated-preview prerequisite must pass before hosted testing. | **Passed 2026-09-29.** Assessment, target selection, scope split and exact combined Preview isolation verified. Browser/server credentials use RDD Release Testing; GitHub CI/Vercel pass. See [completion evidence](release/w1-preview-gate-2026-09-29.md). Hosted schema/gameplay/email and later release gates remain open. |
| W2: Finish statistics foundation | Update SQL, permissions, view and tests as specified in section 1A; document final defaults and dependency order. | Independent source review resolved; focused local checks pass; no new feature surface. | **Passed locally 2026-09-29.** Member-only final view, unknown historical provenance/timestamps, optional measurements, dependency order, validation/conflict/lock handling and recorder preservation verified. Independent review resolved. [Completion evidence](release/w2-statistics-foundation-2026-09-29.md). No hosted SQL or new statistics UI. |
| W3: Combined synthetic release | Dedicated isolated stack, repeatable full-chain upgrade, preservation checks, all application/DB/API/browser gates, and verified fixes. See sections 2 and 4. | Final combined candidate passes; legacy/new-client behavior and failure recovery are demonstrated. | **Passed locally 2026-09-29.** Eleven ordered SQL inputs, 442 SQL assertions, real Auth/HTTP and combined browser suites, interruption/retry and compatible-app rollback with original rows intact. See [W3 completion record](release/w3-combined-synthetic-2026-09-29.md). W4 has since proved protected backup/restore; hosted test schema, owner phone and deployment gates remain open. |
| W4: Backup and restore proof | Concrete export/handling proposal, owner decision, protected backup manifest, isolated restore and integrity/timing report. See section 3. | Complete recoverable backup demonstrated within agreed recovery limits. | **Passed 2026-09-29.** Owner-attested BitLocker copies on F: and D:, stable production export, independent-copy local restore, all 677 dump rows, row/sequence/rights checks and timing passed. The hosted/local managed Storage trigger difference is recorded. Owner accepts 48 hours or more of downtime but zero lost committed records; a fresh cutover backup and write pause remain W8 gates. See [W4 record](release/w4-backup-restore-2026-09-29.md). |
| W5: Production-shaped dress rehearsal | Run the exact release manifest and account-transition process on the protected restored copy; exercise rollback and compare original records. See section 4. | SQL hashes/order, preservation, migration-history adoption, interruption recovery and compatible rollback all pass. | **Passed locally 2026-09-29.** Eleven exact SQL inputs, local history anchor, ten injected transaction failures, all 677 original rows preserved, fictional account transition and compatible-app rollback passed. See [W5 record](release/w5-production-shaped-2026-09-29.md). Hosted configuration and owner acceptance remain W6-W8. |
| W6: Operational and owner acceptance | Verified member/organizer lists, configuration plan, approved isolated email/Auth acceptance, cleanup ownership, phone walkthrough and maintenance procedure. See section 5. | Required real configuration/account decisions are settled; delivery, recovery and owner acceptance have evidence. | **In progress 2026-09-29.** The isolated test schema and synthetic hosted/preview acceptance passed; the owner approved the current four-member roster and Ben/Tim organizer roles. Real invite/signup/login/recovery passed by owner report; test public signup is disabled, daily cleanup is active, and write-pause/restoration passed. GitHub monitor delivery, production credential preparation/rotation and the broader owner phone walkthrough remain open. See [W6 record](release/w6-operational-acceptance-2026-09-29.md). |
| W7: Freeze and go/no-go | Release packet with exact app SHA/artifact, SQL hashes, evidence, final dry run, rollback and operator assignments. | Owner authorizes the concrete production release after reviewing the packet. | Pending; no deployment authorization. |
| W8: Cutover and observation | Fresh backup, ordered production steps, controlled acceptance, activation, monitoring and first-night check. See section 6. | Accepted live behavior, preserved records, working recovery and completed watch period. | Not started. |

The implementation operator prepares changes and evidence; an independent
reviewer checks the combined security/migration/recovery changes; the owner
decides legitimate membership/organizers, data handling, downtime and release
acceptance. Assign the actual backup, deployment and monitoring operators before
W7; do not assume a named person has accepted operational responsibility.

For each package record: status (`planned`, `running`, `passed`, `blocked` or
`deferred`), source SHA/SQL hashes, target, date, checks, results, unresolved items
and evidence location. A required gate marked deferred does not permit release.
Store sanitized summaries under `docs/release/`; keep credentials, membership
lists, exports and detailed production-data evidence in approved protected storage.

Keep local preparation commits separate from any later migration promotion or
activation changes. Before an authorized push, inspect every outgoing commit;
before merge, inspect the full release diff and effective deployment triggers.
Re-run affected checks after fixes and the final required application checks
on the frozen candidate. No unrelated dependency modernization is bundled here.

## Database inventory and dependency order

These are candidate source inputs, **not approved deployment scripts**. Build a
reviewed release manifest with ordered steps, transaction boundaries, SHA-256
hashes, preconditions, postconditions and recovery actions before execution.

| Source | Purpose and release dependency |
| --- | --- |
| `supabase/tests/fixtures/advanced_statistics_foundation.sql` | W2 storage preparation: unknown historical provenance/modification time, optional measurements, closed seasons and compatibility view. Install before invitations. No season seeded. Refuses the older experimental foundation pending reconciliation. |
| `supabase/pending/league_night.sql` | Nights, attendance, revisions and atomic match save/replay; precedes planning and game modes. |
| `supabase/tests/fixtures/league_planning.sql` | Polls, votes, schedules, RSVPs and private organizer authority; requires League Night. Current source includes `published_at`. |
| `supabase/tests/fixtures/league_board.sql` | Board content, approval, moderation and RPCs; precedes parent admission wrappers. |
| `supabase/tests/fixtures/invite_only_registration.sql` | Invitation service, `league_members` and restrictive base-table policies; requires the reviewed statistics dependency. Does not admit existing users automatically. |
| `supabase/tests/fixtures/invite_parent_admission.sql` | Admission wrappers around existing League Night/planning/Board RPCs and additional restrictive policies. Requires those parent functions and invitation schema. |
| `supabase/tests/fixtures/game_modes.sql` | `game_config`, presets, audited corrections and replacement save implementation. Preserves an installed invitation wrapper in one transaction; test the private implementation grants and public wrapper after installation. New-mode writes default to disabled. |
| `supabase/tests/fixtures/advanced_statistics_final.sql` | W2 final caller-permission view and member-only season reads; after invitation admission and game modes. Includes complete game/team context and all optional measurements; no current site consumer. |
| `supabase/tests/fixtures/solo_play.sql` | Private solo sessions/games/preferences, operation records, consented projections and membership checks. Requires the combined parent/game-mode contract. |
| `supabase/tests/fixtures/rivalry_room.sql` | Private avatar catalog/selections, challenge terms, game links, audit events and replay receipts; requires profiles, League Night/planning, invitation admission and the final game-mode save implementation. Installs an outer `rdd_save_match` wrapper for atomic challenge linking; test ordinary/team saving and admission through the entire wrapper chain. Solo does not replace that RPC and may precede this input. |
| `supabase/pending/league_night_enforce.sql` | Revokes direct split match/participant writes. Separate cutover step after the compatible application works and legacy writes are drained. |
| `supabase/tests/fixtures/advanced_statistics_profile.sql` | W2 read-only actual-CHECK conflict counts; inspect before validation. Does not repair or expose conflicting real rows in tracked output. |
| `supabase/tests/fixtures/advanced_statistics_validate.sql` | W2 separate atomic constraint validation with bounded lock/statement timeouts. Promote only after profiling and representative rehearsal; not an automatic installation step. |

Exclude `existing_schema_baseline.sql` and synthetic seeds from production: the
existing tables are already present. Exclude `game_modes_local_enable.sql`: it
is a local demo switch, not hosted activation approval. The planning visibility
upgrade is for older planning installations; use it only if refreshed schema
evidence identifies that upgrade path. Do not blindly deploy every fixture.

The existing Solo rehearsal installs the parent chain, but snapshots old rows
only immediately before Solo SQL and primarily tests Solo/admission. It also
installs enforcement earlier than a live rollout can. It is useful prior evidence,
not proof of the complete production upgrade order or preservation across it.

The Rivalry fixture is also a one-time rehearsal input. It moves the existing
public save function into `rivalry_private.base_save_match`, then creates a new
public wrapper. Installing game-mode SQL after it could replace that wrapper;
rerunning Rivalry SQL blindly is unsafe. W3/W5 must freeze the function identities,
dependency order, private grants, source-change triggers and interrupted-install
recovery before promoting any reviewed deployment SQL. Keep this input outside
`supabase/migrations/`.

## 1. Freeze and inspect the combined candidate

- [ ] Record release SHA, diff from refreshed `origin/main`, all included commits,
  lockfile/runtime versions, and any uncommitted changes. Repeat affected gates
  whenever the candidate changes; do not silently carry results to a new SHA.
- [ ] Check CI for this exact SHA. Existing CI runs application tests, coverage,
  lint, TypeScript and build; it does not run the full database/browser release matrix.
- [ ] Refresh the hosted schema, RLS, grants/default grants, function signatures,
  triggers, extensions, Postgres version and migration history read-only. Compare
  with the complete SQL inventory, including pre-existing functions and policies.
- [ ] Refresh GitHub/Supabase/Vercel integration settings and effective production,
  preview and development targets. A preview must be shown to use an isolated DB;
  do not infer this from a green Vercel build or Supabase connection.
- [ ] Confirm no automatic migration/config deployment can race the reviewed
  process. Keep SQL outside `supabase/migrations/` until deployment mechanism and
  history adoption are agreed. Include `supabase/config.toml` Auth changes in the
  review; committing local config does not prove hosted Auth settings changed.

The [W1 refresh](release/w1-completion-2026-09-29.md) confirms the legacy schema,
empty migration history, unavailable backups/PITR, disabled automatic DB previews,
Auth/signup/SMTP gaps and eight hosted redirects. Both Supabase and Vercel
production integrations target `main`. Vercel public targets and current
invitation server project metadata agree with production, including Preview.
This resolves inspection, not isolation or credential validity/runtime server
acceptance. W1 proposes a checked legacy
starting contract and a first history anchor followed by reviewed increments,
rehearsed in W3/W5 and approved in W7. Never replay the baseline or repair history
to silence a warning. A deployment dry run must list only the approved changes.

## 1A. Finish future statistics storage without adding site features

The older foundation and its 25 database/7 preservation checks were written
before the combined admission, team-game and RPC-only saving contracts. W2's
integration is now locally complete; their historical passing result is not a release pass.
Use the existing fixture as the starting point, keeping deployment SQL deferred.
Checked items below mean source/focused synthetic acceptance, not real-data or
hosted acceptance. W3/W5 must repeat the contract on their approved targets.

### Storage and historical meaning

- [x] Retain optional season linkage, detail/source metadata, best-of format,
  updated timestamp, raw scoring denominators/totals, checkout/First 9 counts,
  achievements, throw order and legs fields after reviewing their definitions.
  Keep unknown measurements null and do not populate old rows from averages.
- [x] Record defaults and backfill behavior field by field. In particular, verify
  that `entry_source='manual'` is justified for the historical records before
  assigning it; otherwise define an explicit unknown/legacy representation and
  update the constraint/tests. Do not fabricate a historical modification time
  from migration time; document or revise `updated_at` initialization semantics.
- [x] Keep seasons empty and old `season_id` values null unless a separate,
  evidence-backed assignment is authorized. No initial season names, dates,
  historical reassignment or rating-reset decision is needed for storage alone.
- [x] Preserve the existing league save API's scope: it does not accept the
  future enhanced fields. Demonstrate that current valid saves, retries and
  corrections still work and retained participant rows preserve unrelated values.
  Document limits when a participant is removed or rules change; do not promise
  future enhanced-stat editing that the current API does not implement.

### Permissions and view compatibility

- [x] Replace the old public-season access assumption with the final members-only
  contract, including the period before invitation policies are installed.
  Ordinary clients must not gain season administration rights. Choose explicit
  grants, safe default privileges and a tested installation order; fail closed
  until the admission dependency is ready.
- [x] Keep `stats_match_facts` under caller permissions and test it with populated
  data for anonymous, provisional, active and revoked identities. Minimize grants
  and profile fields; the view must not bypass base-table admission/privacy rules.
- [x] Include game configuration needed to distinguish teams, presets, practice,
  handicap and completion status before the view becomes usable for future
  calculations. Keep a documented row meaning (one participant record) and
  avoid duplicating team totals as individual evidence. Do not connect the site
  to this view or change its calculation definitions in this package.
- [x] Split storage preparation from final view creation if needed: `game_config`
  is created by the later game-mode SQL. Record this ordering in the release
  manifest and cover both fresh install and upgrade. Do not create a circular
  dependency between foundation, invitations and game modes.

### Validation and acceptance

- [x] Review all ranges and relationships against the supported game/rule
  definitions, including checkout limits and individual-versus-team attribution.
  Retain only constraints that express an agreed storage contract; do not infer
  scoring rules from an unspecified historical preset.
- [x] Inspect the `NOT VALID` constraints deliberately: profile existing values,
  define treatment of any conflicts, and rehearse validation/locking. Do not
  treat migration success as proof that historical rows have been validated.
- [x] Check the timestamp trigger with match/participant revision triggers and
  the atomic save/correction path. Verify the final replay receipt revision and
  unchanged pre-existing data through the complete upgrade.
- [x] Retain stage-specific tests for the older foundation where useful, but add
  final-state tests. Public-season reads and direct match-table updates must no
  longer be required to pass after membership/RPC-only enforcement is installed.
- [x] Seed future fields only with fictional values in tests. Verify null/default
  behavior, invalid values, view context, client write denial, owner/nonowner
  permissions, preservation and future-field isolation from current statistics.
- [x] Complete independent review, resolve verified findings, run focused SQL
  checks, and hand off the ordered inputs/results for W3/W5 whole-release rehearsals.

W2 is complete when this future storage is coherent and tested under the new
release's rules. It does not require any richer league-stat entry, new charts,
season-management page, import integration or change to existing Solo metrics.

Completed locally 2026-09-29: all section 1A W2 items passed in the focused
synthetic scope. See the [field contracts, source order, review and test evidence](release/w2-statistics-foundation-2026-09-29.md).
Hosted conflicts/volume/locking and full release behavior remain W3/W5 gates.

## 2. Run the complete application and security checks locally

Use the checked-in runtime and trusted installation workflow:

```powershell
npm run ci:install
npm test
npm run test:coverage
npm run lint
npm run typecheck
```

Build and serve with verified isolated Supabase settings. Existing
`npm run solo:local -- build` provides a combined-parent starting point, but its
stack identity must be inspected before use; do not reuse/reset another active
feature's stack. A release rehearsal needs its own project ID, workdir, ports,
container/database and output directory. A worktree alone does not isolate it.

- [ ] Review the merged authorization and recovery code independently, reproduce
  findings, fix confirmed defects and rerun affected gates.
- [ ] Build a combined test harness using existing feature tests, with deliberate
  fixture membership/organizer setup. Earlier tests assuming every authenticated
  user is admitted need adaptation; do not weaken policies to make them pass.
- [ ] Test through actual Auth/PostgREST/API clients as well as SQL. Test anonymous,
  uninvited/provisional, active, revoked and cross-owner identities; separately
  test Board approval, Board organizer and planning organizer authority.
- [ ] Cover every public RPC, table/view and private implementation grant after
  the entire SQL chain. Replacing `rdd_save_match` must not bypass admission.
  Check denial after revocation even for prior valid replay IDs and cached pages.
- [ ] Verify credential separation, invite origin checks, error/log redaction and
  no service-role/mail/invite secrets in browser bundles. Confirm local preview
  bypasses are disabled in the production configuration.

Existing scripts to reuse after target/fixture review: `rehearse-league-night.mjs`,
`rehearse-planning.mjs`, `rehearse-board.mjs`, `rehearse-game-modes.mjs`,
`rehearse-solo.mjs`, the SQL suites under `supabase/tests`, and feature API/browser
scripts under `scripts/qa`. Some scripts refresh their feature demo database after
a successful rehearsal; do not run them against an arbitrary restored target.
Include the guarded Rivalry API/browser scripts and the shared-page integration
matrix. The existing `rdd-rivalry-room` synthetic stack is feature evidence, not
the dedicated W3 release stack or a protected restore target.

## 3. Establish and prove the backup

Before exporting real data, agree the exact source/restore target, authorized
operator, protected destination outside Git, retention, access and deletion rules.

- [x] Inventory schema/data/roles/grants, Auth identities and dependencies,
  sequences, private schemas, operation logs and migration history. Record Auth
  provider/redirect/SMTP settings, hosting configuration and recovery procedures
  for secrets separately. Do not assume a default CLI dump covers everything.
  Include `rivalry_private` avatar selections/catalog, challenge terms, links,
  audit events and replay receipts once installed; prove their grants, triggers
  and functions survive restore with canonical match/profile relationships.
- [x] Check Storage usage. Database backups contain Storage metadata, not object
  bytes; back up actual objects separately when relevant. Record unused surfaces
  explicitly rather than silently omitting them.
- [x] Produce a consistent protected backup, record timestamp, source identity,
  tool versions, checksums and a contents manifest. Retain a separate secure copy.
  Verify the backup is readable by the recovery operator; an export exit code alone
  is insufficient.
- [x] Restore into a genuinely isolated compatible target with outbound email,
  webhooks and other integrations disabled or redirected. Never expose restored
  real identities/data in the synthetic demo or ordinary preview.
- [x] Prove restored schema, relationships, representative complete rows and
  usable Auth/profile relationships. Compare counts plus stable-key row digests
  and relevant aggregates. Keep detailed private evidence out of tracked logs.
- [x] Measure restore time and agree acceptable downtime/data-loss limits.
  Rehearse recovery access and document exclusions. The owner accepts 48 hours
  or more of downtime, but **no loss of committed records**. An older snapshot
  cannot overwrite writes made after it; reconcile any post-backup writes before
  a recovery restore. The W4 copy proves recovery of its capture-time state.
- [ ] Obtain a fresh final backup during the W8 release write pause, after
  in-flight writes are drained; an earlier rehearsal snapshot will age.

## 4. Rehearse the exact upgrade and failure recovery

- [ ] Start from the refreshed production-shaped schema, not a database already
  upgraded with every feature. First use synthetic data; then repeat the approved
  upgrade on the protected restored copy when its handling is authorized.
- [ ] Snapshot existing rows before **any** release SQL. Apply the proposed exact
  manifest/order, membership backfill and permissions. Compare all original field
  values and identities after the full chain, allowing only documented additive
  defaults/changes. Verify foreign keys, duplicates, orphan rows and chronology.
- [ ] Test old-client behavior at each staged boundary, schema-cache refresh,
  lock duration/timeouts, interrupted SQL, partial multi-file completion and
  repeat attempts. Many fixtures use one-time CREATE statements; do not assume
  blindly rerunning a failed batch is safe.
- [ ] Exercise save/edit/rematch, concurrent revisions, duplicate submissions,
  dropped responses after commit and exact retry. Preserve pending operation IDs
  and payloads; a timeout is not proof that nothing was saved.
- [ ] Verify all feature workflows on one production build and combined database:

| Area | Required acceptance |
| --- | --- |
| Existing league records | Login/recovery, profiles, history, filters, legacy null game rules, chronology and statistics remain usable. |
| Future statistics storage | Optional fields/defaults preserve historical meaning; member-only seasons and caller-permission view are enforced; game/team context survives; current UI/calculations and save scope remain unchanged. |
| League Night | Shared attendance, creator-only edits, atomic saves/recovery, rematches, recap awards and share-card export. |
| Planning | Organizer-only actions, draft privacy, two-suggestion limit under concurrency, vote privacy, closure, rescheduling/reconfirmation, cancellations and next-night rollover. RSVP remains distinct from attendance. |
| Board | Separate request/approval, feed/thread paging, post/reply/reaction recovery, retained drafts, moderation/reporting, revocation and temporary read failures. |
| Invitations | Verified inbox ownership, forwarded-link denial, expiry/reissue/revoke, rate limits, duplicate requests, uncertain provisioning, corrected passwords, active-member admission and no public signup path. |
| Games/teams | All supported modes/presets, doubles/triples, corrections/audit privacy, winners/ties/abandonment, disabled/enabled write gate, compatible score cohorts and team ratings. |
| Solo | Owner privacy, admission, draft/retry/edit/delete/undo, profile consent/revocation and night sharing without notes/location leakage. No competitive wins, ratings, awards or attendance from solo games. |
| Rivalry Room / avatars | Owner-only revision-checked avatar saves, durable exact-operation retry and cross-account cleanup; admitted-only pair/challenge data, acceptance/expiry/caps, schedule reconfirmation, canonical atomic game links, corrections/reopening, delegated link repair, organizer authority, accurate completion headlines and explicit poster/TV export. Series never create another rating event. |

- [ ] Include multiple devices/accounts, sign-out/account-switch cleanup, stale
  tabs, session refresh, network loss, 320/390/768/1440 layouts, dark mode,
  keyboard/error focus, and browser/hydration errors. Complete owner phone review.
- [ ] Rehearse application rollback with the upgraded DB and data created after
  upgrade. Keep a version that understands RPC saving, admission, teams and Solo.
  The current pre-release `main` is not automatically a safe rollback target.
  The compatible rollback must also preserve Rivalry receipts, canonical links
  and avatar state; test ordinary match saving through the outer Rivalry wrapper.
- [ ] Rehearse failed rollout recovery and a separate disaster restore. Determine
  how post-backup writes would be preserved/reconciled before any restore; never
  silently overwrite fresh league data with an older snapshot.

## 5. Prepare hosted cutover and operational ownership

- [x] Close W1's isolated-preview prerequisite: the owner provisioned RDD Release
  Testing and split credential scopes; combined source `25317dc` is built and its
  browser/server target and both keys are verified. See the
  [W1 evidence](release/w1-preview-gate-2026-09-29.md). Historical deployments
  retain their old values and must not be used for write/email/signup tests.
- [x] Prepare and apply the reviewed testing schema to the isolated RDD Release
  Testing project, then validate its history, constraints and synthetic hosted
  acceptance. Exact origins/redirects/delivery controls remain open. Keep
  protected restore data separate from synthetic/email acceptance. See the
  [W6 record](release/w6-operational-acceptance-2026-09-29.md).
- [ ] Complete owner-approved rotation of the service-role credential disclosed
  in one browser-tool response during W1 and verify its affected consumers.
  Production credentials have been removed from new Preview scope and the test
  server key is a Secret. Review production-key/GitHub-token Secret handling and
  consumer scopes separately. W1 recorded no credentials in files and did not
  rotate the exposed key; the owner performed the environment scope changes.
- [x] Approve the legitimate existing-member UUID list and cutoff; the owner
  chose all current production users except Captain Test, with the private UUID
  snapshot held outside tracked files.
- [ ] Reconcile accounts created between initial inventory and cutover. Backfill
  active `league_members` with null `source_invite_id`; do not auto-admit every Auth user.
  Restrictive policies immediately deny members not yet admitted, so rehearse
  the backfill/policy boundary under maintenance or a reviewed atomic package.
- [x] Decide planning organizers and Board organizers from verified IDs: Ben
  Linford and Tim Kiefer for both roles.
- [ ] Assign those roles through W8 trusted administration. League membership never implies Board approval or
  either organizer role; do not infer authority from editable profile metadata.
- [ ] Prepare server-only invitation configuration described in the
  [handoff](invite-only-registration-handoff.md): enable flag, exact origin,
  matching service-role key, stable invite secret, Resend key and verified sender.
  Arrange controlled email-delivery acceptance separately from provider submission.
- [ ] Prepare hosted public-signup disablement while retaining email login,
  review alternate providers, recovery URLs and Auth SMTP. Test existing login
  and account recovery across this transition.
  W1 found Vercel redirects the apex to `www.rocdartdegens.com`, while Auth's
  eight-entry allowlist has no explicit `www` reset URL and the recovery client
  uses its current origin. Resolve/test this canonical-origin discrepancy; no
  hosted recovery failure was reproduced during the read-only assessment.
- [ ] Arrange the approved daily server-only `invite_cleanup()` job, its failure
  handling and retention policy. No cleanup schedule is present merely because
  the function exists. Preserve required replay/history records.
- [ ] Choose deployment mechanism and final migration-history adoption procedure;
  inspect the dry run. Specify owner/operator, maintenance window, stop criteria,
  rollback artifact, final backup, and monitored acceptance checks.
- [ ] Rehearse an enforceable write pause across old browser tabs, API clients
  and signup/provisioning. A banner alone is not a write barrier. Document how
  only controlled operator acceptance writes proceed during the pause, and prove
  that normal writers cannot race backup, admission backfill or enforcement.
- [ ] Prepare an owner walkthrough on the final isolated build: existing login
  and history; plan/RSVP to attendance; save/rematch and team recap; Board
  approval/post/recovery; invitation join/recovery; private Solo and sharing.
  Include choosing an avatar, accepting/recording/correcting a challenge, and
  phone/TV/poster review alongside the redesigned shared pages.
  Record phone/browser used and any deferred nonblocking polish separately.
- [ ] Define observable stop conditions: unexplained record differences,
  privilege bypass, legitimate-member lockout, broken login/recovery, duplicate
  or partial saves, missing expected RPCs, or failed integrity checks stop the
  rollout. Set acceptable lock/error limits and watch duration from rehearsal
  evidence before W7, with a named operator to act on failures.

## 6. Explicit go/no-go, then a separately authorized deployment

The review packet must contain the exact app SHA/artifact, SQL hashes and order,
target identities, fresh hosted diff, test/browser evidence, successful restore
receipt and timing, approved admission list, configuration checklist and rehearsed
rollback. Any missing item remains an open gate. The owner separately authorized
W4's protected export and isolated restore on 2026-09-29; this plan is not
approval to merge to `main` or modify hosted DB/Auth/configuration.

Proposed cutover, to finalize after rehearsal:

1. Enter a coordinated write/admission maintenance window, drain in-flight old
   split saves and reconcile incomplete records. Confirm target and fresh backup.
   A DB lock alone cannot drain a save split across two HTTP requests.
2. Apply the approved dependency/schema chain and membership/organizer setup,
   preserving tested policy boundaries. Keep invitations and new game-mode writes
   disabled. Coordinate Auth signup closure with the approved account cutoff.
3. Deploy and verify the compatible application before direct-write enforcement
   and feature activation. Validate actual hosted configuration and controlled
   test identities; preserve production records during acceptance.
4. Apply the separately staged RPC-only enforcement; verify grants, old-tab
   behavior, retries and persistence. Enable game-mode writes and invitations
   only after their reader, access and delivery acceptance succeeds. Do not run
   the local demo enable script on hosting.
5. Resume activity only after acceptance; require old tabs to refresh. Observe
   errors, failed saves, access denials, invitation delivery/cleanup and data
   integrity during the agreed watch window and first real league night.

Sequence GitHub merge and Vercel publication explicitly: if merging to `main`
automatically deploys the app, the merge belongs at the compatible-app step,
after schema prerequisites. If Supabase also deploys from that event, first
choose and rehearse a mechanism that prevents uncontrolled simultaneous steps.
Use one deployment authority; do not apply the same SQL manually and then let
the integration replay it. A Git push or merge must not become an accidental
substitute for the staged DB/app/activation process.

If a gate fails, remain in maintenance or disable the affected feature, preserve
data/operation logs and use the tested compatible rollback. Do not automatically
reopen public signup, strip restrictive RLS, drop new tables or revert to split
saving. Prefer a reviewed forward repair when it preserves new records safely.

### Release completion

- [ ] Record deployed app identity, applied SQL/history entries, configured
  feature switches and sanitized acceptance results; refresh the readiness table.
- [ ] Confirm new legitimate members and existing members can use their intended
  features; verify old records plus controlled new create/edit/retry results.
- [ ] Complete the agreed watch period and first real league-night review, with
  no unresolved release-blocking access, save, privacy or integrity issue.
- [ ] Confirm backup cadence, invitation cleanup and failure alerts have owners.
  Retain the compatible rollback artifact and protected pre-release backup for
  the agreed period; clean protected rehearsal copies only under that policy.
- [ ] Record remaining future-stat UI, seasons management and imports as later
  work. Do not count them as unfinished acceptance for this storage-only scope.

## Immediate next work

W0-W5 have passed in their documented scopes. W1's isolated Preview is available
for later hosted testing after reviewed schema and controlled Auth/email setup.
No production-release decision has been requested or granted.

## References

- [Solo combined-parent verification](solo-play-rebase-2026-09-28.md)
- [Game-mode activation and rollback](game-modes-verification-2026-09-27.md)
- [Planning handoff](league-night-planning-handoff.md)
- [Board handoff](league-message-board-handoff.md)
- [Supabase backups](https://supabase.com/docs/guides/platform/backups), checked
  2026-09-28: backup coverage, Free-plan exports and Storage-object exclusion.
- [Supabase GitHub integration](https://supabase.com/docs/guides/deployment/branching/github-integration),
  checked 2026-09-28: inspect automatic production migration/config deployment.
- [GitHub branch rename](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-branches-in-your-repository/renaming-a-branch),
  checked 2026-09-28: branch rename and local tracking behavior.


### September 30 W6 acceptance amendment

Owner follow-up testing passed the earlier checklist; additional requested fixes
are recorded in [W6 operational acceptance](release/w6-operational-acceptance-2026-09-29.md).
The poll privacy / Solo 701 supplement is separate from the immutable original
W5 chain: [amendment manifest](release/w6-sql-amendment-2026-09-30.json).
It passed local synthetic, protected-copy and hosted isolated test acceptance.
W7 must append its exact hash/order to the release packet and staged migration
history, rehearse that final chain, and rebuild/retest the compatible rollback
app for the new 701 and masked-poll contracts. The original W5 result remains
dated evidence for its original inputs; it does not settle this amended final
release packet. New owner affected-flow retest remains W6. Production is unchanged.
