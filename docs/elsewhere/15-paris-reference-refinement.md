# Paris reference refinement

Implemented locally on 2026-10-11. Paris destination only; itinerary screens and planner logic remain unchanged.

## Changes

A shallow, full-width original-photo hero, compact book/film shelves with working Save controls, an archive sidebar, selectable places with detail cards, and a compact archive-day outline bring the page closer to the supplied references. Previously removed hero actions/counts remain absent. Only the two published Paris works appear; reviewed candidates remain offline.

The optional `place` query parameter selects an existing catalog place and survives reload. Invalid values fall back to Jardin du Luxembourg. Numbered native buttons support keyboard selection. The map uses existing Mapbox infrastructure when configured, with a labeled coordinate schematic when unavailable. No walking route or unverified cultural-location connection is implied. Missing place photos use explicit typographic placeholders.

## Validation

- Passed route smoke, including valid/invalid Paris selections and removed hero controls.
- Passed culture, preservation and offline importer checks.
- TypeScript and API runtime checks passed.
- Production application bundle passed with public-media copying disabled.
- Full production build attempted but blocked by ENOSPC while Vite copied original media into dist. Final media checks did not run in this attempt. This is not a full production-build pass.
- Browser: selection, reload persistence and keyboard activation verified. Widths 390, 768, 1280 and 1600 had no horizontal overflow. Desktop/mobile screenshots saved alongside this report.
- No Supabase writes, publication, deployment, catalog edits, original-media edits or storage-key changes.

## Remaining limitations

The local environment has no Mapbox token, so the live street-map path needs verification in a configured environment. More independent disk space is required for the complete media-inclusive build. The four-work catalog and limited place photography intentionally differ from the rich reference mockups. No new film-location assertions, music/podcast records, journey tracking or itinerary integration were introduced. Full zoom/contrast auditing was not repeated in this refinement.
