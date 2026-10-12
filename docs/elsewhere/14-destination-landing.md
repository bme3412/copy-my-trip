# 14 — Destination landing page

October 11, 2026. Removed the Paris hero's Explore Paris / Plan a visit buttons and three-count statistics strip. Lower-page planner navigation remains. The user approved showing all 15 reference cities, with unavailable destinations clearly marked Coming soon.

`/discover` now opens a destination directory with a dark original-Paris-photo hero, working city/country search, Books/Films/archive shortcuts and 15 city cards. Paris and Rome open real destination pages; the other 13 are non-interactive Coming soon articles with no invented destination routes. Original typographic artwork is used where approved photography is unavailable. No external image rights or stock-photo provenance is implied.

Single-city cultural browsing now has `/discover/browse`. Existing `/discover?q=…`, `destination`, `kind` and `work` query links continue to render the browser for compatibility. Paris cultural links use the new browse URL. Existing root `/` still redirects to the preserved Copy My Trip `/paris` route; this change establishes the Elsewhere landing within `/discover`, not a deployment or root-route replacement.

## Verification

Route smoke, culture/API/bookmark tests, snapshot/storage preservation and all eight offline-import groups passed. New assertions check 13 non-interactive Coming soon cards, live Rome navigation, absence of a London destination link and absence of the removed Paris hero controls. TypeScript found a narrow Set inference in the live-city lookup; explicitly typing it as Set<string> fixed it.

Browser checks at 1600 and 390 pixels verified city/country filtering (Italy returns Rome, Florence and Venice), empty-search reset, Paris hero control removal, Paris-to-browse navigation, no horizontal overflow and no console errors. The photo overlay was corrected to darken only the image and preserve readable provenance captions. Screenshots are saved below.

Production build passed: TypeScript, API/runtime checks, Vite bundling and public-media redaction/preservation checks for 282 images, 40 videos and one document. All 40 audiovisual stream hashes and original/WebP bytes remain unchanged. Existing large-bundle warnings remain.

No catalog records were published or promoted. The four-work catalog, original media, Supabase, saved-itinerary behavior and itinerary screens are unchanged. The 13 future city cards are presentation-only roadmap entries, not researched cultural catalogs. Native 200% zoom remains the previously documented manual-check limitation. Development and checks ran in the established non-iCloud copy; changed files were mirrored back with byte comparisons.

[Desktop](redesign-screenshots/destination-landing-desktop.jpg) · [Mobile](redesign-screenshots/destination-landing-mobile.jpg)
