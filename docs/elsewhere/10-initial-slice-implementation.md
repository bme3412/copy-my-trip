# 10 — Initial implementation and Phase 0 validation

Updated 2026-10-12 UTC. The initial Elsewhere slice remains limited to `/discover`, two destination pages, four source-attributed book/film records, filtering, details and device-local bookmarks. Existing trip routes and deterministic planning remain the compatibility baseline. This follow-up covers preservation, workspace recovery, media release hygiene and read-only deployment reconciliation. No deployment, database migration, account mutation, media upload or later-phase feature expansion was performed.

## Delivered vertical slice

`/discover` is an additive Elsewhere discovery entrance in the existing React/Vite application. It has a light editorial layout, original Paris photography, working title/creator/place/medium search, Paris and Rome destination pages, four book/film detail pages with citations, and a persistent device-local saved list. Navigation connects both ways to the existing planner and archive. `/` still redirects to `/paris`; all old routes and redirects remain.

The end-to-end path is **GET /api/catalog → runtime-validated cultural data → filtered results → work detail/source → Save → local persistence → reload → Saved**. This is not a static mockup. Catalog loading failures offer retry and a route back to planning. Unsupported links and empty searches have explicit states. Keyboard labels, focus indication, route focus management, reduced-motion support, responsive layouts and loading/error handling are included.

Files:

- `app/src/lib/culture/{schema,seed,shelf}.ts`: narrow versioned contracts, four factual records and isolated bookmark storage.
- `app/api/catalog.ts`: read-only public projection, bounded/allowlisted filters, 400/404/405 responses, no external provider calls. `app/server/dev-trips.ts` adapts the same handler for local development.
- `app/src/pages/elsewhere/`: discovery, destinations, work detail, shelf recovery, and archive-photo components.
- `app/src/styles/elsewhere.css`: scoped light-mode styles using the existing font infrastructure.
- `app/src/App.tsx`, `app/src/components/Layout.tsx`, `app/vercel.json`: additive navigation and direct-link rewrite.

The opening works are Giovanni’s Room, Cléo from 5 to 7, Roman Stories and The Great Beauty. Publisher/Criterion citations support the city connections. Only short original descriptions, factual metadata and links are stored; no scraped synopsis, book cover, film poster, still, transcript or provider payload is copied. The typographic work panels are original interface treatments, not reproductions of covers.

Connections are explicitly **source-reported** at city scope. Immersion remains **unreviewed**. No curator endorsement, neighborhood location, filming location or firsthand recommendation is invented. `npm run review:culture` produces an offline review packet and content hash; it does not approve or publish records. Human editorial approval remains a release gate.

The shelf uses `elsewhere-shelf-v1`, never either trip key. It validates bounded data, preserves corrupt/unsupported data, reports failed writes without claiming success, reads latest state before changing a bookmark, synchronizes other tabs and serializes writes/reset with Web Locks where available. A read/compare check is the fallback; browsers without Web Locks do not have a fully atomic cross-tab guarantee. Recovery exports the original bytes and offers a separately confirmed reset. Import, account sync and private journeys are outside this slice.

## Phase 0 preservation work

Frozen synthetic Paris/Rome accepted snapshots and their contract baseline live under `app/scripts/fixtures/preservation/`. They were captured before the discovery changes, with fixed acceptance time, existing waits/returns, variant provenance and fixture narration. They contain no private traveler data. The capture script is deliberately outside CI: refreshing a fixture must be a reviewed compatibility decision, not an automatic way to make a failing test pass.

`test:preservation` asserts exact storage-envelope round trips, no-op replay of committed stops/clock, old release readability and edit refusal, briefing restoration, corrupt/legacy recovery, schema/engine/storage-key stability and catalog hashes:

| Contract | Baseline retained |
|---|---|
| Snapshot schema | 1 |
| Planner | `local-companion-1` |
| Current / legacy keys | `cmt-local-companion-v1` / `cmt-trips-v3` |
| Paris catalog | `ed589fe219b927d8` |
| Rome catalog | `db907f20df07d3ae` |

No planner, city JSON, accepted snapshot format, trip persistence, auth, account deletion, mail/weather policy or AI scheduling behavior was changed. Cultural records are outside the hashed `City` objects. Existing media assets and URLs were retained.

`.github/workflows/quality.yml` adds a Node 22 offline gate with `npm ci`, preservation, city/culture validation, plans/routes, companion/cloud/review, mail/weather, proposals/analytics, media and production build. It contains no credentials and makes no live provider calls. Commands were run locally; the new workflow has not yet run on GitHub.

