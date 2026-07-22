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
    hoodRepeat: 1, // the trip already anchored a day in this hood — spread out
    groupSaturation: 0.5, // per same-group stop beyond the second today
    rank: 0.5, // editorial pull: icons up, deeper cuts down (rank 2 is neutral)
    interest: 1, // per matched theme, scaled by the traveler's extracted −1..1 weight
    pin: 6, // "I asked for this" — a pinned place wins its day as soon as it's feasible
  },
  /** Candidates offered per pick: the builder shows 3; generation sees more so
   * the presets' pick strategies have room to diverge. */
  candidatePool: 3,
  candidatePoolGenerate: 6,
  /** Timed reservations book the slot this many minutes after expected arrival —
   * the margin that absorbs a slow métro or a longer lunch. */
  timedEntryBuffer: 15,
  /** Day-anatomy limits from the first-trip framework. */
  maxTimedPerDay: 2,
  longTransferMin: 20, // a metro leg this long counts as a cross-city transfer
  maxLongTransfers: 1, // at most one per day (the day's opening commute is exempt)
  /** The commute into the day's theme area is expected — first leg travel is half price. */
  firstLegTravelFactor: 0.5,
  /** Lunch is allowed from 11:00 but only *forced* from here. */
  lunchForceFrom: 11.75 * 60,
  /** Nobody eats dinner at 16:00. The city doesn't serve it and the day
   * doesn't want it — so an early clock IDLES to here rather than booking a
   * mid-afternoon dinner. Generation always did this by jumping the clock;
   * holding it in the schedule instead is what lets a replay reproduce it. */
  dinnerFrom: 18 * 60,
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

/** The day's theme hood: declared by its first committed stop; for an empty
 * day, suggested by hood richness *discounted by distance from where the
 * traveler is* — a Montmartre base should not be told to open in the Marais.
 * Richness counts unvisited verified places (the archive leads), falling back
 * to all unvisited places in a city with no archive yet. */
