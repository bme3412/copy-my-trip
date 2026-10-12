# 05 — UX and information architecture

Use the current light editorial design, not a visual rewrite. `styles/classical.css`, `editorial.css`, `fonts.css`, Home, Page, ImageSlot and HeroPhoto already establish the typography and image treatment. Preserve map/list alternatives, focus styles, skip links and reduced-motion behavior. Four primary nav items: Discover, Places, My Elsewhere, My Trips. Account controls remain optional for browsing. Dates appear only when planning or explicitly refining discovery timing.

## 1. Discovery Home

**Purpose:** help a visitor articulate an interest and find a few meaningful entry points.

**Hierarchy:** short proposition (“Discover a place through its stories”), one search field, two editorial examples, a featured destination or thematic essay, then a modest saved-interest shortcut when signed in. Results use an introductory editorial line and grouped book/film rows with one sentence of evidence-backed relevance, not an endless card grid or chat transcript.

**Interaction:** submit “Contemporary novels about expatriates living in European cities.” Show editable dimensions: books/fiction; expatriate life; Europe; story setting period; language/availability if requested. Do not treat publication year as story setting. “Lisbon next month” resolves a destination and an editable relative month using the user's timezone, not exact itinerary dates. Unknown constraints prompt refinement; no matches offers a clearly labeled relaxation that the user chooses. A subject-only query leaves geography empty.

**Reuse/new:** reuse Page, field/button/focus tokens and ImageSlot. Add DiscoveryQueryForm, DiscoveryDimensions, DiscoveryResults, WorkRow and ClaimExplanation. Do not reuse `ExtractedPrefs` as the discovery schema: its vocabulary is deliberately narrower and city-bound.

**Mobile:** field spans width, refinements open in a labeled sheet with focus return; show a readable summary and no long horizontal chip strip. Each work row has a clear title link and separate Save button.

**States/navigation:** skeleton rows retain dimensions during load; keyword/manual fallback when AI is unavailable; explicit no-supported-results state; retry without losing query on search error. Save stays pending until persisted; link to work, destination, theme and journey. No fabricated answer fills an empty result set.

## 2. Destination page

**Purpose:** connect a place's daily life and cultural stories with archive evidence.

**Hierarchy:** reviewed photograph or text-led cover, short editorial introduction, provenance note, “Inhabit the city” reading section, screen section, one neighborhood essay, related places/map toggle and optional plan-a-visit link. Additional media appears when catalog coverage exists, not as empty carousels. Avoid putting all content into identical cards.

**Interaction:** explore works by qualified relationship; open “why this connection” to see concise evidence and uncertainty; save destination or a work; move between neighborhoods and essays. Distinguish set-in, filmed-at and thematic association in normal language. Never present all book mentions as recommended physical stops.

**Reuse/new:** reuse HeroPhoto, ImageSlot, Page, ArchiveMap's marker/list patterns and existing fallback approach. Add DestinationPage, EditorialSection, RelationshipLabel, EvidenceDisclosure and a geographic adapter so discovery-only places do not require City. Existing `NeighbourhoodsPage` remains reachable while richer pages are introduced.

**Mobile:** image then editorial text and anchored section index; map opens on demand with list equivalent, rather than taking the first screen. Keep captions visible. Target readable line lengths and 44px touch controls.

**States/navigation:** destination exists without photographs or works; explain researched coverage and show useful text. Broken image uses an honest fallback. Withheld claims disappear from recommendations while an unavailable collection entry can remain identifiable. Unknown destination returns missing content, not Paris. Link to works, neighborhoods, collections and planner only when supported. Paris and Rome are the first contrasting prototypes; Lisbon requires new editorial review.

## 3. Cultural journey / My Elsewhere

**Purpose:** preserve a flexible set of discoveries before, during and after travel without mandatory completion steps.

**Hierarchy:** title/optional note, editorial grouping (Read / Watch / Explore, or user sections), saved work rows, places and a small next-discovery area. No compulsory progress rings or date schedule. “Discover Lisbon Before You Go” can remain valuable after the trip.

