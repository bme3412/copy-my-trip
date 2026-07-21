/** Engine quality invariants — regression guards for the recommendation engine. */
import { CITIES } from '../src/cities'
import { generatePlan, PLAN_PRESETS, type GeneratedPlan } from '../src/lib/plan-presets'
import { blankDay, buildCandidates, dayDate, dayWeekday, effectiveHours, ENGINE, PACE, placeVariants, stayLoc, stopPlace } from '../src/lib/planner'
import type { City } from '../src/cities/types'

const city = CITIES.paris
const ARRIVING = '2026-09-12' // Sat → days fall Sat, Sun, Mon (Orsay closed), Tue (Louvre closed)…
const STAY = stayLoc(city, city.hoodOrder[0])
const placeOf = (id: string) => city.places.find((p) => p.id === id)

let fail = 0
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok || !detail ? '' : ` — ${detail}`}`)
  if (!ok) fail++
}

const genFor = (c: City, presetId: string, dayCount: number) =>
  generatePlan(c, PLAN_PRESETS.find((p) => p.id === presetId)!, dayCount, 'balanced', stayLoc(c, c.hoodOrder[0]), ARRIVING, [])
const gen = (presetId: string, dayCount: number) => genFor(city, presetId, dayCount)

function checkDays(c: City, tag: string, plan: GeneratedPlan, dayCount: number) {
  const allIds = plan.days.flatMap((d) => d.committed.map((s) => s.id))
  check(`${tag}: no repeats across the trip`, new Set(allIds).size === allIds.length)

  plan.days.slice(0, dayCount).forEach((d, i) => {
    const day = `${tag} day ${i + 1}`
    const wd = dayWeekday(ARRIVING, i)!
    const isDayTrip = d.committed.some((s) => stopPlace(c, s)?.dayTrip)
    const minStops = isDayTrip ? 1 : i === 6 ? 2 : 3
    check(`${day}: populated (${minStops}–8 stops)`, d.committed.length >= minStops && d.committed.length <= 8, `${d.committed.length}`)

    const late = d.committed.filter((s) => s.timeIn + s.dur > 22 * 60)
    check(`${day}: home by 22:00`, late.length === 0, late.map((s) => s.name).join(', '))

    const anchors = d.committed.filter((s) => stopPlace(c, s)?.role === 'anchor').length
    check(`${day}: ≤1 anchor`, anchors <= 1, `${anchors}`)

    const timed = d.committed.filter((s) => stopPlace(c, s)?.timed).length
    check(`${day}: ≤2 timed`, timed <= 2, `${timed}`)

    const longLegs = d.committed.filter((s, j) => j > 0 && s.travelMode === 'metro' && s.travelMin >= 20).length
    check(`${day}: ≤1 long transfer`, longLegs <= 1, `${longLegs}`)

    const date = dayDate(ARRIVING, i)
    const closed = d.committed.filter((s) => {
      const p = stopPlace(c, s)
      return p && effectiveHours(p, date, wd) === null
    })
    check(`${day}: nothing visited on its closing day`, closed.length === 0, closed.map((s) => s.name).join(', '))

    const earlyLunch = d.committed.filter((s) => s.meal === 'lunch' && s.timeIn < 11 * 60)
    check(`${day}: no lunch before 11:00`, earlyLunch.length === 0, earlyLunch.map((s) => s.name).join(', '))

    const offWindow = d.committed.filter((s) => {
      const best = stopPlace(c, s)?.best
      if (!best) return false
      const h = s.timeIn / 60
      return h < best[0] - 0.5 || h > best[1] + 0.5
    })
    check(`${day}: best-time respected (±30 min)`, offWindow.length === 0, offWindow.map((s) => s.name).join(', '))
  })
}

// Generic invariants run for EVERY registered city — a new city is a data
// drop, and this is where its data meets the engine.
const seq = (x: GeneratedPlan) => x.days.flatMap((d) => d.committed.map((s) => s.id)).join(',')
for (const [cid, c] of Object.entries(CITIES)) {
  for (const p of PLAN_PRESETS) {
    const a = genFor(c, p.id, 4)
    const b = genFor(c, p.id, 4)
    check(`${cid}/${p.id}: deterministic`, seq(a) === seq(b))
    checkDays(c, `${cid}/${p.id}`, a, 4)
  }
  check(`${cid}: three presets produce distinct itineraries`, new Set(PLAN_PRESETS.map((p) => seq(genFor(c, p.id, 4)))).size === 3)
  checkDays(c, `${cid}/first-time 7d`, genFor(c, 'first-time', 7), 7)
}

// The 7-day trip: Orsay day, Versailles day-trip, buffer day.
const seven = gen('first-time', 7)
check('7-day: day 5 contains Orsay', seven.days[4].committed.some((c) => c.id === 'orsay'), seven.days[4].committed.map((c) => c.id).join(','))
check('7-day: day 6 is the Versailles day-trip', seven.days[5].committed.some((c) => c.id === 'versailles'))
check('7-day: day 7 is a small buffer day', seven.days[6].committed.length <= 4 && !seven.days[6].committed.some((c) => stopPlace(city, c)?.role === 'anchor'))
check('7-day: purposes present', seven.purposes.slice(0, 7).every((p) => p.length > 0))

// ── Operating rules v2: weekday hours + date exceptions ──
const louvre = placeVariants(placeOf('louvre')!).find((v) => v.experienceId === 'interior')!
const orsay = placeOf('orsay')!
// 2026-09-16 is a Wednesday; -09-17 a Thursday; -09-15 a Tuesday; -09-14 a Monday.
check('hours: Louvre closed Tuesday', effectiveHours(louvre, '2026-09-15', 2) === null)
check('hours: Louvre nocturne Wednesday to 21:45', effectiveHours(louvre, '2026-09-16', 3)?.[1] === 21.75)
check('hours: Louvre normal Thursday to 18:00', effectiveHours(louvre, '2026-09-17', 4)?.[1] === 18)
check('hours: Orsay closed Monday', effectiveHours(orsay, '2026-09-14', 1) === null)
check('hours: Orsay nocturne Thursday to 21:45', effectiveHours(orsay, '2026-09-17', 4)?.[1] === 21.75)
check('hours: undated query falls back to typical open', effectiveHours(louvre)?.[1] === 18)

// Exceptions beat weekday hours in both directions.
const testEx = {
  ...louvre,
  exceptions: [
    { date: '2026-09-16', closed: true as const },
    { date: '2026-09-17', open: [9, 22] as [number, number], note: 'test late night' },
  ],
}
check('exceptions: one-off closure beats a nocturne weekday', effectiveHours(testEx, '2026-09-16', 3) === null)
check('exceptions: one-off late night beats normal hours', effectiveHours(testEx, '2026-09-17', 4)?.[1] === 22)
check('exceptions: other dates unaffected', effectiveHours(testEx, '2026-09-18', 5)?.[1] === 21.75)

// The nocturne is schedulable: in a city whose Louvre offers only the interior,
// a 17:30 start passes the hard filters on Wednesday and fails them on Thursday.
const wedEvening = { ...blankDay(city, STAY), clock: 17.5 * 60 }
const interiorOnly: City = {
  ...city,
  places: city.places.map((p) => (p.id === 'louvre' ? { ...p, experiences: p.experiences?.filter((e) => e.id === 'interior') } : p)),
}
const allButLouvre = new Set(city.places.filter((p) => p.id !== 'louvre').map((p) => p.id))
const wedCands = buildCandidates(interiorOnly, wedEvening, 'balanced', allButLouvre, { weekday: 3, date: '2026-09-16' })
check('hours: Louvre-interior evening visit feasible on nocturne Wednesday', wedCands.some((c) => c.p.id === 'louvre' && c.p.experienceId === 'interior'))
const thuCands = buildCandidates(interiorOnly, wedEvening, 'balanced', allButLouvre, { weekday: 4, date: '2026-09-17' })
check('hours: same evening visit infeasible on a normal Thursday', !thuCands.some((c) => c.p.id === 'louvre'))

// Generation-level: an exception on one trip date removes the place that day only.
// Trip 2026-09-12 (Sat): day 3 is Monday 09-14, where the baseline schedules
// Holybelly — a one-off closure that date must keep it off that day.
const exCity: City = {
  ...city,
  places: city.places.map((p) => (p.id === 'holybelly' ? { ...p, exceptions: [{ date: '2026-09-14', closed: true as const }] } : p)),
}
const basePlan = generatePlan(city, PLAN_PRESETS[0], 4, 'balanced', STAY, ARRIVING, [])
const exPlan = generatePlan(exCity, PLAN_PRESETS[0], 4, 'balanced', STAY, ARRIVING, [])
const onDate = (plan: GeneratedPlan, id: string) =>
  plan.days.filter((_, i) => dayDate(ARRIVING, i) === '2026-09-14').some((d) => d.committed.some((c) => c.id === id))
check('exceptions: excepted place never scheduled on its closed date', !onDate(exPlan, 'holybelly'))
check('exceptions: baseline actually schedules it that day (test is live)', onDate(basePlan, 'holybelly'))

// ── Experiences: embedded variants, place-level dedup ──
check('experiences: the two Louvre records are one place', !placeOf('louvremus') && placeOf('louvre')?.experiences?.length === 2)
check('experiences: variants inherit parent fields', louvre.hood === placeOf('louvre')!.hood && louvre.lat === placeOf('louvre')!.lat)
check('experiences: interior carries its own provenance', louvre.src === 'web' && placeOf('louvre')!.src === 'verified')

// The Louvre day seeds the interior experience specifically.
const louvreStops = seven.days.flatMap((d) => d.committed.filter((c) => c.id === 'louvre'))
check('experiences: the trip visits the Louvre exactly once', louvreStops.length === 1, `${louvreStops.length}`)
check('experiences: the seeded visit is the interior variant', louvreStops[0]?.experienceId === 'interior')
check('experiences: committed stop carries the variant name', louvreStops[0]?.name === 'The Louvre, inside')

// Visited is place-level: once any variant is committed, no variant returns.
const afterLouvre = buildCandidates(city, blankDay(city, STAY), 'balanced', new Set(['louvre']), { weekday: 3, date: '2026-09-16' })
check('experiences: visited place blocks all its variants', !afterLouvre.some((c) => c.p.id === 'louvre'))

// Candidate lists never offer two variants of one place.
const openCands = buildCandidates(city, blankDay(city, STAY), 'balanced', new Set(), { weekday: 3, date: '2026-09-16' })
const candIds = openCands.map((c) => c.p.id)
check('experiences: one variant per place in candidates', new Set(candIds).size === candIds.length, candIds.join(','))

// From Trocadéro at golden hour, the verified view outscores the web summit.
const eiffelVariants = placeVariants(placeOf('eiffel')!)
check('experiences: Eiffel has view + summit variants', eiffelVariants.length === 2 && eiffelVariants.some((v) => v.experienceId === 'summit'))

// The literary cafés: one Saint-Germain café visit per trip, never both —
// and the curator's terraces stay verified while the institutions are web.
const sgVariants = placeVariants(placeOf('stgermain')!)
check('food: Flore and Deux Magots are variants of one place', sgVariants.some((v) => v.experienceId === 'flore') && sgVariants.some((v) => v.experienceId === 'deuxmagots'))
check('food: the terraces variant keeps its provenance', sgVariants.find((v) => v.experienceId === 'terraces')?.src === 'verified')
check('food: the institutions are honestly web-tier', sgVariants.find((v) => v.experienceId === 'flore')?.src === 'web')

// Meal override: Stohrer is a pâtisserie stop on a lunch street.
const moVariants = placeVariants(placeOf('montorgueil')!)
check('food: Stohrer overrides the street’s lunch role', moVariants.find((v) => v.experienceId === 'stohrer')?.meal === null)
check('food: the street itself stays a lunch', moVariants.find((v) => v.experienceId === 'street')?.meal === 'lunch')

// ── Structured explanations: every stop can say why ──
const CANONICAL_TERMS = new Set(['provenance_fit', 'transit_cost', 'locality_fit', 'time_of_day_fit', 'narrative_fit', 'variety', 'coverage', 'interest_fit', 'editorial_fit'])
for (const [cid, c] of Object.entries(CITIES))
  for (const preset of PLAN_PRESETS) {
    const plan = genFor(c, preset.id, 7)
    const stops = plan.days.flatMap((d) => d.committed)
    check(`${cid}/${preset.id}: every stop has at least one reason`, stops.every((s) => (s.reasons?.length ?? 0) > 0),
      stops.filter((s) => !s.reasons?.length).map((s) => s.name).join(', '))
    check(`${cid}/${preset.id}: reasons use canonical terms only`, stops.every((s) => s.reasons!.every((r) => CANONICAL_TERMS.has(r.term))))
    check(`${cid}/${preset.id}: reason notes are prose`, stops.every((s) => s.reasons!.every((r) => r.note.length > 0)))
  }
const reasonsA = JSON.stringify(gen('first-time', 7).days.map((d) => d.committed.map((c) => c.reasons)))
const reasonsB = JSON.stringify(gen('first-time', 7).days.map((d) => d.committed.map((c) => c.reasons)))
check('reasons: deterministic across runs', reasonsA === reasonsB)

// ── Robustness: worst-case durations and timed-entry buffers ──
// No day busts curfew even when every stop runs to dur + durVar. The stored
// dur is pace-scaled, so durVar scales by the same pace (day 7 is the gentle
// buffer day in every preset; all other generated days run balanced).
for (const [cid, c] of Object.entries(CITIES))
  for (const preset of PLAN_PRESETS) {
    const plan = genFor(c, preset.id, 7)
    const busts = plan.days.flatMap((d, i) =>
      d.committed.filter((s) => {
        const p = stopPlace(c, s)
        if (!p) return false
        const pf = PACE[i === 6 ? 'gentle' : 'balanced'].f
        // Worst case caps at closing time (the venue ends the overrun), never
        // below the typical plan — mirrors the engine's curfew rule.
        const hrs = effectiveHours(p, dayDate(ARRIVING, i), dayWeekday(ARRIVING, i))
        const close = (hrs?.[1] ?? 24) * 60
        const worstEnd = Math.max(s.timeIn + s.dur, Math.min(s.timeIn + s.dur + Math.round((p.durVar ?? 0) * pf), close))
        return worstEnd > 22 * 60
      }),
    )
    check(`${cid}/${preset.id}: home by 22:00 even at worst-case durations`, busts.length === 0, busts.map((s) => s.name).join(', '))
  }
// Timed candidates carry the entry buffer: the slot sits ≥ buffer past
// expected physical arrival (clock + travel). Narrow the pool to force each
// timed place into the returned picks.
let timedSeen = 0
for (const timedId of ['saintechapelle', 'orangerie']) {
  const others = new Set(city.places.filter((p) => p.id !== timedId).map((p) => p.id))
  for (const clk of [city.dayStart, 14 * 60]) {
    const state = { ...blankDay(city, STAY), clock: clk }
    for (const c of buildCandidates(city, state, 'balanced', others, { weekday: 6, date: '2026-09-12' })) {
      if (!c.p.timed) continue
      timedSeen++
      check(`timed buffer: ${c.p.name} at ${fmtClock(clk)} slot ≥${ENGINE.timedEntryBuffer} min past arrival`, c.arrive - (clk + c.t.min) >= ENGINE.timedEntryBuffer)
    }
  }
}
check('timed buffer: at least two timed candidates exercised', timedSeen >= 2, `${timedSeen}`)
function fmtClock(m: number): string {
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`
}

