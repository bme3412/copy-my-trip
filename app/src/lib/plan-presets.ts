import type { City, DayTemplate, Pace, StartLoc, Theme } from '../cities/types'
import type { ExtractedRequest } from './extract'

const SLOT_START: Record<'morning' | 'afternoon' | 'evening', number | undefined> = {
  morning: undefined, // schedulable from the day's start
  afternoon: 13 * 60,
  evening: 17 * 60,
}

/** Which trip day (0-based) a request names; undefined = any day. */
function requestDay(r: ExtractedRequest, dayCount: number): number | undefined {
  if (r.day === 'first') return 0
  if (r.day === 'last') return dayCount - 1
  if (typeof r.day === 'number') return Math.min(r.day, dayCount) - 1
  return undefined
}
import {
  bestInsertion,
  blankDay,
  buildCandidates,
  commitCandidate,
  commitPlace,
  dayDate,
  dayWeekday,
  effectiveHours,
  ENGINE,
  isDayDone,
  placeVariants,
  returnFromDayTrip,
  tripThemes,
  type Candidate,
  type CandidateOpts,
  type DayState,
} from './planner'

export interface PlanPreset {
  id: string
  kicker: string
  title: string
  body: string
  /** null means "use the traveler's pace from compose". */
  pace: Pace | null
  /** Skip the Louvre/Orsay seeds and the Versailles day (Off the beaten path). */
  avoidIcons?: boolean
  /** The preset's scoring lean — a coarse interest profile, applied every pick. */
  themeBias?: { themes: Theme[]; weight: number }
  pick: (cands: Candidate[]) => Candidate
}

export interface GeneratedPlan {
  preset: PlanPreset
  days: DayState[]
  /** One-line purpose per day, from the first-trip framework. */
  purposes: string[]
  /** The pace each day was actually BUILT at (template override, else the
   * preset's, else the traveler's). Stored with the trip so later edits
   * re-time the day at the pace it was generated at, not today's slider. */
  paces: Pace[]
  stops: number
  verified: number
  pct: number
  sampleNames: string[]
  perDay: string
  /** Asks from the brief that fit nowhere — surfaced, never silently dropped. */
  unplaced: { placeId: string; reason: string }[]
}

export const PLAN_PRESETS: PlanPreset[] = [
  {
    id: 'first-time',
    kicker: 'Recommended',
    title: 'First Time in Paris',
    body: 'The confident first visit — the essentials, but only the ones I keep coming back to, at your pace with short hops between them.',
    pace: null,
    pick: (c) => c[0],
  },
  {
    id: 'broader',
    kicker: 'Fewer crowds',
    title: 'Off the beaten path',
    body: 'Skips the icons where it can — markets, canals, the east, the streets people actually live on.',
    pace: 'balanced',
    avoidIcons: true,
    themeBias: { themes: ['neighborhood', 'everyday'], weight: 0.75 },
    // Dodge the monumental set and the big-ticket anchors when possible.
    pick: (c) =>
      c.find((x) => x.p.src === 'verified' && x.p.role !== 'anchor' && !(x.p.themes ?? []).includes('monumental')) ??
      c.find((x) => x.p.role !== 'anchor' && !(x.p.themes ?? []).includes('monumental')) ??
      c[0],
  },
  {
    id: 'gentler',
    kicker: 'Culture first',
    title: 'Art + museum heavy',
    body: 'The Louvre, Orsay and the smaller collections — padded with cafés to recover in.',
    pace: 'balanced',
    themeBias: { themes: ['artistic'], weight: 1 },
    // Chase the artistic thread; fall back to any indoor collection.
    pick: (c) =>
      c.find((x) => (x.p.themes ?? []).includes('artistic')) ?? c.find((x) => x.p.group === 'indoor') ?? c[0],
  },
]

/** The framework's day templates come from city data (City.dayTemplates) —
 * this resolves each day's variant: the alt when the preset dodges icons,
 * and for day-trip days, the alt when interests don't justify the trip. */