export function dayAnchor(city: City, day: DayState, visited: Set<string>): string {
  // Coffee is a prelude, not the theme — the first non-coffee stop declares the day.
  const themeStop = day.committed.find((c) => c.meal !== 'coffee')
  if (themeStop) {
    const place = city.places.find((p) => p.id === themeStop.id)
    if (place) return place.hood
  }
  let best = city.hoodOrder[0]
  let bestScore = -1
  for (const h of city.hoodOrder) {
    const pool = city.places.filter((p) => p.hood === h && !visited.has(p.id))
    if (pool.length === 0) continue
    // Archive places lead; web places half-count — so a hood the curator
    // hasn't shot yet (a Montmartre stay) can still open its own day.
    const richness = pool.reduce((a, p) => a + (p.src === 'verified' ? 1 : 0.5), 0)
    const lat = pool.reduce((a, p) => a + p.lat, 0) / pool.length
    const lon = pool.reduce((a, p) => a + p.lon, 0) / pool.length
    // Diminishing returns on richness, steep decay on distance: a decent hood
    // nearby beats the richest hood across town.
    const score = Math.sqrt(richness) / (1 + travelMinutes(day.loc, { lat, lon }) / 10)
    if (score > bestScore) {
      best = h
      bestScore = score
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
  term: 'provenance_fit' | 'transit_cost' | 'locality_fit' | 'time_of_day_fit' | 'narrative_fit' | 'variety' | 'coverage' | 'interest_fit' | 'editorial_fit'
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
  /** A forced meal/coffee pick — offered because the day needs it, not by score.
   * Consumers that reorder candidates must keep forced picks first. */
  forced?: boolean
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

/** The ISO date of a trip day (arrival + index) — feeds exception lookups.
 * Formatted from LOCAL date parts, so it always names the same day that
 * dayWeekday's local getDay sees (toISOString would drift in UTC+13/14). */
export function dayDate(arriving: string, dayIndex: number): string | undefined {
  const t = Date.parse(arriving + 'T12:00:00')
  if (Number.isNaN(t)) return undefined
  const d = new Date(t + dayIndex * 86400000)
  const pad = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
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
    durVar: e.durVar ?? p.durVar,
    meal: e.meal !== undefined ? e.meal : p.meal,
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

/** Door-to-door minutes between two points — walk under 1.2 km, métro above. */
function travelMinutes(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const d = dist(a, b)
  return d <= 1.2 ? Math.max(3, Math.round((d / 4.5) * 60)) : Math.round(11 + d * 4)
}

function travel(a: Place | StartLoc, b: Place) {
  const d = dist(a, b)
  const min = travelMinutes(a, b)
  const mode: 'walk' | 'metro' = d <= 1.2 ? 'walk' : 'metro'
  const measured = !!(a && a.src === 'verified' && b.src === 'verified' && mode === 'walk' && d < 1.6)
  return { min, mode, measured }
}

function forecast(e: Omit<Candidate, 'forecast'>, day: DayState, pace: Pace, dayEnd: number, home?: { lat: number; lon: number }): string {
  const newClock = e.leave
  if (e.p.meal === 'dinner') {
    // The way home is measured, not assumed — most dinner venues are nowhere
    // near the stay, and "short walk home" was a fabricated claim on 11 of the
    // 16 Paris ones. With no known stay, the clause is simply omitted.
    if (!home) return 'Dinner wraps ≈' + fmt(newClock)
    const d = dist(e.p, home)
    const back = d <= 1.2 ? `${travelMinutes(e.p, home)} min walk home` : `≈${travelMinutes(e.p, home)} min métro home`
    return 'Dinner wraps ≈' + fmt(newClock) + ' · ' + back
  }
  if (e.p.meal === 'lunch') return 'Fed by ' + fmt(newClock) + ' · the afternoon stays open'
  // Dinner still pending extends the runway to dayEnd — it will fill the evening.
  const endBudget = day.meals.dinner ? 21 * 60 : dayEnd
  const timeSlots = Math.max(0, Math.floor((endBudget - newClock) / PACE[pace].slot))
  // Dinner rides free of the budget; count it as room only while it's pending.
  const nonDinner = day.committed.filter((c) => c.meal !== 'dinner').length
  const budgetLeft = Math.max(0, ENGINE.stopBudget[pace] - nonDinner - 1)
  const more = Math.min(timeSlots, budgetLeft + (day.meals.dinner ? 0 : 1))
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
  /** Hoods that already anchored an earlier day — repeat visits score down. */
  usedHoods?: ReadonlySet<string>
  /** Where the day ends — evening candidates near home score up. */
  home?: { lat: number; lon: number }
  /** The plan's flavor (from the preset): themes it leans toward, and how hard. */
  themeBias?: { themes: readonly Theme[]; weight: number }
  /** The traveler's own lean, extracted from their free-text brief (−1..1 per
   * theme). Negative weights are real dislikes, not absence of interest. */
  interestWeights?: Partial<Record<Theme, number>>
  /** Places the traveler asked to skip — never offered. */
  exclude?: ReadonlySet<string>
  /** Places the traveler asked for on THIS day: boosted hard, and held back
   * until `notBefore` (minutes) when they asked for a time of day. */
  pins?: ReadonlyArray<{ id: string; notBefore?: number }>
  /** How many candidates to return (default ENGINE.candidatePool). */
  limit?: number
  /** Day-template stop cap (buffer day) — overrides ENGINE.stopBudget. */
  maxStops?: number
  /** Reconsidering a mid-day slot: the stops after it. Day-anatomy caps
   * (anchor, timed, budget, transfers, group saturation) count these too,
   * so a swap can't sneak a second anchor past a later one. */
  suffix?: ReadonlyArray<CommittedStop>
  /** Constrain candidates to one meal kind — the incumbent's. A swap changes
   * *where* lunch happens, never *whether*. `null` means a non-meal slot
   * (no meal cards); leave undefined for no constraint (append). */
  slotMeal?: Meal
}

export function buildCandidates(city: City, day: DayState, pace: Pace, visited: Set<string>, opts: CandidateOpts = {}): Candidate[] {
  const clk = day.clock
  const pf = PACE[pace].f
  const W = ENGINE.weights
  const anchor = dayAnchor(city, day, visited)
  const curHood = 'hood' in day.loc ? (day.loc as Place).hood : anchor
  const firstLeg = day.committed.length === 0
  // Reconsidering mid-day: the rest of the day still counts against the caps.
  const suffix = opts.suffix ?? []
  // Once the day's budget is spent, only dinner is still on the table.
  const stopBudget = opts.maxStops ?? ENGINE.stopBudget[pace]
  const budgetReached =
    day.committed.filter((c) => c.meal !== 'dinner').length + suffix.filter((c) => c.meal !== 'dinner').length >= stopBudget
  // Day-anatomy state: one anchor, ≤2 timed bookings, ≤1 cross-city transfer.
  // Committed stops resolve through their scheduled variant (stopPlace) —
  // an anchor may live on an experience rather than its parent place.
  const anchorTaken = opts.blockAnchors || [...day.committed, ...suffix].some((c) => stopPlace(city, c)?.role === 'anchor')
  const timedTaken = [...day.committed, ...suffix].filter((c) => stopPlace(city, c)?.timed).length
  // Suffix legs are never the day's opening commute, so they all count.
  // Known staleness: a swap re-routes the suffix, but these are the STORED
  // legs — tolerated because any transfer the swap actually creates is
  // honestly flagged at replay (scheduleNext).
  // The ride to dinner is the day's closing commute: exempt from the cap
  // below, so it must not SPEND the budget either — counting it hid legal
  // mid-day swaps on every day whose only long leg was the one to dinner.
  const longTransfers =
    day.committed.filter((c, i) => i > 0 && c.meal !== 'dinner' && c.travelMode === 'metro' && c.travelMin >= ENGINE.longTransferMin).length +
    suffix.filter((c) => c.meal !== 'dinner' && c.travelMode === 'metro' && c.travelMin >= ENGINE.longTransferMin).length

  // A concrete traveler ask outranks the day-anatomy caps: pinned places
  // ignore the stop budget and timed cap — the traveler asked for this one.
  const pinnedIds = new Set(opts.pins?.map((x) => x.id))
  const en = city.places
    .filter((p) => !visited.has(p.id))
    .filter((p) => !opts.exclude?.has(p.id))
    .filter((p) => pinnedIds.has(p.id) || !p.dayTrip)
    .flatMap(placeVariants)
    // A meal slot only trades against its own kind; a sight slot never
    // grows a meal. `undefined` (append) leaves the pool whole.
    .filter((p) => opts.slotMeal === undefined || (p.meal ?? null) === opts.slotMeal)
    .filter((p) => effectiveHours(p, opts.date, opts.weekday) !== null)
    // Pins bypass the anchor cap too — a pinned second anchor is deliberate.
    .filter((p) => pinnedIds.has(p.id) || !(anchorTaken && p.role === 'anchor'))
    .filter((p) => pinnedIds.has(p.id) || !(p.timed && (opts.blockTimed || timedTaken >= ENGINE.maxTimedPerDay)))
    .filter((p) => pinnedIds.has(p.id) || !budgetReached || p.meal === 'dinner')
    .map((p) => {
      const hrs = effectiveHours(p, opts.date, opts.weekday)!
      const t = travel(day.loc, p)
      const dur = Math.round(p.dur * pf)
      // The worst realistic case — feasibility is judged here, not at typical.
      const durMax = Math.round((p.dur + (p.durVar ?? 0)) * pf)
      // Dinner never starts before the city serves it: an early clock idles to
      // 18:00 instead of pulling dinner into the afternoon. Once the clock is
      // already past it this is a no-op, so generation is unchanged.
      const from = p.meal === 'dinner' ? Math.max(clk, ENGINE.dinnerFrom) : clk
      // A timed slot is booked a buffer after expected arrival, absorbing delays.
      let arrive = from + t.min + (p.timed ? ENGINE.timedEntryBuffer : 0)
      // A short wait for opening is human — you don't skip dinner because you're early.
      const opensAt = hrs[0] * 60
      const waitCap = p.meal === 'dinner' ? ENGINE.maxWaitDinner : ENGINE.maxWait
      if (arrive < opensAt && opensAt - arrive <= waitCap) arrive = opensAt
      const depart = arrive + dur
      // `leave` is when you're truly free for the next move — dwell plus
      // unscheduled drift (wandering, sitting longer than planned).
      const leave = depart + ENGINE.linger[pace]
      // The typical visit must fit before close (short stops still need 30 min inside).
      const open = arrive >= opensAt && arrive <= hrs[1] * 60 - Math.max(dur, 30)
      // Home by 22:00 is a real constraint even when the visit runs long.
      // An overrun can't outlast the venue: closing time caps the worst case.
      const worstDepart = Math.max(depart, Math.min(arrive + durMax, hrs[1] * 60))
      const curfew = worstDepart <= (p.meal === 'dinner' ? city.dayEnd : ENGINE.lastLeave)
      // More than 30 min outside a place's best window is a hard skip —
      // no morning gelato, no midday golden-hour bridges.
      const timely = !p.best || (arrive >= (p.best[0] - 0.5) * 60 && arrive <= (p.best[1] + 0.5) * 60)
      // A pinned-for-later place waits for its asked-for time of day.
      const pin = opts.pins?.find((x) => x.id === p.id)
      const pinReady = !pin?.notBefore || arrive >= pin.notBefore - 45
      // The day's second long metro leg is off the table — except the opening
      // commute, and the ride to dinner: dinner is the day's closing commute,
      // worth a métro even after the long transfer is spent (still priced).
      const transferOk =
        firstLeg ||
        p.meal === 'dinner' ||
        !(t.mode === 'metro' && t.min >= ENGINE.longTransferMin && longTransfers >= ENGINE.maxLongTransfers)
      return { p, t, dur, arrive, leave, open: open && curfew && timely && transferOk && pinReady }
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
    if (e.p.rank === 1) add('editorial_fit', W.rank, 'a first-visit icon')
    else if (e.p.rank === 3) add('editorial_fit', -W.rank, 'a deeper cut — earns its slot on fit, not fame')
    add(
      'transit_cost',
      -(e.t.min * W.travelPerMin * (firstLeg ? ENGINE.firstLegTravelFactor : 1)),
      `${e.t.min} min ${e.t.mode}${firstLeg ? ' to open the day' : ' from the last stop'}`,
    )
    if (e.p.group === lastGroup) add('variety', -W.sameGroup, `another ${e.p.group} stop in a row`)
    // Day-level saturation: the third café or third museum of the day reads
    // as repetition even with something else in between.
    const groupToday = day.committed.filter((c) => c.group === e.p.group).length + suffix.filter((c) => c.group === e.p.group).length
    if (groupToday >= 2) add('variety', -W.groupSaturation * (groupToday - 1), `already ${groupToday} ${e.p.group} stops today`)
    if (e.p.hood === anchor) add('locality_fit', W.anchor, `in the day's theme hood`)
    else if (e.p.hood !== curHood) add('locality_fit', -W.offAnchor, `leaves the current neighbourhood`)
    // Trip-level spread: a hood that already anchored a day pulls less.
    if (opts.usedHoods?.has(e.p.hood) && e.p.hood !== curHood) add('locality_fit', -W.hoodRepeat, `the trip already had a day around ${e.p.hood}`)
    // The unpriced last leg: from 17:00 the walk home starts to matter.
    if (opts.home && e.arrive >= 17 * 60) {
      const homeMin = travelMinutes(e.p, opts.home)
      add('transit_cost', -homeMin * W.travelPerMin * 0.5, `${homeMin} min from home at day's end`)
    }
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
    // The plan's flavor: presets are coarse interest profiles.
    if (opts.themeBias && e.p.themes) {
      const hits = e.p.themes.filter((th) => opts.themeBias!.themes.includes(th))
      if (hits.length) add('interest_fit', hits.length * opts.themeBias.weight, `fits the plan's ${hits.join(' & ')} lean`)
    }
    // A concrete ask from the brief — this place, this day.
    if (opts.pins?.some((x) => x.id === e.p.id)) add('interest_fit', W.pin, 'you asked for this — saved for today')
    // The traveler's own brief: what they said they love — and dislike.
    if (opts.interestWeights && e.p.themes) {
      let v = 0
      const hits: Theme[] = []
      for (const th of e.p.themes) {
        const w = opts.interestWeights[th]
        if (w) {
          v += w * W.interest
          hits.push(th)
        }
      }
      if (v) add('interest_fit', v, `${v > 0 ? 'matches' : 'sits against'} your brief (${hits.join(' & ')})`)
    }
    return parts
  }
  const score = (e: (typeof en)[number]) => scoreParts(e).reduce((a, r) => a + r.value, 0)

  // One schedulable view per place — the best-fitting open variant wins.
  // The place stays the dedup unit, so a trip never gets two Louvres.
  // Provenance is excluded from THIS comparison: it decides between places,
  // not which experience of one place fits the moment — a verified courtyard
  // must not permanently eclipse the web-tier interior it fronts for.
  const dedupScore = (e: (typeof en)[number]) => score(e) - (e.p.src === 'verified' ? W.verified : 0)
  const bestVariant = new Map<string, (typeof en)[number]>()
  for (const e of en) {
    const cur = bestVariant.get(e.p.id)
    if (!cur || dedupScore(e) > dedupScore(cur)) bestVariant.set(e.p.id, e)
  }
  const pool = [...bestVariant.values()]

  let needMeal: 'lunch' | 'dinner' | null = null
  if (!day.meals.lunch && clk >= ENGINE.lunchForceFrom && clk <= 14.5 * 60) needMeal = 'lunch'
  if (!day.meals.dinner && clk >= ENGINE.dinnerFrom) needMeal = 'dinner'
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
  // Everything in picks so far is forced — the day needs it regardless of score.
  const forcedPicks = new Set(picks)
  const rest = pool
    .filter((e) => !picks.includes(e))
    .filter((e) => {
      // Meal windows judge the *arrival* time, not the current clock — waiting
      // out a 10:30 lull for an 11:00 lunch opening is how humans do it.
      if (!e.p.meal) return true
      if (e.p.meal === 'coffee') return e.arrive < 12 * 60 && !day.meals.coffee
      if (e.p.meal === 'lunch') return !day.meals.lunch && e.arrive >= 11 * 60 && e.arrive <= 14.5 * 60
      // Reconsidering the dinner slot judges the *arrival* like every other
      // meal window: the prefix clock is whenever the afternoon happened to
      // end, and gating on it left the dinner deck empty on any day that
      // wrapped early — "a swap changes WHERE dinner happens, never whether".
      // Elsewhere dinner still waits to be forced, so the generator, the
      // append deck and the day's shape are untouched.
      if (e.p.meal === 'dinner')
        return opts.slotMeal === 'dinner' ? !day.meals.dinner && e.arrive >= ENGINE.dinnerFrom : needMeal === 'dinner'
      return true
    })
  const limit = opts.limit ?? ENGINE.candidatePool
  rest.sort((a, b) => score(b) - score(a))
  for (const e of rest) {
    if (picks.length >= limit) break
    if (picks.some((x) => x.p.group === e.p.group)) continue
    picks.push(e)
  }
  for (const e of rest) {
    if (picks.length >= limit) break
    if (!picks.includes(e)) picks.push(e)
  }
  return picks.map((e) => {
    // Forced meals rank by distance, not score — say so instead of the math.
    const mealReason: ScoreReason[] =
      e.p.meal && e.p.meal === needMeal
        ? [{ term: 'narrative_fit', value: 0, note: e.p.meal === 'lunch' ? 'the day needs lunch — this is the closest' : 'dinner closes the day' }]
        : []
    const ranked = [...scoreParts(e)].sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    return {
      ...e,
      forecast: forecast(e, day, pace, city.dayEnd, opts.home),
      reasons: [...mealReason, ...ranked].slice(0, 3),
      forced: forcedPicks.has(e) || undefined,
    }
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
  let arrive = day.clock + t.min + (place.timed ? ENGINE.timedEntryBuffer : 0)
  const win = hours ?? place.open
  const opensAt = win[0] * 60
  if (arrive < opensAt) arrive = opensAt
  // A seeded stop leaves when the venue shuts, not when the pace says it's
  // done: Versailles' 420 minutes become 546 at gentle, which ran the day
  // trip hours past a palace that had closed.
  const dur = Math.min(Math.round(place.dur * PACE[pace].f), Math.max(30, win[1] * 60 - arrive))
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

// ── Reconsidering: the builder generalized from "the end" to any slot ──
// (build-plan/03-itinerary.md). Alternatives for slot k are the ordinary
// candidate machinery run on the day truncated to stops 0..k−1; a swap is a
// replay of the rest of the day through the same commit math.

/** Coming back from a whole-day trip. The return leg is real time on the
 * clock and it puts you in your own neighbourhood, not at the château gate —
 * so the evening that follows is planned from home. Without this the day
 * ended at Versailles and the traveler simply never ate. */
export function returnFromDayTrip(city: City, day: DayState, stay: StartLoc): DayState {
  const last = day.committed[day.committed.length - 1]
  if (!last) return day
  const from = stopPlace(city, last)
  if (!from) return day
  return { ...day, clock: day.clock + travelMinutes(from, stay), loc: stay }
}

/** The prefix state 0..k−1 with its literal meals — replay starts here. */
function dayPrefix(city: City, day: DayState, k: number, pace: Pace, stay: StartLoc): DayState {
  const committed = day.committed.slice(0, k)
  const prev = committed[committed.length - 1]
  // Stored times are the source of truth: clock = free-again after stop k−1.
  const clock = prev ? prev.timeIn + prev.dur + ENGINE.linger[pace] : city.dayStart
  // Resolve through the COMMITTED VARIANT, not the parent place: an experience
  // may downgrade its parent's provenance ("The Louvre, inside" is web under a
  // verified parent), and taking the parent handed the next leg a verified
  // origin it never had — stamping `measured` on a walk leaving a room the
  // curator has never been in. The stay fallback only fires on a stale id
  // (place gone from city data), which the replay loops flag downstream.
  const loc = prev ? (stopPlace(city, prev) ?? stay) : stay
  const meals = { lunch: false, dinner: false, coffee: false }
  for (const c of committed) if (c.meal) meals[c.meal] = true
  return { clock, loc, committed, meals }
}

/** The day as the builder would have seen it when slot k was chosen — except
 * meals count the WHOLE day minus the incumbent, so reconsidering a sight
 * mid-morning doesn't spuriously force the lunch already scheduled later. */
export function truncateDay(city: City, day: DayState, k: number, pace: Pace, stay: StartLoc): DayState {
  const state = dayPrefix(city, day, k, pace, stay)
  const meals = { lunch: false, dinner: false, coffee: false }
  day.committed.forEach((c, i) => {
    if (i !== k && c.meal) meals[c.meal] = true
  })
  return { ...state, meals }
}

/** Other viable moves for slot k, relative to the prior activity. The place
 * stays the trip's dedup unit: everything committed elsewhere stays blocked;
 * only the incumbent's own place is freed — and then not re-offered. */
export function alternativesAt(
  city: City,
  day: DayState,
  k: number,
  pace: Pace,
  visited: Set<string>,
  stay: StartLoc,
  opts: CandidateOpts = {},
): Candidate[] {
  const incumbent = day.committed[k]
  if (!incumbent) return []
  const prefix = truncateDay(city, day, k, pace, stay)
  const freed = new Set(visited)
  freed.delete(incumbent.id)
  const limit = opts.limit ?? ENGINE.candidatePool
  // Ask for one extra: the incumbent may rank among the top picks.
  const cands = buildCandidates(city, prefix, pace, freed, {
    ...opts,
    suffix: day.committed.slice(k + 1),
    slotMeal: incumbent.meal,
    limit: limit + 1,
  })
  return cands.filter((c) => c.p.id !== incumbent.id).slice(0, limit)
}

/** One named constraint a replayed stop now violates. */
export interface StopFlag {
  /** Index into the rebuilt day's committed array (a stop dropped as
   * unresolvable flags the position it would have held). */
  index: number
  /** The violated constraint, in plain words. */
  note: string
}

export interface ReplayResult {
  day: DayState
  /** Broken stops are flagged, never silently dropped or repaired. */
  flags: StopFlag[]
}

/** Schedule one resolved place onto a day state with the candidate math
 * (travel, timed buffer, opening wait, linger) and *name* any hard-filter
 * violation instead of enforcing it — replay flags, never drops. */
function scheduleNext(
  city: City,
  state: DayState,
  v: EffectivePlace,
  pace: Pace,
  opts: { date?: string; weekday?: number },
  reasons?: ScoreReason[],
): { next: DayState; notes: string[] } {
  const notes: string[] = []
  const pf = PACE[pace].f
  const t = travel(state.loc, v)
  const dur = Math.round(v.dur * pf)
  const durMax = Math.round((v.dur + (v.durVar ?? 0)) * pf)
  // The same idle the generator performs by jumping its clock — held here so
  // a replayed day reproduces it. Without this, removing an afternoon stop
  // slid dinner back to 15:11 and reported no violation at all.
  const from = v.meal === 'dinner' ? Math.max(state.clock, ENGINE.dinnerFrom) : state.clock
  let arrive = from + t.min + (v.timed ? ENGINE.timedEntryBuffer : 0)
  const hrs = effectiveHours(v, opts.date, opts.weekday)
  if (!hrs) notes.push('closed this day')
  else {
    const opensAt = hrs[0] * 60
    const waitCap = v.meal === 'dinner' ? ENGINE.maxWaitDinner : ENGINE.maxWait
    if (arrive < opensAt) {
      if (opensAt - arrive > waitCap) notes.push(`a ${Math.round(opensAt - arrive)} min wait for the ${fmt(opensAt)} opening`)
      arrive = opensAt
    }
    if (arrive > hrs[1] * 60 - Math.max(dur, 30)) notes.push(`would run past the ${fmt(hrs[1] * 60)} close`)
  }
  const depart = arrive + dur
  const close = hrs ? hrs[1] * 60 : Infinity
  // Worst case caps at closing time, never below the typical plan.
  const worstDepart = Math.max(depart, Math.min(arrive + durMax, close))
  const curfew = v.meal === 'dinner' ? city.dayEnd : ENGINE.lastLeave
  if (worstDepart > curfew) notes.push(`could run to ${fmt(worstDepart)}, past the ${fmt(curfew)} ${v.meal === 'dinner' ? 'day end' : 'last leave'}`)
  if (v.best && (arrive < (v.best[0] - 0.5) * 60 || arrive > (v.best[1] + 0.5) * 60))
    notes.push(`misses its best window (${v.best[0]}:00–${v.best[1]}:00)`)
  if (v.meal === 'lunch' && (arrive < 11 * 60 || arrive > 14.5 * 60)) notes.push(`lunch lands at ${fmt(arrive)}`)
  // Parity with the lunch window: if a venue's own hours drag dinner back
  // before the city serves it, say so rather than shipping a 16:00 dinner.
  if (v.meal === 'dinner' && arrive < ENGINE.dinnerFrom) notes.push(`dinner lands at ${fmt(arrive)}`)
  // A long métro leg mid-day: only one cross-city transfer per day
  // (the ride to dinner rides free, as in the candidate filter).
  if (state.committed.length > 0 && v.meal !== 'dinner' && t.mode === 'metro' && t.min >= ENGINE.longTransferMin) {
    const longSoFar = state.committed.filter(
      (c, i) => i > 0 && c.meal !== 'dinner' && c.travelMode === 'metro' && c.travelMin >= ENGINE.longTransferMin,
    ).length
    if (longSoFar >= ENGINE.maxLongTransfers) notes.push('a second long métro transfer')
  }
  // Day-anatomy caps — the same limits buildCandidates enforces as hard
  // filters (one anchor, ≤2 timed, the stop budget), named here instead:
  // replay flags, never drops.
  if (v.role === 'anchor' && state.committed.some((c) => stopPlace(city, c)?.role === 'anchor')) notes.push('a second anchor in one day')
  if (v.timed && state.committed.filter((c) => stopPlace(city, c)?.timed).length >= ENGINE.maxTimedPerDay)
    notes.push('a third timed booking')
  if (v.meal !== 'dinner' && state.committed.filter((c) => c.meal !== 'dinner').length >= ENGINE.stopBudget[pace])
    notes.push(`past the day's ${ENGINE.stopBudget[pace]}-stop budget`)
  // Coffee is a morning ritual — parity with the lunch-window note above.
  if (v.meal === 'coffee' && arrive >= 12 * 60) notes.push(`coffee lands at ${fmt(arrive)} — past the morning`)
  const meals = { ...state.meals }
  if (v.meal) {
    if (meals[v.meal]) notes.push(`a second ${v.meal}`)
    meals[v.meal] = true
  }
  const stop: CommittedStop = {
    id: v.id,
    experienceId: v.experienceId,
    name: v.name,
    area: v.area,
    group: v.group,
    label: v.label,
    src: v.src,
    visits: v.visits,
    last: v.last,
    timeIn: arrive,
    dur,
    travelMin: t.min,
    travelMode: t.mode,
    measured: t.measured,
    meal: v.meal,
    reasons,
  }
  return { next: { committed: [...state.committed, stop], clock: depart + ENGINE.linger[pace], loc: v, meals }, notes }
}

/** Rebuild the day with `chosen` in slot k: the prefix stands untouched, the
 * suffix keeps its identity and reasons but gets re-scheduled — transit legs,
 * arrivals and feasibility all recomputed. The swap primitive. */
export function replayFrom(
  city: City,
  day: DayState,
  k: number,
  chosen: Candidate,
  pace: Pace,
  stay: StartLoc,
  opts: { date?: string; weekday?: number } = {},
): ReplayResult {
  const flags: StopFlag[] = []
  // The candidate was built against exactly this prefix state — commit as-is.
  let state = commitCandidate(dayPrefix(city, day, k, pace, stay), chosen)
  // Flag indices are REBUILT-array positions (state.committed.length as each
  // stop lands) — a skipped stop must not shift later flags onto wrong stops.
  day.committed.slice(k + 1).forEach((old) => {
    const v = stopPlace(city, old)
    if (!v) {
      flags.push({ index: state.committed.length, note: 'not in the city data' })
      return
    }
    const r = scheduleNext(city, state, v, pace, opts, old.reasons)
    for (const note of r.notes) flags.push({ index: state.committed.length, note })
    state = r.next
  })
  return { day: state, flags }
}

/** Rebuild the day without stop k — remove-and-retime. The prefix stands;
 * everything after re-schedules, so travel legs close up around the gap. */
export function removeAt(
  city: City,
  day: DayState,
  k: number,
  pace: Pace,
  stay: StartLoc,
  opts: { date?: string; weekday?: number } = {},
): ReplayResult {
  const flags: StopFlag[] = []
  let state = dayPrefix(city, day, k, pace, stay)
  day.committed.slice(k + 1).forEach((old) => {
    const v = stopPlace(city, old)
    if (!v) {
      flags.push({ index: state.committed.length, note: 'not in the city data' })
      return
    }
    const r = scheduleNext(city, state, v, pace, opts, old.reasons)
    for (const note of r.notes) flags.push({ index: state.committed.length, note })
    state = r.next
  })
  return { day: state, flags }
}

/** Rebuild the day with a place inserted before stop k (k = length appends).
 * The new stop and everything after re-schedule — "the day re-routes and
 * re-times around it". */
export function insertAt(
  city: City,
  day: DayState,
  k: number,
  ref: { placeId: string; experienceId?: string },
  pace: Pace,
  stay: StartLoc,
  opts: { date?: string; weekday?: number } = {},
): ReplayResult {
  const v = stopPlace(city, { id: ref.placeId, experienceId: ref.experienceId })
  if (!v) return { day, flags: [{ index: k, note: 'not in the city data' }] }
  const flags: StopFlag[] = []
  let state = dayPrefix(city, day, k, pace, stay)
  const first = scheduleNext(city, state, v, pace, opts, [{ term: 'narrative_fit', value: 0, note: 'added by you' }])
  for (const note of first.notes) flags.push({ index: k, note })
  state = first.next
  day.committed.slice(k).forEach((old) => {
    const ov = stopPlace(city, old)
    if (!ov) {
      flags.push({ index: state.committed.length, note: 'not in the city data' })
      return
    }
    const r = scheduleNext(city, state, ov, pace, opts, old.reasons)
    for (const note of r.notes) flags.push({ index: state.committed.length, note })
    state = r.next
  })
  return { day: state, flags }
}

/** The least-disruptive slot for a new place: every position is tried (never
 * after dinner), the fewest flags win, ties break on the earliest day end. */
export function bestInsertion(
  city: City,
  day: DayState,
  placeId: string,
  pace: Pace,
  stay: StartLoc,
  opts: { date?: string; weekday?: number } = {},
): { k: number; result: ReplayResult } | null {
  const dinnerIdx = day.committed.findIndex((c) => c.meal === 'dinner')
  const maxK = dinnerIdx >= 0 ? dinnerIdx : day.committed.length
  const endOf = (d: DayState) => {
    const l = d.committed[d.committed.length - 1]
    return l ? l.timeIn + l.dur : 0
  }
  let best: { k: number; result: ReplayResult } | null = null
  for (let k = 0; k <= maxK; k++) {
    const result = insertAt(city, day, k, { placeId }, pace, stay, opts)
    if (
      !best ||
      result.flags.length < best.result.flags.length ||
      (result.flags.length === best.result.flags.length && endOf(result.day) < endOf(best.result.day))
    ) {
      best = { k, result }
    }
  }
  return best
}

export interface InsertionSuggestion {
  p: Place
  k: number
  result: ReplayResult
}

/** Nearby, open, clean additions for the "Something missing?" panel: sights
 * whose best insertion breaks nothing, ranked by how little travel they add —
 * icons and archive places lead among near-ties. */
export function insertionSuggestions(
  city: City,
  day: DayState,
  pace: Pace,
  visited: Set<string>,
  stay: StartLoc,
  // `exclude`, `blockAnchors` and `blockTimed` come straight from the day's
  // plan context: a place the traveler asked to skip, and an anchor or timed
  // booking on a day whose template forbids them, are never *suggested*
  // either — the append deck and this pool answer to the same constraints.
  opts: { date?: string; weekday?: number; exclude?: ReadonlySet<string>; blockAnchors?: boolean; blockTimed?: boolean } = {},
  limit = 4,
): InsertionSuggestion[] {
  if (day.committed.length === 0) return []
  const stops = day.committed.map((c) => city.places.find((p) => p.id === c.id)).filter((p): p is Place => !!p)
  if (stops.length === 0) return []
  const nearMin = (p: Place) => Math.min(...stops.map((s) => travelMinutes(s, p)))
  const pool = city.places
    .filter((p) => !visited.has(p.id) && !p.dayTrip && p.meal === null && effectiveHours(p, opts.date, opts.weekday) !== null)
    .filter((p) => !opts.exclude?.has(p.id))
    .filter((p) => !(opts.blockAnchors && p.role === 'anchor'))
    .filter((p) => !(opts.blockTimed && placeVariants(p).some((v) => v.timed)))
    .map((p) => ({ p, key: nearMin(p) - (p.src === 'verified' ? 3 : 0) - (p.rank === 1 ? 3 : 0) }))
    .sort((a, b) => a.key - b.key)
    .slice(0, 24) // bound the insertion trials — the far tail never qualifies
  const out: InsertionSuggestion[] = []
  for (const { p } of pool) {
    if (out.length >= limit) break
    const best = bestInsertion(city, day, p.id, pace, stay, opts)
    if (best && best.result.flags.length === 0) out.push({ p, k: best.k, result: best.result })
  }
  return out
}

/** Materialize an ordered list of place refs into an engine-scheduled day —
 * how a curated day forks into "your version": the curator's sequence,
 * re-scheduled for the traveler's own dates and pace, honestly flagged
 * where their weekday breaks it. */
export function replaySequence(
  city: City,
  stops: ReadonlyArray<{ placeId: string; experienceId?: string }>,
  pace: Pace,
  stay: StartLoc,
  opts: { date?: string; weekday?: number } = {},
): ReplayResult {
  const flags: StopFlag[] = []
  let state = blankDay(city, stay)
  stops.forEach((s) => {
    const v = stopPlace(city, { id: s.placeId, experienceId: s.experienceId })
    if (!v) {
      flags.push({ index: state.committed.length, note: 'not in the city data' })
      return
    }
    const r = scheduleNext(city, state, v, pace, opts, [{ term: 'narrative_fit', value: 0, note: 'from the curated day' }])
    for (const note of r.notes) flags.push({ index: state.committed.length, note })
    state = r.next
  })
  return { day: state, flags }
}