## Phase 0 follow-up changes

- Kept the frozen synthetic Paris/Rome snapshots, exact planner/catalog/storage contracts and the offline CI gate introduced in the initial slice.
- Added `app/scripts/backup-media.py`: explicit backup destination outside the checkout/iCloud, all public media plus media manifests, SHA-256 inventory, and a complete isolated restore with byte comparison. It does not upload anything or replace source assets.
- Added `app/scripts/public-media.mjs`: creates redacted release copies at the same URLs after Vite builds. Images are auto-oriented, converted to sRGB and stripped of embedded EXIF/XMP/IPTC/ICC; images already without those metadata blocks are copied unchanged. Videos retain video/audio packets through stream-copy remuxing while global/stream metadata, chapters and non-audiovisual streams are excluded. New unsupported formats fail closed.
- Added `app/scripts/public-media-smoke.mjs`: rejects synthetic tagged image/video inputs, verifies complete source/output URL inventory and checks original hashes, optimized WebP byte equality and every video/audio stream hash. The build audits every output, not only the three discovery photographs.
- Pinned `ffmpeg-static` 5.3.0 as a build dependency so redaction does not depend on a system-installed FFmpeg. The binary is a build tool, not a browser asset. A build/install without that binary fails rather than publishing unredacted media.
- The existing media publisher now sanitizes and audits its selected local stage before its first AWS call. Its target selection and URL paths are retained. The publisher was not executed against AWS.
- Reconciled README, Design.MD and the implementation plan with verified local/hosted status.

Neither source city data nor planner/snapshot/storage logic was edited. Source originals stay in place; only generated output copies are redacted. The release JPEG copies may differ in encoding; source originals and a restorable backup are retained. This work does not claim that metadata stripping conceals visible people, signs or places in photographs.

## Backup and restore evidence

At the user’s direction, the backup is **outside iCloud on the same Mac**:

`/Users/brendan/Backups/copy-my-trip/phase0-20261012T020728Z/`

The archive contains **330 files, 587,864,856 bytes**: all 323 public media files and seven media manifests. Every archive entry was restored into an isolated directory, hashed, and compared with both its pre-copy hash and the source. All passed. `manifest.json` beside the tar contains file and archive SHA-256 hashes. Permissions restrict the backup directory/files to the user. Temporary restored copies were removed after verification.

This closes the requested local backup/restore work. It is not an off-device disaster-recovery backup; the user explicitly chose a same-Mac location. Disk loss would still affect both copies.

## iCloud recovery and validation workspace

Apple’s supported `FileManager.startDownloadingUbiquitousItem(at:)` operation materialized on-demand project files. The initially blocked Git status and whitespace checks subsequently completed. iCloud then offloaded files again under disk pressure, including the Git index, package manifests and newly edited files. Repeated hydration alone was not a durable fix.

Generated dependencies were installed at `/Users/brendan/Library/Caches/copy-my-trip-deps/node_modules`, with the checkout’s ignored `app/node_modules` pointing there. The old generated dependency directory was retained as ignored `app/.node_modules-icloud`. Source originals were not moved. A stable verification copy is at `/Users/brendan/Library/Caches/copy-my-trip-phase0-check`; its media comes from the verified backup and its source changes are mirrored to the original checkout. Credentials, hosting-local state and review caches are excluded. Small tracked source Git objects are cached locally, with the original history available as an alternate rather than duplicating large archive blobs. Seven unreadable on-demand baseline objects were fetched read-only from the existing GitHub remote and verified against their exact Git hashes; no remote state was changed.

The old regenerable `app/dist` was removed to recover disk space; the final validated build is in the verification copy’s `app/dist`. This workaround closes the blocked checks without disabling iCloud or changing system storage settings. The iCloud checkout can still be offloaded in the future; use the non-iCloud copy for reliable local runs, or choose a permanent non-iCloud development location separately.

