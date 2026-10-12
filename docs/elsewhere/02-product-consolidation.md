# 02 — Product consolidation

Recommendation: evolve the existing application into Elsewhere on the existing stack and initially the existing origin. Treat cultural discovery, private collections and itinerary planning as separate domains with explicit links. This is an additive product expansion, not an engine replacement.

## Product boundaries

- **Discover:** place-optional search and editorial entry point. A topic such as technology and power must work without choosing a city or dates.
- **Places:** cultural geography, with destinations allowed to exist without a schedulable City or firsthand photographs.
- **My Elsewhere:** private saved entities and flexible cultural journeys. A journey is an ordered or unordered collection, not an accepted itinerary and not a completion checklist.
- **My Trips:** an index into existing local/cloud trips and unchanged planner routes. Keep “Copy My Trip” as a transitional explanation (“Trip planning, originally Copy My Trip”), rather than a permanent competing top-level brand. Product judgment can revisit naming without renaming storage keys or tables.

Current City combines planning, geography and editorial content. It can supply places and planner capabilities, but must not become the universal discovery schema: it requires day templates, hours, starting location and timezone even for content-only destinations. Add Destination/GeoEntity and explicit planner mappings. Paris is the archive-rich pilot; Rome proves that researched destinations remain valuable. Lisbon is a future editorial dataset, not an implied supported planning city.

## Route compatibility matrix

| Existing/new URL | Recommended action | Reason |
|---|---|---|
| `/` | Keep redirect initially; change to Discovery Home only at MVP readiness | Avoid an empty rebranded landing page |
| `/discover` | Add outside `/:city` layout | Topics and natural-language dimensions are not city state |
| `/places`, `/places/:slug` | Add geographic index and destination pages | Can include discovery-only destinations |
| `/works/:id/:slug?` | Add stable work ID with optional readable slug | Titles change; IDs persist |
| `/collections/:id/:slug?` | Public editorial collections only | Never expose a private journey by a guessable public route |
| `/my`, `/my/journeys/:id` | New owner-scoped library/journey UI | Independent persistence and account state |
| `/trips` | New aggregation/index; links to current saved routes | Keep repeated-city cloud segments visible |
| `/paris`, `/rome` | Retain during transition; link to new destination pages | Existing users keep familiar entry points |
| `/:city/compose`, `itinerary/:n`, `saved/*`, `today`, `mail/*` | Retain exact paths and behavior | Links, mail, recovery and local snapshot identities survive |
| `/:city/archive`, `neighbourhoods` | Retain; add related cultural links | No forced atlas migration |
| `plans`, `build`, `day/:n` aliases | Retain redirect behavior | Existing compatibility is an asset |
| Invalid new entity URL | Real missing-content view and correct public HTTP status where generated | Do not redirect every missing work to Paris |

Register explicit global routes before the generic city branch, but preserve CityContext solely where it is needed. Refactor Layout into a small shared navigation shell and a city adapter, without moving TripProvider semantics or forcing global discovery through `useCity`. Update `app/vercel.json` for new route families, keep `/api` untouched, and test direct URL requests and browser refresh on the hosted preview. Extend `analyticsPath` with redacted route templates; never record discovery text or journey IDs.

## Accounts, persistence and collections

Reuse existing Supabase auth.users identities, recovery, verified email and deletion flows. New `ew_collections`, `ew_collection_items`, `ew_user_work_state`, and explicit interest tables use owner_id from authenticated context. Do not add cultural entries to `cmt_plan_versions.snapshot`, `TripState.days`, or the existing 20-snapshot local envelope. A saved destination may be a collection item even when planning is unsupported.

Anonymous browsing remains complete. MVP offers explicit sign-in to persist a collection; retain a pending save in page memory and confirm it after authentication. A separate validated anonymous library store/import can come later. Never imply that memory-only saves survive reload. Do not silently import local trips into accounts or use trip briefs to build a taste profile. Start personalization with editable interests and “consumed / want to explore / not interested”; retain reset/delete controls.

## Reusable interface

Use current editorial tokens, self-hosted fonts, image handling, Page spacing, provenance language and accessible navigation patterns. Keep the planner's itinerary workspace and account panels intact. New work rows, evidence disclosure, editable discovery dimensions and collection sections are needed. CandidateCard/ReconsiderDeck are designed around schedule feasibility and should remain planner components. DateRangePicker belongs in the planning handoff, not on every discovery page.

## Domain transition

Keep copy-my-trip.com active through the whole MVP. Branding can change in place without changing the browser origin. A new Elsewhere domain is a separate migration decision: browser localStorage and in-memory sessions cannot be transferred by a 301. Before any redirect, provide export/import and optional explicit cloud save, a recovery landing page on the old domain, exact path redirects, revised Supabase allowlisted recovery URLs, mail origin checks and durable old media URLs. Do not forward recovery tokens to analytics or third-party URLs. Do not redirect all old deep links to the new homepage.

Do not rename `cmt-*` storage keys, SQL tables or `CopyMyTripMedia` CDK stack for brand consistency. Those names are compatibility/infrastructure identities. The old origin may need to serve recovery tools indefinitely for dormant local-only users; choose retention based on actual usage, not an arbitrary launch date.

## Sequence and product changes from the initial concept

1. Establish preservation fixtures and clarify hosted configuration; leave current users' data untouched.
2. Add a preview navigation shell and Paris/Rome destination pages using external editorial data, not edits to City.
3. Add a small reviewed books/films catalog and theme browsing, including a place-free collection.
4. Add private saved journeys and structured search; introduce natural-language interpretation only behind quality/cost gates.
5. Make Discover the root landing page when the end-to-end save/reopen and planner-link paths pass.
6. Add approved place handoff and atlas exploration after evidence coverage justifies them.

The MVP narrows the initial all-media concept to books and films because sourcing rights and relationship review, rather than UI routing, are the largest new work. It brings basic saving before a full atlas because a durable personal collection establishes value sooner. It keeps the existing origin because preserving local users is more consequential than immediate domain symmetry. These are sequencing changes, not reductions to the long-term vision.
