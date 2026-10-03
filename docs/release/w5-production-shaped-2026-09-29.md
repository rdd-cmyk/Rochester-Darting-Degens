# W5: production-shaped protected dress rehearsal

Date: 2026-09-29. **Status: W5 passed locally.** Candidate app source:
`7118e1319e5c8c20b420a5706d6898b2b37f910d` on `release/next`.
The target was the W4 protected local restore, Docker project
`rdd-release-w4-protected` on loopback API `127.0.0.1:58921` and database
`127.0.0.1:58922`. No hosted Supabase project or Vercel deployment was
modified. This pass does not authorize W6–W8 or settle the real membership,
organizer, email and owner-phone decisions.

## Inputs and handling

The independent D: W4 backup copy and its exact original-row digests were the
comparison source. The protected restore began with five Auth users, five
profiles, ten matches, 22 participants, no release migration history and no
permanent W5 admission of any real account. Its backup and restoration are
documented in [W4](w4-backup-restore-2026-09-29.md). All W5 working files,
local app builds, credentials and detailed evidence are ignored under
`.local/release-w5-protected`; that directory contains sensitive restored
records and must remain protected. The source backup copies remain untouched
on the owner-attested BitLocker drives. Retain both copies and the protected
restore through release plus 30 days, subject to the owner-controlled cleanup
decision recorded in W4.

The W5 manifest was built from the exact W4 legacy schema as a first history
anchor (`20260929000000`) and the eleven ordered release SQL inputs from
`scripts/release-environment.mjs`. The eleven canonical LF SHA-256 hashes
matched W3's frozen combined manifest 11/11. The W4 schema anchor was marked
applied in **local** Supabase migration history only; the old CREATE statements
were not replayed over restored records. The pinned Supabase CLI 2.116.0 dry
run listed only the anchor and eleven expected migrations before adoption.
The anchor-plus-eleven history is **a rehearsal**, not hosted migration history.
W7 must prepare and approve the corresponding production procedure from a
fresh read-only history inventory; this rehearsal does not justify blindly
repairing hosted history.

## Upgrade and account transition

The statistics foundation ran first. Its profile query reported zero
violations, and its previously unvalidated constraints validated successfully
with a two-second lock timeout and 30-second statement timeout; the validation
query measured 153 ms locally. Each later SQL file was staged alone. Before
steps 2–11, the final COMMIT was deliberately replaced with a failure in a
transactional copy. For all ten interruptions, application schema/data hashes
and migration history were unchanged. The exact original 677 backed-up COPY
rows matched after each successful step. Supabase CLI applied each step once,
advanced history exactly once, and a repeat dry run reported up-to-date. The
CLI wall time for steps 2–11 was 724–809 ms locally; it is not a production
lock-duration guarantee. The final dry run returned `upToDate: true` with
zero pending files. Aggregate inspection found 12 distinct history versions,
zero unvalidated application checks/foreign keys and zero orphaned
participants, profiles or members.

At the invitation boundary, an existing restored account remained denied
before admission. A temporary real-account membership insertion inside a
transaction proved the profile view opens after explicit admission, then
rolled back. **No existing real account was permanently admitted by W5.** Two
new `@example.test` accounts were denied before explicit local admission and
allowed afterward; only those fictional accounts were used for writes. They
saved one legacy split-write match before final enforcement. After enforcement,
an old direct match insert was denied. Game-mode writes remained disabled by
default; the local test enabled them briefly, exercised atomic RPC saving,
then disabled them again. A bad challenge reference was rejected without a
partial match. The exact match retry replayed rather than duplicating data.

## Application and compatible rollback

The isolated current production build from the candidate SHA passed against
the upgraded copy. Seven routes returned 200. Fictional admitted accounts
saved a guarded match, private Solo game and owner-only Rivalry avatar choice,
with exact-operation retries. Another member could not see the private Solo
game. Anonymous Change Log access was denied; an admitted request reached the
unconfigured local GitHub-provider boundary as expected. The release-only
diagnostic returned 404. The 39 static assets checked did not contain the
local service credential. This was a focused protected-copy test; W3 already
passed the larger SQL/API/browser feature matrix on synthetic data.

The compatible rollback artifact was built from earlier app ref `a72f7bf`
with the five W3 access/recovery backports recorded in the ignored artifact
manifest. It built and served against the **same upgraded database**, with no
schema down-migration. It read the earlier fictional match, saved and exactly
retried a new match and private Solo game, and served the same seven routes.
A full row-hash snapshot across 40 application tables found all 104
pre-switch rows identical afterward; eight new application rows were added.

For Rivalry continuity, the current app created a fictional accepted challenge,
one canonical linked game and operation receipt. The exact game retry replayed.
After switching to the compatible app, the linked match and challenge read
correctly and all 37 private Rivalry rows retained the same digest. Avatar
state and its receipt were among those rows. W3 additionally exercised the
broader Rivalry link/correction/repair and Solo flows on the synthetic stack.
The pre-release `main` app was not tested or designated as a rollback target.

The final independent-copy comparison still matched every one of the 677
original W4 rows across 34 COPY blocks. Additional local fictional/Auth rows
were allowed and counted separately (64 at the final check). The final
aggregate snapshot contained 14 matches, 30 participants, seven profiles and
seven Auth users, with zero application orphans or unvalidated constraints.
No original record loss or mutation was detected in this rehearsal.

## Recovery boundary and next gate

The ten injected transactional failures, per-step retry/dry-run checks,
compatible app rollback and W4 isolated disaster restore establish the local
recovery path. Restoring an older backup **after new hosted writes** would
require reconciling those writes; it must never be treated as an automatic
rollback. Because the owner can accept 48 hours or more of downtime but no
lost committed records, W8 still requires a write pause, a fresh verified
cutover backup, a controlled post-cutover write ledger/reconciliation method,
and explicit go/no-go before irreversible hosted steps. W6 must settle real
admission/organizer mapping, isolated email/Auth acceptance and owner device
testing; W7 must freeze exact production inputs and recovery operators.

Reproduction tools are `scripts/w5-protected-prepare.mjs`,
`scripts/w5-protected-stage.mjs`, `scripts/w5-protected-interrupt.mjs`,
`scripts/w5-protected-apply.mjs`, `scripts/w5-protected-app.mjs`, and the
`scripts/qa/w5-*.mjs`/`.sql` checks. They target the fixed protected local
stack and preserve one-time evidence files. Do not point them at hosting.
