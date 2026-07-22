# Itinerary engine audit — 2026-07-22
Eight-lens multi-agent audit (time math, filter chain, scoring, reconsider/replay, trip arc, geo/routing, data robustness, invariant harness). Every bug below survived two independent adversarial checks that defaulted to refuting; improvements were value/effort judged. 3 claims were rejected in verification: Edit pace can differ from built pace — deck clock and replays go out of step; Empty day 7 hidden by the summary: '7 days · 4–7 stops each' with a 0-stop day; Exact-name link check leaves 8 curated stops unlinked; Paris days 2–4 never materialize.

## Themes

The dominant pattern is a generation/edit split-brain: constraints that are real at generation time — the brief's avoids and pins, interest and theme weights, the day template's noAnchors/noTimed/maxStops/hoodBias, the pace the plan was actually built at, and the 18:00 dinner rule — exist only as arguments passed inside generatePlan, so every reconsider/append/insert path in ItineraryPage rebuilds a weaker world by hand and quietly re-offers, re-times or re-scores what the generator forbade. Underlying it is a state-vs-derivation problem: anything the engine knows but does not store in DayState (the idle-to-18:00 clock jump, the committed variant behind a stop, the pace, the flags themselves) is silently lost the moment a day is replayed, producing 4pm dinners, fabricated 'measured' walks, and violations that disappear on navigation. A third thread is scoring terms that cannot fire where they matter — hoodBias and hoodRepeat both collapse on the empty-day curHood alias, so the personality and spread mechanisms are structurally bypassed at the one pick that decides a day's identity. Finally, the harness systematically skips the failing case rather than catching it (closed-venue check gated on hours existing, meal guard disabled at the inventory boundary, thin days exempted, only balanced pace and one TZ ever exercised), which is why several of these shipped defects show up as 504 PASS.

## Confirmed bugs (22)

### 1. [HIGH] Edit paths rebuild CandidateOpts by hand and drop every constraint generation enforced (avoids, pins, interest weights, theme bias, noAnchors/noTimed/maxStops/hoodBias)
`app/src/pages/ItineraryPage.tsx:166`

ItineraryPage constructs engine opts inline for the append deck (:166), isDayDone (:168), the reconsider deck (alternativesAt, :181) and 'Something missing?' (insertionSuggestions, :282), forwarding only {weekday, date, covered, usedHoods, home}. generatePlan passes far more (plan-presets.ts:135-198): exclude (brief avoids + cross-day pin hold-backs), pins, interestWeights (trip.extracted.themeWeights), the preset's themeBias, and the resolved day template's blockAnchors/blockTimed/maxStops/hoodBias. Consequences, all reproduced on shipped data: (1) a place the traveler said to skip is re-offered in every edit surface and one tap commits it — a harness sweep of all Paris places x 3 presets x all stay lengths found 0 generation leaks and 5209 edit-deck leaks, and alternativesAt ranked an avoided Louvre #0 of 3; (2) the Paris/Rome day-7 buffer template (noAnchors, noTimed, maxStops 3) is unenforced on edits — decks offer anchors and timed bookings (Louvre, Catacombs, Vatican) and isDayDone falls back to ENGINE.stopBudget.gentle=4, so a 4th non-dinner stop commits with no flag (239 as-generated day-7 cases where the page deck differs from the template-constrained deck); (3) a day-pinned ask for day 6 can be consumed by a day-2 append; (4) alternativesAt ranks without interest_fit/pin/themeBias terms, so the deck and the generator disagree about the same slot (6 divergent slots on Paris day 1, including the top card). insertionSuggestions (planner.ts:889) cannot even accept exclude — its signature is {date, weekday}. Commit 80588a0 threaded maxStops into generation only. preset-smoke never drives these primitives with the opts the UI actually builds, so the two paths diverged silently.

**Fix:** Extract the per-day CandidateOpts derivation out of generatePlan into a shared exported helper — dayOpts(city, dayIdx, dayCount, preset, extracted, ...) — that resolves the day template exactly as dayProfiles+resolve do (including the alt actually used) and rebuilds exclude/pins from trip.extracted.requests, interestWeights from trip.extracted.themeWeights and themeBias from trip.planId. Have generatePlan and ItineraryPage both call it, pass maxStops to isDayDone, add an exclude/pins option to insertionSuggestions' opts and apply it in its pool filter, and surface a displaced pinned ask the way generation surfaces unplaced. Add a harness invariant: for every city x preset x day index the opts the page would build must equal the opts generation used, and buildCandidates under page-opts on a noAnchors/noTimed day must return zero anchor and zero timed candidates.

### 2. [HIGH] Edits replay at trip.pace, not the pace the plan was generated at — clocks drift 15 min/stop and durations are rewritten
`app/src/pages/ItineraryPage.tsx:99`

'broader' and 'gentler' hardcode pace 'balanced' regardless of trip.pace (plan-presets.ts:77,91; basePace = preset.pace ?? travelerPace at :130), but ComposePage's adoption (:129/136) stores only {planId, days, dayPurposes} — the generation pace is never recorded, and ItineraryPage:99 edits with `city.dayTemplates[dayIdx]?.paceOverride ?? trip.pace`. Every reconsider/remove/insert then reconstructs the prefix clock with the wrong linger (dayPrefix, planner.ts:620) and re-times the whole suffix at the wrong PACE factor (planner.ts:696/698). Reproduced: Paris/gentler with trip.pace='full', day 1 removeAt(0) gives durs [90,40,75,90,30,90] at the generation pace vs [70,31,59,70,23,70] at edit pace, plus phantom flags ('a 57 min wait for the 10:00 opening', 'lunch lands at 9:27', 'past 22:00', '182 min wait for 19:00') that vanish at the generation pace; at gentle the deck heading is 15 min out of step with the timeline and alternativesAt returns 1 option at balanced vs 0 at gentle. Edits persist to trip.days, so a plan the traveler never asked to re-pace is rewritten. Secondary: line 99 reads the raw template rather than the resolved profile, so an alt substitution is a second divergence source; and the PACE segmented control changes future edit math without re-timing the visible day. 80588a0 fixed only the paceOverride half of this.

**Fix:** Add planPace (per day, from profile.paceOverride ?? preset.pace ?? travelerPace) to TripState, set it in ComposePage's choose() when a plan is adopted, and have ItineraryPage edit with the stored per-day pace instead of re-deriving from raw templates + trip.pace. Make the PACE control re-time the visible day rather than only affecting subsequent edits.

