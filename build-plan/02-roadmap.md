# 02 — Roadmap

Phased plan, written as deltas against `00-current-state.md`. The planner stays
TypeScript; cities become data; a backend is a triggered decision, not a scheduled
one. Every phase names real files and ends with a checkable done-condition.

**Ordering rationale:** data first (every later phase edits the schema, so freeze its
home before touching it), operating rules second (highest correctness win per line —
late openings and date exceptions are what generic planners get wrong), experiences
third (rides the fresh schema), explanations fourth (so they can explain experience
choices too), robustness fifth, second city sixth (needs the de-Paris-ification the
earlier phases motivate), backend last and conditional.

Phase 8 breaks that numbering: it was opened after Phase 7's first triggers had
already tripped, by evidence the archive tooling surfaced (`06-archive-evidence.md`).
Numbers are chronological here, not a priority order — Phase 8 is active work and
Phase 7 remains deferred.

---

## Phase 1 — Cities become data ✅ (shipped 2026-07-21)

**Goal:** city data moves from compiled TS modules to per-city static JSON with a
validation gate, so adding city #2 is a data drop and editing city #1 can't silently
break the app.

Changes:

- New `app/src/cities/paris/data/` holding `places.json`, `hoods.json`,
  `curated-days.json`, `info.json`, `entry.json`, `nodes.json`, `media.json`,
  `slot-files.json`, `media-dates.json`. All current modules are pure literals
  (the italic markup in `desc` strings is plain string data rendered by
  `lib/text.tsx`), so this is a mechanical extraction. Vite imports JSON natively.
- `app/src/cities/paris/index.ts` shrinks to JSON imports + `City` assembly.
- `app/scripts/extract-dates.sh` retargeted to emit `media-dates.json` instead of a
  TS module.
- New `app/scripts/validate-city.ts` + package script `validate:cities`, following
  the existing `esbuild → node_modules/.tmp → node` pattern (see `smoke:plans` in
  `app/package.json`). Hand-rolled assert-style checks like `preset-smoke.ts` — no
  new dependencies. Checks: field types and ranges, `open[0] < open[1]`,
  `closedOn ⊆ 0..6`, id uniqueness, cross-references (info/entry/media/nodes and
  curated-day stops ↔ place ids; `hood` ∈ `hoodOrder`), and provenance sanity
  (verified places have `visits ≥ 1` and a `last` date).

**Done when:** `npm run build` and `npm run smoke:plans` pass; generated plan
id-sequences are byte-identical before and after the migration; `validate:cities`
catches a deliberately broken fixture.

## Phase 2 — Operating rules v2 ✅ (shipped 2026-07-21)