// ── The shuffle: reproducible variety, no RNG ──
const v0a = generatePlan(city, PLAN_PRESETS[0], 4, 'balanced', STAY, ARRIVING, [], 0)
const v0b = generatePlan(city, PLAN_PRESETS[0], 4, 'balanced', STAY, ARRIVING, [], 0)
const v1 = generatePlan(city, PLAN_PRESETS[0], 4, 'balanced', STAY, ARRIVING, [], 1)
const v2 = generatePlan(city, PLAN_PRESETS[0], 4, 'balanced', STAY, ARRIVING, [], 2)
check('shuffle: same variant regenerates the same plan', seq(v0a) === seq(v0b))
check('shuffle: variants produce different plans', new Set([seq(v0a), seq(v1), seq(v2)]).size === 3)

// ── Preference extraction: brief weights steer the deterministic engine ──
import { sanitizeExtracted } from '../src/lib/extract'
const artsy = generatePlan(city, PLAN_PRESETS[0], 4, 'balanced', STAY, ARRIVING, [], 0, { artistic: 1, monumental: -1 })
const baseline4 = generatePlan(city, PLAN_PRESETS[0], 4, 'balanced', STAY, ARRIVING, [], 0)
check('brief: weights change the plan', seq(artsy) !== seq(baseline4))
check('brief: weights are deterministic', seq(artsy) === seq(generatePlan(city, PLAN_PRESETS[0], 4, 'balanced', STAY, ARRIVING, [], 0, { artistic: 1, monumental: -1 })))
const briefReasons = artsy.days.flatMap((d) => d.committed).flatMap((s) => s.reasons ?? [])
check('brief: stops carry interest_fit reasons from the brief', briefReasons.some((r) => r.term === 'interest_fit' && r.note.includes('brief')))
const themeCount = (p: GeneratedPlan, th: string) =>
  p.days.flatMap((d) => d.committed).filter((s) => stopPlace(city, s)?.themes?.includes(th as never)).length
