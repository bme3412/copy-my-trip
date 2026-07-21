import type { City } from './types'
import { PARIS } from './paris'

/** Every city the archive covers. Adding a city is a data drop-in: build a
 * `City` module under `src/cities/<id>/` and register it here. */
export const CITIES: Record<string, City> = {
  paris: PARIS,
}

export const DEFAULT_CITY = 'paris'
