# 05 — Audit remediation

Deltas against `04-engine-audit.md`. Five stages, each independently shippable and
verifiable. Written after re-verifying every remaining finding against `0567dc0`.

## Context

The eight-lens audit (`04-engine-audit.md`) found 22 confirmed bugs and 16 ranked
improvements. Seven bugs are already fixed:

| Fixed | Commit |
|---|---|
| 1 (edit paths drop generation's constraints), 2 (edits replay at the wrong pace) | `12c7b75` |
| 3, 4 (the dinner pair), 11 (dinner leg spends the transfer budget), 14 (day-trip days never eat), 16 (fabricated "short walk home") | `0567dc0` |

**15 bugs and 16 improvements remain.** Three through-lines explain almost all of
them, and they set the order of work:

1. **The harness reports PASS on shipped defects.** It skips the failing case rather
   than catching it — the closed-venue check is gated on hours *existing*, thin days
   are exempt from every assertion, only `balanced` pace is ever exercised. This is
   why 504 PASS coexisted with 8 unflagged mid-afternoon dinners. Nothing later can
   be trusted until this is fixed, so it goes first.
2. **Provenance makes two claims for one stop.** Curated data says "personally
   verified · 3 visits" where `places.json` says web-sourced with zero visits, and
   `dayPrefix` upgrades a web-tier experience back to its verified parent, stamping
   `measured` on a leg leaving a room the curator has never entered. This violates
   the one binding rule in `01-principles.md` §1.
3. **What the engine knows but doesn't store is lost on replay.** Flags live in React
   state and vanish on navigation; day-template caps can't be expressed to
   `scheduleNext` at all.

**Decisions taken** (2026-07-22): fake-verified curated stops are **demoted to
web-sourced**, not promoted. Rome stays live with an **honest empty state** rather
than being gated or back-filled now.

---

## Stage 1 — Make the harness tell the truth

Everything else is measured with this instrument, so it is calibrated first. Expect
this stage to **turn existing PASSes into FAILs** — that is the deliverable, not a
regression. Fix the harness, record the new failures, then fix them in place.

`app/scripts/preset-smoke.ts`:

- **Bug 17** — the closed-venue check reads `if (hrs && s.timeIn + s.dur > hrs[1]*60)`,
  so a stop scheduled on a day the venue is *shut* (`effectiveHours` → `null`) is
  recorded clean. Split the condition: `!hrs` is the loudest failure, not a skip.
- **Bug 18** — meal guards are asymmetric (`lunchInv > dayCount` vs `dinnerInv >= dayCount`),
  which silently disables Rome's lunch assertion at exactly 4 days. Make both `>=`,
  and compute inventory through `placeVariants` + `effectiveHours` per trip date
  rather than top-level `p.meal` (the file already uses `placeVariants` elsewhere).
- **Bug 9** — `checkDays` runs on only 2 of 6 preset×dayCount combinations and only
  variant 0. Move the populated assertion into the multi-variant sweep. This exposes
  the real defect: **rome/broader 7d ships a 0- or 1-stop final day in all five
  variants** (verified: v0 `…,4,1`, v1 `…,6,0`, v2 `…,5,0`, v5 `…,6,1`, v9 `…,6,0`).
  Fix the generator so the last day fills; exempt a day only when the remaining open
  pool is provably empty, and assert that emptiness.
- **Improvement 13** — three guarded blocks (`if (adI >= 0)`, `if (testK >= 0)`, and
  the full-day block) assert nothing when the search fails, so the test can evaporate
  silently. Add liveness checks in house style. Note `.every()` on `[]` is vacuously
  true — assert non-empty too.
- **Improvement 10** — five sites hardcode `22 * 60`. The engine's curfew is two-tier:
  `ENGINE.lastLeave` (21:45) for non-dinner, `city.dayEnd` for dinner. Strictly
  tighter and passes today.
- **Improvement 9** — assert the per-day non-dinner stop budget against
  `template.maxStops ?? ENGINE.stopBudget[pace]`; today only the ceiling of 8 is checked.
- **Improvement 14** — assert `s.timeIn >= hrs[0]*60`. `commitPlace` clamps to opening
  with no `maxWait` cap (unlike `buildCandidates`), so a data change could open a day
  with a silent multi-hour dead wait and stay green.
- **Improvement 3** — 40+ hardcoded `'balanced'`; `'full'` appears nowhere. Wrap the
  generic loops in all three paces and derive scale factors from `PACE[...]` rather
  than literals.
- **Improvement 12** — determinism is only asserted within one process. `dayWeekday`
  and `dayDate` use local date parts and a `toISOString` version already drifted once.
  Re-run the bundle under several `TZ` values across a DST boundary and compare a hash.

**Done when:** the suite runs all three paces, every preset×dayCount×variant asserts
populatedness, and a deliberately closed-venue fixture FAILs. Rome/broader 7d fills
its last day.

## Stage 2 — One stop, one provenance claim

The product's binding rule (`01-principles.md` §1) is that witnessed and web-sourced
facts are never blurred. Four findings break it.

- **Bug 7** — `validate-city.ts` checks `kind` is one of three strings and that
  `placeId` resolves, but never that `kind === 'verified'` ⇔ `place.src === 'verified'`.
  Add that check plus "provenance only on verified", and **require `placeId` on every
  curated stop** — the name-based fallback can't see stops whose names match no place,
  which is how five of them escaped entirely.
  Then fix the data in `paris/data/curated-days.json` (**demote**, per decision):
  `martyrs` and `sacre` (day 3) → `web-image`/`web-pin`, drop their provenance strings;
  same for the five unlinked stops — `Café de la Mairie`, `Shakespeare and Company`,
  `Quai de Montebello` (day 2), `Marché d'Aligre`, `Coulée verte René-Dumont` (day 4) —
  and link each to its place record.
- **Bug 22** — `verifiedLabel` is only length-checked and **3 of 4 Paris days are
  wrong** (day 1 says "6 of 8" with 7 stops / 5 verified; day 3 says "4 of 7" with 6).
  `built-day.ts` already has `builtDayVerifiedLabel`, which computes it honestly and
  currently has no callers. Delete the field from JSON and derive at render.
- **Bug 8** — one line. `dayPrefix` (`planner.ts`) resolves the previous stop with
  `city.places.find(p => p.id === prev.id)` — the **parent** — discarding the
  experience's `src`. Use `stopPlace(city, prev)`, which is exported in the same module
  and already used by every sibling replay function. Four Paris experiences downgrade
  their parent (`louvre/interior`, `stgermain/flore`, `stgermain/deuxmagots`,
  `eiffel/summit`). Reproduced on shipped data: `The Louvre, inside` (web) sits at day
  2 slot 0 in both `first-time` and `gentler`; `truncateDay` returns the verified
  parent and inserting `vertgalant` after it stamps the leg **measured**.
- **Bug 13 / Rome honest empty state** — Rome ships `media.json` `{}`, `slot-files.json`
  `{}`, `curated-days.json` `[]`, 0/42 places with a description. Keep the city live
  (its tagline already says "Researched, not yet walked") but make the web tier
  deliberate: author a `desc` for each candidate place so days read as prose rather
  than bare names and `buildDayFacts` has something to narrate, and add a validator
  coverage gate — a city must have a non-empty `desc` for every non-dayTrip candidate
  place, and every verified place must have plates.

**Done when:** `validate:cities` fails on a deliberately mismatched `kind`/`src`
fixture; no curated stop carries provenance it can't support; no replayed leg is
stamped `measured` leaving a web-tier stop; no Rome day renders as a bare name.

## Stage 3 — Replay fidelity, then durable flags

**The audit's proposed fix for bug 6 is unsafe as written** and must not be applied
directly. It suggests deriving flags at render via `replaySequence`. Verification
found four places where a derived replay does *not* reproduce the stored day, so
derived flags would fire false positives on exactly the days the generator worked
hardest on:

1. **Day-trip days** — generation calls `returnFromDayTrip` (return leg + `loc` reset
   to the stay) before picking dinner; `replaySequence` would route from Versailles.
2. **Pin-window idle** — generation jumps the clock to `windowStart − 30`;
   `scheduleNext` reproduces only the *dinner* idle.
3. **`commitPlace`-seeded stops** — `commitPlace` clamps to opening with no `maxWait`
   cap and never flags; `scheduleNext` would flag the generator's own accepted seed.
4. **Pace** — the derivation must read `trip.dayPaces[dayIdx]`, not `ctx.pace`.

So: **make replay faithful first, then derive.** Replay fidelity is worth having on
its own — "same inputs reproduce the same day" is the determinism property.

- Teach `scheduleNext`/`replaySequence` the day-trip return and the pin idle, and give
  seeded stops a wait exemption (or have `commitPlace` emit a flag when its clamp
  exceeds `ENGINE.maxWait`, per improvement 14).
- Add a harness invariant: replaying a generated day reproduces its stored `timeIn`s
  and raises no flags. That invariant is the gate for the next step.
- **Bug 6** — only once the above holds: derive flags in a `useMemo` keyed on
  `(day, date, weekday, storedPace)` in `ItineraryPage` and delete the transient
  `setFlags` plumbing. This fixes all four drop paths at once — the day-switch reset,
  the append wipe (`commitDay(..., [])`), the prefix-flag drop, and the `!isBuilt`
  gate that means a day built before dates existed is never re-validated.
- **Bug 10** — `scheduleNext` hardcodes `ENGINE.stopBudget[pace]` and has no
  `maxStops`/`blockTimed`/`blockAnchors` input, so `generatePlan`'s unplaced-pin
  fallback can wedge a 4th stop or a timed booking onto the buffer day with zero
  flags. Add the caps to its opts and thread them through `insertAt`/`bestInsertion`/
  `replaySequence`; the fallback passes the resolved profile's caps (`dayPlanContext`
  already resolves them). Flag, don't drop — pins deliberately outrank caps.
