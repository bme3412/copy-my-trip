import type { City, Meal, Pace, Place, StartLoc, Theme } from '../cities/types'

export const PACE: Record<Pace, { f: number; slot: number }> = {
  gentle: { f: 1.3, slot: 90 },
  balanced: { f: 1, slot: 75 },
  full: { f: 0.78, slot: 60 },
}

/** Engine tuning — one block, so iterating on day quality is a constants edit. */
export const ENGINE = {
  /** Committed stops per day (dinner rides free) — days end gracefully, the pool survives four days. */
  stopBudget: { gentle: 4, balanced: 6, full: 7 } as Record<Pace, number>,
  /** Unscheduled drift after each stop — wandering, sitting longer than planned.
   * Stretches six stops across a real day so evenings actually happen. */
  linger: { gentle: 45, balanced: 30, full: 15 } as Record<Pace, number>,
  weights: {
    verified: 2,
    travelPerMin: 1 / 6, // a 21-min metro ride now costs −3.5, not −1.2
    sameGroup: 0.75, // soft variety nudge, no longer strong enough to fight locality
    anchor: 2, // stay in the day's theme hood
    offAnchor: 1, // leaving both the anchor and the current hood costs extra
    bestTime: 1, // in a place's preferred window; ×1.5 against it
    coverage: 1.25, // per still-uncovered trip theme a candidate would satisfy (capped ×2)
    anchorMorning: 1.5, // big commitments belong to mornings…
    anchorLate: 2, // …and are nearly wrong after 15:00
    coffeeMorning: 1.5, // a nearby coffee beats a sight first thing
    hoodBias: 1.5, // the personality day's soft pull toward its hood
  },
  /** Day-anatomy limits from the first-trip framework. */
  maxTimedPerDay: 2,
  longTransferMin: 20, // a metro leg this long counts as a cross-city transfer
  maxLongTransfers: 1, // at most one per day (the day's opening commute is exempt)
  /** The commute into the day's theme area is expected — first leg travel is half price. */
  firstLegTravelFactor: 0.5,
  /** Lunch is allowed from 11:00 but only *forced* from here. */
  lunchForceFrom: 11.75 * 60,
  /** Arriving early is fine if the doors open within this — you wait. Dinner
   * tolerates more (18:10 in the Marais means an apéro until the 19:00 seating). */
  maxWait: 45,
  maxWaitDinner: 75,
  /** Morning coffee is forced like a meal when a café is within this many minutes. */
  coffeeReach: 15,
  /** This late with no dinner on offer, the day is complete (golden-hour ending). */
  eveningWindDown: 19.5 * 60,
  /** Non-dinner stops must end by here; dinner may run to dayEnd. Home by 22:00, for real. */
  lastLeave: 21.75 * 60,
}

/** The day's theme hood: declared by its first committed stop; for an empty day,
 * suggested as the hood with the most unvisited verified places. */
export function dayAnchor(city: City, day: DayState, visited: Set<string>): string {
  // Coffee is a prelude, not the theme — the first non-coffee stop declares the day.
  const themeStop = day.committed.find((c) => c.meal !== 'coffee')
  if (themeStop) {
    const place = city.places.find((p) => p.id === themeStop.id)
    if (place) return place.hood
  }
  let best = city.hoodOrder[0]
  let bestN = -1
  for (const h of city.hoodOrder) {
    const n = city.places.filter((p) => p.hood === h && p.src === 'verified' && !visited.has(p.id)).length
    if (n > bestN) {
      best = h
      bestN = n
    }
  }
  return best
}

export interface CommittedStop {
  id: string
  /** Which experience of the place was scheduled; unset = the place itself. */
  experienceId?: string
  name: string
  area: string
  group: Place['group']
  label: string
  src: Place['src']
  visits: number
  last: string
  timeIn: number
  dur: number
  travelMin: number
  travelMode: 'walk' | 'metro'
  measured: boolean
  meal: Meal
  /** Why this stop, why now — carried from the candidate that was committed. */
  reasons?: ScoreReason[]
}

