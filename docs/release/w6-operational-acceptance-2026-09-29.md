# W6 operational and owner acceptance record — 2026-09-29

**Status: in progress.** Hosted schema, synthetic data/RLS/RPC acceptance, the
owner's account decisions, and the first preview inspection are complete. Test
email configuration and invitation submission were verified on September 30;
owner-reported inbox receipt, verification, join and subsequent login passed on
Pixel Chrome. The owner confirmed password recovery acceptance on the corrected
September 30 preview. Test public-signup restriction, cleanup scheduling, and write-pause/restoration
now pass. GitHub failure-notification receipt, production credential controls,
and the broader owner phone walkthrough remain open. This record is not
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
- Password recovery initially failed; the corrected preview now passes owner
  acceptance as recorded at the end of this item.
  Owner testing confirmed the recovery email arrives, but the deployed W1 app
  consumed the recovery fragment during SDK initialization, signed the user in,
  and showed a false missing-reset-session error. The W3 client fix disabling
  automatic URL detection was present locally but absent from the W1 preview.
  A real-SDK initialization regression now verifies that the fragment remains
  available and no session is automatically created. Publish the corrected
  release candidate and repeat the owner's recovery check before closing this
  gate; successful email delivery alone is not recovery acceptance.
  The owner subsequently confirmed that the corrected preview changed the
  password, but reported a brief missing-session error followed by automatic
  navigation to Matches. Source inspection traced the error to the avatar
  provider remounting the entire page when Auth changed. The provider now keeps
  children mounted and hides cached avatar choices for other accounts. Reset
  success remains visible with an explicit Continue to Matches action and
  accurately states that the recovery session is signed in. Regression tests
  cover page-state preservation across sign-in/account switches and the success
  screen. The owner confirmed the requested recovery retest successful on the
  new preview (`02c3cd61a08f2987d96656bee939cc10c9657e62`) on September 30,
  following the instructions to complete a fresh reset and sign out/login with
  the new password. Password recovery acceptance is passed by owner report.
  Vercel deployment `BorGPtpi8wGW23BaeZJ76HKwjPVc` was verified Ready. Local
  full-suite coverage run passed 547 tests, plus the added avatar-cache isolation
  test passed in its focused four-test file; lint, typecheck and build passed.
  The repeated-email Gmail display concern below remains separate.
- The owner reports later recovery emails arrive in the inbox but Gmail groups
  and collapses their repeated content as quoted text. Expanding reveals the
  complete email. Treat this as a recipient display concern, not missing mail;
  repeated-email template acceptance remains open. No email-template or sender
  configuration change was made for this observation.
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
   real invitation, verification and password recovery passed by owner report.
   Default Supabase email is not evidence of normal recipient
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


## September 30 operational rehearsal checkpoint

The owner approved retaining invitation and recipient history for this release,
and owns cleanup-failure response. The owner also explicitly approved copying
only RDD Release Testing's default secret API key into repository secret
`RDD_TESTING_MONITOR_KEY`. It was transferred through process memory/stdin;
no credential was printed or saved in tracked files.

- Test Auth public signup is disabled; email login/confirmation remain enabled.
  Direct uninvited signup returned `signup_disabled` without changing Auth count.
  Existing fictional-member login and service-admin account provisioning passed.
  The real owner invite/join acceptance preceded this switch; a complete delivered
  invitation join after the switch is still useful final regression evidence.
- Test-only pg_cron cleanup `rdd-test-invite-cleanup` is active daily at 07:15 UTC,
  with command `select public.invite_cleanup()`. A real scheduler run succeeded.
  Invitation history was preserved and ordinary-member invocation was denied.
- Test write pause disabled the Data API and preview invitations. A JWT acquired
  before the pause could neither invoke the save RPC nor insert directly. Public
  signup remained denied; original match/participant fingerprints and Auth count
  were unchanged; operator SQL access remained available. Signed-in preview UI
  showed invitations unavailable and its Send button disabled. An unauthenticated
  terminal request returned Vercel protection's 401, which is not app-denial proof.
- The Data API and branch-scoped preview invitation flag were restored. Existing
  login, one fictional atomic save, and exact operation replay passed. Original
  records remained identical. Preview deployment `BuWf9pFPqwEAXRWMcARWdp87LZSM`
  was Ready for application revision `02c3cd6`; browser Send was enabled again.
- The test-only health RPC returns only a boolean and is service-only. Anonymous
  and ordinary-member access were denied; an inactive job was detected inside a
  rolled-back transaction. The monitor CLI passed live health and intentional
  failure tests. Its fixture is excluded from the production SQL manifest.

The CI workflow supports manual testing-monitor runs on `release/next` and a
07:30 UTC daily schedule. Scheduled Actions only activate on the default branch;
this schedule remains pending the separately approved merge into `main`. Do not
merge solely to activate monitoring. GitHub execution and actual owner failure
notification receipt must be recorded separately from local monitor proof.

