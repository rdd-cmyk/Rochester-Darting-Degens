# Rivalry avatar production manifest

Generated on 2026-09-28 (America/New_York) with the built-in image_gen tool. No user photographs, runtime AI, external API credential, or image-generation feature is shipped.

The owner accepted the six-character visual direction by requesting implementation. The expanded roster is available for final owner visual acceptance. All four 1536 x 1024 masters have alpha minimum 0. Source PNGs stay in this directory; public assets are individual transparent WebP files, not sprite sheets. The exporter preserves character artwork and makes routine crops/resizes only.

- Pilot master: pilot.png; original selected pilot and its prompt are preserved in ../../mockups/rivalry-room-assets/preview-notes.md. The original chosen output was exec-afc199a1-cace-4f3c-a5b1-67ca4ae35b90.png.
- pack-b.png: original exec-d8fd8385-51f4-4b37-8184-74ac0a253c9b.png.
- pack-c.png: original exec-0082837d-e7d6-4730-9ebc-5ce81c4c59dc.png.
- pack-d.png: original exec-c6afd974-5e01-47b8-9a59-4d0a2451378b.png.

All originals remain in the generation tool's output folder. The alternative background-removal pilot remains in the mockup folder and is not selected for production. The original sheets are preserved; the individual wolf replacement below takes precedence over its original pack-c cell.

## Wolf correction — 2026-09-30

The original wolf portrait looked like a raccoon. `wolf-v2.png` replaces it using the built-in image_gen tool, referenced against the previous `public/avatars/wolf.webp`. Original output: `exec-7c37ec81-7da0-4b06-a946-a782afcca04c.png`. The exporter uses this standalone transparent master for all three wolf sizes, preserves the stable `wolf` ID, and records version 2 in the catalog. Locally inspected; owner final visual acceptance pending.

Prompt: Edit target: the provided avatar. Replace the raccoon-like animal with an unmistakable grey WOLF sports mascot. Long pronounced canine muzzle, strong angular jaw, grey fur with cream muzzle and throat, pointed upright ears, amber eyes, NO raccoon eye mask or striped facial markings. Preserve the original hand-inked cartoon style, bold charcoal outlines, painterly cel shading, friendly confident smirk, three-quarter head pose, chest-up composition, orange/navy/cream jersey, and uniform details. Single centered square avatar, ears fully inside frame with safe transparent margin, torso cropped at bottom. True transparent background. No lettering, props, frames or watermark. Match the existing roster's scale and illustration quality.

[Catalog](catalog.json) records stable IDs, labels, source/cell, availability, version, provenance and dimensions. [Exporter](../../../scripts/export-rivalry-avatars.mjs) rebuilds 512 px hero, 256 px profile and 96 px list variants. The shared renderer falls back to initials for unknown IDs or failed image loads. Multiple members may select the same avatar. Retirement should mark server selectability false and preserve the ID and files for existing selections.

## Production prompts

### Three approved additions — 2026-10-05

The owner approved Sharp Shooter (cactus, cream jersey), Big Finish (gorilla,
navy jersey), and Hot Streak (dragon, orange jersey). The local roster now has
27 choices. Selected masters, built-in image_gen provenance and prompts are
recorded in [the artwork handoff](three-player-avatars-2026-10-05.md).
See [release steps and verification](../../three-player-avatars-release-2026-10-05.md)
for the required existing-database catalog insert before application deployment.

### Machine expression correction — 2026-10-01

`robot-v2.png` is the selected standalone transparent master from built-in
image_gen output `exec-45b0f9c1-12c5-4172-a4c2-0aaf475da745.png`. The original
pilot sheet and tool output are preserved. The exporter gives it precedence
for all three public sizes while preserving the stable `robot` ID. Locally
inspected; owner final appearance acceptance pending. The lion's display label
is now King; its `lion` ID and artwork are unchanged.

