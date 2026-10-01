# P16-P20 consistency and copy

Status: awaiting owner review. Baseline `release/next` at `f4613de`.
P10-P15 were accepted on 2026-10-01; the owner authorized these five pages
together, with full checks and one preview publication after all are ready.
P21-P24 remain unstarted; W6/W7/W8 remain paused at the release checkpoint.

## P16: Sign In

Compact PageHeader, shared panels, fields and action variants replace the old
account skins. Keep “Welcome back” and “Sign in to your league account”: an
account form benefits from direct instructions. The invitation-only explanation
and password recovery messages remain precise. Show/Hide, submit, disabled
states, session redirect and recovery destination are unchanged.

## P17: Invitation Join

Shared compact header and account-width token replace the local heading and
inline width. Keep “You’re invited to the league”, “Make yourself at home” and
the successful “You’re in. See you at the oche” title. Verification-code and
registration controls adopt the shared field/button family, with an explicit
submit type. Expiry, code replacement, password limits, uncertain-registration
retry, token removal and separate existing-account sign-in instructions remain
unchanged. No invitation or membership operation was added.

## P18: Verify Email

The shorter “Check your email” title uses the same header in loading and loaded
states. Wording now says “If you received an account confirmation email” rather
than claiming this page sent one. It distinguishes an account-confirmation link
from an invitation's registration code and explains that league membership still
requires an invitation. Address-present and address-absent branches still use
escaped React text. No confirmation, send or admission logic is implemented here.

## P19: Reset Password

The same compact title remains through loading, missing-session, form and
success states. Shared fields, Show/Hide and action variants replace local
skins. Recovery hash capture, temporary-failure token retention, validation,
single-submit guard and success remaining visible until Continue to Matches
are unchanged. Passwords and real recovery tokens were not entered during
browser review; automated tests exercise these transitions with mocks.

## P20: Change Log

Shared standard heading, panel/section-title roles and navigation links align
release notes with the site. Intro: “The latest updates merged into main. See
what’s new around the league.” This describes the existing main-only feed
without implying a merge to a feature branch is a release. Markdown, dates,
pagination, auth/member gating and upstream-error distinctions remain unchanged.
No GitHub route/query changes are included.

## Scope and verification boundary

New account and Change Log CSS is scoped to opting-in pages and consumes existing
width, spacing, radius, field, heading and action roles. No shared token value
changes. Legacy Join button/title rules exclude the newly opted-in page;
Invitation Management retains its existing exclusion and appearance. Other
accepted pages do not opt into these new layout classes. Existing Markdown
table/code scrolling and privacy handling remain intact.

Focused tests pass: 29 tests across five files, plus focused lint. Source review
compared handlers, form types, disabled states, destinations and recovery rules.
Initial edit/import errors were corrected before the passing focused rerun.
Required trusted install, 578 tests in 73 files, coverage, full lint, typecheck
and production build pass. Coverage: 96.53% statements, 90.90% branches, 97.76%
functions and 97.59% lines. The existing one high and one critical dependency
audit findings remain a separate release gate. Build uses local defaults when
hosted variables are absent. Exact publication identity, screenshots and
deployment evidence stay in the ignored QA directory.

Synthetic browser samples cover sign-in/recovery prompt and a successful dummy
sign-in, invitation preview/code form, confirmation with/without an address,
missing and valid reset-session layouts, Change Log signed-out/populated/paging
and empty results. Samples include 320px light phone layouts, 390px dark account
layouts, 768px confirmation and 1280px dark recovery/Join/Change Log. The temporary
dark-media override was restored before final checks. This is sampled layout
evidence, not every state/theme/width combination or real Auth/RLS/email delivery.

Real phone, assistive-technology/zoom and end-to-end invitation/recovery
acceptance remain owner review/final-sweep checks. No hosted writes, production
deployment, SQL/configuration changes, main merge or release-gate closure.
