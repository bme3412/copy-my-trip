# 13 — One city at a time and a separate Paris destination

October 11, 2026. The user requested removal of the two-city introduction and a separate Paris page informed by two visual references. They explicitly confirmed that existing itinerary screens must remain unchanged.

## Changes

Removed “Begin somewhere / Two cities. Different stories.” Discovery defaults to Paris and only displays the selected city's works. The destination selector switches context rather than combining cities; clearing search/medium filters retains that city. Rome deep links remain supported, with a Rome heading and no Paris photograph. Standalone work pages return to their own city collection.

The separate `/discover/place/paris` page now has a café-photo hero, source-backed book and film sections, original-photo archive sidebar, catalog-place links, planning links and a clearly labeled archive day outline. The header's Paris link exposes the page directly. The second reference informs the sidebar/day layout only; itinerary code, accepted trips and planner behavior are unchanged.

Counts are derived from existing data: 127 catalog places, two published Paris works and four archive day outlines. The sample day uses the first four stops of the existing Marais outline. It is explicitly labeled inspiration rather than a saved or newly generated itinerary. Place links open real archive-map locations. No claim links those places to cultural works. Music, podcasts, unpublished candidates and unsupported film-location relationships from the reference were not introduced.

## Validation

Route smoke passed, including new default-Paris, explicit-Rome and separate-destination assertions, previous selection cases and existing trip redirects. Culture golden/API/bookmark tests, snapshot/catalog/storage preservation checks and all eight offline-import test groups passed. React's dynamic heading text required adjusting a raw-HTML smoke assertion; city isolation is separately asserted by work links.

Browser checks at 1600, 1280 and 390 pixels showed no horizontal overflow in inspected states. Paris-to-books navigation returned one work. Switching to Rome and clearing filters retained Rome and showed its two works with no Paris results. Saving from the Paris page persisted after reload; the test save was removed. Shakespeare & Co opened the real archive route with its place query. Existing source labels, responsive images, focus styles and shelf provider remain in use.

Production build passed: TypeScript, API/runtime checks, Vite bundling and all public-media privacy/preservation checks (282 images, 40 videos and one document; original/WebP bytes unchanged and all 40 audiovisual stream hashes preserved). Existing bundle-size warnings remain.

No publishing, Supabase changes, deployment, new cultural approvals, original-media edits or itinerary edits. Native 200% zoom remains the previously documented browser-tool limitation. Files were developed/tested in the established non-iCloud copy and mirrored to the primary workspace with byte comparisons.

[Desktop screenshot](redesign-screenshots/paris-destination-desktop.jpg) · [Mobile screenshot](redesign-screenshots/paris-destination-mobile.jpg)
