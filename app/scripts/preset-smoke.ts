/** Engine quality invariants — regression guards for the recommendation engine. */
import { CITIES } from '../src/cities'
import { dayPlanContext, generatePlan, PLAN_PRESETS, type GeneratedPlan } from '../src/lib/plan-presets'
import {
  alternativesAt,
  blankDay,
  buildCandidates,
  dayDate,
  dayWeekday,
  effectiveHours,
  ENGINE,
  insertAt,
  insertionSuggestions,
  PACE,
  placeVariants,
  removeAt,
  replayFrom,
  replaySequence,
  stayLoc,
  stopPlace,
  truncateDay,
} from '../src/lib/planner'
import type { City } from '../src/cities/types'
import type { ExtractedRequest } from '../src/lib/extract'

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

    // The dinner leg is the day's closing commute — exempt, like the opening one.
    const longLegs = d.committed.filter((s, j) => j > 0 && s.meal !== 'dinner' && s.travelMode === 'metro' && s.travelMin >= 20).length
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

// ── Concrete asks: "save the bateaux mouches for the last night" ──
const validIds = new Set(city.places.map((p) => p.id))
const reqRaw = sanitizeExtracted(
  {
    interests: [],
    themeWeights: {},
    pace: null,
    summary: 'cruise last night',
    requests: [
      { placeId: 'seinecruise', kind: 'include', day: 'last', slot: 'evening' },
      { placeId: 'not-a-place', kind: 'include', day: null, slot: null },
      { placeId: 'eiffel', kind: 'avoid', day: 9, slot: 'brunch' },
    ],
  },
  validIds,
)
check('requests: valid ids survive, bogus ids drop', reqRaw?.requests.length === 2 && reqRaw.requests[0].placeId === 'seinecruise')
check('requests: bad day/slot values are stripped', reqRaw?.requests[1].day === undefined && reqRaw?.requests[1].slot === undefined)

// Engine: the pin lands on its day, in its slot — and nowhere else.
const pinned = generatePlan(city, PLAN_PRESETS[0], 5, 'balanced', STAY, ARRIVING, [], 0, undefined, [
  { placeId: 'seinecruise', kind: 'include', day: 'last', slot: 'evening' },
])
const cruiseStops = pinned.days.map((d, i) => ({ i, stop: d.committed.find((s) => s.id === 'seinecruise') })).filter((x) => x.stop)
check('pin: the cruise sails exactly once, on the last day', cruiseStops.length === 1 && cruiseStops[0].i === 4,
  cruiseStops.map((x) => `day${x.i + 1}`).join(',') || 'never scheduled')
check('pin: and in the evening', (cruiseStops[0]?.stop?.timeIn ?? 0) >= 16 * 60, cruiseStops[0] ? fmtClock(cruiseStops[0].stop!.timeIn) : '—')
check('pin: deterministic', JSON.stringify(pinned.days.map((d) => d.committed.map((s) => s.id))) ===
  JSON.stringify(generatePlan(city, PLAN_PRESETS[0], 5, 'balanced', STAY, ARRIVING, [], 0, undefined, [
    { placeId: 'seinecruise', kind: 'include', day: 'last', slot: 'evening' },
  ]).days.map((d) => d.committed.map((s) => s.id))))

// Avoid: the place never appears anywhere in the trip.
const avoided = generatePlan(city, PLAN_PRESETS[0], 5, 'balanced', STAY, ARRIVING, [], 0, undefined, [
  { placeId: 'eiffel', kind: 'avoid' },
])
check('avoid: the skipped place never appears', !avoided.days.some((d) => d.committed.some((s) => s.id === 'eiffel')))

// The pin holds across configurations — the user's own scenario (late-August
// trip, Montmartre stay), every preset, several shuffle seeds.
for (const preset of PLAN_PRESETS)
  for (const seed of [0, 3, 7]) {
    const plan = generatePlan(city, preset, 5, 'balanced', stayLoc(city, 'Montmartre (18e)'), '2026-08-22', [], seed, undefined, [
      { placeId: 'seinecruise', kind: 'include', day: 'last', slot: 'evening' },
    ])
    const hits = plan.days.map((d, i) => ({ i, s: d.committed.find((x) => x.id === 'seinecruise') })).filter((x) => x.s)
    check(
      `pin holds: ${preset.id} seed ${seed} — cruise on the last night, evening`,
      hits.length === 1 && hits[0].i === 4 && hits[0].s!.timeIn >= 16 * 60,
      hits.map((x) => `day${x.i + 1}@${fmtClock(x.s!.timeIn)}`).join(',') || 'never scheduled',
    )
  }

