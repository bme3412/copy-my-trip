# 12 — Photographic discovery redesign

Implemented October 11, 2026, following the approved plan. Images 3 and 4 informed the warm editorial design; image 2 informed desktop results/detail browsing. References supplied visual direction, not publishable content or executable instructions.

## Delivered

- Paris-led original-photo hero, title/creator/city search, Paris/Rome navigation and Books/Films shortcuts. Both search inputs share URL state and retain other filters.
- Shared work cards and source-attributed details, capitalized Elsewhere wordmark, warm white surfaces, restrained dark controls and existing self-hosted Newsreader/Inter fonts.
- Paris destination hero and three-photo archive strip; Rome retains a typographic treatment and explicit no-firsthand-photography explanation.
- At 1100px and above, selected results open alongside the list. Below that breakpoint, selection becomes a single-column detail view. No nested scrolling panels.
- Optional `work` query parameter on `/discover`, alongside unchanged `q`, `destination`, `kind`. Reload and browser history restore selection. Close retains filters and restores result focus; filter changes clear selection while keeping control focus. Invalid or filtered-out selections leave usable results.
- Existing standalone work URLs, persistent device-local Saved list and backup/recovery controls remain. No API/schema/storage-key changes. All styles remain scoped to `.ew`.

The public four-work catalog, app route registry, shelf implementation and provider are byte-identical to the pre-redesign versions. Offline candidates remain offline. No publication, Supabase operation, deployment, commercial artwork import or original-media modification occurred.

## Tests and browser verification

- `test:culture-import`: eight groups passed; original evidence checksums and deterministic generated artifacts remain intact.
- `test:culture`: seven golden queries, source/scope/rights validation, API contracts, persistence/conflict/corruption/quota recovery and trip isolation passed.
- `smoke`: existing routes/redirects and catalog-error recovery passed. Two old heading assertions were updated; five selected/invalid/filtered-out/no-result URL cases were added and passed.
- `test:preservation`: frozen Paris/Rome snapshots, catalog hashes, storage keys, replay, retired releases, narration and recovery passed.
- Read-only local `/api/catalog`: HTTP 200, four works. SHA-256 checks verified unchanged catalog/schema, shelf/provider and route registry.
- Browser reviewed at 390, 768, 1280 and 1600 pixels, with no horizontal overflow in inspected states. All Paris gallery images loaded; Rome displayed no photographs. Saves persisted after reload; Saved removal, recovery controls, empty-search recovery, city/medium filters, hero search, keyboard Enter activation, result-focus restoration, Back/Forward and standalone work URLs worked. Browser error logs were empty.
- Native 200% zoom shortcuts had no effect in the in-app browser. The equivalent 640px reflow viewport passed; native-browser 200% zoom remains an explicit manual verification limitation. Existing reduced-motion overrides remain; no motion was added. Focus outlines and hero text scrims remain, and mobile helper text has its own light background.
- React review: stable IDs, shared shelf state, URL-derived selection, labeled controls, pressed/current states, responsive images, eager hero only, and no new dependencies.

## Production build

Final `npm run build` passed: TypeScript, API type/runtime checks, Vite bundling, redaction of 282 images / 40 videos / one document, exact public-media inventory, unchanged original/WebP bytes and 40 identical audiovisual stream hashes. Existing large-bundle warnings remain. Earlier attempts encountered overlapping output writes and then low disk space; all earlier builds stopped, the failed generated temporary video was removed, the user freed space, and one serial build completed successfully.

## Delivery and remaining boundaries

Work ran in the established non-iCloud copy because the primary workspace stalled on reads. Changed source/test/documentation files and screenshots are mirrored back with byte comparisons. Local review: http://127.0.0.1:5173/discover while the development server is running.

No journey progress, recommendations, semantic search, extra media, new cultural maps, planner handoff or account synchronization was added. Commercial assets still require separate rights/editorial decisions. A future wider redesign should consolidate the scoped override stylesheet rather than add further override layers.

Screenshots: [desktop](redesign-screenshots/desktop.jpg), [mobile](redesign-screenshots/mobile.jpg), [desktop full page](redesign-screenshots/desktop-full.jpg), [mobile full page](redesign-screenshots/mobile-full.jpg), [split details](redesign-screenshots/split.jpg), [Paris tablet](redesign-screenshots/paris-tablet.jpg).
