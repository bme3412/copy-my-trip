# 01 — Principles

The durable ideas this product is built on. Most were first articulated in the
superseded docs (`reference/architecture.md`, `reference/logic.md`); this document is
their reconciliation — one canonical scoring model, one canonical fatigue model, and
an explicit status tag on everything:

- **[now]** — implemented in the app today (see `00-current-state.md` for where)
- **[phase N]** — activated by the named phase in `02-roadmap.md`
- **[appendix]** — deliberately deferred; listed once at the bottom with its trigger

## 1. The curator-provenance principle (new here — and first)

Every fact in the system is either **witnessed** (the curator's photos, EXIF dates,
walked routes, repeat visits) or **web-sourced**, and the UI never blurs the two:
filled vs hollow markers, `measured` vs estimated travel legs, "N of M stops
personally verified".

This principle does real architectural work. Curation replaces most of the reference
docs' scoring machinery: there is no `first_timer_value` or `paris_uniqueness` score
term here because **membership in the 37-place archive already is that filter**. The
curator decided what's worth a first-timer's time by going back themselves. It also
sets the growth rule for new cities: a city ships when its archive is deep enough to
anchor plans, not when a scraper has filled a table. **[now]**

## 2. Surviving principles

**Experiences, not attractions.** "The Louvre" is a place; "the masterpieces route"
and "the courtyard at blue hour" are experiences with different durations, hours and
moods. Today the app approximates this with separate place records; Phase 3 makes
variants first-class. **[phase 3]**

**A visit opportunity = place + experience + date + time window + traveler state.**
The schedulable unit is dated and timed, not a row in an attractions table. Today's
approximation is `Place × weekday × open × best`; operating rules v2 and experiences
complete it. **[now, partial → phases 2–3]**

**Hard constraints are code, never prompts.** Closures, curfews, timed caps, transfer
limits and best-window timeliness live in the `buildCandidates` filter chain, checked
before anything is scored. No LLM is ever asked to "remember" that the Louvre closes
on Tuesdays. **[now]**

**LLMs get narrow roles and never write canonical facts.** There is no LLM in the app
today, which satisfies this trivially — but the principle is binding on every future
phase: extraction/explanation/conversation only, always validated, never writing city
data directly. The schema validator (Phase 1) is the gate. **[now by omission;
binding]**

**Three-speed data.** Canonical facts (coordinates, descriptions), date-specific
facts (weekday hours, exceptions), live facts (disruptions, availability) change at
different speeds and are stored separately. Today only canonical + weekday data
exists; date exceptions arrive in Phase 2; live data is a backend-phase concern and
until then is simply out of scope — not faked. **[now → phase 2 → phase 7]**

**Unknown is a legitimate state.** When hours or exceptions aren't verified, the
system says so (a `source` field on exceptions, "unverified" in the UI) rather than
inventing precision. **[phase 2]**

**Robustness beats density.** A plan that only works when everything runs on time is
a fantasy. Today: stop budgets, linger drift, wait caps, curfews, and a deliberate
buffer day. Phase 5 adds duration ranges and timed-entry buffers. **[now → phase 5]**

**Itineraries are versioned.** Full version history is a backend-phase feature. Until
then, determinism is the version: the same inputs regenerate the same plan
(`preset-smoke.ts` asserts this), and localStorage holds the traveler's current
state. **[phase 7; determinism now]**

**Curated depth before breadth.** One city done deeply beats ten cities scraped.
Paris first; a second city only when the pipeline proves cities are data
(Phase 6). **[now]**

## 3. The canonical scoring model

One model. The reference docs had two (architecture §7 step 4: 12 weighted terms;
logic §31: 15 terms plus a trip-level block); this table merges them, maps each term
to today's `ENGINE.weights`, and phases or cuts the rest. Weights live in one
editable block (`ENGINE` in `planner.ts`) — that rule survives from the originals.

