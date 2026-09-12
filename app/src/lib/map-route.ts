import type { City, StartLoc } from '../cities/types'
import type { DayState } from './planner'

export type Coordinate = [number, number]
export type RouteLeg = { mode: 'walk' | 'metro'; coordinates: Coordinate[] }

/** Display geometry only. The accepted plan and its timing remain authoritative. */
export function itineraryLegs(city: City, home: StartLoc, day: DayState): RouteLeg[] {
  let previous: Coordinate = [home.lon, home.lat]
  const legs: RouteLeg[] = []
  for (const stop of day.committed) {
    const place = city.places.find(p => p.id === stop.id)
    if (!place) continue
    const next: Coordinate = [place.lon, place.lat]
    legs.push({ mode: stop.travelMode, coordinates: [previous, next] })
    previous = next
    if (stop.returnAfter) {
      const destination: Coordinate = [stop.returnAfter.to.lon, stop.returnAfter.to.lat]
      legs.push({ mode: stop.returnAfter.mode, coordinates: [previous, destination] })
      previous = destination
    }
  }
  return legs
}

/** Combine adjacent walking legs; Mapbox accepts at most 25 coordinates per request. */
export function walkingGroups(legs: RouteLeg[]): Coordinate[][] {
  const groups: Coordinate[][] = []
  let current: Coordinate[] | undefined
  for (const leg of legs) {
    if (leg.mode !== 'walk') { current = undefined; continue }
    if (!current || current.length === 25) {
      current = [...leg.coordinates]
      groups.push(current)
    } else current.push(leg.coordinates[1])
  }
  return groups
}

const routeCache = new Map<string, Coordinate[]>()
export async function walkingGeometry(coordinates: Coordinate[], token: string, signal: AbortSignal): Promise<Coordinate[]> {
  const key = coordinates.map(c => c.join(',')).join(';')
  const cached = routeCache.get(key)
  if (cached) return cached
  const response = await fetch(`https://api.mapbox.com/directions/v5/mapbox/walking/${key}?geometries=geojson&overview=full&access_token=${encodeURIComponent(token)}`, { signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]) })
  if (!response.ok) throw new Error('Walking directions unavailable')
  const body = await response.json()
  const route: unknown = body.routes?.[0]?.geometry?.coordinates
  if (body.code !== 'Ok' || !Array.isArray(route) || route.length < 2 || !route.every(c => Array.isArray(c) && c.length === 2 && c.every(Number.isFinite))) throw new Error('No walking route found')
  if (routeCache.size >= 64) routeCache.delete(routeCache.keys().next().value!)
  routeCache.set(key, route as Coordinate[])
  return route as Coordinate[]
}
