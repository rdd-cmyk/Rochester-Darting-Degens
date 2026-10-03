# Site-wide paired visual review

Status: saved-image review complete, 2026-09-28. This is a synthetic-browser review, not final site acceptance.

## Scope and method

The detached pre-upgrade checkout at `690a01b84d96c55b8ec455a6e298c17ec6093b50` and the candidate on `sitewide-design-upgrade` used the same invented local fixture. Headless Edge captured light and dark browser schemes at 390×844 and 1440×1000 CSS pixels. The saved sets contain 64 normal-route before/after pairs, 42 alternative-state before/after pairs, and 12 candidate-only Change Log views. Every saved image was inspected visually; the 106 matched states were compared side by side for route content, hierarchy, controls, wrapping, containment and intentional differences. The source PNGs and capture manifests remain in the ignored `.qa-artifacts/sitewide-baseline-2026-09-28/` and `.qa-artifacts/sitewide-states-2026-09-28/` directories, with task-output ZIP copies. This review did not change website code.

| Group | Saved coverage | Review result |
| --- | --- | --- |
| Normal member routes | Home, Statistics, Matches, directory, player profile, My Profile; four width/theme variants each | Expected primary content and actions remained visible. Home still places the overall leaderboard first. Match and player pages use more vertical space for readable groups. |
| Guest and secondary routes | Sign-in, verification, invalid reset, guest Change Log, diagnostic, unknown URL, guest Statistics, Matches, directory and My Profile; four variants each | Guest prompts, recovery exit, diagnostic explanation and unknown-page exits remained visible. The candidate's guest Statistics count and My Profile session state are clearer than the baseline. |
| Alternative matched states | Sign-up, Statistics no eligible players/exact history/read error, Match edit, directory no results/true empty, My Profile edit, Change Log unavailable, missing player; four variants each; open mobile menu in two themes | State-specific content, forms, feedback and navigation remained contained and readable in the saved views. Statistics read failure identifies unavailable data and offers Retry; empty and missing-content states are distinct. |
| Candidate-only Change Log | Pages 1, 2 and 3; four variants each | Invented populated cards, long code, table, privacy-safe image fallback and pagination fit the saved widths. Page 3 intentionally shows an empty page with Previous; page 2 has no Next because the fixture reports no following page. |

No new candidate clipping, missing primary action or unexpected content loss was found in this visual pass. The baseline mobile directory search hint was clipped while the candidate hint fits. The candidate's longer Match and player layouts are intentional spacing changes, not lost content. The Home fixture's five default leaderboard tables and the detailed Statistics results have separate exact DOM-value comparisons in `sitewide-validation-report.md`.

## Capture and review limits

The normal-route PNGs include a Next.js development indicator over a small portion of some screens. The alternative-state capture hides that indicator with capture-only CSS. In the original desktop exact-history full-page captures, the sticky Statistics filter bar appears over the chart because the page was scrolled to open the history disclosure before the screenshot. An addendum recaptured both builds in both themes after explicitly returning to scroll position zero. All four captures had 1440px document width within the 1440px viewport, the expanded history table, no external request or browser error, and no filter/chart overlap. The addendum is in `.qa-artifacts/sitewide-states-2026-09-28/exact-history-top/` and the task-output review ZIP.

Desktop side-by-side composites were reduced for review, so this pass checks visible layout and content rather than pixel-level detail or every contrast ratio. Capture manifests reported no document overflow or external requests, but saved images cannot prove keyboard use, browser zoom, operating-system theme switching, real auth, durable database writes, creator permissions, Row Level Security or the candidate's real GitHub-backed Change Log. Those acceptance gates remain open in the plan and validation report.
