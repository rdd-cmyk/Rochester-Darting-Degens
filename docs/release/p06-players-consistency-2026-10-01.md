# P06 Players consistency and copy

Status: awaiting owner review. Baseline release/next at 8a73094.
P05 was accepted and P06 authorized on 2026-10-01. P07 remains unstarted.

## Presentation and copy

The Players directory uses the standard shared PageHeader in populated, loading,
account-error and signed-out states. Its heading is “The league lineup”, with the
approved orange terminal period. Introduction: “Meet the players, scout your next
rival, and put a face to the name.” Search says “Search players” and prompts for
nickname, first name or last name. Linked help keeps the original promise that
players without recorded matches are included. Loading/error/empty/search-empty
copy remains explicit; failures do not become empty results.

Search uses shared controls/panel roles; retry and sign-in use native ActionButton
and ActionLink. Each roster link uses shared panel padding/radius/border with
central spacing, text and hover/focus roles. The width adopts the existing 880px
form role, compared with its prior 900px cap. Avatars retain their size, rendering,
initials and cached choices; their wrapper is decorative for assistive technology
because the player name is adjacent. Primary/secondary name alignment and wrapping
remain. The directory browser title is now Players; individual-player layouts
retain their existing explicit dynamic title.

The effects, query fields, sorting, filtering, disclosure/name formatting, links,
retry counters and Auth guards are unchanged. Directory CSS has no other route
consumer; no shared token value or avatar component implementation changed.
No new SQL, dependencies, environment configuration, hosted writes or production
rollout is included. W6/W7 stay at the saved pre-consistency checkpoint.

## Verification

Required local checks passed: trusted install, 578 tests in 73 files, coverage,
lint, TypeScript and production build. Coverage: 96.53% statements, 90.90% branches,
97.76% functions and 97.59% lines. Existing directory tests retain their failed
account/read recovery, preserved search and loading/empty distinctions; assertions
were updated only to match new labels/copy. The install reports the separately
tracked one high and one critical dependency finding. The build's absent hosted
environment variables use local defaults and do not prove hosted connectivity.

Synthetic loopback browser checks: case-insensitive search returned the expected
rival, unmatched search showed a distinct no-results message, and alphabetical
rows/links retained their order. The first-name display suffix was present only
on the opted-in synthetic rival. Image and initials avatars rendered beside names.
A failed roster read kept typed search; retry recovered its matching result.
Empty roster, account-check failure/retry, loading and signed-out gates rendered.
Signing out followed the existing Auth redirect; reopening Players showed its
sign-in action. Browser console showed no errors after the completed checks.

Light and controlled dark-token rendering fit 320, 390, 768 and 1440px without
horizontal document overflow. Input and linked rows meet the 44px target floor;
long synthetic names wrap. Keyboard Tab from search focused the first roster link
with the themed focus outline. Ordinary and secondary text/eyebrow pairs were
read from the rendered styles and contrast calculations recorded in ignored QA.

Dark rendering temporarily activated local dark CSS media blocks; the exact
normal stylesheet was restored before the production build. This is controlled
theme evidence, not an OS/browser preference switch. Screenshots and synthetic
fixture details remain ignored under .local/page-consistency. Real RLS/admission,
200% browser zoom, phone keyboard and assistive-technology review remain separate
owner/final-sweep checks. No broad accessibility-conformance claim is made.

Exact published source, CI/Vercel outcome and hosted read-only smoke belong to the
ignored P06 publication packet. Owner acceptance is still pending; stop before P07.
