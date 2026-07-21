import type { City, DayStop } from '../cities/types'
import { effectiveHours, fmt, placeVariants, stopPlace, type DayState } from './planner'
import { euTzOffsetMin, sunTimes } from './sun'

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

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

export interface DeckOpts {
  purpose?: string
  /** Real ISO date of this trip day — unlocks the light and closure sentences. */
  date?: string
  /** JS getDay of this trip day. */
  weekday?: number
}

/** First-visit icons (with any of their variants) closed on this date and not
 * on the day — the fact that explains the day's shape. */
function notableClosures(city: City, day: DayState, date: string, weekday: number): string[] {
  const visited = new Set(day.committed.map((s) => s.id))
  const names: string[] = []
  for (const p of city.places) {
    if (p.rank !== 1 || visited.has(p.id)) continue
    for (const v of placeVariants(p)) {
      if (effectiveHours(v, date, weekday) === null) {
        names.push(shortName(v.name))
        break
      }
    }
  }
  return [...new Set(names)].slice(0, 2)
}

/** A proper deck paragraph for a built day: the template's purpose line, the
 * date and its light, why the day is shaped this way, and what it holds. */
export function builtDayDeck(city: City, day: DayState, opts: DeckOpts = {}): string {
  const { purpose, date, weekday } = opts
  const stops = day.committed
  if (stops.length === 0) return purpose ?? ''

  const dated = date !== undefined && weekday !== undefined
  const sun = dated ? sunTimes(city.start.lat, city.start.lon, date, euTzOffsetMin(date)) : null
  const goldenStart = sun ? sun.sunset - 60 : null

  // A day-trip day is one commitment — say so instead of listing it.
  if (stops.length === 1 && stops[0].dur >= 240) {
    const endT = fmt(stops[0].timeIn + stops[0].dur)
    return [purpose, `The whole day out — back in the city around ${endT}.`].filter(Boolean).join(' ')
  }

  const dinner = stops.find((s) => s.meal === 'dinner')
  const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)
  const last = stops[stops.length - 1]
  const end = last.timeIn + last.dur
  const endT = fmt(end)
  const cap = (s: string) => s.replace(/^./, (c) => c.toUpperCase())

  const parts: string[] = []
  if (purpose) {
    // The date belongs with the framing, not with the sunset.
    if (dated) {
      const [, m, d] = date.split('-').map(Number)
      const phase = d <= 10 ? 'early' : d <= 20 ? 'mid' : 'late'
      parts.push(`${purpose.replace(/\.$/, '')}, on a ${WEEKDAYS[weekday]} in ${phase}-${MONTHS[m - 1]}.`)
    } else {
      parts.push(purpose)
    }
  }

  // Why the day is shaped this way — closures come as context, up front.
  if (dated) {
    const closed = notableClosures(city, day, date, weekday)
    if (closed.length > 0) {
      const hoodCounts = new Map<string, number>()
      for (const s of stops) {
        const p = stopPlace(city, s)
        if (p) hoodCounts.set(p.hood, (hoodCounts.get(p.hood) ?? 0) + 1)
      }
      const mainHood = shortHood([...hoodCounts.entries()].sort((a, b) => b[1] - a[1])[0][0])
      parts.push(
        `${closed.join(' and ')} ${closed.length > 1 ? 'are' : 'is'} closed on ${WEEKDAYS[weekday]}s, so the day stays around ${midPhrase(mainHood)} instead.`,
      )
    }
  }

  // The route in day order, grouped by neighbourhood with meals inline —
  // movement, not a flat list.
  type Seg = { hood: string; bits: string[] }
  const segs: Seg[] = []
  for (const s of stops) {
    if (s.meal === 'dinner') continue
    const p = stopPlace(city, s)
    const hood = p ? shortHood(p.hood) : ''
    const bit = s.meal === 'coffee' ? `coffee at ${shortName(s.name)}` : s.meal === 'lunch' ? `lunch at ${shortName(s.name)}` : shortName(s.name)
    const prev = segs[segs.length - 1]
    if (prev && prev.hood === hood) prev.bits.push(bit)
    else segs.push({ hood, bits: [bit] })
  }
  if (segs.length > 0) {
    const phrases = segs.map((g, i) => {
      const names = list(g.bits)
      if (i === 0) return `${g.hood} first — ${names}`
      if (g.bits.length === 1 && g.bits[0] === g.hood) return `then along ${names}`
      const lead = i === segs.length - 1 && segs.length > 2 ? 'and finally' : 'then'
      return `${lead} ${midPhrase(g.hood)} for ${names}`
    })
    parts.push(cap(phrases.join('; ')) + '.')
  }

  // The close, in the order the evening actually happens: light, then dinner.
  if (dated && sun && goldenStart !== null) {
    const goldenStop = stops.find((s) => {
      const p = stopPlace(city, s)
      return p?.best !== undefined && s.timeIn + s.dur >= goldenStart - 30
    })
    const golden = `golden hour comes around ${fmt(goldenStart)}${goldenStop ? ` — the ${shortName(goldenStop.name)} slot is set for it —` : ','} with sunset at ${fmt(sun.sunset)}`
    if (dinner) {
      parts.push(`${cap(golden)}; dinner at ${shortName(dinner.name)} closes the day around ${endT}.`)
    } else if (end <= goldenStart - 60) {
      parts.push(`The day winds down around ${endT} — golden hour isn't until ${fmt(goldenStart)}, so the evening stays yours.`)
    } else {
      parts.push(`${cap(golden)}; the day winds down around ${endT}.`)
    }
  } else {
    parts.push(dinner ? `Dinner at ${shortName(dinner.name)} closes the day around ${endT}.` : `The day winds down around ${endT}.`)
  }
  return parts.join(' ')
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
      name: c.name,
      sub: media?.sub ?? c.area,
      desc: media?.desc ?? '',
      kind: verified ? 'verified' : media?.webImage ? 'web-image' : 'web-pin',
      plates: verified ? media?.plates : undefined,
      webImage: !verified ? media?.webImage : undefined,
      pin: !verified ? (media?.pin ?? c.area) : undefined,
      provenance: verified ? `From ${c.visits} visits · last ${c.last}` : undefined,
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
