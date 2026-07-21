# Design.MD — Copy My Trip

Design ground-truth for this repo. Everything below is pulled from the codebase —
`build-plan/`, `app/src/`, the city JSON, and the design handoff in
`project/Copy My Trip.dc.html`. Nothing invented, nothing placeholder: if it isn't
in the repo, it isn't in this document.

---

## 1. What this product is

**Copy My Trip — "a verified archive, not a diary."**

One curator's photo/video archive, clustered by *place* rather than *trip*, is the
trust foundation. Travelers enter dates, pace, stay neighbourhood and interests; a
deterministic engine composes day-by-day plans from the curator's verified places,
filling gaps from web research with **visible provenance**: filled vs hollow
markers, "N of M stops personally verified", measured vs estimated travel times.

The voice is first-person and evidentiary. The hero of the primary design
(`project/Copy My Trip.dc.html`) reads:

> **"These are the places I keep going back to in Paris."**

City copy (from `app/src/cities/*/data/city.json`):

| City | Tagline | Hero |
|---|---|---|
| Paris | "A verified archive, not a diary" | "Paris, from someone who's actually been." / "Real photos, real routes, real timings — copy a trip that's already been walked." |
| Rome | "Researched, not yet walked" | "Rome, planned with the same discipline." / "No archive here yet — every stop is web-researched and marked as such until it has been walked and shot." |

Rome's tagline is the provenance principle applied to itself: a city without an
archive says so, on its own hero.

## 2. The one principle that does design work

