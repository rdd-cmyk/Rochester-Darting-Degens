# Release checkpoint before the page consistency pass

Recorded: 2026-09-30. Release work is waiting for the owner-requested page-by-page
consistency and wording pass. This is a resume record, not production approval.

## Current candidate

- Branch: `release/next`; checkout: `F:\RDD\Rochester-Darting-Degens-league-night-mode`.
- Published app SHA: `351a4b0253f2c7f05d7a70708597d1c847977c65`.
  This includes the final W6 Solo/change-log fixes and owner navbar, avatar and
  style-guide updates. The working tree was clean before this planning request.
- [Stable test preview](https://rochester-darting-degens-git-rele-684da0-tims-projects-b7b7f743.vercel.app)
  and [exact candidate preview](https://rochester-darting-degens-jlwn6ltxd-tims-projects-b7b7f743.vercel.app).
- Recorded publication evidence: [GitHub CI 36778724323](https://github.com/rdd-cmyk/Rochester-Darting-Degens/actions/runs/36778724323)
  passed; Preview deployment `6770410289` succeeded for that SHA. These are dated
  results from the completed publication, not checks rerun for this document.
- Latest implementation checks: trusted install, 578 tests, coverage, lint,
  type-check and production build passed. Signed-in desktop/mobile navigation
  and avatar loading passed; 24 stored avatar IDs stayed unchanged. See the
  [UI/avatar addendum](ui-avatar-preview-2026-09-30.md).
- Production is unchanged. The preview uses RDD Release Testing; production
  backups and protected restore/rehearsal evidence remain separate from it.

## W0-W8 position

| Package | Recorded position at this checkpoint | Resume implication |
| --- | --- | --- |
| W0 | Scope/candidate preparation passed, with subsequent scope and app addenda. | Refresh the final app inventory/SHA after the consistency pass; preserve earlier manifests. |
| W1 | Environment assessment and isolated-preview prerequisite passed. | Recheck inexpensive environment/isolation facts before the final freeze; old deployments retain their original bundles/configuration. |
| W2 | Deferred statistics foundation passed independent review and focused local checks. | No new statistics features or raw-stat entry are part of the UI pass. |
| W3 | Combined synthetic rehearsal passed for its recorded inputs. | Keep its evidence; retest affected app flows and the final amended release in W7. |
| W4 | Protected backup and independent-copy restore passed. | Retain both protected copies through release plus 30 days. The owner accepts 48 hours or more of downtime, but no lost committed records. W8 still requires a fresh drained-write backup. |
| W5 | Eleven-input production-shaped chain, preservation, interruption recovery and compatible rollback passed locally. | Original evidence is valid for those inputs. Its rollback app predates the W6 SQL supplements and is not the final amended rollback artifact. |
| W6 | Substantial operational and owner acceptance passed; keep final acceptance open for the changed candidate. | Use the accepted results below, refresh only affected checks, and resolve outstanding release gates explicitly. |
| W7 | Not started; no freeze/go-no-go or production authorization. | Resume after all page packages are accepted and any remaining W6 gates are resolved. |
| W8 | Not started. | Requires the owner's concrete W7 approval, fresh backup/write pause, ordered cutover, verification and observation. |

The detailed authorities are [release readiness](../release-next-readiness.md)
and [W6 operational acceptance](w6-operational-acceptance-2026-09-29.md).
Historical headings in those records do not override later dated acceptance.

## Acceptance already obtained

The owner approved admitting existing accounts except Test Captain, with Ben
Linford and Tim Kiefer as planning and Board organizers. Production role
assignment remains a cutover action. The owner handles operations requiring
human action; implementation preparation can continue under the existing scope.
Final phone acceptance uses the owner's Pixel 11 Pro XL / Chrome.

Isolated email/invitation/signup/login and corrected password recovery passed
by owner report. Test public signup is disabled. Test cleanup is active; the
write pause and restoration rehearsal preserved records. Invitation history is
retained for this release under the owner's decision. The owner received the
intentional GitHub failure alert, and a normal monitor rerun passed. The daily
GitHub monitor schedule activates only after the approved default-branch merge.
The owner attested that only this Vercel website consumes production Supabase
keys; production key migration has not been executed.

The owner completed the broader walkthrough and reported the subsequent fixes
looked good. Keep that acceptance and the recorded automated/synthetic checks;
do not reinterpret older setup blockers as current failures. The final Solo
default/order, main-only Change Log and owner UI/avatar candidate have technical
preview evidence. Obtain affected-page owner acceptance during the new pass and
confirm any still-unexercised multi-account/organizer/team flows at W6 closeout.
Repeated Gmail emails collapsing quoted content and initial spam placement are
recorded delivery observations; do not claim an email-template fix was made.

## Items that must survive the detour

1. Keep the original SQL chain immutable and append the two W6 supplements in
   order: [poll privacy / Solo 701 manifest](w6-sql-amendment-2026-09-30.json),
   then [Solo summary-default manifest](w6-solo-summary-default-2026-09-30.json).
   Both passed synthetic, protected-copy and hosted testing with original rows
   and grants preserved. Neither was applied to production.
2. W7 must freeze exact hashes/order, rehearse the final amended chain, and build
   and test a compatible rollback app: 701 reads/edits, masked open polls and own
   suggestion withdrawal, summary default-on, stored opt-out and read-failure
   behavior. Styling rollback does not authorize DB rollback.
3. Retain the production credential inventory/migration controls. Prepare
   release and rollback artifacts with the reviewed new keys; actual production
   migration, retirement and verification belong to the approved cutover.
   Never store secrets in these plans or use production for UI acceptance.
4. Resolve the separately scoped dependency patch/review gate before release.
   The dated W6 audit recorded the Next 16.3.4 ImageResponse advisory and a
   development brace-expansion advisory; reviewed source did not use
   ImageResponse. Refresh applicability and fixes when doing that package.
   Do not fold a dependency update into a page styling package.
5. Reconfirm operator access, final roster/configuration, maintenance/write
   barrier, fresh backup/retention and no-record-loss recovery before W8. Refresh
   drift-prone facts at W7 rather than repeating completed rehearsals blindly.

## Return to release

After all packages in the forthcoming consistency plan are owner-accepted:
review the final diff against this checkpoint; refresh W0's candidate addendum;
finish affected W6 checks and the separate dependency gate; then execute W7's
final packet, rehearsal and go/no-go. W8 remains a separately approved action.
Any change to SQL, admission, privacy, game rules, saves/recovery, or dependencies
requires its own scope and relevant release gate review instead of being called
UI-only.
