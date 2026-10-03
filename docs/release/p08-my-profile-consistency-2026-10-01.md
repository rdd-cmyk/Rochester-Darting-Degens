# P08 My Profile consistency and copy

Status: owner accepted 2026-10-01 at 6fb7fc9. Baseline release/next at 42492c2.
P07 was accepted and P08 authorized on 2026-10-01. P08 CI 36862583510, Vercel deployment and hosted read-only smoke passed; owner acceptance authorized P09.

## Presentation and copy

My Profile adopts the shared compact PageHeader in populated, loading, signed-out
and load-error states. It retains the page title with the approved decorative
orange period. Its eyebrow is Your league identity, with the introduction:
"Put a face to the rivalry. Make your name your own." Signed-in account context
remains visible below the header and wraps at narrow widths.

Keep: Pick your personality. Bring it to every matchup; all curated avatar names,
field labels, required-field validation, save/error messages and exact unfinished
avatar-save instructions. Avatar and profile saves stay separate.
Revise: How your name will appear becomes Your name on the scoreboard; task labels
use Edit profile and Save profile. Preview help explicitly describes the name's
appearance in matches, leaderboards and stats. Reason: restrained league character
in the introduction and preview, with plain action/recovery language.

AvatarPicker is only used on this page. Its choices/save/recovery controls now use
ActionButton; name/profile panels and fields use shared panel and form roles.
Account-specific layout classes avoid the old Rivalry button rules without changing
Rivalry's stylesheet or pages. Avatar IDs, images/initials and their existing sizes
are retained. Choice avatars are decorative beside their labels, avoiding duplicated
initials in the accessible button name. Selected choices retain aria-pressed and
use an underline in addition to the central primary color roles. Avatar operations
expose their busy state without changing the pending/recovery lock.

The existing account-width proposal is centralized as --rdd-content-account at
740px, replacing this page's former 760px cap. Shell/panel padding, gaps, radii,
control boundaries, focus and action colors consume established shared roles.
No existing token value, shared avatar renderer, save API, operation ID, state
handler, query, first-name preference, payload, validation or persistence behavior
changes. The unusual existing Sex Yes/No options are retained; changing their
meaning would exceed a presentation pass. No dependencies, SQL, environment
changes, hosted writes or production rollout are included. W6/W7 stay paused at
the saved pre-consistency checkpoint.

## Verification

Required trusted install, 578 tests in 73 files, coverage, lint, TypeScript and
production build passed. Coverage: 96.53% statements, 90.90% branches, 97.76%
functions and 97.59% lines. Profile tests retain missing-session versus load-failure,
account/profile retry, pending field/Cancel locks and duplicate-submission coverage.
The avatar test retains confirmed-but-superseded receipt handling; recovery-hook
and API tests remain unchanged. Assertions changed only for visible label casing.
React source review confirmed stable keys, native submit/button/link semantics,
unchanged handlers/effect cleanup and preserved request/receipt ownership.

Synthetic loopback browser checks exercised disabled view mode, live name preview,
first-name checkbox, Cancel restoring persisted fields, successful save/reload and
pending save disabling fields/Cancel. An injected profile-write failure retained
edited values and recovered through Save profile. Avatar selection/save survived
reload; an interrupted avatar save locked choices and recovered with Check avatar
save. Failed avatar reads blocked saving and recovered through Refresh avatar
details. A failed account/profile read showed Retry and restored the saved profile.
Fixture data and receipts are in memory only: this verifies interface behavior,
not real Auth, RLS, durable persistence or hosted exactly-once guarantees.

Light and controlled dark-token rendering fit 320, 390, 768 and 1440px without
horizontal document overflow. Long preview names wrapped. The avatar grid uses
responsive columns and central gaps. Choice buttons exceeded 44px; the checkbox
label retained its 44px target. Keyboard Tab from the checkbox focused Sex with
a solid themed outline. Dark form/selected colors consumed the shared roles.
Dark review temporarily activated local dark media blocks; the exact normal
stylesheet was restored before build. No OS preference-switch or complete
accessibility-conformance claim is made. Actual phone/browser zoom and assistive
technology acceptance remain owner/final-sweep work.

Screenshots, synthetic fixture and exact publication/hosted read-only evidence
remain ignored under .local/page-consistency. The install's pre-existing one high
and one critical dependency finding remain separate release gates. Build defaults
for absent hosted variables are not hosted connectivity proof. Owner review passed on 2026-10-01; P09 was authorized.
