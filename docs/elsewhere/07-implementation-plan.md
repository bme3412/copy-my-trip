# 07 — Implementation plan and evaluation

This document records the original roadmap. The user subsequently authorized Phase 0 and the smallest complete user-visible Phase 1 slice. See [10 — Implementation and Phase 0 validation](10-initial-slice-implementation.md) for completed local work, read-only hosted reconciliation and explicit remaining release gates. Full Phase 1 and later phases remain unauthorized for this follow-up. Deliver work in small reviewable changes. Each phase must preserve all currently supported trip routes and accepted schedule semantics. Use additive migrations and flags; disable new surfaces on rollback without deleting new user data. No production migration is part of this assignment.

## Dependency order and release boundary

P0 preservation → P1 cultural contracts/reviewed seed → P2 public editorial discovery → P3 private journeys/structured search → MVP release. Natural-language interpretation may follow within P3 only after evaluation and quota gates. P4 archive/atlas expansion → P5 reviewed planner handoff → P6 other media/monetization. Basic links into existing Compose can ship in P2; passing selected cultural candidates requires P5.

This changes the suggested brand-first order: schemas/rights and real reviewed content should exist before a prominent discovery launch. It moves the golden evaluation set before automated enrichment. Initial culture models include edition/parent abstractions, but only book/film implementations are required.

## Phase 0 — Preservation baseline and deployment reconciliation

**Outcome:** existing travelers retain working plans, exports, account flows and deep links; team has a reproducible release gate.

**Workstreams / repository changes:**

1. Add preservation fixtures under future `app/scripts/fixtures/preservation/`: accepted Paris/Rome snapshots with recorded waits, return travel, variant provenance, narration, old engine/catalog releases, corrupt local envelope and legacy draft. Derive sanitized fixtures from existing test factories; never copy real private trips.
2. Extend companion/cloud/route tests with exact canonical equality checks across branding/new route changes; enforce unchanged storage keys, snapshot schema and catalog hashes for presentation-only commits.
3. Add a reviewed CI workflow invoking existing build, cities, planner, companion, cloud, review, proposals, mail/weather and media/analytics offline suites. Run localhost tests on a permitted runner. Add no credentials to offline CI.
4. Reconcile README/Design.MD status with this audit. Read deployed commit, root directory, flags and applied migration IDs through approved read-only operations in a later implementation task. Record environment matrix; do not infer deployment from source.
5. Inventory served media outputs, EXIF on public fallbacks and the 18 archive-evidence proposals; classify privacy issues separately from disputed visit evidence. Establish an original backup/restore sample before media changes.

**Migrations/APIs:** none. Existing API behavior is the baseline. Do not “fix” old snapshots or migrate local storage.

**Dependencies:** reproducible Node 22-compatible install; access to a safe test environment for later hosted verification; curator review of media/evidence.

**Tests:** all existing offline gates; raw HTTP direct links on hosted preview, account A/B RLS and save/download round trip with disposable accounts when authorized; confirm build output does not contain private archive metadata. Browser accept/reload/edit-copy/print at desktop and 390px. Historical test records are not substitutes.

**Risks:** environmental differences, stale docs, hidden deployed settings, public source-media fallback. **Acceptance:** checked baseline artifacts and command results, old release snapshots render unchanged, route matrix signed off, deployed/source differences listed, backup restore demonstrated. **Deferred:** rebrand, new tables/providers, original-media relocation and worldwide ingestion.

## Phase 1 — Cultural contracts, rights and seed catalog

**Outcome:** a curator can review a small Paris/Rome book/film dataset and a place-free theme collection; no public claim is generated without support.

**Changes:** create `src/lib/culture/schema.ts` with runtime parsing for work/edition/agent/geo/relation/claim DTOs; `server/culture/` adapters with a provider-policy manifest; `scripts/culture/validate.ts` and `scripts/culture/review.ts` adapted from existing review semantics. Add a sanitized golden corpus under `scripts/culture/evals/`. Keep existing `scripts/review` behavior/tests unchanged.

**Migration:** additive entity registry, works/titles/credits/editions, typed book/film details, geography/planner mapping, taxonomy, claims/sources/reviews/publication revisions. Include FKs, uniqueness, public projection and curator-only writes. Seed Paris/Rome IDs without changing City JSON. Rollback disables culture reads, preserves tables, and never drops cmt data.

