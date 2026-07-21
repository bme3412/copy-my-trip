# 00 — Current state

What exists today, described in the vocabulary the rest of the plan uses. The point
of this document: `02-roadmap.md` is written as *deltas against this*, not as a
greenfield build. Counts and line references are accurate as of 2026-07-21; treat
them as "at time of writing".

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

`app/src/lib/planner.ts` (356 lines) — a deterministic greedy day builder. The same
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

Contracts in `app/src/cities/types.ts`; Paris data in `app/src/cities/paris/`
(compiled TS modules — moving this to JSON is roadmap Phase 1).

`Place` already carries: coordinates, neighbourhood (`hood`), duration, a daily
`open: [h, h]` tuple, weekday closures (`closedOn`), preferred arrival window
(`best`), meal role, category `group`, trip `themes`, `role: 'anchor'`, `timed`
(reservation required), `dayTrip`, and provenance (`src: 'verified' | 'web'`,
`visits`, `last`).

At time of writing: **37 places (23 verified, 14 web)**, 10 hoods, 4 curated days
(`days.ts`), 3 presets, 6 themes. Media records and EXIF capture dates are generated
into TS modules by `app/scripts/extract-dates.sh`.

## The quality harness

- `app/scripts/preset-smoke.ts` (`npm run smoke:plans`) — regression invariants over
  generated plans: determinism, preset distinctness, no repeats across the trip, days
  populated, home by 22:00, ≤1 anchor, ≤2 timed, ≤1 long transfer, nothing scheduled
  on its closing weekday, no lunch before 11:00, best-window respected.
- `app/scripts/diag.ts` (`npm run diag`) — replays generation for eyeballing.
- All scripts use the `esbuild → node_modules/.tmp → node` pattern in
  `app/package.json`; new scripts should follow it.

## Concept map: originals' vocabulary → what exists

The superseded docs (`reference/`) describe machinery much of which is already here
under different names. This table is the bridge; caveats matter.

| Plan vocabulary (reference docs) | Existing implementation | Caveat |
|---|---|---|
| Operating rules (recurring hours) | `Place.open` single daily tuple + `closedOn` weekday array, pruned in `buildCandidates` | One tuple for all days — no per-weekday hours (Louvre's late Wednesday is unrepresentable), no date exceptions. That is the Phase 2 delta. |
| Start windows on visit opportunities | `Place.best?: [h, h]` arrival window | Not soft-only: it's a soft score (`W.bestTime`, early = −3×) **and** a hard filter — >30 min outside the window disqualifies (`timely`, planner.ts:234). |
| Provenance / source hierarchy | `src: 'verified' \| 'web'`, plus `measured` travel legs, plus `visits`/`last`/EXIF dates as evidence | A deliberate 2-level collapse of the reference 7-level hierarchy. `measured` is narrower than "EXIF-measured": only verified↔verified *walking* legs < 1.6 km (planner.ts:163); metro legs are always estimated. |
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

1. **Interests are nearly inert.** The compose screen collects them, but they only
   gate the Versailles-vs-east day in `dayProfiles`. No interest-based scoring exists.
2. **One `open` tuple per place.** Late openings (Louvre Wednesday, Orsay Thursday)
   and date exceptions cannot be represented.
3. **Paris-isms in the generator.** `dayProfiles` hardcodes place ids and hood names;
   a second city is *not* a pure data drop until that moves into city data.
4. **Data is compiled into the bundle.** Adding or editing a city means editing TS
   source; there is no schema validation beyond the type checker.
5. **No per-stop explanations.** The engine knows why it picked a stop; the UI can't
   say so.
6. **Fixed durations.** A single `dur` per place; no ranges, no arrival buffers for
   timed entries beyond `maxWait`.
