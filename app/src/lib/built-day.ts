import type { City, DayStop, FinishedDay } from '../cities/types'
import { fmt, stopPlace, type DayState } from './planner'

/** "The Islands" reads as "the Islands" mid-phrase; French articles stay. */
const midPhrase = (hood: string) => (hood === 'Latin Quarter' ? 'the Latin Quarter' : hood.replace(/^The /, 'the '))
const shortHood = (hood: string) => hood.replace(/\s*\(.*\)$/, '')
const shortName = (name: string) => name.split(',')[0].split(' — ')[0]
/** "X & Y" — unless either side already carries an '&', then "X, then Y". */
const join = (a: string, b: string) => (a.includes('&') || b.includes('&') ? `${a}, then ${b}` : `${a} & ${b}`)

/** A curated-style title from what the day actually holds — "The Louvre &
 * the Islands", "A day at Versailles" — deterministic, no placeholder. */
export function builtDayTitle(city: City, day: DayState): string {
  const stops = day.committed
  if (stops.length === 0) return 'An open day'
  const places = stops.map((s) => stopPlace(city, s)).filter((p) => p !== undefined)

  const dayTrip = places.find((p) => p.dayTrip)
  if (dayTrip) return `A day at ${shortName(dayTrip.name)}`

  const hoodCounts = new Map<string, number>()
  for (const p of places) hoodCounts.set(p.hood, (hoodCounts.get(p.hood) ?? 0) + 1)
  const hoods = [...hoodCounts.entries()].sort((a, b) => b[1] - a[1]).map(([h]) => shortHood(h))

  // Days that run past dusk earn their suffix.
  const last = stops[stops.length - 1]
  const evening = last.timeIn + last.dur >= 18.5 * 60

  const anchor = places.find((p) => p.role === 'anchor')
  if (anchor) {
    const a = shortName(anchor.name)
    const other = hoods.find((h) => h !== shortHood(anchor.hood))
    return other ? `${a}, then ${midPhrase(other)}` : `A day around ${midPhrase(a)}`
  }
  if (hoods.length === 1) return `A day in ${midPhrase(hoods[0])}${evening ? ', into the evening' : ''}`
  const base = join(hoods[0], midPhrase(hoods[1]))
  return evening && !base.includes(', then') ? `${base}, into the evening` : base
}

/** Render a day committed in the builder in the same shape as a curated day page. */
export function builtDayStops(city: City, day: DayState): DayStop[] {
  return day.committed.map((c, i) => {
    const media = city.media[c.id]
    const verified = c.src === 'verified'
    const next = day.committed[i + 1]
    const stop: DayStop = {
      time: fmt(c.timeIn),
      timeNote: c.meal ?? undefined,
      placeId: c.id,
      name: c.name,
      sub: media?.sub ?? c.area,
      desc: media?.desc ?? '',
      kind: verified ? 'verified' : media?.webImage ? 'web-image' : 'web-pin',
      plates: verified ? media?.plates : undefined,
      webImage: !verified ? media?.webImage : undefined,
      pin: !verified ? (media?.pin ?? c.area) : undefined,
      prov: media?.prov,
      transitAfter: next ? { min: next.travelMin, measured: next.measured } : undefined,
      why: c.reasons?.filter((r) => r.value >= 0).map((r) => r.note),
    }
    return stop
  })
}

export function builtDayVerifiedLabel(day: DayState): string {
  const v = day.committed.filter((c) => c.src === 'verified').length
  return `${v} of ${day.committed.length} stops personally verified`
}

/** The same label for a curated day, counted from its stops rather than typed
 * by hand — the hand-typed version had the wrong numbers on three of Paris's
 * four days, which is a false provenance claim waiting to reach the page. */
export function curatedVerifiedLabel(day: FinishedDay): string {
  const v = day.stops.filter((s) => s.kind === 'verified').length
  return `${v} of ${day.stops.length} stops personally verified`
}
