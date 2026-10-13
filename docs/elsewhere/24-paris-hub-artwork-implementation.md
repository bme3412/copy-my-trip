# Paris hub hierarchy and licensed photography

Implemented locally, 12 October 2026, following [the layout and artwork review](23-paris-layout-artwork-review.md).

## Changes

- Shortened the original-photo hero and reduced the width of its pale overlay.
- Replaced four equally prominent starting-point cards with the sourced Before Sunset → Shakespeare and Company feature. The rotating Paris-date story is now part of this feature, above the audio selection.
- Kept the Paris playlist prominent beside three compact song previews. Podcast episodes use smaller format placeholders; the walking episode leads the selection, followed by jazz and stonemasonry.
- Paired James Baldwin and Giovanni’s Room in one feature. Kept the existing book-cover handling and its typographic fallback; no new publisher artwork was installed.
- Consolidated Literary Paris into one collection feature, retained a related theme link, and added three distinct original archive photographs before the quieter atlas invitation.
- Removed activity-status controls from the hub. Existing detail/atlas actions, bookmarks, local storage contracts, catalog facts and planner behavior remain intact.
- Added shared credited photography for the bookshop, Baldwin, and the two bookshop stories. This avoids showing a café photograph as though it were the bookshop. Story-index cards keep credits outside navigation links; no nested links are introduced.

## Artwork

Installed two reviewed photographs, each with 320/640/1280px WebP variants, responsive `srcSet`, lazy loading, explicit dimensions and a missing-image state:

- Shakespeare and Company, Mike Peel, 2012 — CC BY-SA 4.0.
- James Baldwin, Allan Warren, London, 1969 — CC BY-SA 3.0. The caption explicitly identifies London.

Source URLs, credits, license links and derivative changes are recorded in [the public credits file](../../app/public/culture/artwork/CREDITS.md). The same credit information is visible beside each photograph. The six variants total 501,804 bytes and contain no EXIF, XMP, IPTC or ICC metadata. Images were visually inspected before use.

No film stills, publisher covers, podcast artwork or streaming artwork were newly installed. Those remaining permissions/recording matches are documented in report 23. Spotify integration remains deferred. Original travel photographs are labeled separately from licensed photographs.

## Verification

Passed:

- `test:culture-import` — eight importer tests and generated-evidence check.
- `test:culture` — existing catalog/API/search/save contracts plus audio compatibility and playlist integrity.
- `test:paris-discovery` — relationship integrity, daily rotation, trails, personal storage, recovery, listened-state undo and preservation.
- `smoke` — all routes, selected-result recovery, city-scoped library and planner escapes. Three assertions were updated to the intentionally changed hub headings.
- `test:preservation` — frozen Paris/Rome snapshots, catalog hashes, storage keys, replay and recovery.
- `build` — TypeScript, API checks/runtime tests, Vite, media redaction and public-media tests. All original media and all 40 audiovisual stream hashes passed preservation checks. Existing large-chunk warnings remain.
- New licensed assets — all six expected widths and absence of private image metadata.
- Local `/api/catalog` response — existing versioned contract and 33 works.

Browser checks at 390, 768, 1280 and 1600px found no horizontal overflow. Reviewed the stacked tablet/mobile presentation, desktop feature, photo credits and loaded images. Checked visible keyboard focus, hub → bookshop navigation, Browser Back, music-filter navigation (eight songs), and the playlist page (eight ordered tracks). Saving La Seine persisted after reload and was removed again; the Baldwin entity save was also exercised and restored. No test saves were left behind. No browser warnings/errors were observed in the inspected log.

Native 200% browser zoom and OS reduced-motion mode were not separately exercised. The page was checked down to 390px; it adds no animations and retains the existing reduced-motion rules. The missing book artwork fallback was observed. A forced failure of the new local photo URLs was not simulated.

## Build environment and source copies

Used the established non-iCloud workspace at `/Users/brendan/Library/Caches/copy-my-trip-phase0-check`. The first media check failed during video redaction when disk space dropped to about 113 MiB. Removed only the obsolete generated `/private/tmp/elsewhere-push-check/app/dist`, then reran the complete production build successfully. Source media and user files were not removed.

All 13 changed implementation/asset/test files were copied back atomically to the main iCloud workspace and compared byte-for-byte. The running local preview uses the matching non-iCloud copy. No deployment, Supabase operation, commit or push was performed.

## Screenshots and remaining work

- [Desktop feature](paris-hub-screenshots/paris-feature-desktop.png)
- [390px](paris-hub-screenshots/paris-390.png)
- [768px](paris-hub-screenshots/paris-768.png)
- [1280px](paris-hub-screenshots/paris-1280.png)
- [1600px](paris-hub-screenshots/paris-1600.png)

The public catalog, relationship data and personal stores are unchanged. The new photograph component is a small shared presentation registry, not a new content backend. If the artwork inventory expands, move these asset records into a validated registry with explicit permission evidence and edition/recording identifiers. Confirm book/film/podcast display permissions and exact Spotify recordings before replacing their remaining placeholders.