### 3. [HIGH] The dinner-from-18:00 rule lives in an unstored clock jump, so replays retime dinner to mid-afternoon with zero flags
`app/src/lib/planner.ts:720`

Generation enforces dinner-at-18:00 two ways that both evaporate on replay: buildCandidates gates dinner on needMeal, derived from day.clock (planner.ts:505), and plan-presets.ts (:235,269) idle-jumps day.clock to 18:00. That jump is never stored in DayState — only stop times are — and scheduleNext (planner.ts:687-760) flags lunch outside 11:00-14:30 and coffee past noon but has no dinner-window counterpart. So any suffix replay (removeAt, insertAt, replayFrom, replaySequence) re-schedules dinner at clock+travel, bumped only to the venue's opening; 6 Paris dinner venues open 10:00-12:00 with no `best`, so nothing fires. Reproduced across all 3 presets and 5 Paris days: removing the stop before dinner moves it 18:10->15:11, 18:33->16:06, 18:32->16:13, 18:37->16:25, 18:06->16:44, 18:32->17:20, every one with flags=[] — a 4pm dinner presented as clean, violating 'broken stops are flagged, never silently dropped or repaired'. Reachable from ItineraryPage.tsx:220/:182.

**Fix:** Make the 18:00 rule part of the schedule, not of a transient clock: have every replay path idle the clock to 18:00 before scheduling a dinner stop (mirroring generation), and add a parity note in scheduleNext (`if (v.meal === 'dinner' && arrive < 18*60) notes.push(...)`) so an early dinner can never ship unflagged.

### 4. [HIGH] Dinner slot is unreconsiderable: alternativesAt returns 0 candidates whenever the prefix clock is before 18:00
`app/src/lib/planner.ts:505`

Same root cause as the replay-retiming bug, opposite symptom. needMeal is derived from day.clock (planner.ts:505), not from the candidate's arrival, contradicting the engine's own rule at :522-527 that 'meal windows judge the arrival time, not the current clock'. dayPrefix (planner.ts:620) rebuilds the clock as prev.timeIn + prev.dur + linger, which lands before 18:00 on any day whose last afternoon stop ends early, and the generation-time idle-jump is not reconstructible. Reproduced (Paris, balanced, 2026-09-12): alternativesAt on the dinner slot returned 0 for first-time days 1/3 (prefix 16:58/16:11) and broader days 1/2/3 (17:17/17:40/17:35), and 3 alternatives once the prefix clock is >= 18:00; forcing the same prefix's clock to 18:00 yields 4 dinner candidates every time, so the needMeal gate is the sole binding filter (maxWaitDinner=75 is secondary). After any removeAt that pulls the day earlier, every tested day's dinner deck is empty — the reconsider deck is blank and the promise 'a swap changes where dinner happens, never whether' fails.

**Fix:** In alternativesAt (or in buildCandidates when the slot being replaced is a dinner) advance the effective clock to max(clk, 18*60) before building dinner candidates, and judge the dinner window on arrival rather than on needMeal — the same change that fixes the replay retiming.

### 5. [HIGH] Empty-day curHood aliasing defeats both hoodBias and hoodRepeat — personality days skip their own hood, and one hood anchors day after day
`app/src/lib/planner.ts:440`

StartLoc has no `hood`, so on an empty day buildCandidates sets curHood to the dayAnchor suggestion (planner.ts:339). Two documented mechanisms break at the only decision point that matters — the pick that declares the day's hood. (a) hoodBias is arithmetically too weak: a candidate in the bias hood scores +hoodBias(1.5) -offAnchor(1) = +0.5 against +anchor(2) for the richness-suggested hood, and dayAnchor (66-92) never consults opts.hoodBias. Traced: Sacre-Coeur = [transit -2, hoodBias +1.5, offAnchor -1] loses to Pont des Arts (Saint-Germain) = [verified +2, transit -1.5, offAnchor -1]; across all stay hoods x 3 presets, 43 of 80 bias days put ZERO stops in the biased hood (Paris first-time 'the climb toward Montmartre' 0/7 even with a Montmartre stay; Rome broader 0/7). (b) The trip-spread penalty at :440 requires `e.p.hood !== curHood`, so candidates in a re-suggested anchor hood are exempt from -hoodRepeat while still collecting +anchor(2) — the penalty only hits *other* used hoods, reinforcing the repeat. dayAnchor takes no usedHoods parameter and its distance decay (sqrt(richness)/(1+min/10)) makes a one-hood stay re-win its own hood until depleted: Paris broader/Marais anchors days 1, 3 and 4 in Le Marais; broader/Montmartre anchors days 4, 5 and 6; Rome broader/Villa Borghese repeats days 1 and 4; 12 of 18 combos duplicate. Related: usedHoods marks only each prior day's first non-coffee stop's hood (plan-presets.ts:149-153), so an afternoon spent in a hood leaves it unmarked.

**Fix:** Pass usedHoods and the template hoodBias into dayAnchor: discount already-used hoods' richness (x0.4-0.5) and let hoodBias force or strongly bias the empty-day anchor suggestion. Change the hoodRepeat exemption to apply only mid-day (`day.committed.length > 0 && e.p.hood === curHood`) so an opening pick in a used hood pays the penalty, and mark every hood that hosted >= 2 stops as used. Alternatively seed the personality day in its bias hood the way anchor days seed the Louvre/Orsay.

### 6. [HIGH] Replay flags are ephemeral UI state — violations vanish on navigation, on append, and on any prefix stop
`app/src/pages/ItineraryPage.tsx:113`

StopFlags from replaySequence/replayFrom/removeAt/insertAt live only in ItineraryPage's `flags` useState; DayState has no flags field. Three drop paths: (1) the useEffect at :111-115 resets flags to [] whenever dayIdx changes, so leaving and returning to a day renders a stop flagged 'closed this day' or 'would run past the close' with no flagNote while the violating stop stays committed; (2) the append path at :189 calls commitDay(..., []) wiping all existing flags; (3) replayFrom/removeAt/insertAt only emit flags for stops at/after slot k (planner.ts:766-791, 795-816), and commitDay(r.day, r.flags) at :195 replaces the whole list, so a prefix stop's still-valid flag is dropped. Verified: a 3-stop day whose stop 0 carried 'a 57 min wait for the 10:00 opening' (and separately 'closed this day') returns flags=[] after swapping slot 2 while the day still schedules the violation. Related: a day built or materialized before trip.arriving is set (append opts get date/weekday undefined) is never re-validated once real dates arrive — the re-validate effect at :124 is gated on !isBuilt — so weekday closures are never flagged.