- **Improvement 1** — a timed stop's `timeIn` is sold as the slot to book
  ("Book ahead · Musée d'Orsay (11:59)"), but a replay moves it silently. Emit a flag
  when a timed suffix stop shifts more than `ENGINE.timedEntryBuffer`.
  `03-itinerary.md` already lists this as an unmet done-when.

**Done when:** replaying any generated day is a no-op; a flag survives navigating away
and back; a pinned stop that breaks the buffer day's caps says so.

## Stage 4 — Plan quality

- **Bug 5 + improvement 2 (do together — same root)** — `StartLoc` has no `hood`, so on
  an empty day `curHood` aliases to the `dayAnchor` suggestion. Measured on shipped
  data, worse than the audit reported: **48 of 76 hood-bias days put zero stops in
  their biased hood**, and **49 of 57 stay×preset combos repeat an anchor hood**. The
  personality-day and trip-spread mechanisms are effectively inert.
  Fix: add `hood` to `StartLoc` and set it in `stayLoc`; pass `usedHoods` and
  `hoodBias` into `dayAnchor` (it takes neither today) and discount already-used hoods;
  apply the `hoodRepeat` penalty to an opening pick in a used hood instead of exempting
  it. Behavior-changing — rebaseline the harness.
- **Bug 15** — day purposes aren't binding. Templates promising "the city without the
  queues" and "a gentler middle day" carry no `noAnchors`/`noTimed`, and the
  `anchorMorning` bonus actively pulls anchors into those mornings (Rome day 2 opens
  with Galleria Borghese; day 3 with the Vatican Museums). Mostly a **data fix**: set
  the flags on the alt and "gentler" templates in both `city.json` files. The two
  personality alts carry `noAnchors` but not `noTimed` despite "no monuments".