check('brief: artistic lean yields ≥ as many artistic stops', themeCount(artsy, 'artistic') >= themeCount(baseline4, 'artistic'),
  `${themeCount(artsy, 'artistic')} vs ${themeCount(baseline4, 'artistic')}`)

// Sanitizer: clamp, filter, reject — never trust model output structurally.
const dirty = sanitizeExtracted({
  interests: ['Museums', 'Skydiving', 42],
  themeWeights: { artistic: 3, monumental: -2, bogus: 1, everyday: 0 },
  pace: 'ludicrous',
  summary: 'x'.repeat(500),
})
check('sanitize: keeps only vocabulary interests', JSON.stringify(dirty?.interests) === '["Museums"]')
check('sanitize: clamps weights to ±1 and drops unknown/zero themes',
  dirty?.themeWeights.artistic === 1 && dirty?.themeWeights.monumental === -1 && Object.keys(dirty?.themeWeights ?? {}).length === 2)
check('sanitize: invalid pace becomes null and summary truncates', dirty?.pace === null && (dirty?.summary.length ?? 0) <= 280)
check('sanitize: junk input rejected', sanitizeExtracted({ interests: [], themeWeights: {}, pace: null, summary: 'hi' }) === null)

// ── Sun times + the deck: the day tied to its date ──
import { euTzOffsetMin, sunTimes } from '../src/lib/sun'
import { builtDayDeck } from '../src/lib/built-day'
const inRange = (v: number, lo: string, hi: string) => {
  const m = (s: string) => Number(s.split(':')[0]) * 60 + Number(s.split(':')[1])
  return v >= m(lo) && v <= m(hi)
}
const paris = { lat: city.start.lat, lon: city.start.lon }
const jun = sunTimes(paris.lat, paris.lon, '2026-06-21', euTzOffsetMin('2026-06-21'))
const dec = sunTimes(paris.lat, paris.lon, '2026-12-21', euTzOffsetMin('2026-12-21'))
const sep = sunTimes(paris.lat, paris.lon, '2026-09-12', euTzOffsetMin('2026-09-12'))
check('sun: Paris June solstice sunset ~21:58', inRange(jun.sunset, '21:40', '22:15'), fmtClock(Math.round(jun.sunset)))
check('sun: Paris December solstice sunset ~16:56', inRange(dec.sunset, '16:40', '17:15'), fmtClock(Math.round(dec.sunset)))
check('sun: Paris mid-September sunset ~20:10', inRange(sep.sunset, '19:55', '20:25'), fmtClock(Math.round(sep.sunset)))
check('sun: DST rule flips (CEST in June, CET in December)', euTzOffsetMin('2026-06-21') === 120 && euTzOffsetMin('2026-12-21') === 60)

