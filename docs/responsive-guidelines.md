# Mobile-first responsiveness without harming desktop layouts

These guidelines apply across the app (home, matches, profiles, auth, leaderboards) to keep pages readable on phones while preserving the current desktop experience.

## Layout and spacing
- Prefer responsive utility classes (e.g., Tailwind) or breakpoint-based CSS modules over inline pixel values. Files that still use inline styles—such as `app/auth/page.tsx`, `app/profiles/[id]/page.tsx`, and portions of `app/matches/page.tsx`—should migrate to classes so paddings/margins can shrink at small widths while remaining unchanged on large screens.
- Use a single column flow with vertical gaps on mobile, then reintroduce multi-column grids at `md`/`lg` breakpoints for areas like the home hero (`app/page.tsx`) and match cards.
- Keep touch targets ≥44px high; scale paddings via responsive classes so buttons/links (e.g., “Back to matches” in `app/profiles/[id]/page.tsx` and auth submit buttons) stay tappable on phones.

## Tables and data density
- Retain existing desktop tables for stats-heavy sections (leaderboards on `app/page.tsx`, match lists on `app/matches/page.tsx`) but provide mobile alternatives:
  - Stack each row into a card with label/value pairs at small breakpoints.
  - Allow horizontal scrolling only as a fallback, not the primary mobile pattern.
- Keep numeric columns right-aligned and add subtle separators or background stripes for readability in both modes.

## Forms and auth
- In `app/auth/page.tsx`, stack label/input pairs vertically on mobile; switch to two-column label layouts only on medium screens and up. Use responsive width utilities so inputs naturally fill small viewports.
- Surface validation and success messages with clear spacing and high contrast; avoid absolute positioning that can overlap on short screens.

## Profile and match details
- For profile and match detail pages (`app/profiles/[id]/page.tsx` and `app/matches/page.tsx`):
  - Wrap stats blocks and metadata in cards that can collapse into a single column on mobile while retaining the side-by-side layout on desktop.
  - Ensure player lists inside matches use flex/stack layouts so long names wrap gracefully without forcing horizontal scroll.
  - Keep date/venue metadata grouped at the top of each card for quick scanning on mobile.

## Navigation and typography
- Use the global font/color tokens defined in `app/globals.css` for consistent text sizing and contrast; adjust only the `font-size` scale at mobile breakpoints instead of swapping fonts.
- Keep navigation and call-to-action links consistently styled between pages (home hero, auth, matches) by reusing shared button/link classes rather than per-page inline styles.

## Testing checklist
- Test the home page, auth, matches, and profile routes at 320px–768px widths to confirm:
  - No horizontal overflow occurs.
  - Tables have a stacked fallback.
  - Buttons and links remain comfortably tappable.
  - Typography remains legible and consistent.