export function dayProfiles(city: City, dayCount: number, interests: string[], avoidIcons = false): DayTemplate[] {
  return city.dayTemplates
    .map((t) => {
      if (t.dayTripId) {
        const wants = !avoidIcons && (interests.length === 0 || (t.dayTripFor ?? []).some((i) => interests.includes(i)))
        return wants ? t : (t.alt ?? t)
      }
      return avoidIcons && t.alt ? t.alt : t
    })
    .slice(0, Math.max(dayCount, 4))
}

/** Everything one day's picks are judged against. Derived in ONE place so the
 * generator and every edit surface (append, reconsider, insert) ask the engine
 * the same question: the same brief avoids and pins, the same interest and
 * theme weights, and the same day-template caps. Callers add only what is
 * genuinely theirs — `covered`, `limit`, and the slot-specific fields. */
export interface DayPlanContext {
  /** The template as actually resolved: alt substitutions applied. */
  profile: DayTemplate
  purpose: string
  /** The pace this day is built at — the template's override, else the plan's. */
  pace: Pace
  opts: CandidateOpts
}

export interface DayContextInput {
  dayCount: number
  /** The adopted plan preset, if any — carries pace and theme bias. */
  preset?: PlanPreset | null
  travelerPace: Pace
  stay?: StartLoc
  arriving?: string
  interests?: string[]
  interestWeights?: Partial<Record<Theme, number>>
  requests?: ExtractedRequest[]
  /** Places committed on OTHER trip days: a template seed already spent
   * elsewhere resolves to the day's alt, exactly as during generation. */
  visitedElsewhere?: ReadonlySet<string>
  /** Hoods that anchored other days — repeat visits score down. */
  usedHoods?: ReadonlySet<string>
  limit?: number
}

export function dayPlanContext(city: City, dayIndex: number, input: DayContextInput): DayPlanContext {
  const {
    dayCount, preset, travelerPace, stay, arriving,
    interests = [], interestWeights, requests = [], visitedElsewhere, usedHoods, limit,
  } = input
  const basePace = preset?.pace ?? travelerPace
  const template = dayProfiles(city, dayCount, interests, preset?.avoidIcons)[dayIndex]
  const weekday = arriving ? dayWeekday(arriving, dayIndex) : undefined
  const date = arriving ? dayDate(arriving, dayIndex) : undefined

  // The brief's concrete asks: avoids never appear; day-pinned includes are
  // held OFF every other day so they're guaranteed available for theirs.
  const avoids = new Set(requests.filter((r) => r.kind === 'avoid').map((r) => r.placeId))
  const includes = requests.filter((r) => r.kind === 'include' && !avoids.has(r.placeId))
  const exclude = new Set(avoids)
  const pins: { id: string; notBefore?: number }[] = []
  for (const r of includes) {
    const pinDay = requestDay(r, dayCount)
    if (pinDay === undefined || pinDay === dayIndex) pins.push({ id: r.placeId, notBefore: r.slot ? SLOT_START[r.slot] : undefined })
    else exclude.add(r.placeId) // held for its own day
  }

  const openToday = (id: string, expId?: string) => {
    const p = city.places.find((pl) => pl.id === id)
    // Seeds and day-trips honor the brief's avoids like everything else.
    if (!p || visitedElsewhere?.has(p.id) || exclude.has(p.id)) return null
    const variants = placeVariants(p)
    const v = expId ? variants.find((x) => x.experienceId === expId) : variants[0]
    if (!v) return null
    const hrs = effectiveHours(v, date, weekday)
    return hrs ? { p: v, hrs } : null
  }

  // Resolve the template against the real day BEFORE declaring its purpose:
  // a closed or avoided day-trip/seed hands the day to its alt (the alt's
  // shape and purpose), so "A full day at Versailles" never heads a Monday.
  const resolve = (t: DayTemplate): DayTemplate => {
    if (t.dayTripId && !openToday(t.dayTripId)) return t.alt ? resolve(t.alt) : { ...t, dayTripId: undefined }
    if (t.seed && !openToday(t.seed, t.seedExp)) return t.alt ? resolve(t.alt) : { ...t, seed: undefined }
    return t
  }
  const profile = template ? resolve(template) : undefined

  return {
    profile: profile ?? ({ purpose: '' } as DayTemplate),
    purpose: profile?.purpose ?? '',
    pace: profile?.paceOverride ?? basePace,
    opts: {
      weekday,
      date,
      blockAnchors: profile?.noAnchors,
      blockTimed: profile?.noTimed,
      hoodBias: profile?.hoodBias,
      usedHoods,
      home: stay ?? city.start,
      themeBias: preset?.themeBias,
      interestWeights,
      exclude,
      pins,
      limit,
      maxStops: profile?.maxStops,
    },
  }
}

