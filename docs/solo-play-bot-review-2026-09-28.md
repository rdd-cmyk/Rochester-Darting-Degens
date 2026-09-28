# GitHub review: retain valid unrated night activity

Personally verified the [P2 recap finding on PR #74](https://github.com/rdd-cmyk/Rochester-Darting-Degens/pull/74#discussion_r4126110382) against `1aac4b2`.
Four new calculation regressions and two component regressions failed before
the fix: valid practice, handicapped, tied and abandoned games disappeared from
the recap, reduced its game/player counts, and triggered an incorrect
incomplete-result warning.

The recap now retains every structurally valid game in chronological activity
and counts its participants. A separate competitive subset supplies standings,
rating movement and awards. Unrated games carry explicit reason labels; tied
and abandoned games display their status without inventing a winner. Share
text and image counts use all valid recorded activity. Genuinely malformed
history still produces the existing warning and award uncertainty safeguards.
Private Solo records remain in their separate consent-controlled projection.

## Verification

| Check | Result |
| --- | --- |
| Trusted pinned install | Passed; 572 packages, audit reported zero vulnerabilities |
| Full unit suite | 425 tests across 51 files passed |
| Coverage | 425 tests passed; 98.31% lines / 91.15% branches; thresholds passed |
| Lint and TypeScript | Passed |
| Isolated production build | Passed through `node scripts/solo-local.mjs build` |
| Focused production browser | Five chronological games and four unrated labels; accurate participant/share counts; no false warning or tied/abandoned winner; competitive-only standings; mobile/desktop without overflow or browser script errors |
| Diff whitespace check | Passed |

The calculation regressions compare standings, awards and rating movement
exactly with a competitive-only baseline while retaining a genuinely malformed
row. The browser check signs into the fictional loopback demo and substitutes
paginated match reads; it performs no database writes. Its first attempt lacked
the cross-origin header exposing the fixture's total count. Correcting that
test fixture produced the passing browser result. Screenshots and the fixture
script remain in ignored `.local/solo/`.

This correction changes application calculations and presentation only. No SQL,
dependency lockfile, CI workflow or hosted database changes are included.
Earlier combined-schema/API verification remains recorded in
[the rebase verification](solo-play-rebase-2026-09-28.md).
