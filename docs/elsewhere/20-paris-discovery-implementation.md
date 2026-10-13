# Paris stories, connections and personal atlas

Implementation and local review: October 12, 2026. Implements approved concepts 1, 2, 3, 4, 6, 7 and 8. No deployment, remote publishing, Supabase changes, account synchronization or planner integration.

## What changed

- `/discover/place/paris` is now a photographic, story-first hub. Paris search matches titles, creators, names and editorial summaries with entity-type filters. Four featured starting points connect into the reviewed network. The existing multi-city landing page and city-neutral library remain intact.
- A separate versioned discovery dataset references the existing 19 Paris works and introduces 11 entities: three places, two people, two themes, three stories and one free collection. Fourteen relationships comprise six sourced connections and eight explicitly labeled editorial connections. Original work IDs, metadata, media, archive coordinates and catalog API contracts remain unchanged.
- Before Sunset’s three place connections now come from the shared dataset. Its standalone page adds the same selectable connection graph/list used by place, person, theme and story pages. Only reviewed edges are exposed; pending edges are excluded. SVG nodes have labels, keyboard links and sources in the equivalent list. The graph is optional below 1100px, where the list comes first.
- Dedicated place, person, theme, story and collection pages live beneath the Paris route. Shakespeare and Company gets sourced history, links, a catalog-position map and connected works/people. It deliberately uses typography because no verified original shop photograph was available. Other archive photographs keep their real location captions; they are not film stills or photographs of this shop.
- Discovery trails hold their ordered path and active branching step in the URL. Selecting an earlier step and following a connection replaces only the later branch. Save, name, reopen and delete trails locally. Invalid, missing, disconnected or oversized paths recover without crashing or silently inventing a connection.
- Three short editorial stories rotate deterministically by the Europe/Paris calendar date. The hub checks the date every minute while open. Read time is estimated at 200 words/minute, rounded up to one minute. The complete story archive remains available independently of the daily spotlight.
- The free Literary Paris collection links five ordered starting points. Each can open a detail page or start a trail. Saving or removing the collection never changes its members’ independent saves.
- The local Paris atlas combines explicit entity saves, explicit read/watched/visited marks, existing Paris work bookmarks and saved trails. It supports type/activity filters, undo, timestamps and map selection. Existing work bookmarks have no timestamp; the UI says so rather than fabricating dates. No page view, graph click or trail step is recorded as an activity.
- Existing work saves still use `elsewhere-shelf-v1`. The new independent key is `elsewhere-paris-personal-v1`. No trip keys are read or written by the new personal-state code. The Saved screen links to the atlas and complete recovery tools.

## Evidence and editorial boundaries

Sources checked for this increment:

- [Criterion: The Before Trilogy — Time Regained](https://www.criterion.com/current/posts/4445-the-before-trilogy-time-regained): bookshop reading, Promenade Plantée, river setting and director context.
- [Shakespeare and Company: official history](https://www.shakespeareandcompany.com/history): George Whitman’s shop, 1951 opening, 1964 name change and Baldwin’s inclusion among early visitors. The current shop is explicitly distinguished from Sylvia Beach’s earlier bookstore.
- The existing reviewed publisher citation for Giovanni’s Room supplies author attribution; its catalog record and source were not changed.

The river is a broad setting and has no invented exact pin. The place map uses existing catalog reference coordinates, not camera positions or a reconstructed film route. No reference-image quotations, commercial stills, fictional counts, unsupported Lost Generation links, opening hours or itinerary promises were imported. Stories contain original editorial prompts and short factual summaries, not copied source articles.

This is an additive, local public-facing dataset, not promotion of the offline candidate review queue. Imported evidence, publication decisions and existing 21-work catalog remain byte-for-byte unchanged. Television, podcast, episode, music and album records were not fabricated or added. Generic work references and the media-kind contract anticipate those formats; their original catalog schema still needs a separately validated extension before such records can ship.

## Interfaces and storage

Routes added:

- `/discover/place/paris/places/:entityId`
- `/discover/place/paris/people/:entityId`
- `/discover/place/paris/themes/:entityId`
- `/discover/place/paris/stories` and `/stories/:entityId`
- `/discover/place/paris/collections` and `/collections/:entityId`
- `/discover/place/paris/trails?path=<comma-separated typed IDs>&step=<index>`
- `/discover/place/paris/atlas?type=<entity kind>&status=<activity>&place=<catalog place ID>`

The Paris hub accepts `q` and `type`; connection views accept optional `node=<typed entity ID>`. Existing `/discover/browse` query parameters and standalone work links are preserved. Legacy Paris `?place=` URLs still load a usable hub with links into the dedicated place pages. Existing Before Sunset `?place=` selection remains functional.

Runtime validation checks unique IDs, source references, work/place references, collection membership and relationship review/evidence. Trails are limited to 24 connected steps. Personal data is versioned, bounded and parsed before each write. Unavailable IDs are retained for recovery rather than silently discarded.

Writes reread storage under Web Locks, detect changed snapshots and report storage failures. Storage events refresh other tabs. The complete JSON backup includes original raw atlas and shelf strings, so corrupt originals remain exportable. Restore validates both stores, requires an export and explicit in-product confirmation, acquires both locks and attempts rollback if either write fails. Atlas reset preserves work bookmarks. Saved trips are never part of these operations.

## Validation

Automated checks:

- `test:culture-import`: all eight importer tests and generated-evidence check passed; offline source inputs unchanged.
- `test:culture`: source/schema/API/search tests and existing bookmark persistence, corruption, quota, conflict and trip-isolation tests passed.
- `smoke`: all original planner/landing/library routes and new Paris routes passed. Intentional old Paris presentation assertions were updated; original itinerary preservation assertions remain. Added place/person/theme/story/collection/atlas routes, valid/invalid trails, invalid graph selection and zero-result search.
- `test:preservation`: frozen Paris/Rome snapshots, catalog hashes, storage keys, deterministic replay, retired releases, narration and recovery passed.
- New `test:paris-discovery`: graph integrity, pending-edge exclusion, missing evidence, duplicate IDs, deterministic search/filtering, branching, missing/disconnected/oversized paths, Paris-date rollover, daily rotation, persistence, corrupt-data retention, valid-data quota failures, concurrency conflict detection, backup round trip, partial-restore rollback and unavailable-item retention passed.
- Production build includes TypeScript, unbundled API runtime checks, Vite and the public-media integrity checks. Media verification passed for 282 images, 40 videos and one document, with unchanged originals/WebP derivatives and 40 identical audiovisual stream hashes. Existing large Mapbox/application chunk warnings remain.

Browser flow on a separate local review origin, `127.0.0.1:5174`:

- Paris hub → Before Sunset → start trail → bookshop → Baldwin → save → reload → reopen from atlas.
- Branch from the bookshop to Literary Paris; Back restores the prior branch, Forward and reload restore the new branch. Focus moves to the next-step heading.
- Select a graph node and inspect the same connections through its accessible list. Place and film details link into the same data.
- Combined search for Baldwin and Person returned one result; zero-result behavior is covered by route/data tests.
- Save a place, mark visited, undo; save a work and mark watched. The atlas shows a place pin only for the explicit place action. Filtering to watched leaves the work in the list with zero pins.
- Save and remove a collection; independently saved place/work remain. A second tab receives a save without reload.
- Export full backup through the UI, select the downloaded file, validate and confirm restore; both work and personal records remain available.
- Screenshots and layout reviews at 390, 768, 1280 and 1600px. No horizontal overflow in inspected hub/place layouts; mobile connection list has no nested scrolling panels. Keyboard Tab reaches a visible outlined action; graph recentering restores heading focus. Unnamed card-image links were fixed.
- New text/control color pairs checked at contrast ratios 14.52:1, 6.26:1, 9.73:1 and 5.55:1. A low-contrast map pin caused by button-style inheritance was fixed. Graph center labels now wrap.
- Reduced-motion rules remove Paris animations/transitions; graph positions are static and map fitting uses zero duration. OS-level reduced-motion switching was not exercised.

Screenshots in `paris-discovery-screenshots/` include the hub at all four widths, place/graph desktop and mobile, local atlas and 640px reflow. Example saves in these screenshots are test records created on port 5174; the existing port-5173 browser storage was not used for these tests.

## Remaining limitations and assumptions

1. **Native 200% zoom:** the in-app browser ignored both native zoom shortcut variants. Half-width 640px reflow (equivalent to a 1280px viewport at 200% for layout) was checked with visible focus and no overflow; this is not a claim of native zoom verification.
2. **Street-map service:** no Mapbox token is configured in the local review environment. The labeled coordinate schematic is verified, including centered single-place pins and filtering. Authenticated street tiles still need verification in an environment with the existing token configured. No token or hosting setting was changed.
3. **Editorial scale:** this is a deliberately small network, three short stories and one free collection. Wider content requires evidence and rights review. The daily spotlight rotates existing stories; it does not promise daily publication.
4. **Atlas semantics:** the timeline represents currently retained explicit saves/statuses and their timestamps, not an immutable event log. Undo removes the status. Original shelf saves have no historical timestamp. Account sync, cross-device merge and inferred history remain out of scope.
5. **Storage atomicity:** Web Locks coordinate participating tabs. Browsers without Web Locks use synchronous reread/conflict detection; that is not a transactional database. Two-key recovery has rollback, but a browser crash or persistent storage failure during rollback requires the downloaded backup.
6. **Architecture:** the original book/film catalog remains schema v1. The new discovery model is a separate validated projection, not a replacement catalog or cloud migration. Future media, ingestion/CMS workflows and shared editorial ownership need a coordinated schema revision. Typed references avoid duplicating work facts now.
7. **Phase boundaries:** this approved increment supersedes the earlier presentation-only boundary for Paris relationships and local personal state. It does not authorize commerce, subscriptions, account sync, automated planner handoff or itinerary redesign.

## Local delivery

Implementation was developed and validated in the established clean non-iCloud checkout `/private/tmp/elsewhere-push-check`. Changed existing files were compared against the original workspace and established cache copy before mirroring; both matched the pre-change Git baseline. Source/report/screenshot copy-back is recorded below after final comparison. No commit, push or deployment is part of this increment.

### Final copy-back and review

All 26 delivered source, test, report and screenshot files were mirrored to the original iCloud workspace and `/Users/brendan/Library/Caches/copy-my-trip-phase0-check`, with SHA-256 equality checks. Three original files became iCloud `compressed,dataless` placeholders after initially matching the baseline. Their placeholders and pre-change Git contents were retained at `/private/tmp/elsewhere-paris-prechange-backup`; validated replacements were installed atomically and their bytes verified. No unrelated files were overwritten.

The final production build/media suite and Paris tests passed after the last graph-label and map-pin contrast fixes. The temporary generated `dist` folder was removed after validation to recover 579 MB of disk space; original media and source remain intact. The updated stable preview is running at `http://127.0.0.1:5173/discover/place/paris`, and its story-first hub was verified in the browser. Final browser error log check returned no errors. Native zoom and live street-tile limitations remain as documented above.

## Discovery-led hub follow-up

Removed the hero’s “Find your starting point” and “Or be surprised” controls and the Paris hub’s search/type-filter form and explanatory text. Featured discoveries and editorial sections now remain visible, including for legacy q/type URLs. The paris-search anchor remains valid for existing links. Intentional work search remains in the city-neutral library.

Validation: TypeScript no-emit check and the full route smoke suite passed, including assertions that the removed controls are absent. No catalog, personal storage, planner or itinerary changes. This focused follow-up did not rerun the production media build. A more experiential arrangement of the remaining cards is a design recommendation, not implemented in this follow-up.
