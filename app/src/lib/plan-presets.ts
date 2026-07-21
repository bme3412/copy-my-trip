import type { City, DayTemplate, Pace, StartLoc } from '../cities/types'
import {
  blankDay,
  buildCandidates,
  commitCandidate,
  commitPlace,
  dayDate,
  dayWeekday,
  effectiveHours,
  isDayDone,
  placeVariants,
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
  pick: (cands: Candidate[]) => Candidate
}

export interface GeneratedPlan {
  preset: PlanPreset
  days: DayState[]
  /** One-line purpose per day, from the first-trip framework. */
  purposes: string[]
  stops: number
  verified: number
  pct: number
  sampleNames: string[]
  perDay: string
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
    // Chase the artistic thread; fall back to any indoor collection.
    pick: (c) =>
      c.find((x) => (x.p.themes ?? []).includes('artistic')) ?? c.find((x) => x.p.group === 'indoor') ?? c[0],
  },
]

/** The framework's day templates come from city data (City.dayTemplates) —
 * this resolves each day's variant: the alt when the preset dodges icons,
 * and for day-trip days, the alt when interests don't justify the trip. */
function dayProfiles(city: City, dayCount: number, interests: string[], avoidIcons = false): DayTemplate[] {
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

/** Deterministic greedy simulation — the same engine the interactive builder runs. */
export function generatePlan(
  city: City,
  preset: PlanPreset,
  dayCount: number,
  travelerPace: Pace,
  stay?: StartLoc,
  arriving?: string,
  interests: string[] = [],
): GeneratedPlan {
  const basePace = preset.pace ?? travelerPace
  const profiles = dayProfiles(city, dayCount, interests, preset.avoidIcons)
  const days: DayState[] = []
  const purposes: string[] = []
  const visited = new Set<string>()

  for (let d = 0; d < 7; d++) {
    let day = blankDay(city, stay)
    const profile = profiles[d]
    if (d < dayCount && profile) {
      purposes.push(profile.purpose)
      const pace = profile.paceOverride ?? basePace
      const weekday = arriving ? dayWeekday(arriving, d) : undefined
      const date = arriving ? dayDate(arriving, d) : undefined
      const opts: CandidateOpts = {
        weekday,
        date,
        blockAnchors: profile.noAnchors,
        blockTimed: profile.noTimed,
        hoodBias: profile.hoodBias,
      }

      const openToday = (id: string, expId?: string) => {
        const p = city.places.find((pl) => pl.id === id)
        if (!p || visited.has(p.id)) return null
        const variants = placeVariants(p)
        const v = expId ? variants.find((x) => x.experienceId === expId) : variants[0]
        if (!v) return null
        const hrs = effectiveHours(v, date, weekday)
        return hrs ? { p: v, hrs } : null
      }

      const tripPlace = profile.dayTripId ? openToday(profile.dayTripId) : null
      if (tripPlace) {
        // Versailles-style day: one commitment, the whole day.
        day = commitPlace(day, tripPlace.p, pace, tripPlace.hrs, 'the whole-day trip this day is for')
        visited.add(tripPlace.p.id)
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
          if (isDayDone(day, pace, cands, profile.maxStops)) break
          const c = preset.pick(cands)
          day = { ...day, ...commitCandidate(day, c) }
          visited.add(c.p.id)
        }
      }
    } else if (d < 7 && !profile && d < dayCount) {
      purposes.push('')
    }
    days.push(day)
  }
  while (purposes.length < 7) purposes.push('')

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
    stops,
    verified,
    pct: stops ? Math.round((verified / stops) * 100) : 0,
    sampleNames,
    perDay: `${dayCount} ${dayCount === 1 ? 'day' : 'days'} · ${lo === hi ? lo : `${lo}–${hi}`} stops each`,
  }
}
