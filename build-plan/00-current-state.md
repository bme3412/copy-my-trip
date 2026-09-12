# 00 — Current state

What exists today, described in the vocabulary the rest of the plan uses. The point
of this document: `02-roadmap.md` is written as *deltas against this*, not as a
greenfield build. Counts and line references are accurate as of 2026-07-24; treat
them as "at time of writing".

## September 2026 update

The sections below preserve the July architecture description. Current changes
are documented in [plan 11](11-copy-my-trip-companion-implementation-plan.md):
validated local drafts and immutable accepted snapshots, faithful replay with
recorded timing/return travel, saved-trip/Today/briefing routes, explicit optional
narration, and experience-scoped provenance. Two narrow Anthropic routes and the
separate local OpenAI curator pilot now exist. Optional account/cloud-save code
and a tested PostgreSQL migration are implemented. The approved Supabase preview
is connected and migrated; hosted Auth/RLS and browser save/download checks pass
([preview verification](13-supabase-preview-verification.md)). Password recovery and account deletion are implemented; an application preview is deployed
([plan 14](14-account-lifecycle-and-hosted-preview.md)). Signup/recovery delivery is
verified and enabled in the latest preview ([plan 15](15-domain-and-email-activation.md));
the approved production release is now live at `https://copy-my-trip.com`
([launch verification](16-production-launch.md)).
Scheduled itinerary delivery is implemented with the approved single-owner pilot
recorded in [plan 17](17-scheduled-itinerary-email-preview.md). Weather preview and
shared-cache/mail preparation are implemented locally, disabled and unapplied to
production ([plan 18](18-weather-preview.md), [plan 19](19-weather-cache-and-mail-integration.md)).
Commercial weather is deferred. Operational alternatives, traveler AI editing,
scoped MCP and broader rollout are planned in
[plan 20](20-alternatives-ai-mcp-and-rollout-plan.md); they do not depend on commercial weather.
Its first local alternatives slice is implemented and browser verified
([plan 21](21-local-alternatives-verification.md)); live source coverage and cloud proposal acceptance remain planned. The older
“no API / no LLM” and three-preset statements below are historical.

## The product in one paragraph

**Copy My Trip — "a verified archive, not a diary."** One curator's photo/video
archive, clustered by *place* rather than *trip*, is the trust foundation. Travelers
enter dates, pace, stay neighbourhood and interests; the engine composes day-by-day
plans from the curator's verified places, filling gaps from web research with visible
provenance (filled vs hollow marker, "N of M stops personally verified", measured vs
estimated travel times). The authoritative product definition is the design handoff at
`project/Copy My Trip.dc.html`; the app implements it.

## What's built

A fully client-side React 19 + Vite + TypeScript app in `app/`. No backend, no API
calls (Mapbox tiles aside), no LLM anywhere. Trip state lives in localStorage
(`app/src/state/TripContext.tsx`).

Pages (`app/src/pages/`, routed in `app/src/App.tsx`):

- **Home** — hero + entry points.
- **ComposePage** — collects arrival/departure dates, pace (gentle/balanced/full),
  stay neighbourhood, interests; then a choice of three generated plan presets.
- **ItineraryPage** (`itinerary/:n`) — a day, curated or built, rendered as a
  timeline with photo plates and provenance — with the builder folded in
  (`03-itinerary.md`): every stop carries a reconsider deck (alternatives
  relative to the prior activity, swap replay with recomputed transit and
  flagged breaks), unfinished days end in an append slot, and curated days
  fork into an editable engine-scheduled copy on first touch. Replaces the
  former BuildPage and DayPage; `build` and `day/:n` redirect. Both curated
  and built render through `app/src/lib/built-day.ts`.
- **ArchivePage / NeighbourhoodsPage** — the curator's archive on a map, and
  neighbourhood essays.

## The engine

`app/src/lib/planner.ts` (1042 lines) — a deterministic greedy day builder. The same
engine drives both the interactive builder and preset generation.

- **`ENGINE`** — one constants block holding stop budgets per pace, linger (drift)
  minutes, all scoring weights, day-anatomy caps (`maxTimedPerDay: 2`,
  `maxLongTransfers: 1`), wait tolerances, meal-forcing times and curfews.
- **`buildCandidates`** — hard filters first (visited, day-trip, weekday closure via
  `closedOn`, anchor already taken, timed cap, stop budget, opening hours, curfew,
  best-window timeliness, long-transfer cap), then `score()` over the survivors, then
  meal forcing (lunch from 11:45, dinner from 18:00, morning coffee when a café is
  within 15 min) and a variety-aware top-3 pick.
- **`isDayDone`** — dinner eaten, budget spent, evening wind-down, or nothing left.
- **`commitPlace` / `commitCandidate`** — advance the day clock (arrival + scaled
  duration + linger) and move the traveler's location.
