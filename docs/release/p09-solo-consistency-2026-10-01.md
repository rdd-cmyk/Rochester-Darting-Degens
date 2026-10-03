# P09 Solo Play consistency and copy

Status: awaiting owner review. Baseline release/next at 6fb7fc9.
P08 was accepted and P09 authorized on 2026-10-01. Stop before P10.

## Presentation and copy

Solo adopts feature PageHeader with the approved decorative orange period,
shared panels, form controls and actions. The game between game nights and
Your board. Your pace remain. The owner requested removal of the three context
chips after preview review; the heading now leads directly into the tabs.
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


## Owner review adjustments

The short History view removed the desktop scrollbar, shifting centered content.
Solo now reserves the root scrollbar gutter only while its shell is present.
At phone widths, the three view choices and Refresh use a two-column grid;
Refresh has the shared outlined control skin, without an isolated right-aligned
second row. The three header context chips were removed as requested.

Follow-up checks passed trusted install, 578 tests, coverage, lint, types and build.
At desktop 1280px, the heading x coordinate stayed 50.518px and the shell x
coordinate stayed 12.571px across Log a game, History, Your progress and back;
content heights varied from 900px to 2087px. Root scrollbar-gutter computed
stable. At 360/390px, all four controls fit two equal columns and 44px rows with
no document overflow; no context chips remained. Progress rendering, Cricket
selection and All play scope worked, resolving the earlier progress-tab browser
limitation for these read-only checks. Visibility writes, delete/undo and retry
browser checks remain unclaimed; existing automated tests pass.
