# P07 Player Profile consistency and copy

Status: accepted by the owner on 2026-10-01. Baseline release/next at d9b8da3.
P06 was accepted and P07 authorized on 2026-10-01. The owner accepted P07
and authorized P08 on the same date.

## Presentation and copy

Player Profile uses the shared standard PageHeader in populated, loading,
signed-out, request-error and missing-player states. Player names remain unchanged,
with the decorative orange period hidden from assistive technology. The existing
80px avatar occupies the identity slot and remains visible above the mobile title.
Browse players and Back to matches use shared ActionLink variants.

Keep: player identity/details, exact record values, League/Solo/All play labels,
privacy disclosure, scoring caveats, filter options and match detail/unit labels.
Revise: Stats Summary becomes The tale of the tape; the introduction says
"The record, the recent form, and the next rival to watch." Section/action labels
use natural casing. Overall record becomes League record; 3DA is explicitly named.
No-scored-game messages describe the actual individual/rules-unspecified cohort.
Reason: add restrained broadcast energy around the record while keeping numerical,
privacy, empty and failure explanations literal.

Panels, history filters, scoring fields, actions and pagination use shared skins
and existing central geometry/color roles. Route CSS owns layout only and stays
scoped to .player-page. The width adopts the established wide-content role rather
than its former 1000px cap. League-summary cards now have their own three-column
grid, stacking on narrow screens; scope controls sit above it rather than sharing
a column with the entire record. Selected buttons have an underline as well as
native aria-pressed and the established primary text/background roles.

ProfileSoloStats has no other page consumer. It now uses the shared controls/panels
and profile-specific layout instead of importing Solo's unrelated page stylesheet.
Solo's page and stylesheet are unchanged. No shared primitive or token value,
avatar renderer, metadata implementation, effect, query, handler, calculation,
stored preference or privacy/admission behavior changed. No SQL, dependencies,
environment changes, hosted writes or production deployment are included.
W6/W7 remain at the pre-consistency checkpoint.

## Verification

Required trusted install, 578 tests in 73 files, coverage, lint, TypeScript and
production build passed. Coverage: 96.53% statements, 90.90% branches, 97.76%
functions and 97.59% lines. Existing profile tests still cover filtered queries
before pagination, page reset, stale-response rejection, pending controls,
request failure/recovery, missing-player versus failure, and missing score versus
recorded zero. Solo tests retain denied-versus-empty, viewer/profile changes,
activation-specific consent, late-response protection and retry coverage.
Assertions changed only for revised visible labels. React source review confirmed
stable keys, native button/link semantics and unchanged request ownership.

Synthetic loopback browser checks exercised sign-in gating, populated records,
initials/chosen avatars, no recorded games, filtered recent/all history, profile
missing versus failed read, and history read failure. Solo and All play displayed
compatible 3DA/MPR cohorts; private summaries hid old metrics in both scopes.
Solo request error recovered through its existing retry to an explicit zero-game
summary, preserving its selected game. Expected injected failures logged errors;
these are synthetic interface checks, not real Auth/RLS or durable SQL proof.

Light and controlled dark-token rendering fit 320, 390, 768 and 1440px without
horizontal document overflow, including a long nickname. The cards stacked below
750px and the avatar remained visible on mobile. Sampled selects/buttons met the
44px minimum. Keyboard Tab from Game type focused Result with a solid themed
outline. Dark selected text/background and form colors used their shared roles.
Dark review temporarily activated local dark media blocks; the exact normal
stylesheet was restored before build. No OS/browser preference switch is claimed.
Screenshots and local fixture evidence remain ignored under .local/page-consistency.
Phone, actual browser zoom and assistive-technology acceptance remain owner/final
sweep checks; this is not a comprehensive accessibility-conformance claim.

The install's existing one high and one critical dependency finding remain separate
release gates. Build defaults for absent hosted environment variables do not prove
hosted connectivity. The exact published source, CI/Vercel results and hosted
read-only smoke belong to the ignored P07 publication packet. Published 42492c2
passed CI 36858790687 and Vercel. Hosted read-only record,
history/filter and Solo-disclosure smoke passed with no console errors; observed
Supabase assets pointed to RDD Release Testing. Owner acceptance is recorded above.