- **Travel** — haversine distance; ≤1.2 km walks at 4.5 km/h, else metro at
  `11 + 4·km` minutes.

`app/src/lib/plan-presets.ts` — three presets (`first-time`, `off-beaten-path`,
`art-heavy`) that differ only in their pick-function over the same candidates, run
across seven `DayProfile` day templates (historic intro, Louvre anchor day, gentle
middle, golden-hour icons, Orsay/Left Bank, Versailles-or-east, buffer day).

## The data

Contracts in `app/src/cities/types.ts`; each city's data is static JSON under
`app/src/cities/<id>/data/`, loaded through a registry and gated by
`validate:cities` (Phase 1).

`Place` carries: coordinates, neighbourhood (`hood`), duration and its variance
(`durVar`), a daily `open: [h, h]` tuple with optional per-weekday `hours` and dated
`exceptions` (Phase 2), weekday closures (`closedOn`), preferred arrival window
(`best`), meal role, category `group`, trip `themes`, `role: 'anchor'`, `timed`
(reservation required), `dayTrip`, `experiences` variants (Phase 3), and provenance
(`src: 'verified' | 'web'`, `visits`, `last`).

At time of writing:

| | Paris | Rome |
|---|---|---|
| Places | 127 | 42 |
| — verified | 33 | 0 |
| — with a description | 37 | 42 |
| — with photo plates | 33 | 0 |
| Hoods | 11 | 8 |
| Curated days | 4 | 0 |

Plus 3 presets and 6 themes, shared. Media records and capture dates are generated
into `media-dates.json` by `app/scripts/extract-dates.sh`.

Two ratios drive the roadmap more than the totals do. **Verified is 26% of Paris and
none of Rome** — the catalog was 37 places at 62% verified before it grew, so almost
all growth has been web-tier. And **90 of 127 Paris places have no description**, so
they render as bare names. Depth, not breadth, is the constraint
(`06-archive-evidence.md`).

## The quality harness

- `app/scripts/preset-smoke.ts` (`npm run smoke:plans`) — regression invariants over
  generated plans: determinism, preset distinctness, no repeats across the trip, days
  populated, home by 22:00, ≤1 anchor, ≤2 timed, ≤1 long transfer, nothing scheduled
  on its closing weekday, no lunch before 11:00, best-window respected.
- `app/scripts/diag.ts` (`npm run diag`) — replays generation for eyeballing.
- `app/scripts/validate-city.ts` (`npm run validate:cities`) — the schema and
  cross-reference gate; proves a city's data agrees with **itself**.
- `app/scripts/media-audit.ts` (`npm run media:audit`) — proves the files on
  disk agree with the data about **where**: filename and GPS proposals, bare
  provenance claims, orphan slots, unconverted masters.
- `app/scripts/archive-evidence.ts` (`npm run archive:evidence`) — proves the
  data agrees with the archive about **when**, and about where the camera
  actually stood. Reports `best` windows contradicted by the shots, places
  whose light is sun-relative rather than clock-fixed, `visits`/`last` counted
  against distinct capture days, month-by-month season coverage, same-day
  transitions between places, and coordinates against each place's declared
  `lat`/`lon`.
- `app/scripts/archive-files.ts` — the metadata reader behind both. Capture
  moment and coordinates per file, derived `_gen-*` files resolved to their
  master: QuickTime tags via `ffprobe` for video, and a small EXIF/TIFF
  reader for photographs, because `sips` reports a date but will not surrender
  GPS and no dependency is worth two IFD lookups. Full **local** time is kept
  deliberately — `extract-dates.sh` truncates to `YYYY-MM`, and the hour is
  the part the engine needs.

  Paris coverage at time of writing: 114 of 114 files dated, 86 carrying
  coordinates. Location services split cleanly by era — every file from 2024
  on has GPS, nothing from 2022 or earlier does — so pre-2024 places can only
  be placed by hand.

  Both audits are **report-only by design**: capture metadata is evidence, and
  promoting it to a provenance claim is the curator's call, never a script's.
- All scripts use the `esbuild → node_modules/.tmp → node` pattern in
  `app/package.json`; new scripts should follow it.

## Concept map: originals' vocabulary → what exists

The superseded docs (`reference/`) describe machinery much of which is already here
under different names. This table is the bridge; caveats matter.

