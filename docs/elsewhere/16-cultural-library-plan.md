# Cultural library: design plan and catalog release

October 12, 2026. Catalog promotion implemented; Browse redesign below is a plan, not yet implemented.

## Local catalog release

The user authorized bringing reviewed candidates online. The local app now serves 21 works: the original four plus 17 distinct source-reviewed Paris works (12 books, five films). The reviewed Cléo candidate resolves to the existing ID, preserving bookmarks. Paris has 19 works and Rome two; a neutral interface cannot by itself remove this editorial imbalance.

Only limited factual metadata, original short summaries, source links and typographic covers are published. Book dates explicitly identify cited editions and retain format/ISBN; film dates use Film year. Lucy Sante is the current publisher display credit, with original input preserved in the source bundle. No third-party images, exact-location joins, planner eligibility or current availability claims were added. Paris destination shelves show two items per format with links to the complete collection.

The separate publication-decisions.json records promotion, identity retention and holds. The imported source bundle and generated historical queue are unchanged. Paris, je t’aime remains held for final credit reconciliation; The Intouchables remains held for Paris-setting evidence. Twenty other-media candidates still require factual review. They are not silently treated as approved by this release.

## Proposed Browse page

Use a city-neutral cultural library at /discover/browse. Opening: “Find your next connection.” Subheading: “Stories, screens and sounds that bring places into focus.” Remove the destination hero, duplicate search inputs and Paris archive promotion. Keep photography on destination pages.

A single search field sits above compact Format, City and Sort controls. Default city is All cities. Search remains deterministic across supported titles, creators, parent shows and cities; no semantic-search claim. Preserve q, destination, kind and work URLs. Changing a filter clears selection; Clear all resets city too.

The Format menu groups Books; Films; Television (shows, episodes); Podcasts (shows, episodes); Music (artists, albums, songs). Display actual counts. Formats without published entries are clearly unavailable with zero counts, rather than pretending content exists. Future records activate the relevant options after review.

Render every matching record once in a responsive grid: four columns at wide desktop widths, two on tablets and one on small screens. Each card has a restrained format badge, original typographic artwork, title, creator or parent-show attribution, date with its meaning, city connection and Save. Avoid repeated featured/category shelves. Default ordering is stable title order; offer newest by clearly labeled edition/release date only after cross-format semantics are resolved.

Selecting a result retains the existing desktop list/detail arrangement at 1100px and above, and mobile detail view with Back to results below it. Preserve selection across reload/back/forward, clear invalid selections safely, restore result focus on close and use one page scroll. Details emphasize why the work relates to a city, its sources, parent-series context when relevant, and Save. No playback controls or availability labels without supported links.

## Metadata needed for broader formats

Introduce validated kinds for tv_show, tv_episode, podcast_show, podcast_episode, artist, album and song alongside book/film. Episodes need an explicit parent ID and source-backed title; season/episode numbers are optional, never invented. Songs/albums need artist attribution and release context. Artists must not be forced into a publication-year field. A show's general city association must not automatically pass to every episode or song.

Separate date value and date meaning (edition, production, release, active period) and retain edition identifiers. Support sourced about-city, narrative-setting and creator-association relationships without converting birthplace, recording location or filming location into narrative setting. Generalize covers and metadata labels so audio is not labeled WATCH. Update catalog validation/API filters/query tests together, preserving all existing work IDs and storage keys.

Before publishing the remaining formats, review the twenty supplied other-media records individually for identity, parent relationships, city evidence and factual display metadata. Do not make broader catalog expansion a prerequisite for the neutral Browse layout.

## Acceptance checks for the redesign

Verify all-city default; city/format/search combinations; exact episode and parent-show matching; zero results; clear/reset; selection/back/reload; malformed URLs; saving/removal/recovery; keyboard focus; reduced motion; 200% zoom; 390/768/1280/1600 layouts. No duplicate records or unsupported formats masquerading as content. Keep destination, itinerary and saved-trip behavior unchanged.

## Release validation and limits

Passed culture tests (21 records, edition guard, Cléo deduplication and held-record exclusion), route smoke, preservation and offline-import tests, TypeScript, API type/runtime checks and the production application bundle with public-media copying disabled. Browser verified a new record from /api/catalog through search/detail, edition/source rendering and Save persistence after reload; the temporary bookmark was removed.

A full media-inclusive production build remains blocked by the disk-space failure documented in report 15; it was not represented as passing here. No original media, planner catalogs, itinerary screens, storage keys, hosted database or deployment changed. Tested source files are mirrored to the original iCloud workspace and compared byte-for-byte.