**Curator provenance** (`build-plan/01-principles.md` §1): every fact is either
**witnessed** (the curator's photos, EXIF dates, walked routes, repeat visits) or
**web-sourced**, and the UI never blurs the two.

This is the feature the design must establish before placing anything else. Its
existing visual vocabulary:

- **Filled vs hollow markers** — verified vs web places, on every map.
- **"N of M stops personally verified"** — the plan-level trust label.
- **`measured` vs estimated travel legs** — only verified↔verified walking legs
  under 1.6 km earn "measured" (`planner.ts`); metro legs are always estimates.
- **Archival photo plates** — `.plate` in `classical.css`: sepia-tinted
  (`sepia(0.22) saturate(0.82) contrast(1.05)`), 6px surface border, hairline
  outline. `.plate-cap`: an 11px caption line, "what it is · when it was shot"
  (EXIF dates via `app/scripts/extract-dates.sh`).
- **The verified-only fold** (`app.css` `.fold`) — web stops "close like a shut
  page rather than vanishing."
- **Unknown is a legitimate state** — unverified hours/exceptions are labeled
  as such, never presented with invented precision.

Current archive scale (from `places.json`): **Paris 121 places, 23 verified;
Rome 42 places, 0 verified.** The verified tier is small and precious — the
design treats it as the lead, not a filter option.

## 3. The product's native shape

The core data structures dictate the page shapes:

- **A day is a timeline.** `planner.ts` builds days as a clock — 9:00 start
  (`startLabel: "Your flat, Le Marais · 9:00 start"`), arrival + duration +
  linger drift per stop, meals forced (lunch from 11:45, dinner from 18:00,
  morning coffee when a café is within 15 min), home by 22:00. `ItineraryPage`
  renders it via `built-day.ts` with photo plates and provenance.
- **A choice is a fan of three — at any stop.** Every itinerary stop carries a
  reconsider affordance (`FanIcon`) that opens the `ReconsiderDeck` inline: up
  to three alternatives relative to the prior activity (`ENGINE.candidatePool:
  3`), each with travel time, arrival, duration, provenance, a one-line
  forecast, and an honest impact line ("next leg 9 min walk · day ends 21:40").
  Appending to an unfinished day is the same deck at the end position. The
  motion system encodes the decision: chosen card lifts toward the timeline
  (`cmt-choose`), rejected cards grayscale and drop (`cmt-reject`), committed
  stops stamp in (`cmt-stamp`), the segmented day meter deposits a block per
  choice (`.meter-seg-new`).
- **The archive is a map.** `ArchivePage`/`NeighbourhoodsPage`: the curator's
  places on a Mapbox map (filled/hollow), plus neighbourhood essays. Hoods are
  an ordered list per city (`hoodOrder` — 11 in Paris, 8 in Rome). The
  itinerary map is Mapbox (`TripMap`: gold dashed route, numbered rings
  filled/dashed by provenance, clickable candidate pins); without a token,
  `RouteMap` stands in — a print-style schematic of the same geometry with
  the river as a soft ribbon (`City.river`).
- **A trip is an arc of purposes.** Each day template carries one line of
  intent (`dayTemplates[].purpose`), e.g. Paris day 2: *"One demanding anchor —
  the Louvre — then Tuileries and the Palais-Royal at ease."* The handoff's day
  headers follow the same grammar: "Marais & the two islands", "Latin Quarter &
  the gardens", "Canal Saint-Martin & Montmartre", "The east side & a last
  river light".

Page inventory (routed in `app/src/App.tsx`, all under `/:city`):
**Home** (hero + entry points) → **Compose** (dates, pace, stay neighbourhood,
interests, free-text brief → three plan presets) → **Itinerary/:n** (the day —
curated or built — with the builder folded in: per-stop reconsider decks, an
append slot on unfinished days, swap replay with recomputed transit) →
**Archive** / **Neighbourhoods**. The old `build` and `day/:n` routes redirect.

## 4. Visual identity — the "Classical" system

Source of truth: `app/src/styles/classical.css` (tokens + components) and
`app/src/styles/app.css` (motion). Design-system reference copies live in
`project/_ds/classical-*/`.

**Color** (light, warm-neutral ground with a gilded accent):

```
--color-bg:      #f3f2f2      --color-accent:   #b68235
--color-surface: #eae9e9      --color-accent-2: #ac803e
--color-text:    #201f1d      --color-divider:  16% ink
```

Full OKLCH tonal ramps (100–900) exist for neutral and both accents, generated
on one shared lightness scale. The handoff's hero text sits on dark imagery in
`#f4efe6`. Shadows are soft ink-tinted (`#2d2b2b` at 14/16/22%).

**Type** (serif throughout — the archive register):

- Headings: **Cormorant Garamond 600** — semibold is the ceiling ("bold
  retired"; display text goes lighter, to the normal 400 cut — the handoff hero
  is 62px/400).
- Body: **Lora 400**, 15px, line-height 1.55.
- Scale: h1 42 / h2 32 / h3 25 / h4 20 / h5 16 / h6 13 (h6 uppercase,
  +0.08em tracking). Captions 11px at 55% ink.

**Space & shape:** 4.6px-based scale (`--space-1..8`: 4.6 / 9.2 / 13.8 / 18.4 /
27.6 / 36.8). Radii are tight and print-like: 2 / 4 / 7px.

**Motion** — the metaphor is **print: settle, draw, stamp. No springs.**
Durations 150/250/400ms, one ease (`cubic-bezier(.2,.7,.3,1)`). Named moves:
`cmt-fade-up` (settle), `cmt-draw-in` (the day meter draws left-to-right),
`cmt-stamp` (provenance dots arrive at 1.5× and shrink), staggered `deal-in`
cards, scroll `.reveal` with layered plate arrival.

## 5. Critical files

| File | Role |
|---|---|
| `project/Copy My Trip.dc.html` | The authoritative design handoff — the product definition the app implements |
| `app/src/lib/planner.ts` (770 lines) | The deterministic greedy day engine; `ENGINE` is the single tuning block. Also the reconsider primitives: `truncateDay`, `alternativesAt`, `replayFrom`, `replaySequence` |
| `app/src/lib/plan-presets.ts` | Three presets — `first-time`, `off-beaten-path`, `art-heavy` — as pick-functions over shared candidates, across city day templates |
| `app/src/lib/built-day.ts` | The one render path for both curated and built days |
| `app/src/cities/types.ts` | Data contracts: `Place`, `Experience` variants, per-weekday `hours`, `exceptions`, provenance fields |
| `app/src/cities/{paris,rome}/data/*.json` | Cities as data — a new city is a data drop plus registration, zero planner edits |
| `app/src/styles/classical.css` | Visual-identity source of truth |
| `app/src/styles/app.css` | Motion tokens and choreography |
| `app/src/state/TripContext.tsx` | Trip state, localStorage-backed; determinism is the version |
| `app/api/extract-preferences.ts`, `app/api/narrate-day.ts` | The only two LLM roles: brief → validated engine inputs; facts → curator prose. Neither writes canonical data |
| `app/scripts/preset-smoke.ts` | The invariant harness — trip-level quality as hard pass/fail, not scores |
| `build-plan/00-current-state.md`, `01-principles.md`, `02-roadmap.md` | Product definition, canonical scoring/fatigue models, phased plan (Phases 1–6 shipped 2026-07-21) |

## 6. Goals and guardrails

From `build-plan/` — binding on design work:

1. **Curated depth before breadth.** A city ships when its archive is deep
   enough to anchor plans, not when a scraper has filled a table. Paris first;
   Rome is the pipeline proof.
2. **Hard constraints are code, never prompts.** Closures, curfews, timed caps
   (≤2), anchor cap (≤1), long-transfer cap (≤1), best-window timeliness — all
   in the `buildCandidates` filter chain before scoring.
3. **LLMs get narrow roles and never write canonical facts.** No LLM ever
   writes city JSON; the validator (`validate:cities`) is the gate. Narration
   may omit facts; it may never add any.
4. **Robustness beats density.** Stop budgets per pace (gentle 4 / balanced 6 /
   full 7), linger drift, duration ranges (`durVar`), timed-entry buffers, a
   deliberate buffer day. A plan that only works when everything runs on time
   is a fantasy.
5. **Every stop can say why.** `score()` returns named reasons from the
   canonical scoring model; the UI shows "why this, why now" beside provenance.
6. **Determinism is the version.** Same inputs regenerate the same plan;
   `preset-smoke.ts` asserts it.

**Page hierarchy rule:** the verified archive leads. The hero is the curator's
claim ("places I keep going back to"), provenance markers establish trust
before any planning UI appears, and the planner is presented as a consequence
of the archive — what matters (witnessed places) before what measures
(timings, scores, counts).

## 7. What the design must not do

- No blurring verified and web-sourced content — the two-tier provenance is
  the product.
- No invented precision — unverified hours say "unverified"; missing data is
  shown as unknown, not faked.
- No springs, no bounce — motion is print: settle, draw, stamp.
- No bold headings — semibold (600) is the interface ceiling; display text is
  lighter still.
- No generic attractions-table framing — the units are experiences, days with
  purposes, and a trip arc; not a filterable list of sights.
