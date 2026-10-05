# Three player avatars: release and verification

Approved names and artwork: Sharp Shooter (`cactus`, cream jersey), Big Finish
(`gorilla`, navy jersey), Hot Streak (`dragon`, orange jersey, near-side fire and
smoke only). The shared picker/renderer use the existing paths and save RPC;
this change adds choices without changing permission, gameplay or save logic.
All three portraits have transparent 512px, 256px and 96px WebP exports.

## Release order

1. Review the PR and require passing CI/Vercel checks.
2. Through the reviewed production release process, run only
   `supabase/tests/fixtures/three_player_avatars.sql` against RDD Main Project.
   Capture the current catalog and verify the existing entries/selections remain
   unchanged. Verify cactus, gorilla and dragon exist with `selectable=true`.
3. Merge the application PR to `main` and confirm the production deployment.
4. On an authorized member account, select/save a new avatar, reload My Profile,
   and verify the saved choice renders in a player view. Restore the prior choice
   if this is a release-check account.

The production read-only inspection on 2026-10-05 found 24 selectable original
IDs and none of the three additions. Merging the PR alone does not insert rows:
fixtures are not automatically deployed. The RPC rejects IDs absent from the
database catalog. No hosted writes were performed for this PR.

Do not rerun the full `rivalry_room.sql` fixture on an existing installation;
it is a one-time fresh-install input. Its list was updated only for new local
installations and the existing catalog-consistency test. No SQL was placed under
`supabase/migrations/`; the historical baseline/history mismatch is unchanged.

## Small additive data change

The release fixture inserts exactly three rows with `ON CONFLICT DO NOTHING`.
No existing selection, catalog row, schema, function, grant or RLS policy is
changed. It runs in one transaction with short lock/statement timeouts. Repeating
it does not reactivate a retired avatar. If one of the new IDs already exists
but is not selectable, stop and review the reason rather than re-enabling it.

Rollback: revert the application additions if needed. Retain catalog IDs and
files once any player has selected them; retire choices with `selectable=false`
only if intentionally withdrawing them. Do not delete referenced catalog rows.

## Completed checks

- Locked dependency install passed; no dependency/lockfile changes. npm reported
  five high advisories in the existing dependency set; dependency remediation
  remains separate from this avatar change.
- All 677 tests across 85 files passed under coverage, including three new picker
  tests covering each approved label and stable ID through a mocked save receipt.
- Coverage gates passed: 96.94% lines and 88.78% branches overall.
- Repository lint, TypeScript and production build passed. Build used local
  Supabase defaults; it is not proof of hosted authentication or save behavior.
- The exact additive fixture passed PostgreSQL 17 checks in a disposable local
  database: insertion, replay, new FK selections, existing-row preservation, and
  retention of a later retirement. The disposable database was removed.
- All nine exported images have the expected dimensions and transparent alpha.
  Regenerating the original 24 portraits produced no changes to their files.

Hosted new-avatar saving and post-deploy owner acceptance remain pending.