// ── Sun times + the deck: the day tied to its date ──
import { euTzOffsetMin, sunTimes } from '../src/lib/sun'
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

// ── Reconsidering: slot alternatives, swap replay, curated fork ──
// (build-plan/03-itinerary.md §6)
const swapPlan = gen('first-time', 4)
const tripVisited = new Set(swapPlan.days.flatMap((d) => d.committed.map((s) => s.id)))

// A middle non-meal slot to reconsider.
let sdI = -1
let sk = -1
for (let i = 0; i < 4 && sdI < 0; i++) {
  const d = swapPlan.days[i]
  for (let k = 1; k < d.committed.length - 1; k++) {
    if (!d.committed[k].meal) {
      sdI = i
      sk = k
      break
    }
  }
}
check('swap: found a middle non-meal slot to reconsider', sdI >= 0)
const sDay = swapPlan.days[sdI]
const sOpts = { date: dayDate(ARRIVING, sdI), weekday: dayWeekday(ARRIVING, sdI) }
const altKey = (cs: ReturnType<typeof alternativesAt>) => JSON.stringify(cs.map((c) => `${c.p.id}@${c.arrive}`))
const alts = alternativesAt(city, sDay, sk, 'balanced', tripVisited, STAY, sOpts)
check('swap: alternatives exist for the slot', alts.length > 0, `${alts.length}`)
check('swap: alternatives deterministic', altKey(alts) === altKey(alternativesAt(city, sDay, sk, 'balanced', tripVisited, STAY, sOpts)))
check('swap: incumbent not re-offered', alts.every((c) => c.p.id !== sDay.committed[sk].id))
check('swap: nothing already used elsewhere in the trip is offered', alts.every((c) => !tripVisited.has(c.p.id)))
check('swap: a non-meal slot offers no meal cards', alts.every((c) => (c.p.meal ?? null) === null), alts.map((c) => `${c.p.id}:${c.p.meal}`).join(','))

// Every break-free alternative, applied, leaves a day that passes the suite.
let cleanSwaps = 0
for (const c of alts) {
  const r = replayFrom(city, sDay, sk, c, 'balanced', STAY, sOpts)
  const r2 = replayFrom(city, sDay, sk, c, 'balanced', STAY, sOpts)
  check(`swap ${c.p.id}: replay deterministic`, JSON.stringify(r) === JSON.stringify(r2))
  check(`swap ${c.p.id}: prefix byte-identical`, JSON.stringify(r.day.committed.slice(0, sk)) === JSON.stringify(sDay.committed.slice(0, sk)))
  check(`swap ${c.p.id}: stop count preserved`, r.day.committed.length === sDay.committed.length, `${r.day.committed.length} vs ${sDay.committed.length}`)
  if (r.flags.length > 0) continue
  cleanSwaps++
  const d = r.day
  const anchors = d.committed.filter((s) => stopPlace(city, s)?.role === 'anchor').length
  const timed = d.committed.filter((s) => stopPlace(city, s)?.timed).length
  const longLegs = d.committed.filter((s, j) => j > 0 && s.meal !== 'dinner' && s.travelMode === 'metro' && s.travelMin >= 20).length
  const late = d.committed.filter((s) => s.timeIn + s.dur > 22 * 60).length
  const singleMeals = (['coffee', 'lunch', 'dinner'] as const).every((m) => d.committed.filter((s) => s.meal === m).length <= 1)
  const dayIds = d.committed.map((s) => s.id)
  check(
    `swap ${c.p.id}: break-free replay passes the day invariants`,
    anchors <= 1 && timed <= 2 && longLegs <= 1 && late === 0 && singleMeals && new Set(dayIds).size === dayIds.length,
    `anchors ${anchors}, timed ${timed}, long ${longLegs}, late ${late}`,
  )
}
check('swap: at least one break-free alternative exercised (impact honesty is live)', cleanSwaps >= 1, `${cleanSwaps} of ${alts.length}`)