| Plan vocabulary (reference docs) | Existing implementation | Caveat |
|---|---|---|
| Operating rules (recurring hours) | `Place.open` daily tuple + optional per-weekday `hours` + dated `exceptions` + `closedOn`, pruned in `buildCandidates` | Shipped in Phase 2; the Louvre's late Wednesday is now representable. Only 3 Paris places actually declare `hours`, so most still run on one tuple. |
| Start windows on visit opportunities | `Place.best?: [h, h]` arrival window | Not soft-only: it's a soft score (`W.bestTime`, early = −3×) **and** a hard filter — >30 min outside the window disqualifies. Clock-fixed, so it cannot express golden hour in a city where sunset moves four hours a year; that is the Phase 8 delta. |
| Provenance / source hierarchy | `src: 'verified' \| 'web'`, plus `measured` travel legs, plus `visits`/`last` and capture metadata as evidence | A deliberate 2-level collapse of the reference 7-level hierarchy. `measured` is narrower than "EXIF-measured": only verified↔verified *walking* legs < 1.6 km; metro legs are always estimated, and no leg has yet been timed against the archive (`06-archive-evidence.md`). |
| Candidate scoring model | `ENGINE.weights` (9 named weights) applied in `score()` | Two contributions are hardcoded outside the weights block: morning-coffee bias +1.5 (planner.ts:280) and `hoodBias` +1.5 (planner.ts:292). Folding them in is a Phase 4 cleanup. |
| Fatigue / daily budgets | `stopBudget` per pace + `linger` drift + `PACE.f` duration dilation + curfews (`lastLeave`, `eveningWindDown`) + caps | The reference budget dict (`major_anchors_max: 1`, `timed_reservations_max: 2`, `cross_city_transfers_max: 1`) is *literally shipped* as the ≤1-anchor filter, `maxTimedPerDay` and `maxLongTransfers`. |
| Trip-level coverage | `Theme` + `tripThemes()` + `W.coverage` (capped ×2) | Soft-scored here; the reference makes coverage a hard requirement. Soft is canonical (see `01-principles.md`). |
| Trip-level anchors | `role: 'anchor'` + `dayTrip` + preset seeds (`louvremus`, `orsay`, `versailles`) | Seeds and hood names are Paris-hardcoded in `dayProfiles` (plan-presets.ts:88–107) — owned by Phase 6. |
| Day narrative structure | `DayProfile.purpose` (one line per day) + the 7-day template arc | Already the reference "day grammar" in miniature. |
| Reference itineraries | `CURATED_DAYS` in `days.ts` | |
| Generation strategies | `PLAN_PRESETS` pick-functions over shared candidates | |
| Probabilistic buffers | `maxWait`/`maxWaitDinner` + the day-7 buffer day (no anchors, no timed, 3 stops, gentle) | Crude precursors; real duration ranges are Phase 5. |
| Explanation layer | `forecast()` one-liners + "N of M verified" label | Precursor only — no per-stop "why this, why now"; that is Phase 4. |

## Known gaps (honest list)

The original six were all closed by phases 1–5 (`05-audit-remediation.md`). This is
the list as it stands now.

1. **The archive covers a quarter of the catalog.** 25 of 127 Paris places have any
   temporal evidence, 33 have plates, 37 have a description. The rest are web-tier
   names — the tier whose growth makes this resemble the planners it argues against.
2. **Rome ships zero verified places and zero plates.** Honest empty state, but the
   premise does not yet apply to half the shipped cities.
3. **`best` is clock-fixed.** A single tuple cannot mean "an hour before sunset", so
   it is wrong in one season by construction. Phase 8.
4. **`measured` is inferred, not walked.** Haversine over verified↔verified pairs, not
   a timed route. The archive can bound legs from above but cannot confirm them, since
   every photo-to-photo gap includes lingering (`04-engine-audit.md` improvement 6).
5. **Pre-2024 media carries no coordinates.** Location services were off; those places
   can only be placed by hand, permanently.
6. **Three plates are filed where their GPS disproves.** Awaiting curator
   identification (`06-archive-evidence.md`).
7. **`durVar` is sparse.** 49 of 127 Paris places declare it, so most duration ranges
   fall back to a default spread.
8. **The plan cannot leave the device.** Trip state persists in localStorage and
   nowhere else — no accounts, no calendar or offline export, no print stylesheet.
   A traveler cannot carry, share or reopen elsewhere the itinerary they built.

## Scheduled itinerary mail preview — 12 September 2026

The opt-in email implementation and 23 dedicated local checks are complete. The approved production release is live with a single-owner pilot. Its first real itinerary test is delivered; signed events, duplicate-request suppression, private access and exact saved facts pass. The second message is scheduled for 20:00 Eastern on 12 September; automatic verification, pause and cleanup follow. General delivery is restricted. See [plan 17](17-scheduled-itinerary-email-preview.md) for current deployment and pilot state; plan 16 is the prior release.

## Weather preview — 12 September 2026

The local prototype has an Open-Meteo adapter, strict normalized records, bounded process caching, clear failure/expiry labels, and shared app/HTML/text presentation. Browser and provider evaluation checks pass. It is not connected to production mail, and no weather subscription or cloud persistence was added. See [plan 18](18-weather-preview.md).

The next weather layer is implemented locally: a capability-protected shared cache, request budgets/leases, and forecast freezing before email submission. Migration 004 and production activation remain pending; tonight's mail release is unchanged. See [plan 19](19-weather-cache-and-mail-integration.md).
