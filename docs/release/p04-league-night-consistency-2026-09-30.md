# P04 League Night consistency and copy

Status: awaiting owner review. Baseline release/next at 938ee34.
The owner accepted P03 and authorized P04 on 2026-09-30. P05 is unstarted.

## Presentation and scope

League Night adopts PageHeader for loading, signed-out, lobby and active-night states.
The lobby uses the feature size; an active night uses compact with its stored title,
date/venue and unchanged Change night confirmation. Challenge and cancelled-night
context stays below the heading. Native ActionButton retains handlers, disabled flags,
pressed/expanded labels and explicit create-form submit semantics. Plan & RSVP and
Solo navigation use ActionLink; their components are rendered only by this page.

Shared form roles are opt-in without forcing grid layout. Panel padding/radius,
field borders/focus, ordinary actions and disabled states reuse P03 roles.
New central width roles are 1240px wide and 880px form, plus pill radius for player
selection. Tabs and selected-player/winner states retain their domain indicators.
Large score input text and share-card canvas geometry remain deliberate exceptions.

Planning also imports the old night.css. It is unchanged. Every new route rule in
night-consistency.css is scoped to .night-shell--consistent, preserving Planning
until P05. Temporary domain-layout duplication avoids silently migrating another
page; action/form skins remain central. Consolidate legacy layout during subsequent
page adoption where compatible. No query, effect, timing, calculation, admission,
write-recovery, data precision, or export implementation was changed.

## Copy review

| Decision | Text | Reason |
| --- | --- | --- |
| Revise lobby heading | League Night | Shared page identity with the orange terminal period. |
| Keep / shorten intro | Good darts. Better company. Open a night and bring your game. | Keeps the friends-league voice and removes the awkward “tonight’s night”. |
| Keep entry | Pick your players. Record the result. Go again. | Clear, competitive and brief. |
| Keep recap | A few good games. A lot to talk about. / Earned bragging rights. | Existing announcer voice without changing award claims. |
| Keep task/recovery copy | Save & Rematch, Save & Finish, restore/retry/confirmation and privacy explanations | Precise operational meaning. |
| Revise navigation | Plan & RSVP / Log a solo game | Shared action appearance; destination remains unchanged. |

## Verification and limits

Trusted install passed; its two existing audit findings remain the separate release
security gate. Final local tests: 578 in 73 files; coverage also passed (96.53%
statements, 90.90% branches, 97.76% functions, 97.59% lines). Lint, typecheck and
production build passed with normal theme handling restored. No new mirrored CSS
tests were added. Existing tests cover save recovery, rejection/duplicate handling,
team modes, recap calculations and preview persistence through refresh.

Ignored loopback fixtures provided ten synthetic players, six initial attendees
and twelve games. Browser checks passed individual Save & Rematch, receipt and
retained participants/reset scores; 60 3DA converted to 20 PPD; attendance added a
seventh player. Share-card preview opened locally and canvas remained bounded.
Entry at 320/390/768/1440px had no horizontal overflow and controls >=44px.
Light and dark-token entry rendering were captured; dark-token recap/share rendering
was captured at the same widths. This browser preferred light: dark rendering used
a temporary local stylesheet enabling the existing dark media blocks, then restored
the exact normal stylesheet before final checks/publication. It is dark-token
rendering evidence, not an OS-theme-switch or physical-device test.

A stalled browser input channel interrupted further edit/cancel, new-night creation,
team save, restored-draft interaction, light recap/export and keyboard walkthrough.
These are not claimed as independent browser passes. Source handlers are unchanged
and existing automated tests pass. Physical phone, text zoom, assistive technology,
OS theme switching and the remaining interactive walkthrough are owner acceptance.
A later local cache rebuild did not fully resolve the browser-control interruption.

P03 Home/Stats/Matches shared declaration values are unchanged; Planning retains the
unchanged legacy stylesheet. No complete visual regression sweep is claimed after
the browser interruption. Hosted publication identity and read-only smoke are saved
in the ignored QA packet after CI/Vercel verification. No hosted DB writes,
Supabase settings, production changes, SQL or release gate changes are included.

## Review stop

Review lobby, Start a night form, one existing night’s entry/attendance and recap,
including selected winners, narrow scorecards and the share-card preview. Keep P05
unstarted until the owner accepts P04 and authorizes the next page.