**Fix:** Derive flags at render rather than storing them: flags are deterministic from the day, so compute replaySequence(city, day.committed.map(c => ({placeId: c.id, experienceId: c.experienceId})), pace, stay, {date, weekday}).flags in a useMemo keyed on (day, date, weekday, pace) and drop the transient setFlags plumbing. That fixes the navigation reset, the append wipe, the prefix drop and late-arriving dates in one place.

### 7. [HIGH] Curated stop `kind` is never cross-checked against the place's src — the same stop makes two contradictory provenance claims
`app/scripts/validate-city.ts:158`

validate-city checks only that `kind` is one of three strings and that placeId resolves (line 162); nothing asserts kind==='verified' <=> place.src==='verified'. In paris/curated-days.json day 3, 'Rue des Martyrs' (martyrs) and 'Sacre-Coeur' (sacre) carry kind:'verified', 2 plates each, and provenance "From 3 visits - last Apr '22" / "From 2 visits - last Apr '19", while places.json says src:'web', visits:0, last:"" for both. The curated page renders the accent dot, archive plates and a visit count; the moment ItineraryPage.tsx:126 materializes the same day through the engine (replaySequence -> builtDayStops) the identical stop renders as kind:'web-pin' with provenance undefined (built-day.ts:57 derives it from c.visits/c.last, which are 0/''). Same trip, same stop, two provenance claims — exactly what the ground rules forbid.

**Fix:** Add to validate-city's curated-day loop, for every stop with a placeId: check(kind==='verified' === (place.src==='verified')) and check(!stop.provenance || place.src==='verified'). Then fix the data — promote martyrs/sacre to verified with real visits/last, or demote those stops to web-image/web-pin and delete the fabricated provenance strings.

### 8. [HIGH] dayPrefix resolves the previous stop to the parent place, not the committed variant — fabricated 'measured' walks
`app/src/lib/planner.ts:623`

The forward builder sets loc to the committed EffectivePlace (commitCandidate, planner.ts:607), but dayPrefix rebuilds it as `city.places.find(p => p.id === prev.id)` (planner.ts:623) — the parent, discarding the experience's src override. Paris data has variants whose src differs from the parent: louvre/interior ('web' under a 'verified' parent), stgermain/flore, stgermain/deuxmagots, eiffel/summit. travel() (planner.ts:272) derives `measured` from a.src==='verified' && b.src==='verified', and every replay primitive (truncateDay, alternativesAt, replayFrom, removeAt, insertAt, bestInsertion, insertionSuggestions) starts from dayPrefix. Verified: the generated first-time 7-day plan puts 'The Louvre, inside' (web) at day 2 slot 0 and truncateDay(...,1,...) returns prefix.loc = Cour Napoleon (verified); inserting Pont des Arts stamps the leg measured:true and DayTimeline's TransitChip renders '3 min - measured' in accent — a curator-walked claim for a leg leaving a place the curator has never been inside. The forward build gives measured:false for the same leg, so it is also a build-vs-replay divergence.

**Fix:** Resolve the prefix location through the committed variant: `const loc = prev ? (stopPlace(city, prev) ?? stay) : stay`. stopPlace already exists and is used two lines away in the replay loops; it returns the EffectivePlace with the variant's src/visits/last applied.

### 9. [HIGH] rome/broader 7-day plans ship an EMPTY final day, and the harness exempts thin days from every assertion
`app/scripts/preset-smoke.ts:543`

preset-smoke's sweep bails with `if (isTrip || d.committed.length < 3) return` (line 543) and the only minimum-stop assertion (checkDays:49) runs at dayCount 7 for the `first-time` preset only (line 95). rome/broader 7d therefore produces a completely empty day 7 (0 committed stops) at variants 1, 2 and 9 and a 1-stop day 7 at variants 0 and 5, while the suite reports 504 PASS / 0 FAIL. ItineraryPage:93 sets isBuilt=false and there is no curatedDays[6], so the page renders a blank final day — a user-visible failure, not a data-gap footnote.

**Fix:** Move the populated check out of checkDays into the sweep so it runs for every city x preset x dayCount x variant — check('every trip day has stops', d.committed.length >= (isTrip ? 1 : i === lastIdx ? 2 : 3)) — and only exempt a day when the remaining unvisited open pool for that date is provably empty, asserting that emptiness explicitly rather than skipping. Then fix the generator so broader/7d Rome fills its last day.

### 10. [MEDIUM] generatePlan's pin fallback can ship a buffer day that violates its own template caps — scheduleNext cannot express maxStops/noTimed
`app/src/lib/planner.ts:733`

scheduleNext hard-codes ENGINE.stopBudget[pace] for its budget flag (planner.ts:733) and fires its timed flag only at a third booking (:731); there is no maxStops/blockTimed/blockAnchors input. generatePlan's unplaced-pin fallback (plan-presets.ts:304) runs bestInsertion over ALL days including index 6 — the buffer day (maxStops 3, noTimed, gentle budget 4) — so inserting a pinned 4th non-dinner stop or a pinned timed place there produces zero flags, best.result.flags.length===0 passes, and the plan ships a buffer day breaking the very invariant preset-smoke asserts (which only tests plans without requests). Reproduced: Paris first-time arriving 2026-09-12 with carnavalet pinned to day 1 ships day 7 as stgermain > delacroix > montorgueil > carnavalet > frenchie (4 non-dinner stops, cap 3, flags 0); saintechapelle pins a timed stop onto the noTimed day; 190 and 13 cases respectively, all via the fallback (main loop: 0). insertionSuggestions on the buffer day has the same hole — it offers 8 zero-flag 4th stops including timed orangerie.

**Fix:** Add optional maxStops/blockTimed/blockAnchors to scheduleNext's opts with flags 'past the day's N-stop cap' and 'a booking on the no-bookings day', and thread the resolved day template through insertAt/bestInsertion/replaySequence callers — generatePlan's fallback should pass profiles[i]'s caps. (Note buildCandidates deliberately lets pins outrank stop/timed caps; the fix is to flag, not to silently drop.)