**Goal:** represent per-weekday hours and date-specific exceptions — the two things
the single `open` tuple cannot say (Louvre's late Wednesday; a one-off closure).

Changes:

- `app/src/cities/types.ts`: add
  `hours?: ([number, number] | null)[]` (7 entries, Sunday-first to match JS
  `getDay`; `null` = closed) and
  `exceptions?: { date: string; closed?: true; open?: [number, number]; note?: string; source?: 'verified' | 'web' }[]`.
  `hours` absorbs `closedOn`; the validator forbids mixing the old and new forms on
  one place. Base `open` remains the fallback for places without `hours`.
- `app/src/lib/planner.ts`: `CandidateOpts` gains `date?: string`;
  `buildCandidates` and `commitPlace` resolve effective hours as
  exception → weekday `hours` → base `open`. An exception with `source: 'web'` (or
  none) is surfaced as unverified — "unknown is a legitimate state".
- `app/src/lib/plan-presets.ts`: pass the real ISO date per day (it already computes
  `dayWeekday` from `arriving`).
- Seed data: Louvre late Wednesday/Friday, Orsay late Thursday — **freshly
  verified**, not copied from `reference/2026-seed-leads.md`.

**Done when:** `npm run diag` on a Wednesday trip shows an evening Louvre window;
`preset-smoke.ts` gains a date-exception test (a place with an exception on one trip
date never appears that day, and appears on others).

## Phase 3 — Experiences as embedded variants ✅ (shipped 2026-07-21)

**Goal:** one place, several schedulable experiences ("masterpieces route" vs
"courtyard at blue hour") — the reference docs' core upgrade, at archive scale.

Design decision: **embedded variants, not separate records.**
`experiences?: Experience[]` on `Place`, where
`Experience = { id, name, label, dur, hours?, timed?, best?, note? }` and every
omitted field defaults to the parent place. Rationale: with ~40 places and one
curator there is nothing to join; embedding keeps each city's JSON self-contained,
preserves visited-set semantics (visiting one variant marks the place visited), and
a place without `experiences` behaves exactly as today — zero migration.

Changes:

- `app/src/cities/types.ts`: the `Experience` type; validator checks variant ids and
  field ranges.
- `app/src/lib/planner.ts`: candidate expansion picks the best-scoring *open* variant
  per place (the place remains the dedup unit); `Candidate` carries the chosen
  variant; `CommittedStop` gains `experienceId?`.
- Seed cases that prove the model: Louvre masterpieces vs courtyard-only (currently
  two separate places, `louvremus`/`louvre` — this phase merges them), Eiffel from
  Trocadéro vs summit, Versailles palace-only vs full day.

**Done when:** the two Louvre entries are one place with two experiences; all smoke
invariants pass; the visited set prevents scheduling both variants on one trip.

## Phase 4 — Structured explanations ✅ (shipped 2026-07-21)

**Goal:** every committed stop can say *why this, why now* — in terms of the
canonical scoring model in `01-principles.md`, beside the provenance the UI already
shows.

Changes:

- `app/src/lib/planner.ts`: `score()` returns `{ total, reasons: {term, value}[] }`;
  `Candidate` gains `reasons`; `commitCandidate` stores the top 2–3 on the stop.
  While in here: fold the two hardcoded bonuses (morning coffee +1.5, hoodBias +1.5)
  into `ENGINE.weights`, restoring "all weights in one block".
- `app/src/lib/built-day.ts`, `BuildPage`, `DayPage`: render the reasons.
- `app/scripts/diag.ts`: print the breakdown per pick.

**Done when:** every committed stop shows at least one reason naming a canonical
term; `preset-smoke.ts` asserts reasons are non-empty and deterministic.

## Phase 5 — Duration ranges and arrival buffers ✅ (shipped 2026-07-21)

**Goal:** lightweight robustness, client-side — plans that survive a slow lunch.

Changes:

- `app/src/cities/types.ts`: `durVar?: number` (max extra minutes over `dur`).
- `app/src/lib/planner.ts`: schedule on typical duration but test curfews,
  `timely` and timed-entry feasibility against `dur + durVar`; new
  `ENGINE.timedEntryBuffer` (arrive N minutes before a `timed` place's window).

**Done when:** `preset-smoke.ts` gains the invariant "no timed stop inside its
buffer; no day busts curfew under max durations"; day population counts stay in
their current ranges.

## Phase 6 — Second city (the pipeline proof) ✅ (shipped 2026-07-21 — Rome)

**Goal:** a new city is a data drop plus registration — zero planner edits.

This phase owns the prerequisite it exposes: `dayProfiles` in
`app/src/lib/plan-presets.ts:88–107` hardcodes Paris place ids (`louvremus`,
`orsay`, `versailles`) and hood names. Move day templates into city data —
`City.dayTemplates` (purposes, seed place ids, hood-bias ids, day-trip id) in the
city JSON — and have `plan-presets.ts` read them. Without this, a second city
silently inherits Paris seeds.

This is also the natural home for making **interests** real: city day templates can
declare which interests they serve, activating the `interest_fit` scoring term
(`01-principles.md` §3) beyond the current Versailles-day toggle.

Then: new `app/src/cities/<city>/data/` + registration in the `CITIES` record in
`app/src/cities/index.ts`.

**Done when:** `validate:cities` passes for both cities; the generic
`preset-smoke.ts` invariants run per-city; the new city required zero edits to
`planner.ts`.

## Phase 7 — Backend (deferred; triggers, not dates)

**First trigger tripped (2026-07-21):** LLM preference extraction shipped as a
single serverless function (`app/api/extract-preferences.ts`, Vercel) because
an Anthropic key can't live in the client. Scope stays narrow per the
principles: the LLM reads the traveler's free-text brief and returns validated
engine *inputs* (theme weights, interests, pace) — stored in trip state so
regeneration is deterministic and never re-calls the API. It does not
schedule, and it cannot write city data.

**Second narrow LLM role shipped (2026-07-21):** day narration
(`app/api/narrate-day.ts`) — the principles' *explanation* job. The app
computes all facts deterministically (sun times via `src/lib/sun.ts` — the
Phase 2 sunrise/sunset backlog item, now done — weekday closures, route,
meals); the LLM only restyles those facts as curator prose, cached per
day-content in trip state, with the deterministic deck as instant render and
fallback. It may omit facts; it may never add any.

No further design yet. Any one of these opens the phase proper:

1. **Live or scheduled data feeds** worth ingesting (hours refresh, disruptions,
   availability) — the three-speed data model's third tier.
2. **Accounts / cross-device trips** — localStorage stops being enough.
3. **A second curator** — submission and review need the provenance/verification
   machinery sketched in `reference/architecture.md` §6.
4. **Bundle weight** — city JSON pushes the client bundle past a threshold worth
   caring about; data moves behind fetch.
5. **Bookings** — any transactional feature.

Until then, one rule from the reference docs is restated as binding today: **no LLM
ever writes city JSON**. Extraction may propose; the validator and the curator
approve. The validator (Phase 1) is the gate.

## Phase 8 — Light, not clock time

**Goal:** let `best` be expressed relative to the sun, because the clock cannot
say "golden hour" in a city where sunset moves five hours across the year.

Opened by `06-archive-evidence.md`, which measured the problem rather than
arguing it. Paris sunset runs 17:00 in late December and 21:58 in June. Pont des
Arts's December frames sit 26 and 21 minutes before sunset — 16:34 and 16:39 by
the clock — and the identical moment in June falls near 22:00. Its declared
`[17, 22]` therefore means "after dark" for half the year: in December the
engine may seat a traveler on that bridge at 21:30, four and a half hours after
the light the description promises. Because `best` is also a **hard filter**
(>30 min outside disqualifies), the error runs both ways — a place is offered at
the wrong hour, or refused at the right one.

Changes:

- `app/src/cities/types.ts`: `best` accepts a sun-relative form alongside the
  clock tuple — e.g. `{ from: { sun: 'sunset', min: -60 }, to: { sun: 'sunset', min: 30 } }`
  — with the tuple retained for places whose window really is clock-bound
  (opening hours, a market that packs up at two).
- `app/src/lib/planner.ts`: resolve `best` to a concrete window per date through
  `sun.ts` before `timely` and the `bestTime` score. `CandidateOpts.date` and
  the city's coordinates are already in scope; `euTzOffsetMin` already handles
  both shipped cities. Resolution must stay deterministic — same date in, same
  window out — since determinism is the version.
- `app/scripts/validate-city.ts`: a declared window may not contradict the
  place's own archive. `archive:evidence` already computes the comparison;
  this promotes it from report to gate, so the Pont des Arts bug cannot recur.
- Data: the places whose light is the reason to go — `pontdesarts`,
  `tournelle` (if its evening claim is restored), `alexiii`, and the Eiffel's
  dusk experience once it is split from the parent.

**Done when:** Pont des Arts admits a 16:30 arrival in December and refuses it
in June; `archive:evidence` section 1 reports no contradicted windows for
Paris; `validate:cities` fails on a deliberately contradicted fixture; smoke
determinism holds across the existing timezone sweep.

---

## Backlog, not yet phased

- `interest_fit` as a full scoring term beyond the Phase 6 template wiring
  (needs interests → theme/tag mapping).
- `monetary_cost` scoring — needs a budget input in compose; entry-cost data
  already exists (`entry.json` after Phase 1).
- **Split the Eiffel into dusk and daytime experiences** — the archive shows two
  distinct visits under one record (`06-archive-evidence.md`). Phase 3's
  `experiences` already supports it; the widened `[11, 24]` window is a holding
  fix.
- **Re-file the three disproven plates**, and decide whether Marché des Enfants
  Rouges keeps a verified claim with no photograph behind it.
- **Prune or subordinate the web tier.** 90 of 127 Paris places have no
  description and render as bare names; verified has fallen from 62% to 26% of
  the catalog. Either is a strategy decision, not a task.
- **Portability** — the plan cannot leave the device it was built on. Trip state
  persists in localStorage and nowhere else: no calendar, map or offline export,
  no print stylesheet, nothing to hand a travelling companion. Highest
  utility-per-hour on this list, and it needs no backend.
- **Media weight** — 535 MB for one city. It sits in `public/`, so it is transfer
  weight rather than bundle weight and Phase 7 trigger 4 does not strictly cover
  it; a CDN or on-demand derivative pipeline is the likely answer, and city three
  forces the question either way.
- Everything in `01-principles.md` §5 (appendix layers), each waiting on its trigger.