- **Bug 12** — forced meal picks (`mealEls`) sort by travel time and skip the arrival
  window that `rest` applies, so a lunch can be forced with a 14:39 arrival. Rare on
  shipped data (2 of 298 lunches) but it makes the *same stop* clean at generation and
  flagged on replay. Apply the window before slicing.
- **Bug 19** — `lastGroup` reads only the prefix tail, so a swap that creates
  museum→museum adjacency escapes the `sameGroup` penalty. Compare `opts.suffix[0]`
  too; it's already in scope.
- **Bug 20** — "the day needs lunch — this is the closest" is attached to the
  second-closest and to score-ranked entrants. `forcedPicks` already exists one line
  away and is the correct discriminator.
- **Improvements 7, 8, 15** — hoist the evening home-proximity term into `ENGINE` and
  add it to the canonical table in `01-principles.md` §3 (it currently swings evening
  rankings by more than `W.verified` while being invisible to anyone tuning from the
  docs); derive `insertionSuggestions`' ad-hoc 3-minute discounts from `ENGINE`; add
  trip-level anchor spacing so anchors stop clustering on adjacent days.

## Stage 5 — Model honesty and coverage debt

- **Bug 21** — the `ENGINE` comment says `bestTime` is "×1.5 against it"; the code
  applies −3×. Hoist the 3 into `ENGINE.bestTimeMissFactor` so the multiplier is
  itself tunable, per the "weights live in one editable block" rule.
