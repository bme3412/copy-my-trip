# Compact Paris overview implementation

12 October 2026 · local implementation only

## Result

`/discover/place/paris` now has a 184px desktop sidebar, compact navigation/search, shallow original Seine sunset hero, six editorial picks, playlist/three connections/two-place map row, six recent additions, compact places/people/collections and an original-photo strip. Stories and discovery trails remain reachable through navigation. Below 1100px the sidebar becomes an accessible Paris menu; cards use three columns on tablets and two on phones. The page uses one document scroll. The sidebar becomes nonsticky on short desktop viewports so its links remain reachable.

Browse, destination landing, work/entity details, archive, atlas and itinerary retain their layouts. Exact-route detection controls the new shell, including the optional trailing slash. The old Paris anchors remain, with `more-discover-title` attached to Recently added and a Places anchor added. Header search submits `destination=paris&q=…` through the existing deterministic Browse interface. Film and TV links remain separate `kind` values.

Curated work IDs and connection IDs are explicit in `paris-overview.ts`, validated against the public catalog. No new work, relationship, map coordinate, API contract or storage key was introduced. The map uses the existing two verified catalog points, with reviewed entity names; the broad Seine entity has no pin. Map selection reveals the matching detail link and has equivalent text buttons. The existing eight-track playlist is unchanged; only its first four tracks are previewed. Save uses the existing shelf and personal providers.

## Artwork

All six featured artwork candidates were researched. None gained complete new display approval; typography is intentional and the redesign does not depend on unlicensed assets. See [the source-by-source ledger](27-paris-overview-artwork-ledger.md) for exact identity, credits, terms, access failures and next steps. The new shared manifest distinguishes pending research from display-approved images. Unaffected cover behavior remains intact. Original photographs, existing licensed portraits and their credits remain visible.

## Validation

Passed in the established non-iCloud workspace:

- `test:paris-overview`: curated IDs/order; missing-ID rejection; exact route scope; every selected work/entity link and useful anchor; playlist order; reviewed connection trails; exact two map pins; artwork evidence requirements and pending-image exclusion; typography fallback.
- `test:culture-import`, `test:culture`, `test:paris-batch`, `test:paris-discovery`: offline review gates, schema/API, search, existing IDs and playlist, explicit activity undo, concurrent writes, corruption/quota safety, backup/recovery and saved-trip isolation.
- `smoke`: actual loaders and routes, all overview local destinations (sidebar, shortcuts, cards, entities, collections, trails and map), exact-route shell isolation, missing-record recovery and existing planner routes. Updated obsolete Paris copy expectations and corrected a malformed pre-existing route case so each new detail route is checked independently.
- `test:preservation`: frozen planner snapshots, catalog hashes, storage keys, replay, recovery and deterministic behavior.
- Production `build`: TypeScript, API type/runtime checks, Vite and media redaction/public-media checks. 282 images, 40 videos, one document; original files and derivative inventory intact; 40 identical audiovisual stream hashes. Existing large-bundle warnings remain (notably Mapbox).

Browser review at 390, 768, 1280 and 1600px: no horizontal document overflow; two/three/six card columns as appropriate; middle row stacks on mobile/tablet; all artwork titles fit their frames after correcting narrow desktop clipping. All eight visible photograph elements loaded, including lazy lower-gallery images. Schematic map was exercised without a Mapbox token, selecting the second point and revealing its detail link. Street-map rendering with a live token was not exercised.

Live interactions checked: menu expand and Escape, menu close on People anchor navigation, visible 3px keyboard focus, Paris-scoped Piaf search (one result), TV shortcut (three series), browser Back, featured detail navigation, work Save/reload/remove, real Saved count, independent playlist saving with its tracks left unsaved, and returning the test shelf to its initial empty state. Route tests cover all local link destinations.

The in-app browser did not change `innerWidth`, `devicePixelRatio` or visual viewport scale after native zoom shortcuts. **Actual 200% browser zoom is unverified.** An 800px CSS viewport (the layout width corresponding to 1600px at 200%) reflows without overflow, but is not claimed as actual zoom. Reduced-motion rules are scoped and remove animation/transitions; no moving graph or automatic scrolling was introduced. OS reduced-motion toggling was not exercised. Typography for unavailable artwork and the no-token map fallback were verified; a live approved-image network failure was not separately injected because no new artwork is approved.

## Local review

- [Paris overview](http://127.0.0.1:5173/discover/place/paris)
- [Recent additions anchor](http://127.0.0.1:5173/discover/place/paris#more-discover-title)
- [1600px screenshot](paris-overview-screenshots/paris-1600.jpg)
- [1280px screenshot](paris-overview-screenshots/paris-1280.jpg)
- [768px screenshot](paris-overview-screenshots/paris-768.jpg)
- [390px screenshot](paris-overview-screenshots/paris-390.jpg)

## Remaining assumptions and limits

The overview is curated by explicit IDs, not an inferred ranking or a publication-date feed. “Recently added” refers to this existing reviewed batch. Artwork approvals should be managed independently of content evidence; the manifest provides that boundary without a catalog migration. Before accepting approved assets, confirm their restrictions for every intended placement. The current map component’s no-token fallback is adequate for local review, while live Mapbox failure/recovery still deserves a token-enabled pass. The CSS is isolated by the overview root; a future shared shell should not be extracted until another destination needs it.

No Supabase writes, deployment, Spotify integration, playlist changes or itinerary redesign. No commit or push requested in this turn.

Source copy-back and SHA-256 results are recorded in `paris-overview-delivery-manifest.json` after final validation.
