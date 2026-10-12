# 04 — Original archive integration

The archive should be evidence-backed editorial material, not a stock-image layer. Preserve all original files, slot mappings and accepted snapshot image URLs. The repository proves a Paris runtime archive and researched-only Rome, not an indexed 50-country collection. The worldwide archive described in the brief is an expansion input whose location, size, rights and backups require an inventory.

## Existing assets and limits

`src/cities/*/data/media.json`, `slot-files.json`, `media-dates.json`, `lib/media.ts`, `ImageSlot.tsx`, `HeroPhoto.tsx` and `video-director.ts` already connect places to images/video and capture-month labels. `scripts/archive-files.ts`, `archive-evidence.ts` and `media-audit.ts` compare metadata with claims. They are report-oriented; retain the prohibition on silently changing curator assertions. `optimize-media.mjs` generates orientation-corrected, hashed WebP derivatives at up to 320/800/1440px; `src/media/variants.json` is display-only and deliberately outside the catalog hash.

`publish-media.ts` stages only allowlisted JPEG/MP4 runtime files, while optimized display images currently stay on the Vercel origin. `infra/lib/media-stack.ts` protects the S3 origin but serves public objects through CloudFront. The infrastructure has no private viewer access system. `public/media` may also be copied by Vite, because the exclusion is commented out in `.vercelignore`. Audit actual deployed outputs before declaring any source file private. A source JPEG can retain sensitive metadata even if a WebP derivative does not; fallback URLs and downloadable videos must pass the same review.

## Separate five kinds of statements

| Statement | Evidence/authority | What it does not establish |
|---|---|---|
| File was captured at a time | Raw metadata, parser/method, precision and timezone uncertainty | Exact local timezone or date accuracy if camera clock is wrong |
| Camera was near a place | GPS accuracy, clustering, map review | Entry, purchase, participation, recommendation or filming history |
| Subject appears to be a market/building | Model or curator visual annotation with confidence | Verified identity/location |
| Curator visited a scoped experience | Explicit curator-approved observation linked to evidence | Recommendation or present-day conditions |
| Curator recommends it | Explicit dated editorial endorsement scoped to experience | Permanent safety, availability, hours or quality guarantee |

Store these as different claims. Never convert GPS or timestamp thresholds into a recommendation. Preserve exterior/interior distinctions already possible through `Experience.src`.

## Proposed asset contract and integration

Create `ew_assets`: id, checksum, private original reference, media type, dimensions/duration, rights holder, rights status, visibility, sensitivity, ingest batch and immutable master identity. Store exact GPS/capture/device details in a private `ew_asset_evidence` relation with extraction method, parser version, source asset and uncertainty. Public derivatives have their own `ew_asset_derivatives` manifest: asset ID, transform version/hash, format, size, public URL, redaction result and publication revision. Keep legacy `(city, filename, slotId)` mappings as aliases; do not rename originals.

`ew_asset_geo_links` links assets/clusters to reviewed geographic entities, with scope (“view of”, “captured near”, “inside”) and evidence. `ew_asset_annotations` carries visual subjects/model provenance separately. `ew_editorial_observations` stores curator-authored text and approved experience scope; `ew_collection_assets` controls ordering/crop/caption. Public DTOs exclude private fields by construction.

Preserve frozen itinerary evidence URLs and old files. New display resolvers may improve rendering without rewriting snapshots. If an old public asset must be withdrawn for privacy, show an explicit unavailable-image state while preserving accepted schedule and textual provenance; privacy withdrawal takes precedence over indefinite image availability. Record the withdrawal and handle CDN invalidation. Do not erase the original evidence from private storage as a side effect of unpublishing.

## Storytelling and navigation

Destination pages lead with one reviewed photo, a concise curator introduction and two or three editorial sections. Neighborhood guides combine a sequence of images with observation text; photo essays can work independently of planning. Place pages separate archive dates from current researched operating details. The same image can appear in multiple collections without multiplying asset records.

Support country → city → neighborhood → place → image/essay → related work, and work → qualified city relation → relevant photo essay/place. A city-level book relationship can link to a city photo essay, but must not imply that the pictured café appears in the book. Label interpretive juxtaposition as editorial, not evidence. Rome has a complete text-led design and researched map even with no personal photographs; never borrow Paris photos or generate fictional firsthand imagery.

## Batch curator workflow

1. Ingest a bounded private batch; checksum/deduplicate, locate masters/derivatives and produce a contact sheet. No publishing.
2. Cluster by approximate location and capture period, preserving uncertain timezones and absent GPS. Existing master-to-derivative rules seed links; no automatic deletion of apparent duplicates.
3. Propose places, visual subjects, caption drafts and possible editorial connections. Show model-inferred and metadata-derived columns separately.
4. Review contact sheets with map bounds and supporting evidence. Batch approve safe shared attributes (city, public derivative eligibility) while supporting per-image exceptions. Batch geography approval cannot approve participation/recommendation.
5. Review captions and cultural connections in a diff with source citations. Reject/withhold ambiguity; retain reviewer, timestamp, proposal hash and reasons.
6. Publish an explicit selection; rerun rights, metadata-redaction, URL and catalog-link validation. Publication is separate from proposal acceptance, like the current local pilot's separation.

New UI should support keyboard selection, filter by uncertainty/sensitivity, bulk reject, undo via a new revision, resume interrupted batches and conflict detection when source records changed. A curator can approve a cluster without editing JSON, but high-impact relationship claims still receive claim-level review.

## Privacy, rights and recovery

Default new ingestion private. Originals belong outside any Vite public directory or CDN-readable prefix. Proposed private original storage must use a separate bucket or access boundary with no CloudFront public read path; the existing media stack can continue to host only approved public derivatives. No original-storage migration is executed in this assignment.

Review faces, minors, residences, personal documents, vehicle plates and sensitive travel patterns. Public capture dates may use month/year; exact coordinates can be withheld or generalized to an approved place. Strip EXIF/GPS/XMP/IPTC and video location metadata from every public artifact, then inspect the output metadata rather than assume a transform removed it. Verify original fallback URLs too. Original authorship is not a blanket right to commercialize every depicted artwork, person or property; record rights/restrictions per asset.

Keep asset checksums, immutable masters, manifest history and independent encrypted backups with a restore drill. Existing S3 versioning and RETAIN help, but 90-day noncurrent expiry is not an archival backup policy. A restore drill should recover a sample original plus derivative lineage, rights decision and geo association. Document RPO/RTO targets before expanding ingestion (proposed: daily metadata backup, weekly integrity check, recovery of a reviewed batch within one working day).

## Scale and staged enrichment

Launch with 20–30 curator-selected Paris images already represented in the app, plus researched-only Rome. Inventory 50-country archive metadata privately in batches; do not require complete labeling before release. Prioritize destination clusters with strong evidence and user demand, then missing cultural themes. Hash-based idempotency prevents repeated model work on unchanged bytes. Keep a daily image/token budget, batch size, failure queue and review backlog cap; stop proposing when the curator cannot keep up.

Use local extraction and thumbnails before paid image classification. Store proposals as durable jobs and spend receipts. A candidate production policy is at most 100 new images/day and $10/day for an initial experiment, explicitly a proposed budget requiring owner selection rather than a provider price. Measure approved usable images per review hour and cost per approved claim. Defer facial recognition, public uploads, worldwide automated geo assertions and automatic recommendation generation.
