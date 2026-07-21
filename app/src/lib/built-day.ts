import type { City, DayStop } from '../cities/types'
import { fmt, type DayState } from './planner'

/** Render a day committed in the builder in the same shape as a curated day page. */
export function builtDayStops(city: City, day: DayState): DayStop[] {
  return day.committed.map((c, i) => {
    const media = city.media[c.id]
    const verified = c.src === 'verified'
    const next = day.committed[i + 1]
    const stop: DayStop = {
      time: fmt(c.timeIn),
      timeNote: c.meal === 'lunch' ? 'lunch' : c.meal === 'dinner' ? 'dinner' : c.meal === 'coffee' ? 'morning' : undefined,
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
