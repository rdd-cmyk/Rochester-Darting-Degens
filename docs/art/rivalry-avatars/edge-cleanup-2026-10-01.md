## Portrait edge cleanup — 2026-10-01

The owner accepted the visual polish and focused Machine. Alien (Anomaly) and
Red Panda (Wildcard) needed removal of neighboring artwork at their edges.
Built-in image_gen produced standalone transparent cleanup masters:

- `alien-v2.png`: `exec-ccea7323-01b8-4c98-b090-7e46ef317cb0.png`.
- `red-panda-v2.png`: `exec-fa03b2bc-9179-46cb-99f8-49dd087d7286.png`.

The original pack-c sheet is preserved. Stable IDs and labels are unchanged.
All three production sizes use the new masters. Cleanup appearance is pending
owner review. Routine Sharp exports do not repaint the generated artwork.

Alien prompt: Edit target: the supplied green Alien darts-league avatar. Precise cleanup only: remove every stray cut-off fragment of neighboring characters at the far left and far right, including the pink sliver on the left and dark blue fragment on the right. Isolate ONLY the central green alien and its existing cream/navy/orange jersey, with true transparent alpha in all space outside that character. Remove the brown/green surrounding backdrop remnants. Preserve the alien's exact face, clever competitive expression, antennae, black eyes, three-quarter pose facing right, jersey, ink lines, colors, shading, chest-up crop and scale. Do not redesign, add details, crop antennae, change expression or add another character. Keep one clean centered square avatar with transparent safe margin around the top and sides; torso ends at bottom. No text, frame, extra character or watermark.

Red Panda prompt: Edit target: the supplied Red Panda darts-league avatar. Precise cleanup only: remove the tiny stray fragment of an adjacent avatar along the far right edge and any other disconnected neighboring-character pixels. Isolate ONLY the central red panda with its existing cream/navy/orange jersey, with true transparent alpha in all space outside its silhouette. Remove surrounding brown backdrop remnants. Preserve the red panda's exact furry silhouette, cream/red markings, ears, amber eyes, confident focused smirk, pose facing right, jersey, hand-inked outlines, colors, shading, chest-up crop and artwork scale. Do not redesign, change its expression, crop ears or add details. One clean centered square portrait with transparent safe margin at top and sides, torso ends at bottom. No text, frame, extra character or watermark.

Two Machine concepts (Modern Precision and Forged Champion) were generated
for comparison only and saved under ignored `.local/avatar-studies/2026-10-01/`
with prompts and original PNGs. Neither is installed, exported to public assets,
or offered by the catalog. The accepted `robot-v2.png` and Machine exports stay
unchanged.

Local verification: exporter rebuilt all 24 portraits; only the six Alien/
Red Panda public files changed. All six retain transparent alpha and the
expected 512/256/96 square dimensions; hero and thumbnail exports were inspected.
Machine master/exports are unchanged. Three catalog tests and lint passed.
No application logic, SQL or dependency changes; the previous full application
gate remains the baseline, with exact-commit CI checked on publication.
