# League poll availability review — October 4, 2026

An independent agent reviewed the new date availability voting, result visibility, scheduling support, SQL authorization and compatibility. Two P2 application issues were reported and independently reproduced with failing regressions against the committed component.

1. A confirmed save followed by an interrupted feed refresh displayed the old ballot. The page now reconciles the confirmed submitted ballot immediately, while keeping the refresh error visible.
2. Recovery of an uncertain save through Check / retry saved request falsely treated the originating draft as a change on another device. Confirmation now matches the poll, submitted revision, venue selections and date responses. Matching drafts become saved; unrelated drafts keep their conflict protection.

Reconciliation never replaces a newer loaded ballot with an older replay. Submission and confirmation use the same filtered option snapshot. Venue checkboxes and member result visibility retain their existing behavior.

The independent agent reviewed the fixes and found no verified remaining issue. No database migration or hosted data changes were needed for these fixes. Production was not changed.

Validation: locked dependency install; all 674 tests across 85 files; coverage thresholds; lint; TypeScript; production build. Focused planning tests: 31 passing. Local browser checks with synthetic data passed at 1440, 390 and 320 pixels in light and dark themes: member privacy, availability and venue submission, organizer counts, closed result visibility and attendance-first scheduling. Browser checks are local verification, not physical-device or owner acceptance.