### 11. [MEDIUM] Long-transfer budget counts the exempt dinner leg, over-blocking mid-day swaps
`app/src/lib/planner.ts:357`

transferOk (planner.ts:407-410) and preset-smoke.ts:61 both treat the ride to dinner as the exempt closing commute ('dinner rides free'), but the counters that spend the budget do not: buildCandidates' longTransfers (planner.ts:356-358) tallies every committed and suffix metro leg >= 20 min with no meal filter, and scheduleNext's longSoFar (:724) likewise. alternativesAt puts the dinner stop in the suffix, so on a day whose only long leg is the closing commute longTransfers=1 and every non-dinner candidate needing a >= 20-min metro leg is hard-filtered — options that were legal at generation time (the dinner leg didn't exist yet) silently disappear. Reproduced on shipped data: paris/broader 7d day 7 slot 1 (Rue Cler; dinner La Coupole via 21-min metro; ZERO mid-day long legs) returns 1 alternative instead of 3 (Rue Montorgueil, Rue des Martyrs); paris/gentler 7d returns 0 vs 3; rome/gentler 3d returns 0 vs 1; paris/broader 5d day 3 hides grandemosquee. 80588a0 fixed the consumer side only.

**Fix:** Add `c.meal !== 'dinner'` to both the committed and suffix filters at planner.ts:356-358 and to longSoFar at planner.ts:724, matching transferOk and the smoke suite's definition.

### 12. [MEDIUM] Forced meal picks skip the arrival-window check the scored pool enforces
`app/src/lib/planner.ts:506`

The forced-meal branch (mealEls, planner.ts:506-508) selects lunch/dinner purely by travel time, without the arrival-window predicate applied to `rest` (:524-527: lunch must arrive 11:00-14:30, coffee before 12:00). needMeal='lunch' stays active while clk <= 14:30, so at clk 14:20 a lunch 19-25 min away is forced with arrival 14:39-14:50. Generation commits it silently, but the same day replayed through scheduleNext (any earlier-slot edit) flags the generator's own output ('lunch lands at 14:39') — the identical stop is clean at generation and broken on replay. Reproduced in real plans (rome Villa Borghese day 4 timeIn=881; Paris Carnavalet+Rodin prefix forces Rue Cler at 14:35) and by sweep: 101 committed lunches outside 11:00-14:30 plus 123 forced out-of-window candidates across both cities x 3 presets x 3 paces x 5 dates x 3/5/7 days. The same asymmetry exists for forced dinner, where only curfew bounds arrival.

**Fix:** Apply the same arrival-window predicate to mealEls before slicing (lunch arrive <= 14.5*60, coffee arrive < 12*60), falling through to no forced pick when nothing fits the window it exists to protect.

### 13. [MEDIUM] Rome ships zero media and zero slot-files, so every Rome day renders as bare names and narrates with nothing
`app/src/lib/built-day.ts:50`

rome/media.json and slot-files.json are both `{}` for all 42 places, curated-days is empty, and 0 of 42 places are verified — yet ROME is live. built-day.ts:51-58 therefore yields sub: c.area, desc: '', kind: 'web-pin' with no webImage for every stop, so DayTimeline's desc block (:244) and image cards (:331/362) are unreachable and only the pin card renders; buildDayFacts sets curatorNote = city.media[c.id]?.desc -> undefined for all 42, so narrate.ts is handed only names, hoods and labels. A generated 4-day Rome plan: 28 stops, 0 desc, 0 webImage, 0/24 legs measured (Paris: 12/10/4). The validator only checks that media KEYS are place ids (validate-city.ts:116,172-173), which passes vacuously on an empty map — nothing in the gate says a city is renderable.

**Fix:** Add a per-city coverage gate to validate-city: assert Object.keys(city.media).length > 0, that every non-dayTrip candidate place has a media entry with a non-empty desc, and that every verified place has plates. Then either populate Rome media or mark the city as not yet shippable.

### 14. [MEDIUM] Day-trip days get no meals — a 6-day trip's final evening ends at 17:40 with no dinner
`app/src/lib/plan-presets.ts:200`

generatePlan's tripPlace branch (plan-presets.ts:200-205) commits the day trip and skips the candidate loop entirely, so a Versailles/Ostia day always ends meals={-,-,-}. Reproduced: Paris first-time and gentler 6d day 6 = versailles@10:40+420, clock 17:41, lunch:false dinner:false against city.dayEnd 22:00, with 11 of 16 Paris dinner venues unused; same for rome first-time/gentler (ostia, ends 16:39), at both 6d and 7d. Because dayProfiles' slice puts the day trip LAST on 6-day trips, the trip's closing night is silently dinner-less; on 7-day trips it is a mid-trip fasting day. Dinner rides free of the budget everywhere else in the engine but never on this template, and the unplaced fallback (plan-presets.ts:303) explicitly refuses day-trip days. Partly intentional ('one commitment, the whole day') — preset-smoke.ts:542 exempts isTrip days from the eats invariant — but the product outcome is a trip whose last dinner never happens.

**Fix:** After committing the day trip, run a restricted continuation of the pick loop (dinner-only pool, home-biased) when the return lands before eveningWindDown, or explicitly schedule the nearest open dinner near the stay; drop the isTrip exemption from the smoke eats invariant once it holds.

### 15. [MEDIUM] Day purposes are not binding: 'no queues / gentle' days open with the biggest timed anchors
`app/src/lib/plan-presets.ts:176`

resolve() (plan-presets.ts:176-182) hands a closed-seed day to its alt and pushes the alt's purpose, but alt and unseeded templates carry no noAnchors/noTimed, so blockAnchors/blockTimed stay undefined and the anchorMorning bonus (planner.ts:24,457, +1.5) actively pulls anchors into any unconstrained morning. Verified (Rome, gentler, arriving Sat 2026-09-12, balanced): day 2's Vatican seed is closed on Sunday so the day takes the alt purpose 'The city without the queues — neighborhoods first' and then immediately commits Galleria Borghese (anchor, timed) at 10:50; day 3, whose purpose is 'A gentler middle day — gardens, terraces…', opens with the Vatican Museums at 09:34. The purpose line rendered on the plan card directly contradicts the day's content, and the same mechanism produces back-to-back anchor days (d2 Borghese, d3 Vatican, d5 Colosseum, d6 Ostia).

**Fix:** Make purpose claims enforceable: set noAnchors/noTimed on the alt and 'gentler middle day' templates in city.json (resolve already threads blockAnchors/blockTimed), or re-derive the rendered purpose from what the day actually contains after building.

### 16. [MEDIUM] Dinner forecast claims 'short walk home from here' without ever looking at the stay
`app/src/lib/planner.ts:278`

forecast() (planner.ts:278) returns 'Dinner wraps ~X - short walk home from here' for every dinner candidate and doesn't even receive opts.home (call site :549); the string renders on every dinner card (CandidateCard.tsx:133). Using the engine's own dist() from the real Paris stay, 12 of 16 dinner venues exceed the 1.2 km walk threshold: coupole 3.09 km (~23 min metro), chartier 2.09, walyfay 1.73, allard 1.72, septime 1.54, the rest 1.22-1.53; 11 of ~18 generated dinners across the three presets sit beyond the threshold. A fabricated claim in a product whose binding rule is that estimates are never presented as known facts.

**Fix:** Thread opts.home into forecast() (buildCandidates already has it), compute travelMinutes(e.p, opts.home) and phrase by band: <= 1.2 km 'short walk home', otherwise '~N min metro home'; omit the clause entirely when home is unknown.

### 17. [MEDIUM] preset-smoke's closed-venue check is skipped precisely when the venue is closed
`app/scripts/preset-smoke.ts:536`

The multi-variant sweep computes `const hrs = p && effectiveHours(p, date, wd)` and then tests only `if (hrs && s.timeIn + s.dur > hrs[1]*60)` (preset-smoke.ts:535-537). When a stop lands on a day the place is shut, effectiveHours returns null, hrs is falsy, and the assertion silently does nothing — the one condition it exists to catch is the one it skips. The genuine closed-day assertion lives only in checkDays (:65-69), which runs for variant 0 / dayCount 4 on every preset plus first-time 7d. So a regression scheduling a closed venue on variants 1/2/5/9, on 7-day broader/gentler plans, or at any non-balanced pace passes the suite green.

**Fix:** Split the condition: `if (!hrs) closeBusts.push(`${tag} day ${i+1} ${s.id} CLOSED`); else if (s.timeIn + s.dur > hrs[1]*60) closeBusts.push(...)`, and rename the assertion to 'no stop is scheduled on a closing day, and none outlasts its close'.

### 18. [MEDIUM] Meal guard disables itself at the inventory boundary, hiding real Rome 4-day lunch gaps
`app/scripts/preset-smoke.ts:544`

The harness uses `if (lunchInv > dayCount && !d.meals.lunch)` for lunch but `if (dinnerInv >= dayCount && ...)` for dinner (preset-smoke.ts:544-545) — an undocumented asymmetry. Rome has exactly 4 lunch and 4 dinner venues, so on a 4-day trip the dinner assertion is live (4 >= 4) while the lunch assertion is dead (4 > 4 is false). This is NOT the known 7-day data gap: with 4 venues and 4 days every day can eat. Verified against the current engine — rome/first-time 4d variants 2 and 5, rome/broader 4d variant 1, rome/gentler 4d variant 5 each produce a full 5-7 stop day 4 with no lunch while an unused, open lunch venue remained; the harness prints PASS. The guard also counts inventory from parent p.meal only, ignoring experience-level meal overrides (planner.ts:209; Paris dinner is 16 vs 17), and ignores date closures.

**Fix:** Make both guards `>=` and compute inventory per trip date: for each day count places (through placeVariants) whose meal matches and whose effectiveHours(date, weekday) is non-null, minus those already consumed, and assert a meal whenever that count is > 0. Then fix the engine so Rome's 4-day plans actually eat lunch on day 4.

### 19. [MEDIUM] Reconsider variety check ignores the suffix: a swap can create same-group adjacency unpenalized
`app/src/lib/planner.ts:415`

lastGroup (planner.ts:415) is read from day.committed's tail — in alternativesAt that is the truncated prefix, so a candidate for slot k is compared only against stop k-1. The stop at k+1 (suffix[0]) is counted for groupSaturation (:435) and for several other guards (:346, 350, 351, 358) but never for adjacency, so swapping a museum into the slot directly before another museum escapes the -W.sameGroup (0.75) penalty the forward builder applies to every consecutive pair (saturation misses it too: with no same-group stop in the prefix, groupToday=1 < 2). The deck can rank a museum-museum adjacency above an option the original build would have preferred, and the shown reasons omit the 'another indoor stop in a row' note the arithmetic should carry.

**Fix:** In scoreParts, also compare e.p.group against opts.suffix[0]?.group (already in scope) and apply the sameGroup penalty and its reason note for either adjacency.

### 20. [LOW] Meal reason 'this is the closest' is attached to non-closest and non-forced meal cards
`app/src/lib/planner.ts:542`

The mealReason at planner.ts:542-545 is prepended to every candidate whose meal matches needMeal. That includes mealEls[1] — second-closest by construction, since mealEls is travel-sorted and sliced (0,2) — and any score-ranked lunch/dinner candidate that entered via `rest`. All display 'the day needs lunch — this is the closest', false for everything but mealEls[0], and for the scored entrants also contradicting their actual ranking mechanism. Verified: Paris stay Eiffel at 12:00 gives Rue Cler (t=12) and Sainte-Anne (t=24) both labelled closest (10 of 11 hoods reproduce); Marais at 12:00 adds a third, unforced, score-ranked lunch card also labelled closest. The note survives built-day.ts:60 and renders in CandidateCard.

**Fix:** Attach the 'closest' wording only to forcedPicks[0]; give the second forced pick and scored meal entrants a neutral note ('the day still needs lunch') or their real top scoring reasons.

### 21. [LOW] ENGINE tuning comment says bestTime is '×1.5 against it' but the code applies −3×
`app/src/lib/planner.ts:22`

planner.ts:22 documents `bestTime: 1, // in a place's preferred window; x1.5 against it`, while scoreParts (:449-450) adds +W.bestTime in-window and -W.bestTime * 3 outside — matching build-plan/01-principles.md:84 ('bestTime: 1 (-3x outside window)'). The code is right; the comment is stale by a factor of 2 and omits the sign, and has been wrong since the initial commit. The ENGINE block is explicitly the product's tuning surface ('iterating on day quality is a constants edit'), so a wrong multiplier note there invites a mis-tune — doubling bestTime expecting -3 and getting -6.

**Fix:** Correct the comment to 'x3 against it', or better hoist the 3 into ENGINE (bestTimeMissFactor: 3) so the multiplier is itself tunable.

### 22. [LOW] Curated verifiedLabel counts are hand-typed and only length-checked; two Paris days are wrong
`app/scripts/validate-city.ts:156`

validate-city.ts:156 asserts only `d.title.length > 0 && d.verifiedLabel.length > 0`. Paris curated day 1 declares '6 of 8 stops personally verified' but has 7 stops of which 5 are kind:'verified'; day 3 declares '4 of 7' but has 6 stops. built-day.ts:66 builtDayVerifiedLabel computes the same string honestly from day state, making this pure data entry error rather than a definitional difference. Currently dormant — grep shows curated verifiedLabel is referenced only in types.ts and the validator, and builtDayVerifiedLabel has no callers — so it is stale data waiting to become a page-visible false provenance claim.

**Fix:** Delete verifiedLabel from the JSON and derive it at render from d.stops, or assert it in the validator: parse the two integers and compare against d.stops.filter(s => s.kind==='verified').length and d.stops.length.

## Ranked improvements (16)

### 1. Flag timed bookings whose slot moves on replay — value 4/5, small
`app/src/lib/planner.ts:700`

The UI sells a timed stop's timeIn as the slot to book ('Book ahead - Sainte-Chapelle (14:15)', ItineraryPage.tsx:348-353, and '— your slot: 14:15' at :265), but scheduleNext (planner.ts:700) recomputes arrival freely on every replay: an upstream swap, removal or insertion moves a downstream booking's time with no note, while merely infeasible outcomes (past close, long wait) do get flagged. A traveler who booked on the earlier advice holds a ticket for a time the plan no longer visits — the one downstream hard commitment a swap can invalidate that the flag vocabulary does not name. build-plan/03-itinerary.md:230 already lists this as an unmet Done-when.

**Fix:** In replayFrom/removeAt/insertAt compare each timed suffix stop's new timeIn against its stored timeIn and emit a StopFlag ('your 14:15 timed slot moves to 15:05 — rebook') when the shift exceeds ENGINE.timedEntryBuffer, gated on city.entry to avoid churn. Do the flag only; do not turn stored timed times into fixed appointments.

### 2. Carry the stay's hood on StartLoc so the traveler's own neighbourhood counts as current — value 4/5, small
`app/src/lib/planner.ts:339`

stayLoc (planner.ts:146-152) stores the chosen hood only in `area` and StartLoc has no `hood` field, so buildCandidates' curHood check (`'hood' in day.loc`, :339) fails on every empty day and falls back to the dayAnchor hood. When dayAnchor resolves elsewhere (a Montmartre base with a richer Marais pool — the exact case the dayAnchor comment worries about), every opening candidate in the traveler's own stay hood is scored -offAnchor(1) 'leaves the current neighbourhood', never earns +anchor(2), and often takes -hoodRepeat(1) too — actively pushing the day's first stop away from where the traveler wakes up, and printing a reason that is literally false.

**Fix:** Add optional `hood` to StartLoc in types.ts, set it in stayLoc, and let curHood read it so the stay hood is the current neighbourhood for the opening pick; fix the hoodRepeat branch at the same time and refresh the smoke baselines.

### 3. Parameterize preset-smoke over all three paces — gentle and full are untested end to end — value 4/5, small
`app/scripts/preset-smoke.ts:37`

Every generatePlan call in the harness passes 'balanced' (line 37 and all direct calls at 148-149, 249-251, 258-261, 302, 315, 324, 529, 557, 566, 574, 585, 588), and presets broader/gentler hardcode 'balanced' too, so only first-time forwards a traveler pace that is itself always balanced. PACE.gentle/full (f 1.3/0.78, slot 90/60), ENGINE.stopBudget.gentle/full (4/7) and ENGINE.linger.gentle/full (45/15) are exercised only via the day-7 paceOverride, and the worst-case-duration test at line 217 hardcodes PACE[i===6?'gentle':'balanced'], so changing the traveler pace would silently assert the wrong scale factor. Pace is a shipped user control; two of three modes have zero end-to-end coverage. Running the full invariant set across all three paces x 3 presets x {4,7} days x 5 variants x both cities is currently clean, so this is coverage debt, not a live break.

**Fix:** Wrap the generic loops in `for (const pace of ['gentle','balanced','full'] as const)` and thread pace into genFor and checkDays so minStops, budget and worst-case scaling derive from PACE[template.paceOverride ?? pace].f instead of literals; make the meal check at :544 pace-aware.

### 4. Validate that each place has a non-empty feasible arrival window (best x hours x dur x curfew) — value 4/5, medium
`app/scripts/validate-city.ts:53`

isHourTuple(p.best) only checks 0-24 and lo<hi. The engine's filters intersect four constraints — timely (arrive within best +/- 0.5, planner.ts:400), open (arrive <= hrs[1]*60 - max(dur,30)), and curfew (visit ends by lastLeave / city.dayEnd) — and their intersection can be empty, in which case the place is silently unschedulable in every pool on every day with no flag or diagnostic. Replicating planner.ts:395-401 faithfully (durMax, close-capped worstDepart, dinner dayEnd) gives FIVE of 16 Paris dinner venues a negative-width window at gentle pace (allard, benoit, septime, servan, tourargent), and moulinrouge (best [19,22], open [19,23], dur 120) has a 9-minute window at gentle vs 45 at balanced — a dur bump of 15 min would drop it from the catalog with zero signal.

**Fix:** Export the arrival-feasibility predicate from planner.ts (using durMax and the close cap, not a re-derived formula) and have validate-city call it per place per pace, across weekday hours as well as base open, FAILing on an empty window and WARNing below a slack threshold.

### 5. Close the day: price the leg home into curfew and render it — value 4/5, medium
`app/src/lib/planner.ts:397`

stayLoc's contract says 'Days start and end here' (planner.ts:144-145) and ENGINE.lastLeave is commented 'Home by 22:00, for real' (:57), but the curfew checks (planner.ts:397, scheduleNext:716-717) test departure from the venue, not arrival home — a dinner wrapping at 22:00 that is 23 metro minutes away (coupole, 3.1 km from the real Paris stay) puts the traveler home at 22:23, so the comment is false. The stay shapes the route only through a half-weight score term that activates at 17:00 (:442-445), and built-day.ts:59 attaches transitAfter only between stops, so the rendered day ends mid-city with no closing leg. opts.home is always supplied (ItineraryPage:166), so the check is available.

**Fix:** Add travelMinutes(p, home) to the curfew feasibility for the last plausible stop (worstDepart + homeMin <= curfew) when opts.home is set, emit a final estimated home leg in builtDayStops so the day visibly closes where it started, and add a smoke invariant for arrival home. Expect this to thin far-flung dinners.

### 6. Fix the walking model: 1.2 km mode cutoff boards the metro for equal-time walks and kills the measured band — value 3/5, small
`app/src/lib/planner.ts:271`

travel() (planner.ts:271) picks metro for any leg > 1.2 km haversine; by the engine's own formulas walk 13.33d and metro 11+4d cross at d~1.18, so 1.2 is time-optimal with zero friction margin and 15 of 119 committed legs (v0, three presets) ride the metro in the 1.2-1.9 km band — legs a person in Paris simply walks. Side effect: because walk implies d <= 1.2, the measured condition `mode === 'walk' && d < 1.6` (:272) is entirely vestigial, so the stated 'verified<->verified walks under 1.6 km are measured' band never fires above 1.2. Separately, travelMinutes converts raw haversine at 4.5 km/h with no circuity: real Paris street distance runs ~1.2-1.4x straight-line (worse across the Seine, where a crossing must detour to a bridge) and the Montmartre butte walks far slower uphill, so estimates undershoot 20-40% and the error compounds through the day's chained clock.

**Fix:** Choose mode by time with a friction margin (walk when walkMin <= metroMin + 5, i.e. cutoff ~1.8 km) and align it with the 1.6 km measured constant; apply a ~1.3 circuity factor to walking legs (effective 3.5 km/h on haversine) plus an optional per-hood terrain multiplier in city data. Note `measured` is itself haversine-inferred today, so tighten or rename that provenance claim in the same change, and rebaseline preset-smoke.

### 7. Hoist the evening home-proximity term into ENGINE and document it — value 3/5, small
`app/src/lib/planner.ts:443`

The transit_cost contribution at planner.ts:441-444 (-homeMin x travelPerMin x 0.5 for arrivals >= 17:00) appears in no row of the canonical scoring table in build-plan/01-principles.md:82 — the transit_cost row lists only travelPerMin and firstLegTravelFactor — and its 0.5 factor and 17:00 threshold are inline literals despite section 3 stating that weights live in the one editable ENGINE block. The term silently swings evening rankings by up to ~2.5 points (a 30-min-from-home candidate), larger than W.verified (2), while remaining invisible to anyone tuning from the documented model. Sibling time constants (eveningWindDown, lastLeave) already live in ENGINE.

**Fix:** Add homeEveningFactor and homeEveningFrom to ENGINE and add the term to the transit_cost row of the canonical table in 01-principles.md. No behaviour change.

### 8. Derive insertionSuggestions' ranking from ENGINE instead of ad-hoc minute discounts — value 3/5, small
`app/src/lib/planner.ts:904`

The suggestion key (planner.ts:904) is `nearMin(p) - (verified ? 3 : 0) - (rank === 1 ? 3 : 0)`: provenance and editorial pull expressed as flat 3-minute discounts unrelated to W.verified (2) and W.rank (0.5), with no counterweight for rank-3 places that score() penalizes. It is a second, incompatible mini-scoring model for the same concepts — a verified icon 7 min away ties an unranked web place 1 min away here, while the main model separates them by 2.5 points — and it lives outside ENGINE, so tuning W.verified/W.rank leaves the 'Something missing?' panel unchanged. It also truncates the pool to 24 of Paris's 84 eligible places, so it decides what ever gets trialed.

**Fix:** Derive the discounts from ENGINE (minutes-equivalent = weight / travelPerMin, giving verified ~12 min and rank ~3 min) or rank the qualifying insertions with score() against the insertion-point state, adding a rank-3 penalty for symmetry. Deterministic; preset-smoke.ts:487 already snapshots the output.

### 9. Assert the real per-day stop budget in preset-smoke — value 3/5, small
`app/scripts/preset-smoke.ts:49`

checkDays asserts only `d.committed.length >= minStops && <= 8`, but the engine's actual contract is that non-dinner committed stops must not exceed ENGINE.stopBudget[pace] (4/6/7) — enforced by budgetReached (planner.ts:344-345) and named as a flag in scheduleNext (:733). A regression that lets budgetReached slip (counting dinner, or reading the wrong pace) would produce 7- or 8-stop balanced days and still pass, because 8 is the ceiling the test uses. Only the day-7 buffer cap of 3 is checked, and only for i === 6 (lines 539-540). It is the one day-anatomy cap the harness omits.

**Fix:** Per day in the sweep: `check('within the day budget', d.committed.filter(s => s.meal !== 'dinner').length <= (template.maxStops ?? ENGINE.stopBudget[effPace]))`. The sweep is always balanced with no pins and data overrides only lower the cap, so a flat `<= ENGINE.stopBudget.balanced` suffices today — no profile export needed until the pace matrix lands.

### 10. Assert curfews from the engine's own constants, not a hardcoded 22:00 — value 3/5, small
`app/scripts/preset-smoke.ts:51`

checkDays:51-52 and the worst-case loop at :223 test `timeIn + dur > 22*60`, but the engine has two distinct curfews: ENGINE.lastLeave = 21:45 for non-dinner stops and city.dayEnd for dinner (planner.ts:397, 716). 22:00 equals both shipped cities' dayEnd (1320), so the assertion is a coincidence of current data: a city shipping dayEnd 1200 would have its dinner curfew unasserted, and the 15-minute non-dinner margin is unasserted everywhere — a regression letting non-dinner stops run to 21:59 passes today. The harness loops every registered city, so this bites the first non-Paris-shaped one.

**Fix:** Replace the literal at both sites: `const curfew = s.meal === 'dinner' ? c.dayEnd : ENGINE.lastLeave; check('within its curfew', s.timeIn + s.dur <= curfew)`. Strictly tighter and passes today.

### 11. Drive city.dayEnd through the non-dinner curfew and forecast copy — value 3/5, small
`app/src/lib/planner.ts:58`

City.dayEnd (1320 in both cities) is validated as data and used at planner.ts:397 and 716 for the dinner curfew only. Non-dinner stops are capped by the hardcoded ENGINE.lastLeave = 21:45; forecast() receives dayEnd yet hardcodes 21*60 for the post-dinner budget (:281) and 20*60 for the last-stop heuristic (:288). dayStart IS city-driven, so the asymmetry is a defect. A city registering dayEnd 1380 (Madrid) would have its declared day end honoured for the dinner venue and silently ignored for every sight, with forecast copy still quoting a 21:00 runway — invisible today, fatal to the 'a new city is a data drop' premise preset-smoke states at line 85. Conveniently 21.75*60 = 1320 - 15 exactly, so the fix is a no-op for both shipped cities.

**Fix:** Derive lastLeave as city.dayEnd - 15 (or make it a per-city field) and thread dayEnd into forecast() in place of the 21*60 / 20*60 literals. Add a smoke invariant using a synthetic city with a shifted dayEnd. Leave eveningWindDown alone — it is pacing, not curfew.

### 12. Assert determinism across timezones, not just within one process — value 3/5, small
`app/scripts/preset-smoke.ts:91`

Every determinism assertion (preset-smoke.ts:91, 204, 253, 261, 309, 403, 413, 483, 496, 508, 583) compares two calls inside the same process, clock and TZ. The engine has no Math.random and no Date.now; the only environment-sensitive code is dayWeekday (planner.ts:159, local new Date(t).getDay()) and dayDate (:168, local date parts on t + i*86400000). Those are TZ-safe today (identical 7-day Paris plans under UTC, Pacific/Kiritimati, Pacific/Midway, Europe/Paris and America/Santiago across the 2026-10-25 DST boundary), but the header comment at planner.ts:167 records that a toISOString() version already drifted once — and that regression would pass the entire suite for any developer west of UTC. 'Determinism is the version' deserves an assertion on the axis that can actually break.

**Fix:** smoke:plans is already a node cjs bundle, so loop it under TZ in {UTC, Pacific/Kiritimati, Pacific/Midway, Australia/Lord_Howe, America/Santiago} for arrival dates straddling EU and southern-hemisphere DST flips and assert one identical SHA of the plan sequence plus per-stop timeIn/dur. Cheap alternative: assert dayDate/dayWeekday agree with a pure arithmetic reference for 400 consecutive offsets.

### 13. Add liveness assertions to guarded reconsider test blocks — value 3/5, small
`app/scripts/preset-smoke.ts:455`

The suffix-aware anchor-cap test is wrapped in `if (adI >= 0)` (preset-smoke.ts:455) and `if (testK >= 0)` (:459) with no assertion that either search succeeded — unlike the sibling patterns at :397, :443 and :621 which do. If a scoring change stops putting an anchor in the first four days, or puts it in the only non-meal slot, the 'no second anchor offered around an anchored day' assertion silently disappears and the run still prints all PASS, since check() only counts failures.

**Fix:** Add `check('swap: found an anchored day to probe (test is live)', adI >= 0)` and `check('swap: found a non-anchor non-meal slot on it', testK >= 0)` in house style. Skip a global check-count floor — loop counts are data-dependent, so a fixed N is either brittle or vacuous.

### 14. Assert stops start after their doors open, and bound head-of-day dead waits — value 3/5, small
`app/scripts/preset-smoke.ts:74`

The harness asserts closing (effectiveHours[1]), best-window (:74-80) and lunch-not-before-11:00 (:71), but never `s.timeIn >= hrs[0]*60`. That matters because the two scheduling paths differ: buildCandidates only advances to opening when the wait fits ENGINE.maxWait/maxWaitDinner and otherwise rejects the candidate (planner.ts:386-393), while commitPlace — used for every generator seed and day trip (planner.ts:576-577) — clamps arrive = opensAt with no cap at all. A seed whose hours move later in a data update would produce a silent multi-hour dead wait at the head of the day with every existing assertion green: the stop is inside hours, inside its best window, and home by 22:00.

**Fix:** In checkDays and the sweep add per stop: `check('starts after the doors open', !hrs || s.timeIn >= hrs[0]*60)`, plus a generous head-of-day wait bound to avoid false failures. Rather than capping commitPlace (which would strand seed days with no fallback), have it emit a StopFlag when the clamp exceeds ENGINE.maxWait.

### 15. Add trip-level anchor spacing so anchors stop clustering on adjacent days — value 3/5, medium
`app/src/lib/planner.ts:457`

The one-anchor-per-day cap (planner.ts:350) is purely intra-day; across the trip any template without noAnchors is fair game and the anchorMorning bonus (:457, +1.5) makes a free anchor the top morning pick. Rome gentler 7-day lands anchors on days 2, 3, 5 and 6 — back-to-back Borghese then Vatican Museums — while days 1, 4 and 7 have none, so the first-trip framework's intent (demanding days padded by gentle ones) has no enforcement once seeds move or close. usedHoods-style trip state exists for hoods but there is no analogous 'day N-1 was anchored' input to buildCandidates.

**Fix:** Thread prevDayAnchored (or an anchored-day count, seeded from seed/dayTrip anchors) into CandidateOpts from generatePlan and penalize score-picked anchors on a day adjacent to an already-anchored day. Note much of this is also fixable by setting noAnchors on the relevant city.json templates; the opt must also reach ItineraryPage:166, alternativesAt and replayFrom.

### 16. Make durVar required so the worst-case feasibility guard has teeth — value 3/5, medium
`app/scripts/validate-city.ts:46`

Place.durVar documents the invariant 'days are scheduled on dur but must stay feasible at dur + durVar — a plan that only works when everything runs typical is fragile', and planner.ts:381/396/699/715 read it as `p.durVar ?? 0`. 74 of 121 Paris places and 28 of 42 Rome places omit it, so durMax === dur and the curfew/close checks degrade to the typical case; validate-city.ts:46 only checks the value when present, and preset-smoke.ts:222's 'home by 22:00 even at worst-case durations' therefore passes vacuously for the majority of stops it iterates. Every timed place, every anchor and (Paris) all but one dinner venue do carry it, but plain 60-75 min sights (pere, deuxamis, villette, notredame, luxembourg, rome trasteverewalk/popolo) do not.

**Fix:** Make durVar a required field in the validator (~102 judged data edits; parks and strolls can legitimately be 0) and have preset-smoke report how many stops in the tested plans had a non-zero durVar so the invariant cannot silently become a no-op. Do NOT auto-default to dur*0.25 — that fabricates data.
