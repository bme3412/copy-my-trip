# Responsive media and itinerary Mapbox integration

12 September 2026

## Display media

Run `npm --prefix app run media:optimize` after adding or replacing archive images. Commit the generated files in `app/public/media/optimized` and the separate display manifest in `app/src/media/variants.json`. Sharp applies EXIF orientation and generates content-addressed WebP images at up to 320, 800, and 1440 pixels. Originals, catalog hashes, and saved evidence URLs stay intact. Known display images use responsive sizes; a failed derivative retries the original. Unknown images retain their existing behavior.

The 74 source images total 213,591,724 bytes. Their largest display variants total 18,724,538 bytes (91% less). The homepage Eiffel photo falls from 3,232,961 bytes to 97,102 bytes at 800 px or 279,116 bytes at 1440 px. This measures transfer size, not a controlled page-load-time benchmark. Thumbnails use the 320 px variants. Hero images have high fetch priority; other photos remain lazy. Videos acquire a source only near the viewport or after selection. Hashed derivatives have immutable one-year HTTP caching on Vercel.

## Itinerary map

Set the public `VITE_MAPBOX_TOKEN` at build time. It is configured for production and in ignored local settings; no token is committed. The Mapbox library is dynamically loaded on the itinerary. The map uses Mapbox Streets, home and numbered stop pins, keyboard-operable markers, zoom controls, Fit day, resize handling, and loading/error/retry UI.

Walking Directions geometry is display-only: it never updates accepted travel times or itinerary contents. Adjacent walking legs are grouped into requests of at most 25 coordinates. Return legs are retained. Up to 64 successful route geometries are cached in memory, obsolete requests are aborted, and requests time out after 10 seconds. Metro links remain dashed schematic connections; failed walking routing also shows an explicitly labeled schematic fallback. Saved plan timings remain planner estimates. Mapbox map loads and Directions requests count toward the existing Mapbox account's usage.

The old persistent local-storage strip is removed. Saved-trip pages retain collapsed Backup & recovery tools. A real storage failure still produces an alert linking there.

## Verification

- Production build and API runtime check pass.
- 19 route smoke cases, 16 companion save/replay checks, and 14 alternative-proposal checks pass.
- `npm --prefix app run test:map-media` checks return-leg geometry, transit separation, request limits, cache reuse, failed routing, and all 74 responsive image sets.
- Browser verified real street tiles and walking paths, Day 1 → Day 2 updates, numbered pin interaction, Fit day, mobile map at 390 px with no horizontal overflow, deferred off-screen video sources, responsive image selection, and the collapsed recovery section.
