# Cultural library interface — October 12, 2026

Browse now has a city-neutral introduction, one deterministic search, grouped Format menu, All cities default, alphabetical responsive grid, result counts and Clear all filters. Removed the Paris hero, duplicate search and archive promotion. Existing detail selection URLs, desktop split/mobile details, covers and bookmarks are reused.

The menu includes books, films, TV shows/episodes, podcast shows/episodes, artists, albums and songs. Zero-record formats are disabled and explicitly not yet available. This is a presentation change, not publication or schema support for unverified other-media records. Current catalog remains 21 books/films. The typed catalog/API still needs the broader-format metadata work in report 16 before those records can publish.

Passed route smoke including all-city default, broader menu and removal of duplicate sections; culture tests, TypeScript and production application bundle without public-media copying. Browser verified Rome + Books filtering, detail selection/close, reset to All cities, and 390px layout without horizontal overflow. Desktop and mobile screenshots saved. Full media-inclusive build remains blocked by the previously documented disk-space limitation. No deployment, Supabase writes, planner, itinerary, original media or storage changes.

## Pre-push validation — October 12, 2026

Disk space was freed. The full production build now passes, including API checks, 282 images, 40 videos, one document and all 40 unchanged audiovisual stream hashes. This supersedes earlier disk-space blockers. The codex/elsewhere-discovery branch explicitly disables Vercel Git deployment for that branch; this push is for source review, not deployment.
