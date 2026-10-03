# W4: protected backup and restore proof

Date: 2026-09-29. **Status: W4 passed.** Production backup and independent-copy
local restore passed; the owner accepted the recovery limits. Branch:
`release/next`, starting source `e304a43`.
W3 passed on fictional local data; W4 is the first package that may handle a
copy of production records. W4 is not a hosted schema migration, feature
activation, Vercel deployment or approval for W5–W8.

## Source and current inventory

The source is **RDD Main Project** `hrqsbzmsfichiimtxijj`, not RDD Release
Testing. A fresh [SELECT-only inventory](w4-source-inventory-2026-09-29.json)
at 2026-09-29 17:39 UTC found PostgreSQL 17.6, a 13,560,979-byte database,
five Auth users, five profiles, ten matches and 22 participants. Application
storage is still the three legacy public tables plus two sequences. There are
zero Storage buckets and objects, no release/private schemas or migration
history, and no cron or pg_net queue table. Seven noninternal triggers are
the managed Storage triggers already seen in W1. The read-only CLI backup
listing still reports no available backup and PITR disabled. No individual
account or player values were read into tracked evidence.

The W1 environment record retains the Auth providers, recovery redirects,
SMTP, Vercel scopes and GitHub integration inventory. Those settings are not
contained in a logical database dump and must be rechecked separately during
recovery. Current Storage object bytes need no separate export because both
bucket and object counts are zero; this must be refreshed before the actual
export. Supabase [documents](https://supabase.com/docs/guides/platform/backups)
that Free projects should maintain logical/off-site exports and that database
backups do not contain Storage object bytes.

## Backup handling decision and source protection

The owner selected `F:\DB backups` as the primary location and `D:\DB BackupsHD`
as the independent copy, confirmed both drives are BitLocker-encrypted, and
accepted retention through release plus 30 days. Windows denied a direct
BitLocker status check, so drive encryption is owner-attested rather than
machine-verified. D: is a slower hard drive. SQL files are **plaintext whenever
either BitLocker drive is unlocked**; keep drive access limited to the owner and
recovery operator, do not copy these files elsewhere, and retain the BitLocker
recovery keys separately. The optional AES-256-GCM mode and its focused tests
remain in the tooling but were not used because the app could not display its
private passphrase terminal. No passphrase was created or stored. The two backup
paths are outside Git and on different drive letters.
The owner controls both drives and their BitLocker recovery keys. The local
Windows operator read the D: copy for this rehearsal. Keep both copies and the
protected local restore through release plus 30 days; the owner should decide
their deletion after that period. Do not use the real-data restore for preview,
synthetic demos or ordinary development.

The [backup command](../../scripts/w4-protected-backup.mjs) has a fixed
production ref and requires both existing destinations. It captured roles,
schema and data separately via the pinned Supabase CLI, with Supabase's
documented vector-table exclusions, plus source digests, catalog and
effective-access evidence. The data dump is one PostgreSQL snapshot.
Stable-key row/sequence digests and structural inventory must agree before and
after the export; a changed source is not accepted. It reread every file,
copied them to D: and compared SHA-256 checksums. Official Supabase
[CLI migration guidance](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
is the basis for the roles/schema/data and transactional restore order.

The production source was `hrqsbzmsfichiimtxijj`; the export folder on both
drives is `RDD-Main-W4-2026-09-29T18-20-24-081Z`. Its manifest reports capture
at 2026-09-29 18:21:02 UTC and 53 seconds for prechecks, three dumps, postchecks,
copy and verification. Manifest format is `RDDW4-BITLOCKER-v1`; the four data
and integrity files are 297, 9,283, 182,406 and 64,883 bytes, respectively.
The two locations' four files plus manifest matched by SHA-256. The source
remained stable across seven complete-row digest/sequence checks and structural
inventory. The manifest and full hashes live only on the protected drives.

## Isolated restore procedure

The separate `rdd-release-w4-protected` local Supabase project uses its own
workdir, Docker volume/network and loopback ports 58921/58922, apart from the
W3 synthetic project, the W4 synthetic proof target and every hosted project.
The source has no cron, pg_net queue or Storage objects. The generated local
config disables public signup, Studio and analytics; Auth email routes to the
local mail sink. The Docker bridge itself is loopback-bound **but not proven
egress-blocked**, because the fully internal bridge prevented the Supabase
CLI from reaching its own database during startup. The source inventory and
these integration controls were verified before real data was restored.

The [restore command](../../scripts/w4-protected-restore.mjs) requires a fresh
empty protected target. It verified archive and plaintext checksums, temporarily
closed the target's broad default client
privileges, then loaded reviewed platform role adjustments, schema and data in one
`psql --single-transaction` operation, and compared stable-key row/sequence
digests, Auth/profile/match relationships, source catalog and effective
client privileges. The operator read from the **independent D: copy**. SQL
errors rolled back the transaction; the protected files remained intact.

The first transaction exposed a hosted/local managed-schema difference and
rolled back: the hosted data dump names Auth tables absent from the local CLI
image. A header/row-count comparison established that five differing Auth COPY
blocks and one Storage COPY block were all empty. The reviewed restore skips
only those six exact empty blocks and aborts if any gains a row. The second
transaction loaded successfully; core source/restored row and sequence digests
matched. An additional [all-COPY comparison](../../scripts/qa/w4-all-copy-digests.mjs)
matched every row from all 34 dump
blocks: 677 rows across nine nonempty tables, plus 25 empty blocks. The six
managed-schema exceptions were empty in the source. All Auth/profile/match
relationship orphan counts were zero. Nineteen
of 20 catalog sections matched directly after normalizing order/format; the
remaining trigger section differs by exactly three newer hosted, managed
Storage triggers absent from the local image. There are no Storage buckets or
objects to exercise them. All other triggers, policies, grants, functions and
effective client privileges matched. The validation file on D: records this
exception explicitly, with `catalogMismatches: []` after the narrow allowance.
The SQL transaction took 0.227 seconds; local stack startup was roughly 30
seconds. This is a measured local recovery drill, not a hosted restore-time
guarantee. The owner accepts 48 hours or more of downtime but no lost committed
records. The W4 backup recovers the state at its capture time; it cannot cover
later writes. W8 requires a fresh final backup during an enforceable release
write pause after in-flight writes drain. If recovery is needed after new writes,
operators must preserve and reconcile them before restoring an older snapshot.

## Completed synthetic proof and finding

With only fictional W3 data, three CLI dumps were created under ignored
`.local/w4-synthetic/`, restored into the distinct local
`rdd-release-w4-restore` project and verified. All **47 selected application,
Auth and Storage tables** had matching complete-row counts/digests. A restored
fictional account authenticated with its existing password and reached its
matching profile through RLS. Twenty catalog sections, including policies,
functions, grants, sequences, triggers and integrity summaries, matched after
normalizing owner-only implicit ACLs and parentheses-only PostgreSQL CHECK
formatting. Effective client privileges matched separately. The final source
roles/schema/data sizes were 370 / 186,054 / 1,833,320 bytes, respectively.
All three synthetic files also passed encrypted-file reopen and byte match;
wrong passphrase/tamper tests reject. Detailed fictional outputs remain ignored
in `.local/w4-synthetic/`.

The synthetic drill caught two issues before real data was involved:

1. A target without Supabase's normal Realtime role could not load its
   platform-only role grant. The protected target retains that managed role;
   the one local-ungrantable `log_min_messages` grant is omitted only after an
   exact statement match.
2. Fresh target default privileges silently gave new tables/functions extra
   `anon` or `authenticated` rights despite applying the schema dump. The
   restore now revokes those defaults **inside the restore transaction before
   CREATE**, and the dump restores the source default settings afterward.
   Actual client rights, grants and policies then matched. A data-only count
   comparison would not have detected this security drift.

The synthetic results established the method before production data was
handled. The protected production restore and its limited platform exceptions
are recorded above. The owner's zero-loss requirement is a stop condition for
later rollout and recovery procedures; W8 needs a **fresh** final backup during
the release write pause.
