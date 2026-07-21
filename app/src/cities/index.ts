import type { City } from './types'
import { PARIS } from './paris'
import { ROME } from './rome'

/** Every city the archive covers. Adding a city is a data drop-in: build a
 * `City` module under `src/cities/<id>/` and register it here. */
export const CITIES: Record<string, City> = {
  paris: PARIS,
  rome: ROME,
}

export const DEFAULT_CITY = 'paris'
