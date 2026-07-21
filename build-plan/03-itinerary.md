# 03 — The Itinerary (merging the builder into the days) ✅ (shipped 2026-07-21)

Written as deltas against `00-current-state.md`, in the manner of `02-roadmap.md`.

**Shipped note:** implemented as designed, with one data reality found on the
way: 8 of the 26 Paris curated-day stops (Café de la Mairie, Saint-Sulpice,
Shakespeare and Company, Quai de Montebello, Le Bon Georges, Place du Tertre,
Marché d'Aligre, Coulée verte) have no place record, so only curated day 1
(7/7 linked) forks stop-by-stop today; days 2–4 offer the build-from-scratch
path instead. Authoring those 8 places is a curator data task — when they land
in `places.json`, the validator's name↔placeId check will demand the links and
the fork lights up with no code change. Replay flags are shown transiently
after an edit ("Needs a look · …"); a persistent day-audit is deliberately not
attempted because generated days may carry a different pace than the trip's.

**Restyle round (same day), from the updated design mocks:** the itinerary
gained the remove-× per stop (`removeAt` — legs close up around the gap) and
the "Something missing?" panel (`insertionSuggestions` → `bestInsertion`:
nearby sights whose least-disruptive insertion breaks nothing, every position
tried, never after dinner). The itinerary map is Mapbox (`TripMap` — gold
dashed route, numbered provenance rings, clickable candidate pins), with the
print-style SVG `RouteMap` as the no-token fallback (numbered rings
filled/dashed by provenance, dotted travel lines, the river as a data-backed
ribbon — `City.river`, Seine + Tiber).
Stops picked up the anchor chip, the "timed slot" note and the
"Book a timed slot before you go" callout from `entry.json`; the day deck
gained `**hood**`/`*place*` emphasis rendered by `lib/text.tsx`. The day
meter was retired in favor of the walk/métro summary caption.

**Narration-only intro (same day, by decision):** the deterministic deck was
removed from the UI entirely — the day intro IS the LLM narration
(`lib/narrate.ts` → `/api/narrate-day`), with ghost lines while it's written
and nothing when the API is absent. Narrations retry with backoff, prefetch
across all trip days (current day first), stay cached per day-content in trip
state, and now receive `notableClosures` so the paragraph can explain a
Monday. `builtDayDeck` and its smoke tests were deleted; `builtDayTitle`
remains the deterministic title. One principle-note: "hard constraints are
code, never prompts" still holds — narration explains the day, the engine
still decides it.

**Decision (2026-07-21):** "The days" is renamed **Itinerary** everywhere, and the
Day builder stops being a page. Building becomes a *mode of the itinerary*: every
stop on an itinerary day carries a reconsider affordance that opens the builder's
candidate deck inline — other viable moves *relative to the prior activity* — and
choosing one swaps the stop and recomputes every transit leg and arrival time
downstream.

## 1. Why this is a generalization, not a rewrite

The two pages already share their object and most of their machinery:

- Both render a `DayState`. `DayPage` goes through `built-day.ts`; `BuildPage`
  renders `day.committed` directly. One render path already exists.
- `buildCandidates(city, day, pace, visited, opts)` is stateless over the day it
  is given. It does not know whether that day is "a day being built" or "the
  first k stops of a finished day".

That second fact is the whole merge: **reconsidering stop k = running the
existing builder on the day truncated to stops 0..k−1.** The current builder is
the special case k = committed.length (append). One engine call serves viewing,
editing and building; the candidate deck moves from a page column into a
per-stop fold.

## 2. Engine deltas (`app/src/lib/planner.ts`)

Three pure functions, built from existing primitives. All deterministic — the
result of a swap is a function of (day, k, chosen variant, pace, date), the same
invariant surface the smoke tests already police.

### `truncateDay(city, day, k, pace): DayState`

The day as of the moment after stop k−1: `clock` = stop k−1's `timeIn + dur +
linger` (k = 0 → `city.dayStart`), `loc` = stop k−1's place (k = 0 → the stay),
`committed` = stops 0..k−1. **Meals are computed from the whole day minus the
incumbent**, not the prefix — otherwise a mid-morning swap with lunch scheduled
downstream would trip `needMeal` forcing and offer lunch cards for a sight slot.

### `alternativesAt(city, day, k, pace, visited, opts): Candidate[]`

`buildCandidates` on the truncated prefix, with three adjustments:

1. **Visited excludes the incumbent** (its place must not block its own slot)
   but keeps every other stop of this day and all other days — the no-repeats
   invariant holds during editing, not just generation.
2. **Meal slots stay meal slots.** If the incumbent is lunch/dinner/coffee,
   alternatives are filtered to the same meal kind; if it isn't, forced-meal
   injection is suppressed (see `truncateDay`'s meals rule). Swapping can change
   *where* lunch happens, never *whether*.
3. **Day-anatomy caps see the suffix.** New `CandidateOpts.suffix?:
   CommittedStop[]` — anchor-taken, timed count, long-transfer count and the
   stop budget are counted over prefix + suffix, so swapping stop 2 can't offer
   a second anchor when stop 5 already is one.

Append remains `buildCandidates` unchanged (empty suffix, real meals) —
`BuildPage`'s behavior verbatim.

### `replayFrom(city, day, k, chosen, pace, opts): { day: DayState; impacts: StopImpact[] }`

Commit the chosen candidate at k, then re-commit each suffix stop in order with
the same travel/wait/linger math as `commitPlace`, resolving hours through
`stopPlace` + `effectiveHours` for the real date. Every suffix stop is
re-checked against the hard filters and annotated:

- **shifted** — still valid; carries `deltaMin` (arrival change). This is the
  "transit updates too" requirement: the leg *into* the swapped stop changes
  (shown on the candidate card) and the leg *out of it* to stop k+1 changes
  (recomputed here, re-rendered as `transitAfter`).
- **broken** — a named constraint in plain words: "arrives 40 min after its
  best window", "reservation slot no longer reachable inside its 15-min
  buffer", "pushes dinner past 22:00". Broken stops are **flagged, never
  silently dropped or repaired** — they render marked, with their own
  reconsider fold as the fix. Unknown is a legitimate state; so is broken.

### Impact pre-flight

Before the deck opens, run `replayFrom` once per candidate (≤6 candidates × ≤7
suffix stops of arithmetic — synchronous, trivial) and attach a one-line impact
to each card: *"next leg 9 min walk, was 14 min métro · day ends 21:40 (+15)"*,
plus *"would break 1 later stop"* where true. Honest deltas beside every
choice — the same register as measured vs estimated. Breakers are down-ranked,
not hidden.

## 3. UI deltas

### One page: `ItineraryPage` (from `DayPage`, absorbing `BuildPage`)

- **Header** keeps the day tabs, title, deck/narration, and gains from the
  builder: the segmented day meter (now always visible — the day's shape is
  itinerary information, not builder chrome), the trip verified label, and the
  pace control.
- **Timeline**: each `DayTimeline` row gains a small **reconsider icon** (the
  fan-of-three as a glyph; right edge, hover-revealed on pointer, always
  visible on touch; `aria-label="Reconsider this stop"`).
- **Click → the row's fold opens** — reuse `.fold` from `app.css`; "closes like
  a shut page" is already the system's motion for exactly this. Inside, the
  **ReconsiderDeck**:
  - Header: *"Other ways from Café Hugo at 9:45"* — the prior activity and the
    prefix clock, literally the user-facing form of `truncateDay`.
  - Up to 3 `CandidateCard`s (extracted from `BuildPage` nearly as-is:
    provenance tags, transit/arrive/duration, price/menu/tickets, reasons,
    forecast) plus the new impact line.
  - A quiet "Keep {incumbent}" closes the fold.
  - Choosing runs the existing choreography end to end: `cmt-choose` /
    `cmt-reject` on the cards, fold shuts, the swapped row `commit-enter` +
    `dot-stamp`, every shifted time downstream re-keys through `fade-swap`, the
    meter redraws its changed segment with `meter-seg-new`. No new motion is
    invented; the merge recomposes the print vocabulary.
- **Append is the same deck.** An unfinished day ends with a dashed "next stop"
  row (rendered while `isDayDone` is false) whose fold shows the append-position
  candidates — today's BuildPage, slot by slot. An empty day is just that row
  alone, with BuildPage's "You're at your place at 9:00" copy. This is how
  `BuildPage` dies without losing anything.
- **Map**: `DayMap` normally; while a fold is open, candidate pins overlay
  (BuilderMap's hover-link behavior scoped to the open deck).

### Curated days fork on first touch

Curated stops are presentation data (`DayStop`, no place id). Tapping
reconsider on a curated day first **materializes it into a built `DayState`** —
the page already promises this: "your version replaces this one here." Data
delta: add `placeId` to each curated-day stop in
`app/src/cities/*/data/curated-days.json` (the validator's curated-stop ↔ place
cross-check gets a real key at the same time). The curator's original stays in
city data untouched; "Start over" (`resetDay`) falls back to rendering it.
Provenance-true: the curated day remains the curator's; your edit forks it.

### Terminology and routes

- Nav (`Layout.tsx`): "Day builder" and "The days" collapse into one link,
  **"Itinerary"**.
- `FlowStepper`: 01 Plan · 02 Itinerary. Build is no longer a step.
- Routes (`App.tsx`), following the existing `plans → compose` redirect
  pattern: `itinerary/:n` is primary; `day/:n` redirects to it; `build`
  redirects to `itinerary/1`. `ComposePage`'s "Build it yourself" links to
  `itinerary/1`.

## 4. State deltas

None structural. A swap is `updateDay(dayIndex, replayFrom(...).day)` — the
existing `TripContext` API suffices. The narration cache invalidates itself
(its key is `id@timeIn` per stop), falling back to the deterministic deck
instantly while `narrate-day` re-runs. `PERSIST` semantics unchanged.

## 5. Edge cases, named

- **k = 0**: the prior activity is home — "Other ways from your place in
  Le Marais at 9:00".
- **Swapping dinner**: same-meal filter keeps the day fed; last-stop swaps have
  no suffix, so the impact line is just the end-of-day time.
- **Swapping an anchor away** is allowed (the day simply loses its anchor —
  the buffer-day shape); swapping one *in* is guarded by the suffix-aware cap.
- **Variety scoring** at slot k judges against the prefix's last group —
  exactly the "relative to the prior activity" ask.
- **Pins, excludes, interest weights** from the extracted brief flow into
  `alternativesAt` the same way `BuildPage` passes covered/usedHoods/home
  today — the page computes them once for both viewing and reconsidering.
- **Pace change** on the itinerary currently only affects future picks; with
  `replayFrom` in hand, replaying the whole day at the new pace is a natural
  follow-on. Out of scope here; noted for the backlog.

## 6. Invariants (`app/scripts/preset-smoke.ts` additions)

- **Swap determinism**: the same swap on the same day yields byte-identical
  id/time sequences.
- **Swap safety**: applying any offered break-free alternative leaves a day
  that passes the whole existing suite (≤1 anchor, ≤2 timed, ≤1 long transfer,
  meals unique, home by 22:00, best windows, no repeats across the trip).
- **Impact honesty**: a candidate whose pre-flight reported no breaks replays
  clean; break counts match the replay.
- **No spurious meals**: reconsidering a non-meal slot never offers meal cards
  when the meal exists elsewhere in the day.

## 7. Order of work

1. `planner.ts`: `truncateDay`, `alternativesAt` (+ `CandidateOpts.suffix`),
   `replayFrom` + `StopImpact`.
2. Extract `CandidateCard` and the day meter from `BuildPage` into components;
   add the impact line to the card.
3. `ReconsiderDeck` (fold + deck + choreography).
4. `DayPage` → `ItineraryPage`: meter, map overlay, per-stop icon + fold,
   append slot; `DayTimeline` rows gain the icon/fold mount.
5. Routes, nav, stepper renames + redirects; delete `BuildPage.tsx`.
6. `placeId` on curated stops + validator check; curated-day materialization.
7. Smoke invariants; update `Design.MD` §3/§5 and `00-current-state.md` page
   inventory when shipped.

**Done when:** `/build` and `/day/:n` redirect; a curated day forks on first
reconsider and "Start over" restores it; swapping a mid-day stop visibly
updates both adjacent transit legs and all downstream times; a swap that would
strand a timed reservation shows the break instead of hiding it; all smoke
invariants (old and new) pass.