export interface DayState {
  clock: number
  loc: Place | StartLoc
  committed: CommittedStop[]
  meals: { lunch: boolean; dinner: boolean; coffee: boolean }
}

/** One contribution to a candidate's score — term from the canonical scoring
 * model (build-plan/01-principles.md), note in plain words for the UI. */
export interface ScoreReason {
  term: 'provenance_fit' | 'transit_cost' | 'locality_fit' | 'time_of_day_fit' | 'narrative_fit' | 'variety' | 'coverage'
  value: number
  note: string
}

export interface Candidate {
  p: EffectivePlace
  t: { min: number; mode: 'walk' | 'metro'; measured: boolean }
  dur: number
  arrive: number
  leave: number
  forecast: string
  /** Top scoring contributions, strongest first — why this, why now. */
  reasons?: ScoreReason[]
}

/** Where the trip sleeps: the centroid of the chosen neighbourhood's places,
 * falling back to the city's default base. Days start and end here. */
export function stayLoc(city: City, stayHood?: string): StartLoc {
  const places = stayHood ? city.places.filter((p) => p.hood === stayHood) : []
  if (!stayHood || places.length === 0) return city.start
  const lat = places.reduce((a, p) => a + p.lat, 0) / places.length
  const lon = places.reduce((a, p) => a + p.lon, 0) / places.length
  return { name: 'your place', area: stayHood, lat, lon, src: null }
}

export function blankDay(city: City, stay?: StartLoc): DayState {
  return { clock: city.dayStart, loc: stay ?? city.start, committed: [], meals: { lunch: false, dinner: false, coffee: false } }
}

/** The actual weekday (JS getDay) of a trip day, from real arrival dates. */
export function dayWeekday(arriving: string, dayIndex: number): number | undefined {
  const t = Date.parse(arriving + 'T12:00:00')
  if (Number.isNaN(t)) return undefined
  return (new Date(t).getDay() + dayIndex) % 7
}

/** The ISO date of a trip day (arrival + index) — feeds exception lookups. */
export function dayDate(arriving: string, dayIndex: number): string | undefined {
  const t = Date.parse(arriving + 'T12:00:00')
  if (Number.isNaN(t)) return undefined
  return new Date(t + dayIndex * 86400000).toISOString().slice(0, 10)
}

/** Effective hours for a place on a trip day: exception → weekday hours →
 * base `open` (with `closedOn` pruning). null = closed that day. Without a
 * real date/weekday the typical `open` tuple stands in. */
export function effectiveHours(p: Place, date?: string, weekday?: number): [number, number] | null {
  if (date) {
    const ex = p.exceptions?.find((e) => e.date === date)
    if (ex) return ex.closed ? null : (ex.open ?? weekdayHours(p, weekday))
  }
  return weekdayHours(p, weekday)
}

function weekdayHours(p: Place, weekday?: number): [number, number] | null {
  if (weekday !== undefined) {
    if (p.hours) return p.hours[weekday]
    if (p.closedOn?.includes(weekday)) return null
  }
  return p.open
}

/** A place seen through one of its experiences — parent fields with the
 * variant's overrides applied. The id stays the parent's. */
export type EffectivePlace = Place & { experienceId?: string }

/** The schedulable views of a place: its experience variants (first = default),
 * or the place itself when it declares none. */
export function placeVariants(p: Place): EffectivePlace[] {
  if (!p.experiences?.length) return [p]
  return p.experiences.map((e) => ({
    ...p,
    name: e.name ?? p.name,
    label: e.label ?? p.label,
    dur: e.dur ?? p.dur,
    open: e.open ?? p.open,
    hours: e.hours ?? p.hours,
    timed: e.timed ?? p.timed,
    best: e.best ?? p.best,
    role: e.role ?? p.role,
    group: e.group ?? p.group,
    src: e.src ?? p.src,
    visits: e.visits ?? p.visits,
    last: e.last ?? p.last,
    experienceId: e.id,
  }))
}

