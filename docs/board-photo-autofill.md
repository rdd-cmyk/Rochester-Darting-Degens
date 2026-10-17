# Board photo autofill

Prepared 2026-10-17 on `feat/board-photo-autofill`, from refreshed `main` at
`0ffa7b9`. This is a match-entry convenience feature; it does not introduce
new scoring measurements or change the save transaction.

## Player behavior

Matches and League Night offer **Read board photo**. Choose the game, format,
participants, team assignments and winner/result in the match form first.
Select a JPEG, PNG or WebP, crop/rotate if needed, then read and review it.
Assign the displayed board columns to league players or shared Team A/B
results. Confirm each assigned column and preview the changes. Replacing
populated fields requires a separate checkbox. **Fill match form** leaves
saving to the existing Save action.

The adapter targets G3 two- and three-column screens. It preserves recognized
Player 1/2/3 and X/O headings; unreadable headings remain explicitly unnamed
columns for manual assignment. No game, winner, rule preset or player identity
is inferred. The example images' game modes remain unknown.

For X01, displayed PPR is used directly as 3DA, avoiding rounded-PPD errors
such as 17.71 × 3 versus the displayed 53.12. PPD × 3 is available only if
the PPR row is absent, and the review labels it calculated. Cricket uses MPR;
missing values stay blank and numeric zero stays zero. If Points and Score
both exist, the recorder must choose the appropriate row. Games recorded as
darts to finish accept that count only for a confirmed finisher.

Team formats use the existing 2v2/3v3 roster validation. Shared results go
only to `game_config.teamScores`; they are never duplicated into personal
stats. Personal averages can still be assigned to individual teammates. There
is no separate shared-team Cricket-points field, so those points cannot be
imported. Individual photos can be scanned successively to fill other players.

## Local processing and assets

Tesseract.js 7.0.0 and the matching 7.0.0 LSTM core variants are pinned. Worker,
embedded WebAssembly and English language data are served from `/ocr/v7/`.
The English data is `@tesseract.js-data/eng@1.0.0/4.0.0_best_int`; SHA-256
values and upstream versions are recorded in `public/ocr/v7/assets.json`.
The asset test compares shipped worker/core bundles with installed packages
and checks every recorded hash. License files accompany these upstream assets.
The local `/ocr/board-worker.js` lifecycle wrapper imports the unchanged pinned
worker and accepts only a per-scan stop message. This also disposes workers
during initialization; failures, cancellation and the 60-second deadline leave
the form editable. It carries no photo or OCR data. The optional upstream
donation postinstall is explicitly denied in
`allowScripts`; it is not needed to run OCR.

Images are limited to 25 MB and 65 megapixels, downscaled to a 2600-pixel
working canvas, and retained only in the component's memory. No recognition
endpoint, external OCR service, photograph upload, filename telemetry or OCR
storage is added. Only public language data uses the OCR model cache. The
existing site still needs its normal network connection for sign-in and saves;
this feature does not make the whole site available offline.

Preparation isolates white/green text and removes connected grid lines.
Extraction locates headings and row labels from OCR boxes, accounts for mild
perspective, and retries uncertain cells against the original working image.
Slash-like digit artifacts are accepted only with a unique, consistent
per-dart/per-three-dart pair and remain flagged for review. Unsupported screens
offer crop/retry or normal manual entry.

Closing, cancelling, changing the match context, or locking the entry for a
pending save invalidates outstanding scans. Applying values uses the existing
draft/recovery paths and clears obsolete correction previews. Date, venue,
notes, rules and eligibility settings are not inferred from the photo.

No database/API changes or enhanced-stat storage are included. Dedicated photo
provenance is not persisted by the current save contract. Achievement counts,
marks and rounds are diagnostic review information, not new saved metrics.

## Photo evidence

The seven supplied originals stay outside source control and public assets.
`lib/board-photo/fixtures/g3-photos.json` annotates visible labels/numbers with
unknown game modes; `ocr-words.json` retains only relevant OCR tokens/boxes for
parser regression tests. These are evaluation fixtures, not model training.

The local evaluator shares the browser's mask and scan implementation. It uses
Sharp to decode/resize the private originals and a manual table crop retaining
15–90% vertically. Browser decoding can differ slightly, so these measurements
are not an accuracy guarantee on every phone or new photograph.

| Photo, in supplied order | Exact core numeric cells | Unflagged incorrect cells |
| --- | ---: | ---: |
| 1 | 10 / 10 | 0 |
| 2 | 15 / 15 | 0 |
| 3 | 15 / 15 | 0 |
| 4 | 12 / 12 | 0 |
| 5 | 11 / 12 | 0 |
| 6 | 9 / 15 | 0 |
| 7 | 27 / 27 | 0 |
| **Total** | **99 / 106 (93.4%)** | **0** |

The denominator includes core numeric readouts (Points, Score, Marks, Darts,
Rounds and paired averages), even where a selected game cannot import that
measurement. All seven non-exact cells are uncertain/unreadable. Real team
screen accuracy remains unverified because no representative team photos were
provided; team mappings are tested with synthetic data.

Reproduce the private-image check with Node 24, after the locked install:

```powershell
node scripts/qa/board-photo.mjs <private-photo-directory>
```

Results and temporary images go to ignored `.local/board-photo/`. The command
fails below 90% numeric accuracy or on any unflagged incorrect cell. Its
`RDD_OCR_PHOTO` (zero-based index) and `RDD_OCR_WIDTH` overrides are diagnostic
options, not production settings.

## Verification and release

Focused tests cover extraction, rounding, absent/zero values, source ambiguity,
validation, team rosters/storage, cancellation, stale responses, overwrite
confirmation, worker cleanup, same-origin paths and both editor adapters.
The browser successfully read photo 3's displayed 53.12 / 52.20 / 51.64
averages and filled the synthetic draft only after assignment and confirmation.
The local preview uses no hosted data or external telemetry. It is a synthetic
component review; authenticated hosted saving is not claimed as verified.

Full installation, suite, coverage, lint, typecheck, build and preview/CI status
are recorded in the draft PR's Testing section. Production deployment and
merging are outside this implementation handoff.

Local gates passed: clean `ci:install` (including install-script approvals),
733 tests in 92 files, coverage (95.88% lines, 88.29% branches), lint and
typecheck. The initial 31-worker production build hit Windows EPERM while
creating generated page directories; the same build passed with
`CIRCLE_NODE_TOTAL=3` (two workers), without source/config changes. Temporary
synthetic preview routes were removed before these release checks. No hosted
database, authentication or data mutation was performed.

The synthetic component was exercised in the browser with the full-size third
photo, confirming displayed-average preservation, manual player assignment,
replacement confirmation and separate saving. Narrow 320px/390px iframe views
showed no horizontal document overflow. Dark appearance and light CSS roles
were reviewed; the light QA view disabled dark media rules locally rather than
changing system preferences. Physical iOS/Android camera capture and 200% zoom
acceptance remain unverified.

An isolated browser check ran the same reader modules with external connections
blocked by Content Security Policy. Recognition completed with the expected
53.12 / 52.20 / 51.64 values. The local server recorded only GET requests for
the test fixture, modules and same-origin OCR assets, all with zero request-body
bytes; no image upload was made. This verifies the OCR path independently of
site telemetry.

The dependency audit currently reports eight high findings in existing
Next/ESLint/Sharp-related chains. No OCR package is flagged. Those existing
package versions are unchanged; this feature does not silently modernize them.
