# W6 operational and owner acceptance record — 2026-09-29

**Status: in progress.** Hosted schema, synthetic data/RLS/RPC acceptance, the
owner's account decisions, and the first preview inspection are complete. Test
email configuration and invitation submission were verified on September 30;
owner-reported inbox receipt, verification, join and subsequent login passed on
Pixel Chrome. Password recovery remains open. The write-pause exercise,
credential rotation, operational
ownership, and the owner's phone walkthrough are still open. This record is not
approval to deploy to production. No production data, Auth, SQL, or configuration
was changed during W6.

## Scope and evidence

- Target is the isolated **RDD Release Testing** Supabase project
  `uepayhdrgzrxhkqbwebo`, previously verified empty. The production project is
  `hrqsbzmsfichiimtxijj`. Historical production-connected previews are excluded.
- An ignored, test-only Supabase workdir contains the baseline for a fresh empty
  project and the eleven exact W5 release SQL inputs. The canonical LF hashes
  match the reviewed W5 manifest. A linked CLI dry run listed exactly these
  twelve files; `db push` applied them successfully to the test project, and a
  second dry run had no pending files. The baseline is **never** an input to
  production. No tracked SQL was placed in `supabase/migrations/`.
- The deferred statistics validation SQL completed on the test project. Final
  read-only check: 12 migration-history records, zero unvalidated public
  constraints, 2 fictional Auth users and league members, and 2 fictional
  matches. Game modes were enabled in the test project only for acceptance.
- Two fictional accounts were denied before admission, then admitted explicitly.
  Hosted checks covered profile visibility, denied direct split-writer insert,
  disabled-by-default game modes, atomic match save/retry, private Solo data,
  avatar write, planning poll, Board approval/post, and Rivalry challenge and
  linked match. An initial linked-game submission was rejected atomically; no
  partial match was left. A fresh canonical submission succeeded and replayed
  idempotently. The exact cause of the first rejection was not established.
- The stable combined preview signed in as a fictional admitted account and
  rendered the seeded match, league night, Board post, Rivalry series and
  challenge. This is a desktop browser smoke check, not owner phone acceptance.
  Preview: https://rochester-darting-degens-git-rele-684da0-tims-projects-b7b7f743.vercel.app/
- Owner decision: admit all five existing production Auth users **except** the
  uniquely resolved Captain Test account (display `CptTest`). The four admitted
  users include Ben Linford and Tim Kiefer. Assign Ben and Tim both planning
  organizer and Board organizer roles. The read-only production roster snapshot
  and its cutoff are kept in ignored `.local/release-w6-testing/approved-roster.json`.
  A review-only SQL draft is in that ignored directory. Re-audit Auth/profiles
  and reconcile any new or changed account at W8; never admit by a blanket rule.
  Neither file contains credentials, and neither was run against production.
- Owner can perform final phone acceptance on Pixel 11 Pro XL with Chrome.
- Operator assignment: Codex prepares and executes authorized technical steps
  it can safely perform; the owner will perform steps requiring personal account
  access or a direct human action and will watch the cutover with Codex. Assign
  named backup/SQL/deploy/monitor duties in the W7 packet before the window.

## Configuration to finish on the isolated test project

### September 30 configuration and invitation checkpoint

- Saved test Auth Site URL and exact `/reset-password` redirect now match the
  stable preview origin above. Custom SMTP is enabled with sender name
  `RDD Release Testing`, host `smtp.resend.com`, port 465, and stored credentials.
  This replaces the earlier unsuccessful URL edit noted below.
- Preview invitation sender and origin were inspected and match the testing
  domain and stable release preview. The invitation secret and Resend API key
  are present as secret Preview variables; their values were not inspected.
- `RDD_INVITES_ENABLED=1` is scoped to Preview branch `release/next`. The correct
  branch deployment was redeployed as `2Lz6A4HgiK786NPMWvJ6byqEc3Wh`, source
  `9c582fa35cb03f644c0a8eb22e2a5cc59922b00f`, and reached Ready with the stable
  alias assigned. Production configuration was not changed.
- The signed-in fictional member sent one invitation to the owner-controlled
  Gmail test inbox. The preview reported `Invitation sent` and one pending
  invitation with a sent date and seven-day expiry. This proves submission,
  not inbox delivery. Screenshot evidence is kept in ignored
  `.local/release-w6-testing/preview-invite-sent-2026-09-30.png`.
- The owner confirmed receipt of both invitation and verification-code emails,
  successful signup using the code, and successful subsequent login, all in
  Chrome on Pixel 11 Pro XL. Both emails initially landed in Spam and were
  marked as not spam. Functional delivery/join/login acceptance passed by owner
  report on September 30; inbox placement remains a deliverability concern for
  release monitoring. This does not establish password recovery acceptance or
  acceptance of the remaining phone feature walkthrough.