/** Resolve a committed stop back to the variant it was scheduled as —
 * for anything (tests, diagnostics, UI) asking about role/timed/best. */
export function stopPlace(city: City, stop: { id: string; experienceId?: string }): EffectivePlace | undefined {
  const p = city.places.find((pl) => pl.id === stop.id)
  if (!p) return undefined
  const variants = placeVariants(p)
  return variants.find((v) => v.experienceId === stop.experienceId) ?? variants[0]
}

/** Coverage themes the trip has already satisfied. */
export function tripThemes(city: City, days: DayState[]): Set<Theme> {
  const covered = new Set<Theme>()
  for (const d of days) {
    for (const c of d.committed) {
      const p = city.places.find((pl) => pl.id === c.id)
      for (const th of p?.themes ?? []) covered.add(th)
    }
  }
  return covered
}

export function fmt(m: number): string {
  m = Math.round(m)
  const h = Math.floor(m / 60)
  const mm = m % 60
  return h + ':' + String(mm).padStart(2, '0')
}

function dist(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLon = (b.lon - a.lon) * rad
  const la1 = a.lat * rad
  const la2 = b.lat * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

function travel(a: Place | StartLoc, b: Place) {
  const d = dist(a, b)
  let min: number
  let mode: 'walk' | 'metro'
  if (d <= 1.2) {
    min = Math.max(3, Math.round((d / 4.5) * 60))
    mode = 'walk'
  } else {
    min = Math.round(11 + d * 4)
    mode = 'metro'
  }
  const measured = !!(a && a.src === 'verified' && b.src === 'verified' && mode === 'walk' && d < 1.6)
  return { min, mode, measured }
}

function forecast(e: Omit<Candidate, 'forecast'>, day: DayState, pace: Pace, dayEnd: number): string {
  const newClock = e.leave
  const dinnerAfter = day.meals.dinner || e.p.meal === 'dinner'
  if (e.p.meal === 'dinner') return 'Dinner wraps ≈' + fmt(newClock) + ' · short walk home from here'
  if (e.p.meal === 'lunch') return 'Fed by ' + fmt(newClock) + ' · the afternoon stays open'
  const endBudget = dinnerAfter ? dayEnd : 21 * 60
  const timeSlots = Math.max(0, Math.floor((endBudget - newClock) / PACE[pace].slot))
  const budgetLeft = Math.max(0, ENGINE.stopBudget[pace] - day.committed.length - 1)
  const more = Math.min(timeSlots, budgetLeft)
  if (more === 0) return 'Runs to ' + fmt(newClock) + ' · likely your last stop of the day'
  if (newClock >= 20 * 60) return 'Runs to ' + fmt(newClock) + ' · likely your last stop of the day'
  const mealNote = day.meals.lunch ? '' : newClock < 15 * 60 ? ' incl. lunch' : ''
  return 'Free by ' + fmt(newClock) + ' · room for ≈' + more + ' more ' + (more === 1 ? 'stop' : 'stops') + mealNote
}

export interface CandidateOpts {
  /** Real weekday of this trip day (JS getDay) — prunes closed places. */
  weekday?: number
  /** Real ISO date of this trip day — activates date-specific exceptions. */
  date?: string
  /** Trip-level themes already covered — uncovered ones score up. */
  covered?: ReadonlySet<Theme>
  /** Forbid anchors entirely (the day-7 buffer day). */
  blockAnchors?: boolean
  /** Forbid timed reservations (the buffer day has no bookings at all). */
  blockTimed?: boolean
  /** Soft pull toward a hood (the personality day). */
  hoodBias?: string
}

export function buildCandidates(city: City, day: DayState, pace: Pace, visited: Set<string>, opts: CandidateOpts = {}): Candidate[] {
  const clk = day.clock
  const pf = PACE[pace].f
  const W = ENGINE.weights
  const anchor = dayAnchor(city, day, visited)
  const curHood = 'hood' in day.loc ? (day.loc as Place).hood : anchor
  const firstLeg = day.committed.length === 0
  // Once the day's budget is spent, only dinner is still on the table.
  const budgetReached = day.committed.filter((c) => c.meal !== 'dinner').length >= ENGINE.stopBudget[pace]
  // Day-anatomy state: one anchor, ≤2 timed bookings, ≤1 cross-city transfer.
  // Committed stops resolve through their scheduled variant (stopPlace) —
  // an anchor may live on an experience rather than its parent place.
  const anchorTaken = opts.blockAnchors || day.committed.some((c) => stopPlace(city, c)?.role === 'anchor')
  const timedTaken = day.committed.filter((c) => stopPlace(city, c)?.timed).length
  const longTransfers = day.committed.filter((c, i) => i > 0 && c.travelMode === 'metro' && c.travelMin >= ENGINE.longTransferMin).length

  const en = city.places
    .filter((p) => !visited.has(p.id))
    .filter((p) => !p.dayTrip)
    .flatMap(placeVariants)
    .filter((p) => effectiveHours(p, opts.date, opts.weekday) !== null)
    .filter((p) => !(anchorTaken && p.role === 'anchor'))
    .filter((p) => !(p.timed && (opts.blockTimed || timedTaken >= ENGINE.maxTimedPerDay)))
    .filter((p) => !budgetReached || p.meal === 'dinner')
    .map((p) => {
      const hrs = effectiveHours(p, opts.date, opts.weekday)!
      const t = travel(day.loc, p)
      const dur = Math.round(p.dur * pf)
      let arrive = clk + t.min
      // A short wait for opening is human — you don't skip dinner because you're early.
      const opensAt = hrs[0] * 60
      const waitCap = p.meal === 'dinner' ? ENGINE.maxWaitDinner : ENGINE.maxWait
      if (arrive < opensAt && opensAt - arrive <= waitCap) arrive = opensAt
      const depart = arrive + dur
      // `leave` is when you're truly free for the next move — dwell plus
      // unscheduled drift (wandering, sitting longer than planned).
      const leave = depart + ENGINE.linger[pace]
      const open = arrive >= opensAt && arrive <= hrs[1] * 60 - Math.min(dur, 30)
      // Home by 22:00 is a real constraint: only dinner may run to dayEnd.
      const curfew = depart <= (p.meal === 'dinner' ? city.dayEnd : ENGINE.lastLeave)
      // More than 30 min outside a place's best window is a hard skip —
      // no morning gelato, no midday golden-hour bridges.
      const timely = !p.best || (arrive >= (p.best[0] - 0.5) * 60 && arrive <= (p.best[1] + 0.5) * 60)
      // The day's second long metro leg is off the table (opening commute exempt).
      const transferOk =
        firstLeg || !(t.mode === 'metro' && t.min >= ENGINE.longTransferMin && longTransfers >= ENGINE.maxLongTransfers)
      return { p, t, dur, arrive, leave, open: open && curfew && timely && transferOk }
    })
    .filter((e) => e.open)

  const lastGroup = day.committed.length ? day.committed[day.committed.length - 1].group : null
  /** The scoring model, one reason per contribution — the sum ranks the
   * candidate, the parts become the stop's "why this, why now". Terms are the
   * canonical vocabulary from build-plan/01-principles.md. */
  const scoreParts = (e: (typeof en)[number]): ScoreReason[] => {
    const parts: ScoreReason[] = []
    const add = (term: ScoreReason['term'], value: number, note: string) => {
      if (value !== 0) parts.push({ term, value, note })
    }
    if (e.p.src === 'verified') add('provenance_fit', W.verified, `from the archive — ${e.p.visits} visits`)
    add(
      'transit_cost',
      -(e.t.min * W.travelPerMin * (firstLeg ? ENGINE.firstLegTravelFactor : 1)),
      `${e.t.min} min ${e.t.mode}${firstLeg ? ' to open the day' : ' from the last stop'}`,
    )
    if (e.p.group === lastGroup) add('variety', -W.sameGroup, `another ${e.p.group} stop in a row`)
    if (e.p.hood === anchor) add('locality_fit', W.anchor, `in the day's theme hood`)
    else if (e.p.hood !== curHood) add('locality_fit', -W.offAnchor, `leaves the current neighbourhood`)
    if (e.p.best) {
      const h = e.arrive / 60
      // Being early to a golden-hour spot is nearly disqualifying, not a nudge.
      if (h >= e.p.best[0] && h <= e.p.best[1]) add('time_of_day_fit', W.bestTime, 'arrives in its best window')
      else add('time_of_day_fit', -W.bestTime * 3, 'outside its best window')
    }
    // Breakfast bias: a nearby coffee beats a sight first thing in the morning.
    if (e.p.meal === 'coffee' && !day.meals.coffee && clk < 10.5 * 60) add('narrative_fit', W.coffeeMorning, 'the day starts with coffee')
    // Anchors belong to mornings — "reserve the first entry".
    if (e.p.role === 'anchor') {
      const h = e.arrive / 60
      if (h < 12) add('narrative_fit', W.anchorMorning, 'a big anchor, taken in the morning')
      else if (h >= 15) add('narrative_fit', -W.anchorLate, 'a big anchor this late in the day')
    }
    // Trip coverage: reward what the trip hasn't seen yet.
    if (opts.covered && e.p.themes) {
      const freshThemes = e.p.themes.filter((th) => !opts.covered!.has(th))
      if (freshThemes.length) add('coverage', Math.min(freshThemes.length, 2) * W.coverage, `first taste of ${freshThemes.join(' & ')} this trip`)
    }
    if (opts.hoodBias && e.p.hood === opts.hoodBias) add('locality_fit', W.hoodBias, `the day leans toward ${opts.hoodBias}`)
    return parts
  }
  const score = (e: (typeof en)[number]) => scoreParts(e).reduce((a, r) => a + r.value, 0)

  // One schedulable view per place — the best-scoring open variant wins.
  // The place stays the dedup unit, so a trip never gets two Louvres.
  const bestVariant = new Map<string, (typeof en)[number]>()
  for (const e of en) {
    const cur = bestVariant.get(e.p.id)
    if (!cur || score(e) > score(cur)) bestVariant.set(e.p.id, e)
  }
  const pool = [...bestVariant.values()]

  let needMeal: 'lunch' | 'dinner' | null = null
  if (!day.meals.lunch && clk >= ENGINE.lunchForceFrom && clk <= 14.5 * 60) needMeal = 'lunch'
  if (!day.meals.dinner && clk >= 18 * 60) needMeal = 'dinner'
  const mealEls = needMeal ? pool.filter((e) => e.p.meal === needMeal).sort((a, b) => a.t.min - b.t.min) : []
  const picks: typeof pool = []
  mealEls.slice(0, 2).forEach((e) => picks.push(e))
  // Morning coffee is forced like a meal — but only when a café is genuinely close.
  if (!day.meals.coffee && clk < 10.5 * 60) {
    const coffee = pool
      .filter((e) => e.p.meal === 'coffee' && e.t.min <= ENGINE.coffeeReach && !picks.includes(e))
      .sort((a, b) => a.t.min - b.t.min)[0]
    if (coffee) picks.unshift(coffee)
  }
  const rest = pool
    .filter((e) => !picks.includes(e))
    .filter((e) => {
      // Meal windows judge the *arrival* time, not the current clock — waiting
      // out a 10:30 lull for an 11:00 lunch opening is how humans do it.
      if (!e.p.meal) return true
      if (e.p.meal === 'coffee') return e.arrive < 12 * 60 && !day.meals.coffee
      if (e.p.meal === 'lunch') return !day.meals.lunch && e.arrive >= 10.75 * 60 && e.arrive <= 14.5 * 60
      if (e.p.meal === 'dinner') return needMeal === 'dinner'
      return true
    })
  rest.sort((a, b) => score(b) - score(a))
  for (const e of rest) {
    if (picks.length >= 3) break
    if (picks.some((x) => x.p.group === e.p.group)) continue
    picks.push(e)
  }
  for (const e of rest) {
    if (picks.length >= 3) break
    if (!picks.includes(e)) picks.push(e)
  }
  return picks.map((e) => {
    // Forced meals rank by distance, not score — say so instead of the math.
    const mealReason: ScoreReason[] =
      e.p.meal && e.p.meal === needMeal
        ? [{ term: 'narrative_fit', value: 0, note: e.p.meal === 'lunch' ? 'the day needs lunch — this is the closest' : 'dinner closes the day' }]
        : []
    const ranked = [...scoreParts(e)].sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    return { ...e, forecast: forecast(e, day, pace, city.dayEnd), reasons: [...mealReason, ...ranked].slice(0, 3) }
  })
}

/** Single source of truth for "this day is complete" — dinner eaten, budget
 * reached, evening wind-down with no dinner on offer, or nothing left. */
export function isDayDone(day: DayState, pace: Pace, candidates: Candidate[], maxStops?: number): boolean {
  if (day.meals.dinner) return true
  const budgetReached = day.committed.filter((c) => c.meal !== 'dinner').length >= (maxStops ?? ENGINE.stopBudget[pace])
  // Past budget only dinner extends the day — none on offer means done.
  if (budgetReached && !candidates.some((c) => c.p.meal === 'dinner')) return true
  if (candidates.length === 0) return true
  if (day.clock >= ENGINE.eveningWindDown && !candidates.some((c) => c.p.meal === 'dinner')) return true
  return false
}

/** Commit a specific place directly (generator seeds: the Louvre morning,
 * Orsay, the Versailles day-trip) — same travel/wait math as candidates.
 * `hours` is the day's resolved window (from effectiveHours); defaults to typical.
 * `why` labels the commitment (seeds aren't score-ranked, they're the day's premise). */
export function commitPlace(day: DayState, place: EffectivePlace, pace: Pace, hours?: [number, number], why?: string): DayState {
  const t = travel(day.loc, place)
  const dur = Math.round(place.dur * PACE[pace].f)
  let arrive = day.clock + t.min
  const opensAt = (hours ?? place.open)[0] * 60
  if (arrive < opensAt) arrive = opensAt
  const depart = arrive + dur
  const leave = depart + ENGINE.linger[pace]
  const reasons: ScoreReason[] = [{ term: 'narrative_fit', value: 0, note: why ?? "the day's opening commitment" }]
  return commitCandidate(day, { p: place, t, dur, arrive, leave, forecast: '', reasons })
}

export function commitCandidate(day: DayState, c: Candidate): DayState {
  const item: CommittedStop = {
    id: c.p.id,
    experienceId: c.p.experienceId,
    name: c.p.name,
    area: c.p.area,
    group: c.p.group,
    label: c.p.label,
    src: c.p.src,
    visits: c.p.visits,
    last: c.p.last,
    timeIn: c.arrive,
    dur: c.dur,
    travelMin: c.t.min,
    travelMode: c.t.mode,
    measured: c.t.measured,
    meal: c.p.meal,
    reasons: c.reasons,
  }
  const meals = { ...day.meals }
  if (c.p.meal === 'lunch') meals.lunch = true
  if (c.p.meal === 'dinner') meals.dinner = true
  if (c.p.meal === 'coffee') meals.coffee = true
  return { committed: [...day.committed, item], clock: c.leave, loc: c.p, meals }
}
