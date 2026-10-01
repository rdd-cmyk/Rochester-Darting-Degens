# P09 Solo Play consistency and copy

Status: awaiting owner review. Baseline release/next at 6fb7fc9.
P08 was accepted and P09 authorized on 2026-10-01. Stop before P10.

## Presentation and copy

Solo adopts feature PageHeader with the approved decorative orange period,
shared panels, form controls and actions. The game between game nights and
Your board. Your pace remain, with noninteractive context chips below the header.
Tabs, game choices and analysis scopes retain aria-pressed with an underline.
Save game/Save changes retain explicit submit semantics. The benchmark uses
themed inset/text roles; Your first benchmark starts here replaces Your next
game starts it. Keep One good game to chase and Does it carry over.

Privacy, night-sharing, stopped-game, exact raw-total, analysis caveat and device
recovery descriptions stay precise. No scoring, filtering, API, recovery,
privacy or default behavior changes. Preserve 301/501/701/Cricket order, summary
default-on with stored opt-out, linked-night sharing default and no competitive
effect. Shared skins replace duplicated local rules; no shared token changes.
PracticePerformance has no consumer outside Solo. Chart series/geometry, bounded
table scrolling and separate League Night activity rules remain unchanged.

## Verification and acceptance boundary

Required trusted install, 578 tests in 73 files, coverage, lint, typecheck and
production build pass. Coverage: 96.53% statements, 90.90% branches, 97.76%
functions, 97.59% lines. Initial JSX link closing-tag errors were corrected before
the passing rerun. One pre-existing League Night test initially failed on timing;
both the full corrected rerun and coverage pass. The pre-existing one high and
one critical dependency findings remain separate release gates. Local build
uses defaults when hosted variables are absent.

Synthetic loopback-only UI confirmed save/play-again, a refreshed recent record
and editing through the explicit submit action. Light and controlled dark-token
entry rendering fit 360, 390, 768 and 1280px without horizontal document overflow;
observed action targets are at least 44px. Dark benchmark uses themed inset/text
roles. Temporary local dark-media activation was restored byte-for-byte before
build. A local Turbopack file-lock panic during stylesheet restoration did not
recur in the successful production build. No OS-theme or WCAG claim is made.

Browser automation stalled at the native delete-confirmation dialog. Subsequent
progress-tab actions did not produce a verifiable change. Browser delete/undo,
progress/filter/visibility and retry checks are not counted as passed. Existing
automated behavior tests pass, and unchanged handlers/APIs were reviewed. These
interactions remain owner review/final-sweep checks. Synthetic persistence is
memory-only, not proof of real Auth, RLS, durable or exactly-once hosted saves.
Phone, zoom and assistive technology acceptance remain owner/final-sweep work.

Exact publication, CI, hosted read-only evidence and screenshots stay ignored in
.local/page-consistency. No hosted writes, SQL, Supabase configuration, production
deployment, main merge or W6/W7 closure occurred. P09 awaits owner review;
P10 remains unstarted.