| Canonical term | Merges (reference) | Today (`ENGINE.weights`) | Status |
|---|---|---|---|
| `provenance_fit` | — (from principle 1) | `verified: 2` | **[now]** |
| `transit_cost` | geographic_fit (distance half); transit_cost | `travelPerMin: 1/6`, first leg × `firstLegTravelFactor: 0.5` | **[now]** |
| `locality_fit` | geographic_fit (clustering half) | `anchor: 2` / `offAnchor: 1` (+ hoodBias hardcode) | **[now]** |
| `time_of_day_fit` | evening_or_scenic_value; scenic_value; date_specific_value (time half) | `bestTime: 1` (−3× outside window) | **[now]** |
| `narrative_fit` | narrative_value; anchor-placement heuristics | `anchorMorning: 1.5` / `anchorLate: 2` (+ coffee hardcode) | **[now]** (hardcodes folded in at phase 4) |
| `variety` | duplication_cost (within-day) | `sameGroup: 0.75` | **[now]** |
| `coverage` | category_coverage; duplication nonlinearity ("the fourth museum") | `coverage: 1.25`, capped ×2 | **[now]** — soft by design |
| `interest_fit` | traveler_interest_fit; personal_interest_fit | preset theme bias + traveler theme weights extracted from the free-text brief (`interestWeights`, −1..1, negatives are real dislikes) | **[now]** |
| `date_value` | date_specific_value (date half); temporary_event_bonus | — | **[phase 2]** |
| `booking_risk` | booking_risk | hard caps only (`timed ≤ 2`, `maxWait`) | **[phase 5]** as a soft term |
| `monetary_cost` | monetary_cost | entry-cost strings exist, unused by planner | **[appendix]** |
| `editorial_fit` | first_timer_value (revived) | `Place.rank` 1/2/3 → `W.rank` (icons up, deeper cuts down) | **[now]** |

Terms **cut, with rationale**:

- `paris_uniqueness` — replaced by curation itself (principle 1). Archive
  membership is the term.
- `first_timer_value` — cut while the catalog was ~36 places ("curation is the
  filter"); revived as `editorial_fit` (`Place.rank`) once the web tier grew
  past the point where curation alone could order it.
- `fatigue_cost` as a *score* term — fatigue is a **budget** (hard), not a score
  (soft); see §4. Consistent with "hard constraints are code".
- `weather_fit`, `crowd_cost` — no client-side data source; **[appendix]**, tied to
  the backend triggers.
- `group_satisfaction` — travel-party modeling deferred whole; **[appendix]**.

The reference docs' *trip-level* score (logic §31's second block) is deliberately not
merged into the candidate score. It survives as two things: the soft `coverage` term,
and the **invariant checklist** — `preset-smoke.ts` already asserts the trip-level
qualities (populated days, no repeats, day-anatomy caps, curfews) as hard pass/fail
regressions, which is stronger than scoring them.

## 4. The canonical fatigue model

One model. The reference docs had two (architecture §10: four loads plus a daily
budget dict; logic §21: seven loads with an accumulator). **The budget form wins**:
three of its entries are already shipped verbatim (≤1 anchor, ≤2 timed, ≤1 long
transfer), so it is proven in use, while the accumulator was never grounded in
measurable data.

Three tiers:

1. **Discrete budgets [now]** — `stopBudget` per pace (energy as stop count),
   `major anchors ≤ 1`, `timed ≤ 2`, `long transfers ≤ 1`, curfews (`lastLeave`,
   `eveningWindDown`, `dayEnd`). Hard, checked in the filter chain.
2. **Time dilation [now]** — `PACE.f` duration multiplier and `linger` drift: the
   honest client-side stand-in for "fatigue lowers the value of later blocks".
   Gentle pace doesn't just prefer fewer stops; it makes each stop cost more clock.
3. **Load vectors [future — post-phase-3, if ever]** — architecture §10's **four
   loads only** (physical, standing, cognitive, crowd) as per-experience profiles,
   with recovery blocks (cafés, parks) reducing accumulated load. Logic §21's three
   extra loads (navigation, decision, social) are **explicitly rejected** as
   unmeasurable over-modeling.

## 5. Appendix: deferred layers

One line each; the trigger is what would open the work, not a schedule.

- **Weather fit** — trigger: any forecast data source (backend phase); until then
  the buffer day is the rain plan.
- **Crowd model** — trigger: a crowd data source worth trusting.
- **Heat management** (shade, cooling stops) — trigger: weather layer exists.
- **Amenity routing** (toilets, water, benches) — trigger: a traveler segment that
  needs it (families, accessibility).
- **Luggage rules** — trigger: arrival/departure-day planning.
- **Travel-party modeling** (group scoring, split plans) — trigger: multi-traveler
  input in compose.
- **Extra fatigue loads** (navigation/decision/social) — rejected; revisit only with
  observed-behavior data.
- **Monte Carlo simulation** — trigger: duration ranges (phase 5) prove insufficient.
- **Live repair engine** — trigger: live data feeds (backend phase).
- **Constraint solver (OR-Tools etc.)** — trigger: the greedy+templates engine
  demonstrably fails a real planning case it can't be tuned out of.
- **`monetary_cost` scoring** — trigger: budget input added to compose.
