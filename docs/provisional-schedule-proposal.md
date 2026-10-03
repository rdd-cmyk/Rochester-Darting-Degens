# Provisional opponent replacement for schedule strength

Date: 2026-10-01. Status: implementation authorized by the owner on October 1.
The rules below are the implementation contract. See
[implementation evidence](release/provisional-schedule-2026-10-01.md) for checks
and acceptance boundaries.

Base: `release/next` at `a5dbf31cda1ac7bfee004d95d8fe7b7d42c5773b`, verified equal to `origin/release/next` after fetching on October 1. Implementation should recheck the branch tip and preserve subsequent accepted work.

This proposal changes Schedule on Advanced Statistics to correct uncertain starting opponent ratings once those opponents become established. It preserves the rating estimate at match time for established opponents, so later growth or slumps do not continually rewrite earlier schedule strength. Power-rating updates and all other competitive metrics retain their current calculations.

## Calculation rules

For every analyzed match, record each participant's pre-match rating and whether they were provisional immediately before that match. Provisional status follows the existing ten-evidence-game threshold: singles and free-for-all appearances contribute one, doubles one-half, and triples one-third. Reuse the engine's floating-point tolerance when checking the threshold.

For each opponent appearance, select its schedule contribution as follows:

| Opponent status before the match | Contribution |
| --- | --- |
| Established | Their pre-match rating for that match. |
| Provisional, and later graduates within the analyzed history | Their rating immediately after the first match that reaches ten evidence games. |
| Provisional, and has not graduated within the analyzed history | Their original pre-match rating for that match, until graduation supplies a replacement. |

The graduation match itself qualifies for replacement because the opponent was provisional before it. Later matches use their ordinary pre-match ratings. Capture the graduation rating once per calculation; later rating changes must not overwrite it.

Keep the current averaging rules: average the selected ratings of the opposing participants within each match, then average those match values equally across the player's appearances. Team members on the player's own side remain excluded. Repeat encounters count separately. This introduces neither recency weighting nor WIN50.

Example: Ben faces provisional Tim in Tim's first game at 1500. Tim later graduates at 1700, so that early encounter contributes 1700 to Ben's Schedule. An encounter after graduation with Tim rated 1760 contributes 1760. If these are Ben's only two matches, Schedule is 1730. Tim subsequently reaching 2100 does not change either contribution.

## Filters and historical corrections

Preserve the current Stats filtering contract. Game, board, format, and score-cohort filters select the facts supplied to the engine; ratings and graduation are calculated within that selected history. An opponent may therefore be established in All but provisional in a narrower view. The minimum-games control only filters displayed players and must not change graduation or schedule contributions.

Do not borrow a graduation rating from outside the selected history. Doing so would mix rating scales and alter the existing filter behavior. A future decision to use global ratings across filters would be a separate proposal.

Graduation is derived from canonical match history, with the existing chronological ordering and match-ID tie-breaker. Edits, deletions, or backdated matches can change the graduation match and its rating when history is recomputed. Fixed means unaffected by later chronological results, not immune to corrections of the underlying history. No database snapshot or persisted graduation record is needed.

## Benefits and limitations

This corrects part of the initial 1500 uncertainty while keeping established-player growth and slumps tied to the dates when they occurred. Historical contributions settle after an opponent graduates, and an early encounter continues to count even if those players never meet again.

The graduation rating can still be inaccurate. A streak near the threshold can leave a lasting bias, and real improvement during the provisional period is partly applied backward. Schedule can jump when an opponent graduates, including for players who have not played recently. Opponents who never graduate retain uncertain pre-match contributions. These are accepted tradeoffs of the proposed rule, rather than claims that ten evidence games establish a player's true ability.

## Implementation outline

1. In `lib/stats/engine.ts`, retain schedule appearance records containing opponent IDs, their pre-match ratings, and their pre-match provisional flags while performing the existing rating replay.
2. After each match's normal rating updates and evidence increments, capture the first graduation rating for each participant crossing the existing threshold.
3. After the replay, resolve the schedule records using the table above and calculate `strengthOfSchedule`. Keep the public numeric field and display rounding unchanged.
4. Update the existing Stats methodology disclosure and the roadmap's Schedule definition. Suggested copy: "Schedule averages your opponents' ratings before each match. For opponents who were provisional, we replace that estimate with their rating when they first reach ten evidence games. Until they reach that point, their original pre-match rating is used. This is calculated within your selected filters."

Use the existing disclosure and shared design standards. The interface change is explanatory copy; it does not require a new layout or control.

## Verification and acceptance

Add meaningful calculation regressions for graduation replacement, the graduation match boundary, non-graduating opponents, and later results leaving established historical contributions fixed. Cover mixed provisional and established opponents, opposing-side selection in doubles/triples, fractional evidence at graduation, repeated opponents, and participant-order independence. Verify narrower histories and minimum-games display filtering separately. Test historical corrections moving the graduation point.

Use a sufficiently long fixture where replacement actually changes Schedule. Compare the old and new outputs to prove that only `strengthOfSchedule` changes: power ratings and history, ranking, expected wins, win delta, quality wins, upset probabilities, form, evidence totals, score distributions, and match eligibility must remain equivalent.

Run the repository's required application checks before committing implementation: trusted install, tests, coverage, lint, typecheck, and build. Review the changed disclosure and populated Schedule table on the isolated Preview, including mobile and both themes. Record owner acceptance separately from automated verification. Local implementation checks are now recorded in the linked implementation evidence; isolated Preview and owner acceptance remain open.

## Release package impact

The original release scope preserved statistics calculations. The owner has now
authorized this scoped application amendment. Production approval remains a
separate W7/W8 decision.

| Package | Required follow-up if implemented |
| --- | --- |
| W0 | Add the calculation amendment and refresh candidate identity. Preserve original manifests. |
| W1 | Environment and isolation evidence remains applicable; verify the updated Preview targets the same isolated project. |
| W2 | Future storage and permissions evidence remains applicable. No SQL, schema, or stored-match changes are proposed. |
| W3 | Add focused calculation regressions and refresh affected combined application evidence. No database-chain rerun is required solely for this calculation. |
| W4 | Backup and restore proof remains applicable. Existing fresh-cutover-backup requirements remain. |
| W5 | Preserve dated SQL, data-preservation, and migration evidence. Refresh affected application checks and the final compatible rollback artifact. |
| W6 | Review Schedule values, graduation behavior, filters, and explanation on the updated isolated Preview. Other accepted journeys retain their scoped evidence. |
| W7 | Include the new exact application SHA, verification, acceptance, and compatible rollback artifact in the final packet. Existing final-chain gates remain. |
| W8 | Verify the released calculation during application acceptance; no extra database step is introduced. |

The existing W6 SQL supplements and final W7 rehearsal requirements remain independent obligations. Preserve earlier dated evidence and append results for the changed candidate rather than rewriting previous passes.

## Source references

- [Current release plan](release-next-readiness.md)
- [W2 storage completion](release/w2-statistics-foundation-2026-09-29.md)
- [Statistics engine](../lib/stats/engine.ts)
- [Stats page and filters](../app/stats/page.tsx)
- [Statistics roadmap](advanced-statistics-roadmap.md)
- [Design standards](design-standards.md)
