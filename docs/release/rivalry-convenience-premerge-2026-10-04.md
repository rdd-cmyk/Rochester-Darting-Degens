# Rivalry and league convenience release readiness

Prepared October 4, 2026. Application candidate: `e0bd33dc140a3dd7d0f225b06681e8e9050287fd` on `feat/rivalry-power-rating`. Main: `b9e8155decee04dfdde8520d33e118f2dc99478b`. The candidate contains main, with 15 additional commits and no divergence. Production activation and merge have not been performed. The owner authorized PR preparation, production verification, backups and recovery rehearsal.

## Application and platform checks

- Independent feature reviews and verified fixes are recorded in the branch review documents. All 674 application tests, coverage thresholds, lint, TypeScript and production build passed. Exact candidate GitHub CI `37220175533` succeeded; the Vercel check succeeded.
- Candidate Preview `dpl_8VyXMZP1o7sdyWsPVN6Qgi29QVip` is READY. Local synthetic browser checks passed at 1440, 390 and 320 pixels in both themes. These checks do not replace owner/device acceptance.
- Fresh inspection found no SQL under `supabase/migrations/` in main or the candidate. The updates remain fixtures, so merging this branch will not activate them automatically.
- Vercel's linked repository is `Rochester-Darting-Degens`, production branch `main`. Supabase's default branch points to `main` on the production project; no other development database branch was listed. No Supabase PR check was posted on the candidate commit; do not interpret its absence as a passed migration check. Recheck GitHub integration settings immediately before merge.
- Production and Preview have their required Supabase and invitation environment key names configured; secret values were not printed or added to Git. No environment settings were changed.

## Fresh production inventory and backup

The intended source is **RDD Main Project**, `hrqsbzmsfichiimtxijj`, ACTIVE_HEALTHY on PostgreSQL 17.6.1.054. It has 14 recorded migrations, seven Auth users/profiles, ten matches, 22 participants, zero polls and zero Storage objects. The existing invitation cleanup job is active and uses SQL rather than outbound HTTP. The three release updates have not been applied to production.

Public application tables retain RLS. Private planning and rivalry tables have RLS and no direct member/anonymous reads. Private invitation/control tables deny direct client reads; their existing RPC authority remains server-owned. Security advisors reported the existing private-table/no-policy notices, authenticated definer RPC notices and disabled leaked-password protection warning. No new policy or grant was applied to production.

Fresh backup folder on both previously owner-selected, owner-attested BitLocker drives:

- `F:\DB backups\RDD-Main-W4-2026-10-04T17-44-58-437Z`
- `D:\DB BackupsHD\RDD-Main-W4-2026-10-04T17-44-58-437Z`

Capture completed at 17:45:42 UTC. Roles, schema, data, integrity evidence and manifest were written outside Git. Both copies matched by SHA-256. Core row/sequence fingerprints and structural inventory were stable across export. SQL is plaintext while the drives are unlocked; drive encryption remains owner-attested.

The CLI dump omits migration history. `recovery-supplement.json` was separately captured in both folders, with matching hashes: all 14 migration entries, the cleanup job definition, all 42 original application function fingerprints and both original private planning function definitions. A database restore must restore this history as data, never execute its historical statements against an existing project. Auth/SMTP, Vercel settings and Storage object bytes are separate recovery concerns; Storage currently contains no objects.

## Independent-copy recovery and production-shaped rehearsal

Restored the D: copy into fresh local Supabase target `rdd-branch-release-20261004`, workdir `.local/branch-release-restore-20261004`, loopback API/database ports 61921/61922. Existing restore targets were preserved. Public signup/Studio/analytics were disabled and mail routes locally. Cron execution was disabled before restoration. The Docker bridge is loopback-bound; outbound network isolation is not proven. The source has no HTTP cron job, and no hosted writes or deliveries were performed.

All 71 COPY blocks, totaling 899 rows, matched exactly. All 14 migration history entries also matched. Core row/sequence digests, 20 catalog sections, effective client access and Auth/profile/match relationships passed. Narrow managed-platform allowances were retained: five verified-empty Auth/Storage COPY blocks differ from the local image, three hosted managed Storage triggers are absent locally, and the local Auth token table needed its nullable `expires_at` column. Complete nonempty token rows were preserved.

Applied only these reviewed fixtures, in this order, twice each on the restored copy:

1. `supabase/tests/fixtures/organizer_access_tools.sql`
2. `supabase/tests/fixtures/invitation_search.sql`
3. `supabase/tests/fixtures/planning_availability.sql`

All 899 original COPY-column projections matched after every step and after testing. Existing schema/table client access remained identical. Only the two intended private planning function definitions changed among the 42 original application functions; public admission wrappers remained identical.

All 58 organizer/invitation permission tests and 46 date-availability tests passed against the restored production baseline in rolled-back transactions. The organizer fixture's six empty-database total expectations were adjusted to add the original candidate/invitation counts; no original records were deleted or changed. Legacy poll fixtures were seeded inside the rollback transaction. Separate fictional-only rehearsals also passed, including interrupted-upgrade rollback, reapplication and legacy vote preservation.

## Rollback path and remaining cutover steps

Primary rollback: return the production aliases to the current READY production deployment `dpl_Hjgwt8VFweUif8WaNsRPhRbAaVZA`, source `9000f1e323f6738bd63938d2eaa1528d11213d0c`, using the reviewed Vercel rollback procedure. Its live aliases are `rocdartdegens.com`, `www.rocdartdegens.com`, `rochester-darting-degens.vercel.app` and `rochester-darting-degens-tims-projects-b7b7f743.vercel.app`. Preserve production environment bindings; do not promote the Release Testing Preview as production.

Retain the additive database updates during app rollback. Old checkbox ballots remain compatible and preserve response states their controls cannot express. Confirmed Board membership grants and new ballot responses must remain intact. If a function rollback is needed, the saved original private planning definitions were restored inside a local transaction and all 42 original function fingerprints matched. The new response column was retained. This proved a local rollback path; no live rollback was executed.

Before actual production activation/merge: obtain the owner's release instruction, refresh main/integration settings and the exact PR checks, capture a fresh backup after coordinating/draining writes, apply only the three approved updates to the verified production target, verify original-row preservation and the new role/API behavior, merge, then verify the exact production deployment and smoke-test the affected journeys. The current backup recovers its capture time; it cannot recover later committed writes. Never restore this snapshot over later records without preserving and reconciling them. Do not replay baseline migrations or drop date responses to undo the release.

Local evidence and recovery harnesses remain under ignored `.local/branch-release-2026-10-04/`; protected backup material remains on the two backup drives. The restore target is stopped with its volume retained after checks. Retain backups through release plus 30 days under the existing owner-selected retention policy; deletion remains a separate owner decision.