- Password recovery remains pending.
  Owner testing confirmed the recovery email arrives, but the deployed W1 app
  consumed the recovery fragment during SDK initialization, signed the user in,
  and showed a false missing-reset-session error. The W3 client fix disabling
  automatic URL detection was present locally but absent from the W1 preview.
  A real-SDK initialization regression now verifies that the fragment remains
  available and no session is automatically created. Publish the corrected
  release candidate and repeat the owner's recovery check before closing this
  gate; successful email delivery alone is not recovery acceptance.
  Public-signup restriction, cleanup scheduling, write pause and production
  credential rotation have not been completed by this checkpoint.

1. Set Supabase Auth Site URL to the exact stable preview origin above, and add
   its exact `/reset-password` URL to the redirect allowlist. Keep email login
   enabled. URL configuration is now verified by the September 30 checkpoint.
   Audit other enabled providers and disable public signup only after a controlled
   invite account path is ready. Test an existing login and a real recovery link.
2. Establish a verified sender/domain and Supabase Auth SMTP for the test
   project. The owner controls `linford585@yahoo.com` and
   `linford585test@gmail.com` for delivery tests. Test SMTP is now configured;
   real invitation and verification delivery passed by owner report; recovery
   remains to be accepted. Default Supabase email is not evidence of normal recipient
   delivery. Use a dedicated Resend API key and verified `RDD_INVITE_FROM` for
   invitation mail, and configure Auth SMTP separately for verification and
   recovery. Keep all keys server-only and out of chat/repository files.
3. In **Preview** Vercel scope only, set `RDD_INVITE_ORIGIN` to the exact stable
   preview origin; `RDD_INVITE_SECRET` to a stable random secret; `RESEND_API_KEY`
   and `RDD_INVITE_FROM` to the verified testing sender; and confirm
   `SUPABASE_SERVICE_ROLE_KEY` matches the test project. Keep
   `RDD_INVITES_ENABLED=0` until the above and URL/SMTP checks pass, then enable
   it only on this isolated preview and test invite issuance, delivered mail,
   join, retry/unknown-result recovery, password recovery, and uninvited denial.
   The required variable semantics are in
   [invite-only registration handoff](../invite-only-registration-handoff.md).
4. Arrange a daily **server-only** call to `public.invite_cleanup()` with a named
   owner, failure alert, and retry procedure. Its SQL function is present; a
   schedule is not. It clears expired challenges/rate buckets and expires pending
   invites; it does not purge recipient/history records. Approve retention for
   those records before enabling invites.

## Production cutover controls to settle before W7

- The production legacy service-role key exposed during W1 still needs a
  controlled rotation. Inventory every consumer and Vercel scope, move the app
  to project-matched new secret/publishable keys where supported, deploy and
  verify each consumer, then retire legacy keys under a maintenance window.
  Supabase's new and legacy keys can coexist during migration; changing the
  legacy JWT secret can affect both legacy anon and service-role clients. Do not
  rotate or disable it until all clients and rollback artifacts are accounted
  for. Review the production GitHub-token warning separately.
- Use `https://www.rocdartdegens.com` as the candidate canonical production
  origin because the apex currently redirects to `www`; confirm the exact
  production Site URL and add the explicit `www` `/reset-password` redirect.
  Test login and recovery before public signup is disabled.
- Rehearse an enforceable write pause on the **test** project: block old-tab and
  direct Data API writes plus signup/provisioning, verify normal writers fail,
  verify operator DB access remains, then restore service and verify login/save.
  Supabase documents that disabling its Data API stops autogenerated REST
  endpoints. This is a candidate barrier, not yet an accepted production plan;
  RPC and Auth effects, other write paths, and restoration must be observed in
  the rehearsal. Do not rely on a maintenance banner alone.
- Name operators for fresh protected backup, schema/history/backfill/app steps,
  rollback, and monitoring. Choose a maintenance window. The owner tolerates
  48 hours or more downtime but requires zero lost committed records. Freeze
  writes before the W8 backup, record pre/post counts and IDs, apply only the
  reviewed additive SQL, and run the reviewed admission transaction while the
  barrier remains active. Compare the live roster to the snapshot at the cutoff
  and stop if it differs until reconciled.
- Stop on unexplained record differences, a privilege bypass, legitimate-member
  lockout, broken login/recovery, duplicate/partial saves, unexpected migration
  history or missing RPCs. Preserve the compatible app rollback artifact from
  W5; old `main` is not presumed safe with the upgraded DB.

## Owner phone walkthrough still required

On the final isolated preview in Pixel 11 Pro XL Chrome, check existing login
and history; planning/RSVP; ordinary/rematch/team result and recap; Board
request/approval/post/report/recovery; invitation join and password recovery;
private Solo and sharing; avatar choice, challenge acceptance/record/correction;
and phone, TV and poster layouts. Include account switching, stale tabs, network
loss and 320/390/768/1440 layouts where practical. Record any blocking defect
and rerun the affected check after a fix. Owner acceptance and its date are not
yet recorded.

W6 can close only after the open configuration, delivery/recovery, cleanup,
write-pause, credential and owner walkthrough evidence is attached. W7 remains
the separate production go/no-go decision; W8 is the separately authorized
cutover.
