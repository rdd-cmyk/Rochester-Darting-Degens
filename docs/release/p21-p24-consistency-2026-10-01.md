# P21-P24 consistency and copy

Status: awaiting owner review. Baseline `release/next` at `f238849`.
The owner accepted P16-P20 and authorized all four remaining pages together,
with full checks and one preview publication after the batch is ready.

## Presentation and copy

- P21 Release Readiness: compact shared heading, account-width utility shell,
  token-based panel and wrapped sanitized JSON. Success/failure wording and
  connection-isolation acceptance boundary remain precise. Preview environment
  and release/next branch restrictions are unchanged.
- P22 Client Diagnostics: “Client session check” describes what the page actually
  checks. It explicitly does not test database connectivity. Session read,
  error handling and fixture-only error trigger are unchanged.
- P23 Not Found: shared compact heading and navigation actions. Keep “That page
  is off the board” as the light league metaphor; exit instructions remain
  direct. No routing, missing-record or request-error handling changes.
- P24 Error Fallback: shared compact heading and native retry/navigation actions.
  Keep plain recovery copy, without asserting whether a save succeeded. The
  installed Next runtime supplies both reset and retry; the existing reset
  callback recovered the real local error boundary successfully and is retained.

All four use the existing PageHeader/ActionButton/ActionLink variants as needed.
The new utility shell is opt-in and uses existing account width, shell padding,
spacing, text and panel roles. No shared component or token value changed.
React review confirmed unchanged hooks/client boundaries, native button/link
semantics, escaped diagnostic text and no newly displayed error details.
No API, SQL, membership, privacy, game rules or hosted configuration changes.

## Evidence and limits

Focused diagnostic checks: 22 tests passed, including production/other-branch
rejection, sanitized text and failure-without-success wording. Existing full
application checks are run only after all four pages are ready.

Local browser evidence: diagnostics and missing-page layouts have no horizontal
overflow at 320, 390, 768 and 1280px. Unknown route returned HTTP 404. The real
fixture error boundary rendered and Try again recovered in both the light
desktop and dark phone samples. Dark review used a temporary CSS media override;
the intended stylesheet was restored byte-for-byte before full checks.
This is sampled layout evidence, not a full accessibility certification or
physical-device acceptance. Screenshot/geometry and exact publication evidence
remain in the ignored `.local/page-consistency/p21-p24-*` packet.

The local isolation diagnostic intentionally reports configuration not ready:
synthetic URLs and fixture flags cannot pass its hosted isolation guard. The
existing W1 diagnostic also requires invitations disabled, while W6 enables
invitations; its stage-specific failure is not a new UI regression or an
instruction to disable invitations. No new environment-isolation/DB acceptance
is claimed from these layout checks.

Required final checks passed: trusted install, 578 tests across 73 files, coverage,
lint, typecheck and production build. Coverage: 96.53% statements, 90.90% branches,
97.76% functions and 97.59% lines. Existing dependency audit findings (one high,
one critical) remain in the separately scoped release dependency gate. CI and
Vercel identity/results are recorded in the ignored publication packet after push.

## Owner review and final sweep

Review the preview's `/test-supabase`, `/release-readiness`, and an unknown path
such as `/qa-missing-page`. The hosted diagnostic error trigger remains absent;
P24 is illustrated by the saved local synthetic screenshot, so hosted failures
need not be deliberately induced. Verify readability, headings and navigation.

After accepting this batch, all 24 page rows can be marked accepted. Then record
the final combined journey sweep: navigation and both themes; profile/privacy;
planning organizer/member views and polls; individual/team match and night
entry/edit/rematch; Solo history/privacy/undo; Board access, drafts and replies;
challenge acceptance/repair; invitation and password recovery. Retain prior
accepted flow evidence, and exercise unverified multi-account/device states
without calling presentation checks authentication or SQL acceptance.

The [release checkpoint](pre-consistency-checkpoint-2026-09-30.md) remains the
return authority: refresh W0 candidate addendum, finish affected W6 and separate
dependency/credential gates, rehearse both W6 SQL supplements and the compatible
rollback app, then W7 exact packet and owner go/no-go. W8 needs separate cutover
approval, fresh protected backups and write-pause/no-record-loss controls.
Neither this batch nor owner appearance acceptance authorizes a DB deployment.