**Interaction:** save/remove/reorder, add a note, mark consumed or not interested, move to another collection and edit interests. Reordering supports buttons as well as drag. Saving the same canonical entity twice is idempotent; editions remain accessible within the work. Explicit state drives “new discoveries” exclusions. Removing from a collection does not erase global consumed state without a separate action.

**Reuse/new:** reuse account entry/recovery patterns and status/error language, not cloud trip serialization. Add JourneyPage, CollectionSections, SaveToCollection and WorkStateControl with a separate collection API/cache. Public curated collections and private journeys have different visibility contracts; sharing private journeys is deferred.

**Mobile:** inline save confirmation, compact section menus, clear navigation back to originating destination/query. Preserve scroll position across work detail navigation.

**States/navigation:** anonymous Save explains sign-in and retains intent in memory; empty library offers one editorial starting point; offline/failed save visibly remains unsaved; stale revision offers reload without discarding the user's note. Sign-out clears private fetched content, late requests are fenced. Deleted/withdrawn works display an unavailable item with remove action. Link to work/destination and explicit trip handoff.

## 4. Planning handoff

**Purpose:** translate selected cultural interests into a reviewable planner brief while preserving deterministic scheduling.

**Hierarchy:** chosen destination, selected supported places/interests with evidence labels, editable dates/pace/stay, then the existing Compose choices and itinerary editor. Show unsupported places and reasons separately. Existing accepted itinerary is never the destination of an implicit write.

**Contract:** proposed `PlannerHandoffV1` has destination ID, known planner city ID, selected approved relationship IDs, allowed `(placeId,experienceId?)` candidates, supported interests/theme weights and provenance references. It has no stop times, durations, hours or snapshot mutation. Resolve against current catalog and reviewed mapping server-side or in a validated trusted adapter. A cultural taxonomy concept does not directly become one of the six planner themes without an explicit reviewed mapping.

**Flow:** user chooses “Plan a visit”; validate mapping; preview selectable inputs; existing draft conflict offers keep/export or explicit replacement; user chooses dates; adapt to `ExtractedPrefs` includes/avoids and supported preset inputs; `generatePlan`/`buildCandidates` enforce openings, anchor/timed caps, duplicates and travel budgets; show unplaced requests; accept a new snapshot only through the existing flow. If a snapshot is open, offer edit-copy only when compatible. No approval of a discovery collection authorizes itinerary changes.

**Reuse/new:** DateRangePicker, ComposePage, itinerary workspace, ReconsiderDeck and snapshot acceptance remain. Add HandoffReview and a pure culture-to-planner adapter. Experience-specific requests cannot be squeezed into today's place-only ExtractedRequest: initially offer only supported place/default-experience mappings; extend the request schema in a separately versioned engine workstream if exact variants are needed.

**Mobile/states/navigation:** review before redirect; no new drag-based planning. Missing planner catalog gives “Explore this destination” without fake scheduling. Stale mapping, unavailable catalog or infeasible requests produce clear reasons, preserving the discovery collection and existing trip. Back links return to the originating journey/destination; refresh cannot repeat a destructive draft replacement.

## Prototype and acceptance order

1. Paris destination with reviewed photo and three book/film rows; Rome text-led counterpart. Test whether evidence is understandable without visual clutter.
2. Place-free Discovery query with editable dimensions, no-match and AI-disabled variants.
3. Save → sign in → journey → reload, including conflict/failed-save states.
4. Rome handoff to existing Compose, including a rejected place and an existing draft.

Use realistic reviewed content or conspicuously synthetic test fixtures. Check keyboard-only operation, focus after sheet close/navigation, screen-reader names, 200% zoom, contrast, reduced motion, 390px mobile and slow-network image behavior. Current render smoke tests are useful regressions, not substitutes for these interactions. Do not prototype six media carousels before validating whether users understand the cultural relationship labels.
