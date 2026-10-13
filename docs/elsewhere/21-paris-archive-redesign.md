# Paris archive: photography-first redesign

## Delivered locally

`/paris/archive` now uses the Elsewhere shell and a photographic introduction: “Paris, through our lens.” The default gallery contains 70 mapped archive entries (50 photo entries and 20 video entries), interleaved across places rather than showing long runs of one landmark. It uses existing responsive image variants; secondary images are lazy-loaded and videos load metadata only until opened. No media files, source metadata, catalog facts, saved-state keys or planner inputs changed.

Neighborhood and photo/video filters, 24-item gallery pages, selected media and selected places live in the URL. Detail views show the uncropped photo or playable video, catalog location, known capture month, related media, original archive-day links, and reviewed cultural connections when available. Returning restores the selected gallery link's focus; changing filters or pages focuses the results heading. Unknown media IDs recover to the gallery. Empty filters have a reset action.

Map & places is a separate view, with 12 numbered places per page and an equivalent accessible list. It reuses the existing Mapbox component and explicitly labeled coordinate schematic. Researched places are distinguished from places with mapped original media. Existing place-ID and slug links still resolve; original day groupings remain in an expandable section linking to unchanged itinerary pages. Rome’s archive and all planner screens are unchanged.

## Content and architecture decisions

The gallery derives from `PARIS.media[*].plates` joined to `slotFiles`; files without a place mapping and research-only imagery are not introduced as firsthand photographs. Files remain available in their existing locations. Duplicate mapped media are displayed once. A video’s mapped image acts as its poster.

Some existing plate captions visibly describe a different subject (for example “The cone” mapped to a storefront photograph). The new gallery uses neutral numbered photo/video labels and existing place/date metadata rather than repeating these captions. The original metadata is preserved; a future visual caption audit should add precise descriptions and independently review place associations. Catalog coordinates identify a place, not a camera position.

An explicit `/paris/archive` route takes precedence over the generic city archive route, reusing the Elsewhere shell and catalog loader. This now means the archive shell depends on `/api/catalog`; a future shared shell independent of the catalog loader would improve archive resilience during catalog outages. The current error screen supports retry and a planner escape.

## Validation

- TypeScript passed.
- Route smoke passed, including gallery, map, media detail, invalid media, empty neighborhood and legacy place routes.
- Added checks for mapped media existence, exclusion of research-only images, unique gallery IDs, opening-gallery variety and original day-link resolution.
- `test:preservation`, `test:culture` and `test:map-media` passed.
- Production build passed with API runtime checks and full media validation: 282 images, 40 videos, 1 document; original/WebP preservation and all 40 audiovisual stream hashes passed. Existing large-bundle warning remains.
- Browser checked photo detail/back focus, combined neighborhood/video filters, browser Back, playable video metadata (readyState 4), numbered map selection, researched-place labeling and pagination.
- Gallery checked at 390, 768, 1280 and 1600px: no horizontal overflow. 640px reflow also passed; this is not a native 200% browser-zoom test. Screenshots are in `archive-redesign-screenshots/`.
- Live Mapbox tiles were not tested because the local preview uses the schematic fallback. No added animation; no autoplay. A complete screen-reader audit and native zoom review remain unperformed.

No Supabase modifications, deployment, commit or push. Changes were developed in the established non-iCloud copy and mirrored to the workspace and normal 5173 preview with content comparisons.