// A lunch slot trades only against lunch — where lunch happens, never whether.
let li = -1
let lk = -1
for (let i = 0; i < 4 && li < 0; i++) {
  const k = swapPlan.days[i].committed.findIndex((s) => s.meal === 'lunch')
  if (k > 0) {
    li = i
    lk = k
  }
}
check('swap: found a lunch slot', li >= 0)
if (li >= 0) {
  const lAlts = alternativesAt(city, swapPlan.days[li], lk, 'balanced', tripVisited, STAY, {
    date: dayDate(ARRIVING, li),
    weekday: dayWeekday(ARRIVING, li),
  })
  check('swap: a lunch slot offers only lunch', lAlts.length > 0 && lAlts.every((c) => c.p.meal === 'lunch'), lAlts.map((c) => `${c.p.id}:${c.p.meal}`).join(','))
}

// Suffix-aware caps: around a day that already holds its anchor, no slot may
// grow a second one.
const adI = swapPlan.days.findIndex((d) => d.committed.some((s) => stopPlace(city, s)?.role === 'anchor'))
if (adI >= 0) {
  const aDay = swapPlan.days[adI]
  const ak = aDay.committed.findIndex((s) => stopPlace(city, s)?.role === 'anchor')
  const testK = aDay.committed.findIndex((s, k) => k !== ak && !s.meal)
  if (testK >= 0) {
    const aAlts = alternativesAt(city, aDay, testK, 'balanced', tripVisited, STAY, {
      date: dayDate(ARRIVING, adI),
      weekday: dayWeekday(ARRIVING, adI),
    })
    check('swap: no second anchor offered around an anchored day', aAlts.every((c) => c.p.role !== 'anchor'), aAlts.map((c) => c.p.id).join(','))
  }
}

// Append is the k = length special case: truncation reproduces the live state.
const td = truncateDay(city, sDay, sDay.committed.length, 'balanced', STAY)
check(
  'truncate: k = length reproduces the live day state',
  td.clock === sDay.clock && JSON.stringify(td.meals) === JSON.stringify(sDay.meals) && td.committed.length === sDay.committed.length,
  `clock ${td.clock} vs ${sDay.clock}`,
)

// ── Remove & insert: the day re-routes and re-times itself ──
const rm = removeAt(city, sDay, sk, 'balanced', STAY, sOpts)
check('remove: stop count drops by one', rm.day.committed.length === sDay.committed.length - 1)
check(
  'remove: the stop is gone, order preserved',
  JSON.stringify(rm.day.committed.map((s) => s.id)) === JSON.stringify(sDay.committed.map((s) => s.id).filter((_, j) => j !== sk)),
)
check('remove: deterministic', JSON.stringify(rm) === JSON.stringify(removeAt(city, sDay, sk, 'balanced', STAY, sOpts)))

// Suggestions need a day with budget room — a full day now honestly offers none.
const sBase = rm.day
const sugg = insertionSuggestions(city, sBase, 'balanced', tripVisited, STAY, sOpts)
check('insert: suggestions exist and all break nothing', sugg.length > 0 && sugg.every((s) => s.result.flags.length === 0), `${sugg.length}`)
check(
  'insert: each suggestion adds exactly its place',
  sugg.every((s) => s.result.day.committed.length === sBase.committed.length + 1 && s.result.day.committed.some((c) => c.id === s.p.id)),
)
check('insert: nothing already in the trip is suggested', sugg.every((s) => !tripVisited.has(s.p.id)))
check(
  'insert: suggestions deterministic',
  JSON.stringify(sugg.map((s) => `${s.p.id}@${s.k}`)) ===
    JSON.stringify(insertionSuggestions(city, sBase, 'balanced', tripVisited, STAY, sOpts).map((s) => `${s.p.id}@${s.k}`)),
)
check('insert: clean insertions keep the day home by 22:00', sugg.every((s) => s.result.day.committed.every((c) => c.timeIn + c.dur <= 22 * 60)))