Prompt: Edit the provided Machine robot darts-league avatar. Give the same robot
a quietly competitive, focused game-face: slightly narrowed glowing orange eyes
with subtle angled metallic brow ridges and a restrained confident asymmetric
smirk instead of the wide cheerful smile. Keep it appealing and approachable,
never evil, frightening or grotesque. Preserve its silver retro robot identity,
round orange eyes, headphone-like ears with orange antenna tips, three-quarter
head pose facing right, cream/navy/orange jersey and uniform details, hand-inked
dark outlines, painterly cel shading, controlled print texture, chest-up square
composition and artwork scale. One centered portrait with safe transparent
margin and bottom torso crop. True transparent alpha outside the robot; remove
the brown/grey backdrop. No text, props, frame, watermark, extra characters or
scenery. Generated with the built-in tool; exports are routine Sharp resizes.

### pack-b

Use the provided six-character sheet ONLY as an art-style reference, not an edit target. Create a NEW six-character avatar production sheet for the Rochester Darting Degens darts league. Exactly 3 columns by 2 rows, landscape 1536 by 1024, six equal 512-square cells. Each portrait centered in its cell, all ears/horns/details and body silhouette inside the cell with at least 20 pixels of safe transparent margin on left/right/top, chest-up crop at bottom of cell. Exact same framing, scale, eye line, lighting and hand-inked cartoon illustration quality as the reference: bold charcoal outlines, painterly cel shading, angular sports mascot shapes, controlled print texture, expressive friendly confident personalities, orange/navy/cream uniforms. Original designs. True transparent alpha everywhere behind and between the six characters. No gradients or background scenes. No hands, props, lettering, numerals, badges, trademarks, frames or watermarks. Characters in left-to-right top row then bottom row order: a confident badger in orange jersey; a cool black panther in cream/navy jersey; a determined brown bear in navy jersey; a relaxed green crocodile in orange jersey; a clever purple octopus in cream/navy jersey; an energetic white rabbit in navy/orange jersey

### pack-c

Use the provided six-character sheet ONLY as an art-style reference, not an edit target. Create a NEW six-character avatar production sheet for the Rochester Darting Degens darts league. Exactly 3 columns by 2 rows, landscape 1536 by 1024, six equal 512-square cells. Each portrait centered in its cell, all ears/horns/details and body silhouette inside the cell with at least 20 pixels of safe transparent margin on left/right/top, chest-up crop at bottom of cell. Exact same framing, scale, eye line, lighting and hand-inked cartoon illustration quality as the reference: bold charcoal outlines, painterly cel shading, angular sports mascot shapes, controlled print texture, expressive friendly confident personalities, orange/navy/cream uniforms. Original designs. True transparent alpha everywhere behind and between the six characters. No gradients or background scenes. No hands, props, lettering, numerals, badges, trademarks, frames or watermarks. Characters in left-to-right top row then bottom row order: a fearless grey wolf in orange/navy jersey; a charming red panda in cream/navy jersey; a focused brown eagle in navy jersey; a cheeky pink pig in orange jersey; a happy green alien in cream/navy jersey; a friendly blue shark in navy/orange jersey

### pack-d

Use the provided six-character sheet ONLY as an art-style reference, not an edit target. Create a NEW six-character avatar production sheet for the Rochester Darting Degens darts league. Exactly 3 columns by 2 rows, landscape 1536 by 1024, six equal 512-square cells. Each portrait centered in its cell, all ears/horns/details and body silhouette inside the cell with at least 20 pixels of safe transparent margin on left/right/top, chest-up crop at bottom of cell. Exact same framing, scale, eye line, lighting and hand-inked cartoon illustration quality as the reference: bold charcoal outlines, painterly cel shading, angular sports mascot shapes, controlled print texture, expressive friendly confident personalities, orange/navy/cream uniforms. Original designs. True transparent alpha everywhere behind and between the six characters. No gradients or background scenes. No hands, props, lettering, numerals, badges, trademarks, frames or watermarks. Characters in left-to-right top row then bottom row order: a determined orange tiger in orange/navy jersey; a playful cream bulldog in cream/navy jersey; a cool black-and-white penguin in navy jersey; a confident golden lion in orange jersey; a wise tortoise in cream/navy jersey; a mischievous grey cat in navy/orange jersey
