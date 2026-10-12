# Book covers — October 12, 2026

Added ISBN-addressed Open Library cover integration to the shared card/detail component. All 14 book records have a cover lookup; films retain their typography. Images load lazily with no referrer, use uncropped containment and retain typography while loading or after errors. Details link to Open Library and state the cover edition. No cover files are downloaded into the media archive.

Provider guidance: https://openlibrary.org/dev/docs/api/covers explicitly describes public-facing image embeds and requests direct covers.openlibrary.org URLs and courtesy links. This is a provider-supported display integration, not a claim of owning or obtaining a blanket copyright license to artwork.

Twelve reviewed books use their cited ISBNs. Giovanni’s Room uses the publisher-linked 2024 deluxe paperback (9780593688960); Roman Stories uses the publisher-linked 2024 paperback (9780593469903). These cover editions are explicitly distinguished from the original work/English edition dates. Publisher identity sources remain the catalog sources.

Verified The Only Street in Paris cover visually in the browser and its source/edition presentation. Remote availability and provider edition-image accuracy are not guaranteed across all 14 lookups; unresolved or slow requests retain typography. No fallback to a guessed alternative ISBN.

Passed culture checks including 14 ISBN mappings and film exclusion, route smoke, TypeScript and production application bundle without public-media copying. Full media-inclusive build remains blocked by the previously recorded disk-space limitation. No deployment, Supabase change, catalog identity change or original-media change. Tested files mirrored back and compared byte-for-byte.