// Curated day 1 forks: fully linked, and materializes deterministically into
// the same sequence, re-scheduled by the engine.
const curated1 = city.curatedDays[0]
check('curated: day 1 fully linked to places', curated1.stops.every((s) => s.placeId))
const matRefs = curated1.stops.map((s) => ({ placeId: s.placeId! }))
const mat = replaySequence(city, matRefs, 'balanced', STAY, { date: dayDate(ARRIVING, 0), weekday: dayWeekday(ARRIVING, 0) })
check(
  'curated: materialization deterministic',
  JSON.stringify(mat) === JSON.stringify(replaySequence(city, matRefs, 'balanced', STAY, { date: dayDate(ARRIVING, 0), weekday: dayWeekday(ARRIVING, 0) })),
)
check('curated: every stop materializes, in order', JSON.stringify(mat.day.committed.map((s) => s.id)) === JSON.stringify(curated1.stops.map((s) => s.placeId)))
check('curated: materialized day ends by 22:00', mat.day.committed.every((s) => s.timeIn + s.dur <= 22 * 60))
if (mat.flags.length > 0) console.log(`  (curated day 1 materialization flags: ${mat.flags.map((f) => `#${f.index} ${f.note}`).join(' · ')})`)

// ── Audit guards: meals happen, closings hold, asks are honored or surfaced ──
// Meal assertions run only where the city's inventory leaves slack — Rome's
// four lunch/dinner venues cannot feed a seven-day trip; that's a data gap,
// not an engine regression.
for (const [cid, c] of Object.entries(CITIES)) {
  const cStay = stayLoc(c, c.hoodOrder[0])
  const lunchInv = c.places.filter((p) => p.meal === 'lunch').length
  const dinnerInv = c.places.filter((p) => p.meal === 'dinner').length
  for (const preset of PLAN_PRESETS) {
    const mealMisses: string[] = []
    const closeBusts: string[] = []
    const bufferBusts: string[] = []
    for (const dayCount of [4, 7] as const) {
      for (const variant of [0, 1, 2, 5, 9]) {
        const plan = generatePlan(c, preset, dayCount, 'balanced', cStay, ARRIVING, [], variant)
        plan.days.slice(0, dayCount).forEach((d, i) => {
          const date = dayDate(ARRIVING, i)
          const wd = dayWeekday(ARRIVING, i)
          for (const s of d.committed) {
            const p = stopPlace(c, s)
            const hrs = p && effectiveHours(p, date, wd)
            if (hrs && s.timeIn + s.dur > hrs[1] * 60) closeBusts.push(`v${variant}/${dayCount}d day ${i + 1} ${s.id}`)
          }
          if (i === 6) {
            const nonDinner = d.committed.filter((s) => s.meal !== 'dinner').length
            if (nonDinner > 3) bufferBusts.push(`v${variant} day 7: ${nonDinner} non-dinner stops`)
          }
          const isTrip = d.committed.some((s) => stopPlace(c, s)?.dayTrip)
          if (isTrip || d.committed.length < 3) return
          if (lunchInv > dayCount && !d.meals.lunch) mealMisses.push(`v${variant}/${dayCount}d day ${i + 1}: lunch`)
          if (dinnerInv >= dayCount && !d.meals.dinner) mealMisses.push(`v${variant}/${dayCount}d day ${i + 1}: dinner`)
        })
      }
    }
    check(`${cid}/${preset.id}: every full day eats (5 variants × 4d/7d)`, mealMisses.length === 0, mealMisses.join('; '))
    check(`${cid}/${preset.id}: no stop outlasts its venue's closing`, closeBusts.length === 0, closeBusts.join('; '))
    check(`${cid}/${preset.id}: buffer day keeps its 3-stop cap`, bufferBusts.length === 0, bufferBusts.join('; '))
  }
}

// Avoids bind everywhere — including seeds and the day-trip day.
const REQ = (kind: 'include' | 'avoid', placeId: string, day?: number) => ({ kind, placeId, ...(day !== undefined ? { day } : {}) })
const noLouvre = generatePlan(city, PLAN_PRESETS[0], 7, 'balanced', STAY, ARRIVING, [], 0, undefined, [REQ('avoid', 'louvre')])
check('avoids: an avoided seed appears nowhere', noLouvre.days.every((d) => d.committed.every((s) => s.id !== 'louvre')))
check('avoids: the seed day gets its alt purpose', noLouvre.purposes[1] !== seven.purposes[1] && noLouvre.purposes[1].length > 0, noLouvre.purposes[1])
const noVers = generatePlan(city, PLAN_PRESETS[0], 7, 'balanced', STAY, ARRIVING, [], 0, undefined, [REQ('avoid', 'versailles')])
check('avoids: the avoided day-trip appears nowhere', noVers.days.every((d) => d.committed.every((s) => s.id !== 'versailles')))
check('avoids: the day-trip day hands over to its alt', noVers.purposes[5] !== seven.purposes[5] && noVers.days[5].committed.length >= 3, noVers.purposes[5])

// A closed day-trip resolves to the alt day — purpose and shape together.
// Arriving Wed 2026-08-26 puts day 6 on Monday, when Versailles is closed.
const monSeven = generatePlan(city, PLAN_PRESETS[0], 7, 'balanced', STAY, '2026-08-26', [])
check(
  'closed seed: the Monday Versailles day becomes the alt day',
  monSeven.days[5].committed.every((s) => s.id !== 'versailles') && monSeven.purposes[5] !== seven.purposes[5] && monSeven.days[5].committed.length >= 3,
  monSeven.purposes[5],
)

// Pins: held for their day, honored best-effort, surfaced when impossible.
const pinDay6 = () => generatePlan(city, PLAN_PRESETS[0], 7, 'balanced', STAY, ARRIVING, [], 0, undefined, [REQ('include', 'saintechapelle', 6)])
const pinnedPlan = pinDay6()
const pinnedDay = pinnedPlan.days.findIndex((d) => d.committed.some((s) => s.id === 'saintechapelle'))
check(
  'pins: an ask pinned onto the day-trip day still lands (or is surfaced)',
  pinnedDay >= 0 || pinnedPlan.unplaced.some((u) => u.placeId === 'saintechapelle'),
  `day ${pinnedDay + 1}`,
)
check('pins: a placed ask is not reported unplaced', !(pinnedDay >= 0 && pinnedPlan.unplaced.some((u) => u.placeId === 'saintechapelle')))
check('pins: placement deterministic', JSON.stringify(pinnedPlan.days) === JSON.stringify(pinDay6().days))
// A pinned anchor on the seeded anchor day is deliberate — it lands.
const orsayPin = generatePlan(city, PLAN_PRESETS[0], 4, 'balanced', STAY, ARRIVING, [], 0, undefined, [REQ('include', 'orsay', 2)])
check('pins: a pinned second anchor lands on its asked day', orsayPin.days[1].committed.some((s) => s.id === 'orsay'))
// An impossible ask (Versailles on a one-day Monday trip) is surfaced, not dropped.
const upl = generatePlan(city, PLAN_PRESETS[0], 1, 'balanced', STAY, '2026-08-31', [], 0, undefined, [REQ('include', 'versailles')])
check('pins: an impossible ask is surfaced with a reason', upl.unplaced.some((u) => u.placeId === 'versailles' && u.reason.length > 0), JSON.stringify(upl.unplaced))
check('pins: surfaced asks appear nowhere in the plan', upl.days.every((d) => d.committed.every((s) => s.id !== 'versailles')))

// Variant dedup judges fit, not provenance: a morning offers the Louvre's
// interior; late afternoon hands the slot back to the courtyard.
const morningCands = buildCandidates(city, blankDay(city, STAY), 'balanced', allButLouvre, { weekday: 3, date: '2026-09-16' })
check(
  'dedup: a morning offers the Louvre interior',
  morningCands.some((c) => c.p.id === 'louvre' && c.p.experienceId === 'interior'),
  morningCands.map((c) => `${c.p.id}:${c.p.experienceId}`).join(','),
)
const lateCands = buildCandidates(city, { ...blankDay(city, STAY), clock: 15.5 * 60 }, 'balanced', allButLouvre, { weekday: 3, date: '2026-09-16' })
check(
  'dedup: late afternoon falls back to the courtyard',
  lateCands.some((c) => c.p.id === 'louvre' && c.p.experienceId !== 'interior'),
  lateCands.map((c) => `${c.p.id}:${c.p.experienceId}`).join(','),
)

// ── Edit paths name the day-anatomy caps: flags, never silent breaks ──
const wedOpts = { date: '2026-09-16', weekday: 3 }
const twoTimed = replaySequence(city, [{ placeId: 'saintechapelle' }, { placeId: 'orangerie' }], 'balanced', STAY, wedOpts).day
const thirdTimed = insertAt(city, twoTimed, 2, { placeId: 'louvre', experienceId: 'interior' }, 'balanced', STAY, wedOpts)
check('edit caps: a third timed booking is flagged', thirdTimed.flags.some((f) => f.note === 'a third timed booking'), thirdTimed.flags.map((f) => f.note).join('; '))
check(
  'edit caps: insertAt deterministic',
  JSON.stringify(thirdTimed) === JSON.stringify(insertAt(city, twoTimed, 2, { placeId: 'louvre', experienceId: 'interior' }, 'balanced', STAY, wedOpts)),
)
const oneAnchor = replaySequence(city, [{ placeId: 'orsay' }], 'balanced', STAY, wedOpts).day
const secondAnchor = insertAt(city, oneAnchor, 1, { placeId: 'catacombes' }, 'balanced', STAY, wedOpts)
check('edit caps: a second anchor is flagged', secondAnchor.flags.some((f) => f.note === 'a second anchor in one day'), secondAnchor.flags.map((f) => f.note).join('; '))

const fdi = seven.days.findIndex((d, i) => i < 5 && d.committed.filter((s) => s.meal !== 'dinner').length >= ENGINE.stopBudget.balanced)
check('edit caps: found a generated day at budget (test is live)', fdi >= 0)
if (fdi >= 0) {
  const fdOpts = { date: dayDate(ARRIVING, fdi), weekday: dayWeekday(ARRIVING, fdi) }
  const tripIds = new Set(seven.days.flatMap((d) => d.committed.map((s) => s.id)))
  const spareSight = city.places.find((p) => p.meal === null && !p.dayTrip && !p.timed && p.role !== 'anchor' && !tripIds.has(p.id))!
  const overBudget = insertAt(city, seven.days[fdi], 1, { placeId: spareSight.id }, 'balanced', STAY, fdOpts)
  check('edit caps: an over-budget insertion is flagged', overBudget.flags.some((f) => f.note.includes('-stop budget')), overBudget.flags.map((f) => f.note).join('; '))
  const spareCoffee = city.places.find((p) => p.meal === 'coffee' && !tripIds.has(p.id))!
  const lateCoffee = insertAt(city, seven.days[fdi], seven.days[fdi].committed.length - 1, { placeId: spareCoffee.id }, 'balanced', STAY, fdOpts)
  check('edit caps: an afternoon coffee is flagged', lateCoffee.flags.some((f) => f.note.startsWith('coffee lands at')), lateCoffee.flags.map((f) => f.note).join('; '))
}

// Replaying a generated day unchanged raises no cap flags (no false positives).
const CAP_NOTES = ['a second anchor in one day', 'a third timed booking', '-stop budget']
for (const [i, d] of seven.days.entries()) {
  if (!d.committed.length) continue
  const r = replaySequence(
    city,
    d.committed.map((s) => ({ placeId: s.id, experienceId: s.experienceId })),
    i === 6 ? 'gentle' : 'balanced',
    STAY,
    { date: dayDate(ARRIVING, i), weekday: dayWeekday(ARRIVING, i) },
  )
  const caps = r.flags.filter((f) => CAP_NOTES.some((n) => f.note.includes(n)))
  check(`edit caps: replaying generated day ${i + 1} unchanged raises no cap flags`, caps.length === 0, caps.map((f) => f.note).join('; '))
}

// A stale id mid-sequence must not shift later flags onto the wrong stop:
// indices are rebuilt-array positions, so berthillon's own flag names berthillon.
const staleR = replaySequence(
  city,
  [{ placeId: 'notredame' }, { placeId: 'GONE' }, { placeId: 'berthillon' }, { placeId: 'saintechapelle' }],
  'balanced',
  STAY,
  wedOpts,
)
check('edit flags: a dropped stop does not misalign later flags', staleR.day.committed.length === 3 && staleR.flags.every((f) => f.index <= staleR.day.committed.length) && staleR.flags.filter((f) => f.note.includes('best window')).every((f) => staleR.day.committed[f.index]?.id === 'berthillon'), staleR.flags.map((f) => `#${f.index} ${f.note}`).join('; '))

// Suggestions honor the caps end to end.
check(
  'insert: suggestions never break the day-anatomy caps',
  sugg.every((s) => {
    const d = s.result.day
    const anchors = d.committed.filter((x) => stopPlace(city, x)?.role === 'anchor').length
    const timed = d.committed.filter((x) => stopPlace(city, x)?.timed).length
    const nonDinner = d.committed.filter((x) => x.meal !== 'dinner').length
    return anchors <= 1 && timed <= 2 && nonDinner <= ENGINE.stopBudget.balanced
  }),
)

// ── The generation/edit parity invariant ──
// The engine used to be asked two different questions: generatePlan passed the
// brief's avoids and pins, the interest and theme weights and the day
// template's caps, while every edit surface rebuilt a weaker options object by
// hand — so a place the traveler asked to skip, or an anchor on the buffer
// day, was re-offered by the decks one tap from being committed. Both paths now
// derive from dayPlanContext; these assertions hold them there.
{
  const REQUESTS: ExtractedRequest[] = [
    { kind: 'avoid', placeId: 'louvre' },
    { kind: 'avoid', placeId: 'eiffel' },
    { kind: 'include', placeId: 'berthillon', day: 'last' },
  ]
  for (const presetId of ['first-time', 'broader', 'gentler']) {
    const preset = PLAN_PRESETS.find((p) => p.id === presetId)!
    const dayCount = 7
    const plan = generatePlan(city, preset, dayCount, 'balanced', STAY, ARRIVING, [], 0, undefined, REQUESTS)
    let leaks = 0
    let capBreaks = 0
    let paceMismatch = 0
    for (let i = 0; i < dayCount; i++) {
      const day = plan.days[i]
      if (day.committed.length === 0) continue
      // Exactly what ItineraryPage derives for this day.
      const visitedElsewhere = new Set<string>()
      const usedHoods = new Set<string>()
      plan.days.forEach((d, j) => {
        if (j === i) return
        d.committed.forEach((c) => visitedElsewhere.add(c.id))
        const theme = d.committed.find((c) => c.meal !== 'coffee')
        const p = theme && city.places.find((pl) => pl.id === theme.id)
        if (p) usedHoods.add(p.hood)
      })
      const ctx = dayPlanContext(city, i, {
        dayCount, preset, travelerPace: 'balanced', stay: STAY, arriving: ARRIVING,
        interests: [], requests: REQUESTS, visitedElsewhere, usedHoods,
      })
      // The page edits at the pace the plan was generated at.
      if (ctx.pace !== plan.paces[i]) paceMismatch++
      const visited = new Set(plan.days.flatMap((d) => d.committed.map((c) => c.id)))
      const pace = plan.paces[i]
      const offered = [
        ...buildCandidates(city, day, pace, visited, ctx.opts),
        ...day.committed.flatMap((_, k) => alternativesAt(city, day, k, pace, visited, STAY, ctx.opts)),
      ].map((c) => c.p)
      const suggested = insertionSuggestions(city, day, pace, visited, STAY, {
        date: ctx.opts.date, weekday: ctx.opts.weekday,
        exclude: ctx.opts.exclude, blockAnchors: ctx.opts.blockAnchors, blockTimed: ctx.opts.blockTimed,
      }).map((s) => s.p)

      leaks += [...offered, ...suggested].filter((p) => ctx.opts.exclude?.has(p.id)).length
      if (ctx.profile.noAnchors) capBreaks += [...offered, ...suggested].filter((p) => p.role === 'anchor').length
      if (ctx.profile.noTimed) {
        capBreaks += offered.filter((p) => p.timed).length
        capBreaks += suggested.filter((p) => placeVariants(p).some((v) => v.timed)).length
      }
    }
    check(`edit parity (${presetId}): no avoided place is ever offered by an edit surface`, leaks === 0, `${leaks} leaks`)
    check(`edit parity (${presetId}): a noAnchors/noTimed day offers neither on edit`, capBreaks === 0, `${capBreaks} breaks`)
    check(`edit parity (${presetId}): the page edits at the pace the plan was built at`, paceMismatch === 0, `${paceMismatch} days`)
  }
}

// ── Dinner is a time of day, not a leftover slot ──
// The 18:00 rule used to live in a clock jump the generator made and nothing
// stored, so replays slid dinner into the afternoon (18:10 → 15:11, unflagged)
// while the reconsider deck for the same slot came back empty. Both symptoms,
// one cause: the rule now lives in the schedule, so both directions are held.
{
  let retimed = 0
  let emptyDecks = 0
  let dinnerSlots = 0
  let fabricatedHome = 0
  for (const presetId of ['first-time', 'broader', 'gentler']) {
    const preset = PLAN_PRESETS.find((p) => p.id === presetId)!
    const plan = generatePlan(city, preset, 7, 'balanced', STAY, ARRIVING, [])
    for (let i = 0; i < 7; i++) {
      const day = plan.days[i]
      const di = day.committed.findIndex((c) => c.meal === 'dinner')
      if (di < 1) continue
      const pace = plan.paces[i]
      const o = { date: dayDate(ARRIVING, i), weekday: dayWeekday(ARRIVING, i) }
      // Pull the day earlier: dinner must hold its hour or say that it didn't.
      const r = removeAt(city, day, di - 1, pace, STAY, o)
      const moved = r.day.committed.find((c) => c.meal === 'dinner')
      if (moved && moved.timeIn < ENGINE.dinnerFrom && r.flags.length === 0) retimed++
      // The dinner slot is reconsiderable from any prefix clock.
      dinnerSlots++
      const visited = new Set(plan.days.flatMap((d) => d.committed.map((c) => c.id)))
      const ctx = dayPlanContext(city, i, { dayCount: 7, preset, travelerPace: 'balanced', stay: STAY, arriving: ARRIVING })
      const alts = alternativesAt(city, day, di, pace, visited, STAY, ctx.opts)
      if (alts.length === 0) emptyDecks++
      // No dinner card promises a walk home it never measured.
      for (const a of alts) {
        if (a.p.meal !== 'dinner') continue
        const km = Math.hypot((a.p.lat - STAY.lat) * 111, (a.p.lon - STAY.lon) * 73)
        if (a.forecast.includes('walk home') && km > 1.2) fabricatedHome++
      }
    }
  }
  // A whole-day trip is the day's one commitment, not a fast: the traveler
  // rides back and eats. On a 6-day trip the day trip falls LAST, so this is
  // the trip's closing night. Asserted only where the city still has an
  // unused dinner venue — Rome's four run out by day 4, which is a data gap.
  for (const [cid, c] of Object.entries(CITIES)) {
    for (const p of PLAN_PRESETS) {
      const plan = generatePlan(c, p, 6, 'balanced', stayLoc(c, c.hoodOrder[0]), ARRIVING, [])
      plan.days.slice(0, 6).forEach((d, i) => {
        if (!d.committed.some((s) => stopPlace(c, s)?.dayTrip)) return
        const used = new Set(plan.days.flatMap((x) => x.committed.map((s) => s.id)))
        const spare = c.places.some((pl) => !used.has(pl.id) && placeVariants(pl).some((v) => v.meal === 'dinner'))
        if (!spare) return // city inventory exhausted — a data gap, not the engine
        check(`${cid}/${p.id}: the day-trip day still gets its dinner`, d.committed.some((s) => s.meal === 'dinner'), `day ${i + 1}`)
      })
    }
  }
  check('dinner: a replay never slides dinner before 18:00 unflagged', retimed === 0, `${retimed} days`)
  check('dinner: every dinner slot is reconsiderable', emptyDecks === 0, `${emptyDecks} of ${dinnerSlots} decks empty`)
  check('dinner: no card claims a walk home that is a métro ride', fabricatedHome === 0, `${fabricatedHome} cards`)
}

process.exit(fail ? 1 : 0)