Apple API reference: [download an iCloud item](https://developer.apple.com/documentation/foundation/filemanager/startdownloadingubiquitousitem(at:)).

## Hosted reconciliation — read-only

### Vercel

The connector confirmed project `prj_RtJg4LkI9SEam8rChiQA9D7LedSX` / `copy-my-trip`, Vite, Node 24.x and READY production deployment `dpl_9rQocsJzX9v4QKfrEVoFJetF6ZHP`, sourced from `main` at `e3e4e115086cf56614e7a951326dab9239de7474`. The CLI independently confirmed **Root Directory = `app`**. No project linking or deployment change was made.

The connector denied environment metadata access (403). The CLI’s existing credentials succeeded using explicit project/team GET requests. Only variable metadata and the allowlisted non-secret feature booleans/service hostnames were inspected; credential values were not fetched or printed.

| Production configuration | Observed value |
|---|---|
| `VITE_AI_ENABLED` | `false` |
| `AI_ENABLED` | `false` |
| `COMPANION_EMAIL_ENABLED` | `false` |
| `VITE_ACCOUNT_EMAIL_READY` | `true` |
| `COMPANION_APP_ORIGIN` | `https://copy-my-trip.com` |
| `SUPABASE_URL` and `VITE_SUPABASE_URL` | `wxpsiguklujutvttrqrn.supabase.co` |
| Weather flags | No project-level entries in the returned inventory; source defaults disable weather |
| Media base override | No project-level `VITE_MEDIA_BASE_URL` entry in the returned inventory |

These are current project settings, not a claim that all values are unchanged since the last build. No secrets were exported. The environment inventory returned production targets; no newly deployed Elsewhere preview exists.

Read-only public HTTP checks returned HTML 200 for `/`, `/paris`, `/rome/compose`, `/paris/saved` and `/paris/day/3`. The SPA’s client redirects are covered separately by route tests. Anonymous GETs to `/api/trips` and `/api/notifications` returned 401; `/api/account` returned 405. All three private API responses carried `Cache-Control: private, no-store`. These checks did not create sessions, accounts, trips or notifications.

### Supabase

The linked project is `wxpsiguklujutvttrqrn`, named **`copy-my-trip-preview`**, active in `us-east-1`. Despite its name, it is the database configured in Vercel production. Treat it as production for access and testing decisions.

| Migration | Local | Applied remotely |
|---|---|---|
| `202609120001_companion_cloud` | Present | Yes |
| `202609120002_account_deletion` | Present | Yes |
| `202609120003_itinerary_emails` | Present | Yes |
| `202609120004_weather_cache` | Present | **No** |

Migration listing and a separate PostgreSQL transaction with `default_transaction_read_only=on` / `BEGIN READ ONLY` agreed. The transaction read only migration and PostgreSQL schema/security metadata, then rolled back. It did not read traveler rows. RLS is enabled on all eight deployed public tables. The three direct trip-read policies restrict authenticated reads to `auth.uid() = owner_id`; writes use the existing RPC boundary. RPC metadata shows explicit grants and constrained empty search paths. Mail-worker anonymous execution is capability-gated in the existing implementation; a grant alone is not proof that it is publicly callable without its capability.

No migration, flag, policy or schema was changed. The unapplied weather migration is an explicit deployed/source difference, consistent with disabled weather; it is not silently marked repaired. Account A/B mutation tests, cloud save/download round trips and mail delivery tests were deliberately not run against this database under the user’s read-only constraint. Read-only policy inspection is not equivalent to executing those mutation tests.

## Media privacy and evidence

The local release-output audit covers **282 images, 40 videos and one existing Markdown slot document**, with all 323 paths retained. Source fingerprints are checked around redaction. Existing optimized WebP URLs retain their bytes. The archive audit’s eight findings and 18 evidence proposals remain proposals; no visit/location judgments were promoted into city data.

A read-only GET of the currently hosted original Eiffel photograph returned 200 and still contained EXIF. Therefore **the existing hosted deployment remains exposed to its legacy metadata behavior**. The local redacted build cannot alter already-published Vercel/CDN copies or caches. Resolving that hosted exposure requires a separately authorized release/cache review; no such release occurred here. Originals remain working inputs in the local repo/backup, and local Vite source serving should not be exposed publicly. Use the built output to validate the privacy boundary.

## Validation results

All 19 commands completed with exit code 0 from the non-iCloud verification copy on 2026-10-12 UTC:

- `test:preservation`, `validate:cities`, `validate:culture`, `smoke:plans`, `smoke`.
- `test:companion`, `test:cloud`, `test:review`, `test:mail`, `test:weather`, `test:weather:mail`, `test:proposals`, `test:analytics`.
- `test:map-media`, `smoke:media-url`, `test:media-preservation`, `media:audit`, `archive:evidence`.
- `build`: application/API TypeScript checks, unbundled API runtime smoke test, Vite production compilation, full media redaction and `test:public-media`. Build completed in 62 seconds locally. The media checks rejected synthetic tagged inputs, verified every output path and original hash, retained optimized WebP bytes, and independently compared identical audiovisual stream hashes for all 40 videos.

A separate local publisher-stage exercise sanitized one selected original without adding other paths; no AWS calls occurred. `npm run dev -- --host 127.0.0.1 --port 4319 --strictPort` started normally in 1.7 seconds. HTTP reads of `/discover`, the application entry module, `/api/catalog` and the Rome catalog filter returned 200. The browser rendered all four works and original-photo sections through this normal development server, with no console errors. This resolves the former dependency-preparation stall without a custom preview harness.

The initial slice’s earlier production-build browser checks also verified desktop rendering, 390px layout without horizontal overflow, derivative image loading, Rome + Books filtering, work/source detail, save → reload → Saved, removal → reload, empty-search recovery and navigation into the existing Rome Compose flow. Those earlier checks are distinguished from this follow-up’s new development-server check; no real account or itinerary was modified.

The machine-readable local command results are recorded in `phase0-validation.json`. An independent Git-blob hash comparison of every tracked working file found no missing tracked files and no changes to source media, city data or companion/planner logic. `git diff --check` passed for every changed tracked file, including the previously existing build-plan edit, which was left untouched. Broad Git commands can still stall while consulting uncached historical media objects in iCloud; the scoped checks and full file-hash comparison avoid that dependency. No clean-tree claim is made.

Live write-based tests were excluded by instruction, not reported as passing. There is no claim that the new GitHub workflow ran remotely. Existing large-bundle warnings and existing dependency advisories are documented rather than hidden by unrelated upgrades. The dependency audit listed baseline-browser-mapping, browserslist, nanoid, postcss, react-router/react-router-dom, sharp and source-map-js; no advisory in that inventory named the added ffmpeg-static dependency. This is not a general security certification.

## Architectural assumptions to reconsider before expanding

1. **Database-first P1 is too broad for this four-work proof.** The existing repo already uses deploy-versioned curated files. A strict public schema and real API provide a complete small slice without creating new operational DB dependencies. Normalized works/editions/creators, migrations, RLS, external IDs, review decisions and revisioned publication remain required before multi-editor or automated ingestion. The current DTO is not the complete domain model from document 03.
2. **“Reviewed” must distinguish source checks from curator judgment.** Source-attributed facts can be evaluated locally without pretending the curator read/watched the work. This preview exposes the distinction; the editorial publication policy and human acceptance must be settled before a public launch.
3. **A user-visible Phase 1 slice needs a small shell.** Discovery/detail/save affordances exercise the P1 contract; they are intentionally limited borrowing from the proposed P2/P3 interface, not completion of those phases. There is no root-route replacement, cloud journey, semantic search, ranking engine or planner handoff.
4. **Preservation requires separating originals from release copies.** This follow-up retains originals and all URLs while stripping metadata from generated outputs. Hosted originals still need a separately authorized release/cache review. A same-Mac backup is not off-device disaster recovery.
5. **Single destination per work and edition labels are temporary constraints.** Before multi-city works or adaptation families, migrate stable IDs into normalized many-to-many claims and edition/parent models. Do not turn city text into planner POIs or imply filming locations.
6. **A four-item client filter is sufficient now; pagination/FTS are premature.** Preserve the same hard-filter semantics when the server grows. Do not call this natural-language or semantic retrieval. Search text is local URL state; no new analytics collection was added.

## Scope and next gate

Phase 0’s local preservation, backup/restore, release-media hygiene, documentation and read-only environment reconciliation are the scope of this follow-up. Remaining release-only checks are explicit: deployment of sanitized outputs, cache/CDN behavior, and mutation-based account/mail checks in a designated disposable environment. They cannot be completed through read-only production inspection and were not attempted.

Full Phase 1 remains incomplete: the catalog is a deploy-versioned four-work DTO, source-reported city connections are distinct from curator endorsement, immersion is unreviewed, bookmarks are device-local, and there is no normalized cultural database, publication workflow, semantic retrieval or planner handoff. Revisit those assumptions only after accepting this preservation handoff. Do not proceed to later phases automatically.

Rollback remains additive: revert discovery routes, navigation, rewrite and catalog handler together; retain `elsewhere-shelf-v1` so bookmarks survive. Neither rollout nor rollback requires trip storage migration or schedule regeneration. Keep the release-media privacy boundary when reverting the discovery UI.