**API:** introduce public `GET /api/catalog`; internal import/review/publication command uses expectedRevision and proposal hash. Enforce rights field allowlist before payload persistence. Unknown provider rights blocks that field, not the entire hand-curated catalog.

**Dependencies:** P0; approved source policies and editorial ownership. TMDB commercial decision must precede its commercial ingestion; original annotations and cleared identifiers are the fallback.

**Tests:** work/edition and remake collisions, alternate languages, duplicate external IDs, geography predicate specificity, stale proposal rejection, unsupported claim withholding, role escalation, public-vs-private source projections and migration rollback/forward on disposable DB. Golden evaluation records require independent human judgments.

**Acceptance:** proposed target 30–40 works across Paris/Rome and one cross-city theme, with each published consequential relationship supported and approved; no arbitrary filler to hit the count. At least one ambiguous/contradictory and no-archive fixture. Ingestion retry is idempotent; every public field has a policy. **Risks:** rights delay, sparse evidence and review throughput. **Deferred:** automated bulk enrichment, vectors, audio media, auto-publishing interpretive claims.

## Phase 2 — Editorial Elsewhere surface

**Outcome:** people can explore Paris, Rome and a non-geographic theme through books, films and existing approved photography; existing planning remains available.

**Changes:** add global shell, DiscoveryHome, DestinationPage, WorkPage and public EditorialCollectionPage; keep CityContext scoped. Extend routes in `App.tsx`, `Layout.tsx` adapter, `vercel.json` deep-link handling and `analytics.ts` redaction. Reuse fonts/tokens and image components. Add reviewed editorial content outside City. Build a static public HTML/release manifest, canonical metadata and sitemap for published entities; keep private routes noindex.

**Migration:** none beyond P1; editorial collection relations/publication projection if not included there. Do not edit city hero JSON merely to rebrand; put new brand copy in the new surface to preserve catalog compatibility.

**API:** bounded public catalog reads/pagination and publication revision. No new planner API. “Plan a visit” links to existing Compose with no automatic draft write.

**Dependencies:** P1 seed and published-safe images; hosting preview. **Tests:** existing route/city/companion gates; new deep-link refresh and HTTP metadata checks, unknown entity 404, privacy of unpublished records, mobile/keyboard/reduced-motion checks; Rome no-archive behavior and failed derivatives.

**Acceptance:** reviewer can move destination → work → evidence → theme → existing planner; old saved links/bytes/catalog hashes remain stable; direct new URLs work; raw response carries useful public HTML and canonical tags; no private content in HTML. Keep `/` old behavior until P3 release. **Risks:** route collision, fallback exposing original metadata, editorial data changing planner hash, confusing brand transition. **Deferred:** new domain, large atlas, rich recommendation engine, SSR/framework migration.

## Phase 3 — Personal journeys and useful discovery (MVP completion)

**Outcome:** users can find eligible works, save a flexible journey, reopen it and request new discoveries excluding consumed works. Discover becomes the default landing page only after these flows work.

**Changes:** `lib/collections/schema.ts`, collection client/state with session fencing, JourneyPage, SaveToCollection, editable query dimensions and full-text result rows. Add `server/culture/search.ts`, deterministic rank/explanation functions and query golden harness. Add optional interpretation endpoint behind an independent feature gate after structured search works. Do not broaden trip preference extraction.

**Migrations:** owner-scoped collections/items, work states and explicit interests with RLS/WITH CHECK, auth-user cascading deletion and composite child ownership; FTS projection/index of permitted published text. Mutation IDs, revision checks and quotas (proposed 100 collections/account, 500 items/collection, notes <=2,000 characters; product-adjustable but server enforced).

**API:** collection GET/POST and work-state changes per [06](06-target-architecture.md); `POST /api/discover` with <=20 results/page; `POST /api/interpret-discovery` returns proposed dimensions/ambiguities only. Server derives ownership, limits query body and rejects unknown filters. Return safe structured errors (400 invalid, 401 sign-in, 404 unavailable, 409 conflict, 429 budget, 503 provider unavailable). Personalized results are never publicly cached.

**Dependencies:** P1/P2; golden relevance baseline; approved model spend limits for optional NL. **Tests:** account A/B direct-RLS isolation, save/reload/idempotent retry, concurrent note edit, sign-out response fence, deletion, consumed/edition dedup, hard filter compliance, AI-disabled/manual fallback, prompt injection and invalid structured model response, analytics redaction.

