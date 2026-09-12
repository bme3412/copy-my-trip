# Stitch frontend adaptation

Reference: https://stitch.withgoogle.com/projects/12127019354509204378
Implemented and verified locally on 12 September 2026. Not deployed.

## Visual direction

Adapted the photo-led multi-city design: warm ivory, navy and rust; Newsreader headings, Inter body text and JetBrains Mono metadata; spacious hero, framed archive photograph, three sample cards, a short explanation, call to action and footer. Fonts are self-hosted as compressed WOFF2 files with their open-source licenses.

The same tokens now style the navigation, planner, saved-day cards, itinerary timeline, route summary, briefing and alternatives screens. Mobile layouts stack the content. Archive photographs retain their natural colors. Navigation includes a keyboard skip link and router scroll restoration.

Paris uses actual archive photographs and capture dates. The three featured moments are drawn from the curated Marais/islands day, with explicit sample-timing and historical-photo labels. Rome uses researched places and a typographic cover because it has no firsthand imagery. Only Paris and Rome appear in the city selector. No claims of live verification, offline maps, guaranteed walking times or automatically verified closures were added.

## Files

- `app/src/pages/Home.tsx`: collection homepage and city switcher; presentation only.
- `app/src/components/Layout.tsx`: book mark, shared navigation, heading labels, skip link and scroll restoration.
- `app/src/styles/classical.css`: shared warm palette and typography tokens.
- `app/src/styles/app.css`: existing workspace color rules retuned to the shared tokens.
- `app/src/styles/editorial.css`: editorial homepage, shared finishing styles and responsive rules.
- `app/src/styles/fonts.css`, `app/public/fonts/`: local font faces and licenses.
- `app/src/main.tsx`: stylesheet imports.
- `app/scripts/route-smoke.tsx`, `app/package.json`: current homepage assertions and Vite environment definition for the existing Node route smoke test.

## Verification

- Production build, TypeScript and API runtime checks passed.
- All 19 existing route/render/redirect smoke cases passed.
- 16 companion checks and 14 alternatives checks passed: saved schedules, replay, explicit acceptance and retained history remain protected.
- Browser checked at desktop 1280px, tablet 820px and phone 390px. Home, planner, saved trip, itinerary and briefing fit the phone viewport without horizontal overflow.
- Verified all four Paris homepage images loaded; Paris/Rome switching and sample-day anchor work.
- Direct alternatives page loads and produces three local simulated options. No alternative was accepted during styling verification.
- No browser console errors on the inspected homepage/workspace. The direct lazy alternatives route still emits the existing React Router hydration-fallback warning before rendering; this does not prevent the preview from loading.
- Fixed mobile overflow caused by the older fixed-height hero photo rule and verified route navigation returns to the top.
- Production build still reports the existing large Mapbox/application chunk advisory; this visual update does not redesign bundling.

Screenshots: `artifacts/editorial/home-desktop.png`, `home-mobile.png`, `home-tablet.png`, and `sample-cards-desktop.png`.

## Scope boundary

No catalog records, saved-trip schema, acceptance logic, cloud resources, database migrations, weather configuration or production deployment changed. The next functional milestone remains cloud-backed alternatives and rollout hardening from plan 20, with traveler-facing AI editing and scoped MCP afterward.
