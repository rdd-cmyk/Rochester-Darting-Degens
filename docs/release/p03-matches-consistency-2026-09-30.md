# P03 Matches consistency and copy

Status: awaiting owner review. Baseline `21f3e53` on `release/next`.
The owner accepted P02 and authorized P03 on 2026-09-30. P04 is not started.

## Shared styles and scope

Matches adopts the compact `PageHeader` for loading, signed-out and populated
states, with a stable Darts Matches title. Signed-in account context remains.
The League Night link uses `ActionLink`; native save/edit/cancel/recovery and
pagination controls use the new opt-in `ActionButton`. Their handlers, labels,
submit types and disabled/pending conditions are retained.

The opt-in `.rdd-form-fields` controls share Stats' select geometry, colors,
padding, 44px target and focus roles. Native checkboxes retain their semantics;
their labels provide a 44px target. `.rdd-content-panel` uses central panel
padding/radius/border/surface roles. Participant and history spacing consume
the central spacing scale. A central inset-panel role preserves the existing
subtle participant-card surface. The native date picker now follows the theme,
fixing its dark calendar icon on a dark input; local light QA mirrors this role.

Consumers: Home/Stats/Matches → `PageHeader` and `ActionLink`; Matches only →
`ActionButton`, `.rdd-form-fields`, `.rdd-content-panel`. Stats' control values
are unchanged when the select rule gains a second opt-in consumer. Other pages
retain their existing variants. `GameOptions` itself is unchanged; Matches
styles its rendered fields within the form scope.

No query, validation, date conversion, player/team selection, save operation ID,
correction, retry/recovery, permissions, pagination handler, SQL, dependency or
hosted configuration is changed. No production or hosted data writes are used.

## Copy review

| Copy | Decision | Reason |
| --- | --- | --- |
| Darts Matches / League play | Keep, use across access/loading states, add the shared decorative period. | Stable page identity. |
| Intro | Log the result. Follow the league’s latest games. | Brief sports context with a concrete task. |
| League Night link | Open League Night; supporting text: Shared attendance and quick rematches. | Keep the destination and benefit; avoid a sentence-long action label. |
| Notes example | Anything worth noting about this game | Notes also apply to named games; avoids implying an Other-only field. |
| Venue example | e.g. Radio Social | Clear example. |
| Form/history headings, 3DA/PPD/MPR, team fields, units and eligibility descriptions | Keep. | Preserve result/sample and team-versus-personal meanings. |
| Save/edit/cancel/retry, validation, confirmations, saved-entry and correction messages | Keep. | Failure and recovery language must stay factual. |

## Verification and limits

Trusted install, 578 tests in 73 files, coverage, lint, type-check and the
production build passed. The build was repeated after the date-control CSS
fix. Coverage: 96.53% statements / 90.90% branches / 97.76% functions / 97.59%
lines. Existing dependency findings remain in their separate release gate.

Loopback-only ignored fixtures use fictional history and disposable in-memory
save responses. Browser checks are UI evidence, not a database/RLS or durable
atomic-save rehearsal. Both themes at 320/390/768/1440px showed populated forms
and history without document overflow; visible standalone fields/actions were
at least 44px. Long names remain available in selects and history.

Checks covered invalid participant submission, selection, PPD conversion,
interrupted save with scorecard retained/locked, enabled retry, pending-disabled
button, successful retry, edit/cancel, two-page history, six-player/team
assignment and a triples save, Cricket fields and eligibility disclosure,
read-error, empty history, signed-out identity/link and keyboard field focus.
Existing tests cover correction/recovery/authorization and save contracts;
these are not new hosted DB claims. Additional doubles, correction-save and
reload recovery journeys were not independently rehearsed in this browser pass.

Sampled field text contrast was 17.77:1 light / 15.95:1 dark; control borders
3.39:1 / 4.65:1; heading eyebrow 5.79:1 / 9.47:1. Calendar color-scheme was
light/dark as appropriate. Home and Stats smoke checks passed at 390/1440px in
both themes after shared CSS changes. Their accepted appearance is retained.

Physical phone, browser zoom, assistive technology and broader release
acceptance remain human/release gates. Loading/access and alternative recovery
states retain their tested source behavior; no full accessibility claim is made.
Publication identity and preview captures are kept in the ignored
`.local/page-consistency/` QA packet. Verify CI/Vercel and perform a read-only
hosted smoke before handoff. Stop for P03 owner acceptance before P04.