**Acceptance:** save → sign in → persisted confirmation → reload → open journey succeeds; errors never report false saves; all ten golden categories pass hard safety checks; relevance/latency targets below met on held-out data. Root route switch has a one-flag rollback to current Home. **Risks:** account friction from in-memory sessions, superficial recommendations, private-query cache leaks, model costs. **Deferred:** hidden behavioral profiling, social sharing, collaborative edits, vector retrieval until demonstrated gain.

## Phase 4 — Archive workbench and cultural atlas

**Outcome:** approved photo clusters, neighborhoods and cultural works are navigable in both directions; curator can review batches efficiently.

**Changes:** asset contracts, private ingest manifest, redaction verifier, contact-sheet/map review UI and typed geographic map adapter. Extend existing map/list and media components; retain original filenames and snapshot URLs. Add publication manifest adapter for the deliberate Vercel/CDN split, not an automatic bulk republish.

**Migrations:** assets/private metadata/derivatives/rights/annotations/geo links, editorial observations; bounded job queue and audit if unattended processing is needed. Separate private source grants from public derivatives. No existing media deletion.

**API:** public geographic/asset projection; curator batch proposal/review endpoints with expected revisions and per-item decisions. Worker API is separate from mail cron. Add country/neighborhood containment retrieval without forcing planner support.

**Dependencies:** P0 backup/privacy gate, P1 claim model, measured P3 demand. **Tests:** metadata inspection on every published derivative and fallback, private-original URL denial, coordinate order, model-only location withheld, cluster exceptions, duplicate jobs/crashes, revoke→CDN invalidation and snapshot image-unavailable fallback, restoration drill.

**Acceptance:** one 100-image candidate batch can be processed/resumed with explicit reviewer choices and no accidental recommendation promotion; all published assets have rights/redaction records; Rome still works without photographs; review time measured against manual baseline. **Risks:** sensitive location disclosure, weak GPS inference, expensive backlog. **Deferred:** complete 50-country labeling, face recognition, user uploads, automated endorsements.

## Phase 5 — Cultural interests to deterministic trip planning

**Outcome:** selected supported cultural places become reviewable inputs for a new itinerary; infeasible or unsupported requests are explained.

**Changes:** `lib/culture/planner-handoff.ts` pure adapter and HandoffReview; integrate only at Compose input boundary. Bind handoff to catalog version and publication revision. Map a small reviewed set of themes to existing interests/six planner themes. Do not add model scheduling. Use existing generatePlan, day context, unplaced requests, snapshot acceptance and edit-copy.

**Migrations:** versioned approved planner-place mappings only; if a new planning city is introduced, separately update registry, timezone validator, hosting and cloud SQL allowlist with preservation tests. Discovery-only cities need no planner migration.

**API:** `PlannerHandoffV1` returns supported requests and unsupported reasons, never accepted snapshots. No changes to `/api/trips` or snapshot v1 are required for place-level MVP handoff. Defer exact experience requests until explicitly versioned extraction/engine support exists.

**Dependencies:** P1 evidence, P3 journey selection; P4 not required for plain place handoff if reviewed mappings already exist. **Tests:** unknown IDs, cross-city/experience mismatch, closed and timed sites, avoided places, stale catalog, duplicate selection, impossible pins, preservation of current draft on cancellation, exact unchanged old snapshots, no AI calls on acceptance/replay.

**Acceptance:** a Rome cultural collection can produce validated inputs, review an infeasible request, generate deterministically and accept a new version while original accepted bytes remain identical. Refresh/retry cannot overwrite an unrelated draft. **Risks:** conflating related-with-visit-worthy, variant scope, catalog drift. **Deferred:** LLM edits to accepted schedules, arbitrary internet POIs, reservations, intercity scheduling.

## Phase 6 — Additional media and monetization

**Outcome:** selected podcasts/music/audiobooks add useful depth; rights-cleared outbound offers or premium collections can be tested without distorting ranking.

**Changes:** implement typed episode/recording/release/edition adapters and rendering; source-specific refresh/expiry; disclosed affiliate link component. Add optional entitlements only after a business decision and separate billing architecture review. No payment provider is selected here.

**Migrations:** relevant media extensions/parent constraints and availability policies; later entitlements isolated from editorial claims and collection ownership. **API:** versioned media filters, source-compliant availability read; no audio hosting/transcript pipeline by default. Billing/webhook contracts require a separate approved design when monetization is chosen.