- **Improvement 11** — `city.dayEnd` drives only the dinner curfew; non-dinner stops
  use hardcoded `ENGINE.lastLeave` and `forecast()` quotes literal `21*60`/`20*60`.
  `21.75*60 = 1320 − 15` exactly, so deriving `lastLeave` from `dayEnd` is a no-op for
  both shipped cities and makes "a new city is a data drop" true.
- **Improvement 5** — curfew tests departure from the venue, not arrival home, so
  "Home by 22:00, for real" is false for a dinner 23 métro minutes away. Price
  `travelMinutes(p, home)` into the last stop's feasibility and render a closing leg.
  Behavior-changing: expect it to thin far-flung dinners.
- **Improvement 6** — the 1.2 km walk/métro cutoff is exactly the break-even point
  with zero friction margin, so 15 of 119 legs ride the métro for distances a person
  walks; and because walk implies ≤1.2 km, the stated "measured under 1.6 km" band is
  vestigial. Raise the cutoff to ~1.8 km, apply a ~1.3 circuity factor, and align the
  `measured` constant. **Also re-examine what `measured` claims** — it is haversine-
  inferred today, not walked. Behavior-changing; rebaseline.
- **Improvement 4** — validate that each place has a non-empty feasible arrival window
  (best × hours × dur × curfew). Five of 16 Paris dinner venues have a *negative-width*
  window at gentle pace, meaning they are silently unschedulable with no diagnostic.
  Export the predicate from `planner.ts` rather than re-deriving it.
- **Improvement 16** — `durVar` is optional and missing on **74 of 121 Paris** and
  **28 of 42 Rome** places, so the worst-case feasibility guard degrades to the typical
  case for most stops. Make it required (~102 judged data edits). Do **not** auto-default
  to `dur * 0.25` — that fabricates data.

---

## Critical files

| File | Stages |
|---|---|
| `app/scripts/preset-smoke.ts` | 1 (rewrite of the sweep), 3, 4 |
| `app/scripts/validate-city.ts` | 2 (kind/src, placeId, verifiedLabel, media coverage), 5 |
| `app/src/lib/planner.ts` | 2 (`dayPrefix`), 3 (`scheduleNext`, replay caps), 4 (`dayAnchor`, scoring), 5 |
| `app/src/lib/plan-presets.ts` | 1 (last-day fill), 3 (fallback caps) |
| `app/src/pages/ItineraryPage.tsx` | 3 (derived flags) |
| `app/src/cities/paris/data/curated-days.json` | 2 (demotions) |
| `app/src/cities/{paris,rome}/data/city.json` | 4 (template flags) |
| `app/src/cities/rome/data/media.json` | 2 (desc coverage) |
| `build-plan/01-principles.md` | 4 (home-evening term in the canonical table) |

Reuse rather than reinvent: `stopPlace`, `placeVariants`, `effectiveHours`,
`dayPlanContext`, `returnFromDayTrip`, `builtDayVerifiedLabel`, `ENGINE`.

## Verification

Each stage ends green on all four gates, run from `app/`:

```
npx tsc --noEmit
npm run validate:cities
npm run smoke:plans      # 519 checks today; Stage 1 raises this substantially
npm run smoke
npm run build
```

Two habits from the fixes already shipped, both of which caught real problems:

1. **Prove every new invariant has teeth.** Revert the engine fix (keep the test),
   confirm the test FAILs with the audit's own numbers, restore. A dinner invariant
   passed against the old engine purely because it referenced a constant that didn't
   exist there — `x < undefined` is always false.
2. **Measure before and after on shipped data**, not just pass/fail. The audit's
   numbers (8 unflagged retimings, 8 empty decks, 5209 edit-deck leaks, 48/76 inert
   bias days) are the regression baseline.

Behavior-changing items needing a deliberate rebaseline, not a silent one: bug 5
(hoods), improvement 5 (closing leg), improvement 6 (walking model).

## Not doing

- The three claims rejected during audit verification (listed in `04-engine-audit.md`).
- Promoting the demoted curated stops — decided against; they are web-sourced.
- Gating Rome behind a shippable flag — decided against in favour of an honest empty state.
- ~~`00-current-state.md` §"Known gaps" is stale (all six entries were closed by
  phases 1–5).~~ Refreshed 2026-07-24 with the eight that stand now.