// Deck v3: dated days mention the light; closure days explain themselves.
const sevenPlan = gen('first-time', 7)
const deckFor = (i: number) => builtDayDeck(city, sevenPlan.days[i], { date: dayDate(ARRIVING, i), weekday: dayWeekday(ARRIVING, i) })
check('deck: dated day mentions sunset', deckFor(0).includes('sunset comes at'), deckFor(0))
// Day 3 of the 2026-09-12 trip is Monday — Orsay (rank 1) closes.
check('deck: Monday explains the closures', /closed on Mondays/.test(deckFor(2)), deckFor(2))
check('deck: deterministic', deckFor(1) === builtDayDeck(city, sevenPlan.days[1], { date: dayDate(ARRIVING, 1), weekday: dayWeekday(ARRIVING, 1) }))

// ── Diversity: where you stay and which preset you pick must matter ──
import { dayAnchor } from '../src/lib/planner'
for (const [cid, c] of Object.entries(CITIES)) {
  // The empty-day anchor localizes: many distinct day-1 theme hoods across stays.
  const anchors = new Set(c.hoodOrder.map((h) => dayAnchor(c, blankDay(c, stayLoc(c, h)), new Set())))
  check(`${cid}: day-1 anchors vary with the stay (≥5 distinct)`, anchors.size >= 5, `${anchors.size} of ${c.hoodOrder.length}`)

  // Plans from different stay hoods genuinely differ.
  const stays = [c.hoodOrder[0], c.hoodOrder[Math.floor(c.hoodOrder.length / 2)], c.hoodOrder[c.hoodOrder.length - 1]]
  const stayPlans = stays.map((h) =>
    generatePlan(c, PLAN_PRESETS[0], 4, 'balanced', stayLoc(c, h), ARRIVING, []).days.flatMap((d) => d.committed.map((s) => s.id)),
  )
  for (let i = 0; i < stayPlans.length; i++)
    for (let j = i + 1; j < stayPlans.length; j++) {
      const a = new Set(stayPlans[i]), b = new Set(stayPlans[j])
      const diff = [...a].filter((x) => !b.has(x)).length + [...b].filter((x) => !a.has(x)).length
      check(`${cid}: stays "${stays[i]}" vs "${stays[j]}" differ (≥3 stops)`, diff >= 3, `${diff}`)
    }

  // Presets are more than reorderings: bounded overlap between plan flavors.
  const sets = PLAN_PRESETS.map((p) => new Set(genFor(c, p.id, 4).days.flatMap((d) => d.committed.map((s) => s.id))))
  for (let i = 0; i < sets.length; i++)
    for (let j = i + 1; j < sets.length; j++) {
      const inter = [...sets[i]].filter((x) => sets[j].has(x)).length
      const jac = inter / new Set([...sets[i], ...sets[j]]).size
      check(`${cid}: presets ${PLAN_PRESETS[i].id}/${PLAN_PRESETS[j].id} overlap ≤ 0.8`, jac <= 0.8, jac.toFixed(2))
    }
}

process.exit(fail ? 1 : 0)