/** Deterministic greedy simulation — the same engine the interactive builder runs.
 * `variant` is the shuffle: the same inputs and variant always regenerate the
 * same plan, but each variant rotates which of the top candidates each pick
 * favors — reproducible variety, no RNG. */
export function generatePlan(
  city: City,
  preset: PlanPreset,
  dayCount: number,
  travelerPace: Pace,
  stay?: StartLoc,
  arriving?: string,
  interests: string[] = [],
  variant = 0,
  interestWeights?: Partial<Record<Theme, number>>,
  requests: ExtractedRequest[] = [],
): GeneratedPlan {
  const basePace = preset.pace ?? travelerPace
  const profiles = dayProfiles(city, dayCount, interests, preset.avoidIcons)
  // Asks that must land somewhere — the per-day split is dayPlanContext's job.
  const avoided = new Set(requests.filter((r) => r.kind === 'avoid').map((r) => r.placeId))
  const includes = requests.filter((r) => r.kind === 'include' && !avoided.has(r.placeId))

  const days: DayState[] = []
  const purposes: string[] = []
  const paces: Pace[] = []
  const visited = new Set<string>()

  for (let d = 0; d < 7; d++) {
    let day = blankDay(city, stay)
    const template = profiles[d]
    if (d < dayCount && template) {
      // Hoods that already anchored an earlier day — later days spread out.
      const usedHoods = new Set<string>()
      for (const prev of days) {
        const theme = prev.committed.find((c) => c.meal !== 'coffee')
        const p = theme && city.places.find((pl) => pl.id === theme.id)
        if (p) usedHoods.add(p.hood)
      }
      // The one derivation — shared with every edit surface in the app.
      const ctx = dayPlanContext(city, d, {
        dayCount, preset, travelerPace, stay, arriving, interests, interestWeights, requests,
        visitedElsewhere: visited,
        usedHoods,
        limit: ENGINE.candidatePoolGenerate,
      })
      const { profile, pace, opts } = ctx
      const pins = opts.pins ?? []
      purposes.push(ctx.purpose)
      paces.push(pace)

      const openToday = (id: string, expId?: string) => {
        const p = city.places.find((pl) => pl.id === id)
        if (!p || visited.has(p.id) || opts.exclude?.has(p.id)) return null
        const variants = placeVariants(p)
        const v = expId ? variants.find((x) => x.experienceId === expId) : variants[0]
        if (!v) return null
        const hrs = effectiveHours(v, opts.date, opts.weekday)
        return hrs ? { p: v, hrs } : null
      }

      const tripPlace = profile.dayTripId ? openToday(profile.dayTripId) : null
      if (tripPlace) {
        // Versailles-style day: one commitment, the whole day.
        day = commitPlace(day, tripPlace.p, pace, tripPlace.hrs, 'the whole-day trip this day is for')
        visited.add(tripPlace.p.id)
        // One commitment is not a reason to skip dinner. You ride back into
        // the city and eat there — and on a 6-day trip the day trip falls
        // LAST, so this is the trip's closing night, not a spare evening.
        // No wind-down gate here: getting back at 19:35 means a 19:40 table,
        // which is a normal hour to eat. Whether a dinner is still reachable
        // is the curfew's judgement, and it already makes it.
        const home = returnFromDayTrip(city, day, stay ?? city.start)
        if (!home.meals.dinner) {
          const evening = { ...home, clock: Math.max(home.clock, ENGINE.dinnerFrom) }
          const dinners = buildCandidates(city, evening, pace, visited, {
            ...opts,
            slotMeal: 'dinner',
            covered: tripThemes(city, [...days, evening]),
          })
          if (dinners.length) {
            const c = preset.pick(dinners)
            day = { ...evening, ...commitCandidate(evening, c) }
            visited.add(c.p.id)
          }
        }
      } else {
        const seed = profile.seed ? openToday(profile.seed, profile.seedExp) : null
        if (seed) {
          day = commitPlace(day, seed.p, pace, seed.hrs, "the day's anchor — booked for the first entry")
          visited.add(seed.p.id)
        }
        let guard = 0
        while (guard++ < 20) {
          const covered = tripThemes(city, [...days, day])
          const cands = buildCandidates(city, day, pace, visited, { ...opts, covered })
          const pinCand = cands.find((c) => pins.some((x) => x.id === c.p.id))
          if (isDayDone(day, pace, cands, profile.maxStops)) {
            // The day would end — but an asked-for stop is still on offer:
            // take it before closing out. The traveler asked.
            if (pinCand) {
              day = { ...day, ...commitCandidate(day, pinCand) }
              visited.add(pinCand.p.id)
              continue
            }
            // No pin on offer *yet* — an evening ask on an afternoon clock.
            // Wait it out: free time until the earliest thing worth waiting
            // for — an asked-for window, or 18:00 so the day gets its dinner.
            const targets = pins
              .filter((x) => !visited.has(x.id))
              .map((x) => {
                const place = city.places.find((p) => p.id === x.id)
                const windowStart = x.notBefore ?? (place?.best ? place.best[0] * 60 : undefined)
                return windowStart !== undefined ? windowStart - 30 : undefined
              })
              .filter((t): t is number => t !== undefined)
            if (!day.meals.dinner && day.committed.length > 0) targets.push(18 * 60)
            const ahead = targets.filter((t) => t > day.clock)
            if (ahead.length) {
              day = { ...day, clock: Math.min(...ahead) }
              continue
            }
            break
          }
          // The shuffle: variant N rotates the candidate list so the preset's
          // pick sees a different (still high-scoring) option first — but only
          // within its segment: forced meal picks stay ahead of sights, so a
          // variant changes WHICH lunch, never WHETHER lunch. An asked-for
          // stop that's feasible right now outranks everything — including
          // the forced dinner that would otherwise close the day.
          const rot = (a: Candidate[]) => {
            const s = variant % Math.max(a.length, 1)
            return [...a.slice(s), ...a.slice(0, s)]
          }
          const head = cands.filter((c) => c.forced)
          const tail = cands.filter((c) => !c.forced)
          let c = pinCand ?? preset.pick(head.length ? rot(head) : rot(tail))
          if (!pinCand) {
            // A long stop can swallow the whole lunch window. Rather than guess
            // from a fixed hour, ask the question directly: after this stop, is
            // any lunch still feasible? A 2-hour Forum visit starting at 11:35
            // ends inside the window and still starves the day, because the
            // last open market shuts at 14:00.
            if (!c.p.meal && !day.meals.lunch && day.clock <= 14.5 * 60) {
              const lunchOpts = { ...opts, covered, slotMeal: 'lunch' as const }
              const after = { ...day, ...commitCandidate(day, c) }
              if (buildCandidates(city, after, pace, visited, lunchOpts).length === 0) {
                // Ask for lunch directly rather than looking in the top-N list:
                // a feasible lunch often ranks below the sights around it.
                const now = buildCandidates(city, day, pace, visited, lunchOpts)
                if (now.length) c = now[0]
                else if (
                  day.clock < ENGINE.lunchForceFrom &&
                  buildCandidates(city, { ...day, clock: ENGINE.lunchForceFrom }, pace, visited, lunchOpts).length > 0
                ) {
                  // The kitchens simply aren't open yet at 10:23 — wait for
                  // them instead of starting a 3½-hour museum that ends after
                  // every lunch service in the city.
                  day = { ...day, clock: ENGINE.lunchForceFrom }
                  continue
                }
              }
            }
            // The dinner-side cliff, asked the same way: after this stop, is any
            // dinner still feasible? A stop ending at 19:25 looks harmless
            // against a fixed 19:30 wind-down and still leaves the day unfed.
            if (!c.p.meal && !day.meals.dinner) {
              const dinnerOpts = { ...opts, covered, slotMeal: 'dinner' as const }
              const stillFed = (d2: DayState) => buildCandidates(city, d2, pace, visited, dinnerOpts).length > 0
              if (!stillFed({ ...day, ...commitCandidate(day, c) })) {
                const safer = rot(tail).find((x) => !x.p.meal && stillFed({ ...day, ...commitCandidate(day, x) }))
                if (safer) c = safer
                // Idle to the dinner hour only when idling actually buys a
                // dinner. Rome spends its four dinner venues by day 4, and
                // waiting for one that no longer exists stranded a nine-hour
                // hole in the middle of the day.
                else if (day.clock < ENGINE.dinnerFrom && day.committed.length > 0 && stillFed({ ...day, clock: ENGINE.dinnerFrom })) {
                  day = { ...day, clock: ENGINE.dinnerFrom }
                  continue
                }
              }
            }
          }
          day = { ...day, ...commitCandidate(day, c) }
          visited.add(c.p.id)
        }
      }
    } else if (d < 7 && !template && d < dayCount) {
      purposes.push('')
      paces.push(basePace)
    }
    days.push(day)
  }
  while (purposes.length < 7) purposes.push('')
  while (paces.length < 7) paces.push(basePace)

  // Best effort for asks that never landed (pinned onto a day-trip day, an
  // anchored day, a closing day): the asked-for day first, then any day with
  // a clean slot. Truly unplaceable asks are surfaced, never silently dropped.
  // Known limit: the fallback ignores the ask's time-of-day preference —
  // placed at all beats placed at the asked hour.
  const unplaced: { placeId: string; reason: string }[] = []
  for (const r of includes) {
    if (visited.has(r.placeId)) continue
    const pinDay = requestDay(r, dayCount)
    const order = [
      ...(pinDay !== undefined ? [pinDay] : []),
      ...Array.from({ length: dayCount }, (_, i) => i).filter((i) => i !== pinDay),
    ]
    let placed = false
    for (const i of order) {
      const target = days[i]
      // Never wedge into a whole-day trip.
      if (!target || target.committed.some((c) => city.places.find((pl) => pl.id === c.id)?.dayTrip)) continue
      const best = bestInsertion(city, target, r.placeId, paces[i] ?? basePace, stay ?? city.start, {
        date: arriving ? dayDate(arriving, i) : undefined,
        weekday: arriving ? dayWeekday(arriving, i) : undefined,
      })
      if (best && best.result.flags.length === 0) {
        days[i] = best.result.day
        visited.add(r.placeId)
        placed = true
        break
      }
    }
    if (!placed) unplaced.push({ placeId: r.placeId, reason: 'no clean slot on any trip day' })
  }

  const active = days.slice(0, dayCount)
  const stops = active.reduce((a, d) => a + d.committed.length, 0)
  const verified = active.reduce((a, d) => a + d.committed.filter((c) => c.src === 'verified').length, 0)
  const counts = active.map((d) => d.committed.length).filter((n) => n > 0)
  const lo = counts.length ? Math.min(...counts) : 0
  const hi = counts.length ? Math.max(...counts) : 0
  const sampleNames = active
    .flatMap((d) => d.committed)
    .filter((c) => c.src === 'verified')
    .slice(0, 3)
    .map((c) => c.name)
  return {
    preset,
    days,
    purposes,
    paces,
    stops,
    verified,
    pct: stops ? Math.round((verified / stops) * 100) : 0,
    sampleNames,
    perDay: `${dayCount} ${dayCount === 1 ? 'day' : 'days'} · ${lo === hi ? lo : `${lo}–${hi}`} stops each`,
    unplaced,
  }
}
