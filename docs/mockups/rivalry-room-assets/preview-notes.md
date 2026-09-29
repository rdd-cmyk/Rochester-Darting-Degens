# Rivalry Room — first interactive concept

Date: 2026-09-28. Design preview only; fictional people/results. No application,
database, dependency, membership, or hosted changes.

## Open and explore

- Editable inline source: [rivalry-room.html](../rivalry-room.html).
- Standalone browser preview: [rivalry-room-preview.html](../rivalry-room-preview.html).
- Use the profile control to choose one of six cartoon avatars.
- Select another opponent, inspect head-to-head results, send a demo challenge,
  accept as the opponent, and use the demo win buttons to reach a final result.
- Try TV view and the result-card preview. No messages are sent; results and
  avatar changes exist only in the preview. The result card does not export yet.
- Fullscreen TV is a page presentation in the mockup, not an automatic browser
  fullscreen request. The site navigation outside Rivalries is illustrative.

The roster is a single sheet with CSS positioning for the art pilot only.
Production will use individually reviewed avatar assets as the plan specifies.
The six characters were generated together to judge a coherent art direction;
this is not a completed 24-avatar production library.

## Art files and provenance

Built-in `image_gen` was used; no API key, CLI model, or user reference photos.
The selected source is [avatar-pilot-original.png](avatar-pilot-original.png).
It has a 1536 × 1024 RGBA canvas with verified alpha values including zero.
[avatar-pilot.webp](avatar-pilot.webp) is the same artwork encoded with Sharp
at quality 82 for the mockup, without cropping, compositing, or visual edits.
It is embedded into the inline source so the preview needs no local asset server.
The generated [cutout variant](avatar-pilot-cutout.png) was retained as an
alternate; the original rendered with the intended transparency and is used.
Source masters remain unchanged. Generated art is a review candidate, not a
claim of final production acceptance.

### Original prompt

Use case: stylized-concept. Asset type: a six-character avatar art pilot sheet for the Rochester Darting Degens private darts league's Rivalry Room website. Create exactly six original illustrated sports mascot portraits arranged in a perfectly aligned 3-column by 2-row grid of equal square cells, with transparent background everywhere between and behind characters. Canvas landscape 3:2. Top row left to right: confident grey raccoon in orange darts jersey, focused copper fox in cream and navy darts jersey, determined charcoal bull in dark navy jersey. Bottom row left to right: wise tan owl in orange jersey, friendly retro silver robot in cream/navy jersey, cheerful ivory skeleton in navy/orange jersey. Each character is a centered head-and-upper-chest portrait filling about 82 percent of its square cell, exact same scale, eye line and bottom crop, full ears/horns safely inside each cell; cleanly separated with generous transparent margins, no overlapping adjacent cells. Stylish premium hand-inked cartoon sports illustration: bold charcoal contours, angular expressive shapes, painterly cel shading, controlled screenprint texture, warm cream highlights, confident playful personalities, contemporary collectible player-card quality, mature and cool but friendly. Shared visual language across all six. Warm orange, deep Rochester navy, cream, silver palette with natural animal fur colors. Mild three-quarter poses, no extreme side profiles. No hands, no dart props, no frames, no badges, no words, no numbers, no labels, no watermarks, no background scene. True transparent alpha, not a checkerboard.

### Targeted edit prompt

Edit this exact six-character avatar sheet. Remove ALL brown/grey/orange blurred background behind and between the six characters and replace it with actual transparent alpha. Keep the six characters, their clothes, face details, arrangement, cell positions, scale, outlines and colors unchanged. Preserve the existing 3 columns by 2 rows grid and exact canvas dimensions. Do not add shadows, glows, backgrounds, checkerboard pixels, text or labels. Only background removal; every area not part of a character must be fully transparent. Keep crisp anti-aliased character edges.

## Verification

Local Edge/Playwright review covered 320, 390, 768, 1024, and 1440 px browser
widths, dark/light appearance, and reduced motion. Checked for horizontal
overflow, JavaScript errors, avatar selection, rival switching, the head-to-head
tab, changed challenge terms, acceptance, sample game progression, completion,
result-card preview, TV view, and resetting the preview. Focused browser checks
apply to this synthetic mockup only; they do not validate application or hosted
behavior. Saved screenshots are visual evidence, not production acceptance.

A first browser startup was blocked by the filesystem/process sandbox; the
approved headless run used an isolated temporary browser profile. An initial
TV visibility assertion was timing-sensitive. Panel reveals now scroll
immediately, and the final check waits for actual visibility.

## Next review

Review the character style, poster intensity, mobile hierarchy, and the
challenge flow. The current mockup uses the same six-character art pilot in
profiles and matchup cards. Pending/rejection/error, no-history, revoked-access,
correction, and schedule-reconfirmation states remain planned implementation
and mockup follow-ups; they are not represented as verified here.