**Dependencies:** P3 relevance and retention evidence, provider agreements, review capacity. **Tests:** show versus episode identity, track/release duplicates, audiobook narrator/abridgment, territory expiry, rights revocation removing embeddings, attribution, affiliate disclosure and unchanged evidence-based ranking. **Acceptance:** one medium at a time meets the same golden hard gates and a documented budget/license; paying must not change whether a claim is true. **Risks:** license incompatibility, provider access restrictions, audio rights, commercial bias. **Deferred:** booking marketplace, streaming playback, worldwide automated coverage and opaque collaborative filtering.

## Golden evaluation set before scale

Create a small versioned set before building bulk enrichment: proposed 60 query cases (at least six for each category below), about 80 entity-resolution pairs, and 40 claim/evidence cases. These are target sizes, not existing validated fixtures. Separate approximately 40 development and 20 held-out queries; ensure authors/works do not all overlap. Include supported positives, near-miss negatives, unknowns and contradictory sources. Two human judgments for a representative subset, with adjudication and uncertainty labels; model-to-model agreement is only a diagnostic.

Each fixture: query, explicit dimensions, rights-safe evidence references, expected eligible/ineligible IDs, graded relevance 0–3, expected uncertainty/abstention, relationship types, source review date and explanation. No paid API/model access is required in the deterministic test run. Live adapter checks use a separate capped evaluation job. Do not include proprietary full texts in fixtures.

| Case family | Required distinction / expected behavior |
|---|---|
| Everyday Berlin novels | Inhabit-city evidence beats superficial Berlin keywords; compare plot-only and passing mentions |
| Rome setting scope | Primarily set in Rome ranks eligible; brief Rome sequence excluded from primary-setting filter |
| Modern settings | Recent publication of historical fiction does not satisfy a modern story-period filter; unknown period withheld |
| Film locations | Verified filmed-at point requires scene/source evidence; setting or production country does not qualify |
| Neighborhood podcast | Episode-level evidence and exact neighborhood, not a show's broad city description |
| Cross-media thematic discovery | Human-judged social mobility/reinvention relevance beats shared title words; include place-free requests |
| Photo provenance | Preserve source asset/reviewer/geo scope; exterior or distant GPS cannot establish interior participation |
| New discoveries | Work marked consumed excluded even via translated edition/alternate ID, unless user explicitly opts in |
| No personal archive | Rome or discovery-only city remains useful, with no borrowed photos/firsthand claims |
| Incomplete/conflicting metadata | Unknown, ambiguity or no result; never fabricated explanation or false certainty |

### Release measures (proposed targets; tune only through documented decisions)

| Measure | How measured | Initial gate |
|---|---|---|
| Entity resolution | Labeled pairs and merge audit; precision/recall separately | >=99% precision, >=90% recall; zero known false merges in critical remake/edition fixtures |
| Geographic accuracy | Correct predicate + entity + scope on labeled relations | >=98%; zero unsupported exact filming/firsthand claims |
| Theme relevance | Human graded top-five matches | Precision@5 >=0.8 on theme cases; record inter-rater disagreement |
| Overall recommendation relevance | Held-out graded rankings | nDCG@10 >=0.8 and no regression versus curated/FTS baseline; report raw sample counts |
| Evidence support | Published consequential claims trace to permitted evidence and approval | 100% traceability; zero known unsupported released claims |
| Filter compliance | Media/setting/relation/consumed constraints across full result sets | 100%; unknown does not pass strict filter |
| Duplicate detection | Top-ten canonical duplicates and hard merge pairs | Zero duplicate works in top ten; preserve distinct adaptations |
| Latency | Warm/cold and p50/p95, fixed dataset/network profile | p95 structured search <=1s server; optional interpretation <=4s or bounded fallback; no uncapped enrichment on request path |
| Enrichment cost | Provider + model spend / approved work and approved claim | Initial experiment <=$1 per approved work and explicit daily ceiling; report curator minutes separately |
| Privacy/security | RLS isolation, unpublished/EXIF projection and log tests | Zero cross-owner/private-metadata leakage |

Small samples do not establish population accuracy. Report confidence intervals/raw counts and hold release for any critical unsupported claim even when aggregate metrics pass. Pin data/model/prompt/ranking versions; compare before/after on unchanged held-out fixtures. Every wrong relationship becomes a regression case. Vector retrieval ships only if it improves judged relevance without violating filters, rights, latency or budget. A product check complements offline scores: can users find a meaningful work and understand why it relates, then return to their saved journey? Do not equate a successful build or a filled catalog with this outcome.