On an alert, inspect the test project's Cron job and run history, confirm its
active flag/schedule/command, resolve the cause, invoke `public.invite_cleanup()`
as an operator if a retry is needed, and rerun the GitHub monitor. Preserve
invitation history. A manual cleanup alone does not repair a failing schedule.
The next scheduled successful run must clear health; unexplained data changes
or member access require stopping and investigation.

Evidence is in ignored `.local/release-w6-testing/`: `cleanup-schedule.json`,
`write-pause-result.json`, and dated signup/pause/restoration screenshots.
Private fixture credentials and the pre-pause JWT remain ignored and must never
be attached to GitHub or copied into release documents. Production was untouched.
Earlier open-item prose above describes the earlier checkpoint; this checkpoint
supersedes its test signup, scheduling and write-pause status. Broader owner
walkthrough, monitor receipt/activation and production credential controls remain
open; W7 go/no-go and W8 production cutover still require separate approval.


### GitHub monitor execution and production credential handoff

The approved secret passed in [manual Actions run 36734361232](https://github.com/rdd-cmyk/Rochester-Darting-Degens/actions/runs/36734361232)
on `1798d7b`; only the test cleanup job ran. The push CI also passed. The owner
has enabled failure email notifications and approved the intentional failure
rehearsal; actual receipt remains pending. Daily activation still requires the
separately approved default-branch merge.

Source inventory: `lib/supabaseClient.ts` and `app/api/change-log/route.ts` consume
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
`lib/invites/server.ts` consumes that URL and `SUPABASE_SERVICE_ROLE_KEY`.
The changelog separately consumes `GITHUB_TOKEN`. For the approved production
window, use production `sb_publishable_` in the public anon-named variable and
production `sb_secret_` in the server-only service-role-named variable. Other
integration-generated variable names do not replace these actual consumers.
Keep Preview/Development on the test project. Never put privileged keys in a
public variable. Audit GitHub token scope/expiry separately.

Before retiring old keys, inventory external workers, integrations, webhooks,
CI, old deployment URLs, open tabs and the compatible rollback artifact. The
owner must identify outside consumers or attest there are none; source search
cannot establish their absence. Rebuild release and rollback browser bundles
with the new public key, since updating variables does not update old artifacts.
Under the approved write barrier, verify new-key login/recovery, reads, saves
and invitation provisioning on the designated deployment. Only then deactivate
legacy API keys in Supabase Settings / API Keys and verify old-key rejection.
Creating new keys alone does not retire the exposed legacy key. Current docs
say legacy deactivation is reversible; reactivation restores the prior exposure
and needs an emergency decision. Prefer rollback using new-key artifacts.
JWT signing-key rotation/revocation and session effects are a separate change.
See [Supabase migration guidance](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys).
No production credential change or deployment was performed.


Intentional [alert rehearsal run 36734728823](https://github.com/rdd-cmyk/Rochester-Darting-Degens/actions/runs/36734728823)
failed at the monitor step as designed on September 30. The simulation exits
before any database request; it neither stops cleanup nor changes test data.
The owner confirmed receiving the failure email on September 30; alert delivery
is passed by owner report. The daily GitHub schedule still awaits the approved
default-branch merge, while the test database cleanup schedule is active.


The owner attested on September 30 that only this Vercel website consumes the
production Supabase keys. External-consumer inventory is accepted by owner
report; existing deployment bundles/open tabs and compatible rollback still
need the reviewed key migration controls. Normal [monitor rerun 36734946817](https://github.com/rdd-cmyk/Rochester-Darting-Degens/actions/runs/36734946817)
succeeded after the intentional alert. The broader phone walkthrough is pending.


## Owner phone walkthrough and fixes - September 30

Owner-reported passes: navigation/all pages/history filters/refresh; night creation
and attendance; individual match, rematch, validation, editing and game-entry
fields; Board access request; Solo logging/edit/refresh/delete/undo and no
competitive effects; avatar persistence and challenge submission; sign-out,
keyboard/portrait/landscape/dialog usability; desktop poster/TV view; offline
save retry produced exactly one game; password recovery passed again.

Blocked by setup: planning organizer controls, Board-approved access/moderation,
team saves, second-account Solo privacy/sharing, challenge acceptance/correction,
and Board poster draft. These remain open acceptance, not failures or passes.
The existing controlled Gmail test account now has test-only planning and Board
organizer roles. Three additional fictional admitted players C/D/E make six
players including the owner. Existing fictional A/B logins are provided only in
ignored local `phone-test-logins.txt`; A is organizer, B ordinary. Test setup
verified that B receives null for A's private Solo profile summary. No production
role or account was changed.

Confirmed fixes prepared from this feedback:
- Deployment-specific invitation URLs failed the exact origin restriction with
  generic invalid-request text and a misleading Sign in link. Keep the restriction,
  return a distinct wrong-origin response and link to the configured main address.
- Recap history refreshes after the 20-second results poll and focus events hid
  the share canvas while loading. Keep already-loaded recap/canvas mounted through
  background loading, expose expanded state, and place the preview directly below
  its button before awards. Initial loading/error handling remains explicit.
- Winner hover used a dark-panel background with dark selected text; retain the
  selected orange background/text pairing on hover. Center rivalry dialogs with
  explicit inset/margins so Tailwind reset does not place them at the top-left.
- Selecting a league night defaults Solo night activity sharing on, per owner's
  request; the checkbox, disclosure and opt-out remain. Existing saved sharing
  choices are preserved when editing. Change optional score wording to average.
- Profile Solo scope changes scoring summary, not the league history query below.
  Label that history League Match History and explain the distinction. Profile
  summaries and explicitly shared night activity are independent; private Solo
  individual history is never queried from the profile route.

Verification: trusted install, all 552 tests, coverage gate, lint, typecheck and
production build passed. Focused tests reproduce alternate-origin handling,
share-card stability during loading, and night-sharing default/opt-out. Hosted
browser verification of the published fixes and owner affected-flow retest remain
required. Broader cosmetic feedback is reserved for the owner's later discussion.

The required install audit reported two dependency entries: critical Next
16.3.4 ImageResponse advisory GHSA-vcvr-r3jv-pc5j and high development-tool
brace-expansion advisories. Source search found no next/og or ImageResponse use;
share cards/posters use client canvas, so the documented Next exploit condition
is not present in the reviewed source. Record these for a separate scoped patch
package before release; no dependency version/lockfile was changed here.
See [Next advisory](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j).


Published fix revision `4d50c17` passed GitHub CI run `36753908212` and Vercel
Preview deployment `2C6ZE9AUKzjr3n2ho8Ff1UiYnNdt`. Hosted browser verified:
stable-origin invitation list/Send enabled; deployment-specific origin renders
the configured-origin link with no misleading Sign in link; poster dialog
centered on desktop and 390px phone viewport; open recap canvas persisted across
more than 50 seconds of automatic polls and reopened with one click after closing.
Screenshots are ignored `phone-fixes-origin-guidance-2026-09-30.png` and
`phone-fixes-poster-centered-2026-09-30.png`. Test-only phone setup rerun passed
idempotently. Owner retest of changed behavior and remaining blocked flows is
still required. No production changes were made.


## Follow-up owner acceptance - September 30

The owner reports the previously blocked follow-up checklist and fixes now pass,
with the findings below. This is owner-reported acceptance, distinct from automated
checks. W6 remains open for retest of these new changes and remaining operational
release gates.

- Avatar initials exclude parenthesized first names. Planning says people voted.
- Open poll option counts and suggestion author identifiers/profile details are
  masked by the authenticated read RPC for ordinary members. Organizers retain
  them; members receive them after manual or automatic closure. Participation
  counts and own choices remain available, and an own-suggestion boolean permits
  withdrawal without disclosing another person's identity. Raw private tables
  and private RPC implementation remain inaccessible.
- Solo supports 701 in entry, history/progress/profile filters, rule presets,
  persistence and replay. It remains separate from competitive statistics.
- Board and Stats page backgrounds no longer cover the optional Summer layer;
  cards stay opaque and reduced-motion behavior is preserved.
- Incoming pending challenges appear prominently above the featured rivalry.
  Repair uses a dropdown of eligible, unlinked recorded games, identified by
  date, game and winner. Server eligibility/revision checks remain authoritative.
- Poster preview image is centered inside its dialog. Its Board composer is wider
  and taller. The action explicitly creates a text post and rivalry link; there
  is no image attachment support in the existing Board schema.
- Keeping a Board draft shows its storage location and a Resume saved draft
  button. Drafts use sessionStorage scoped to the account and composer in that
  browser tab. Returning to the same composer restores the text automatically;
  closing the tab may remove it. This is not a server draft or cross-device save.

### Supplemental SQL gate

The original eleven W5 input files are unchanged. The new deferred fixture and
LF-normalized hashes are recorded in [W6 amendment manifest](w6-sql-amendment-2026-09-30.json).
Apply it after the complete W5 chain. It replaces the private planning read
implementation and existing Solo write function, preserving admission wrappers,
function grants and search paths, and widens the Solo game check to allow 701.
The constraint alteration takes a table lock and validates existing rows; W7
must stage this as an additional production step and refresh its exact migration
and compatible-app rehearsal before approval. No down-migration should remove
701 once recorded games use it.

The patch and transactional acceptance tests passed on loopback W3 synthetic,
loopback W4 protected production-shaped, and hosted RDD Release Testing. Tests
cover member masking/organizer visibility, manual/automatic closure, own withdrawal
marker, provisional/anonymous denial, private table/function grants, private 701
history, explicit and unspecified 701 presets and exact retry. Full application
row fingerprints and function grant snapshots were nonempty and identical across
reapplication/testing. Local first-application checks also preserved all existing
application rows. No production project or backup was modified.

Trusted install, all 573 tests with coverage, lint, typecheck and production build
passed. Dependency audit findings remain the separate patch gate noted above.
Hosted visual verification and publication results will be recorded after deployment.
