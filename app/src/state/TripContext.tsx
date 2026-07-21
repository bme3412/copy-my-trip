import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { City, Pace } from '../cities/types'
import { blankDay, stayLoc, type DayState } from '../lib/planner'
import { useCity } from './CityContext'

export interface TripState {
  arriving: string
  departing: string
  pace: Pace
  interests: string[]
  /** Neighbourhood the traveler is staying in — days start and end here. */
  stayHood: string
  planId: string | null
  /** Shuffle counter for plan generation — the same seed regenerates the same
   * plans; bumping it rotates the picks. Deterministic variety, no RNG. */
  planSeed?: number
  days: DayState[]
  /** One-line purpose per day, set when a generated plan is chosen. */
  dayPurposes?: string[]
}

/** Trips scale 1–7 days (the framework's 4-day core plus Orsay, Versailles/personality, buffer). */
export const MAX_DAYS = 7

type TripMap = Record<string, TripState>

// v3: trips begin blank (wizard flow) — earlier keys carried pre-filled test
// dates, so they are deliberately not migrated.
const STORAGE_KEY = 'cmt-trips-v3'

function defaultTrip(city: City): TripState {
  // Fresh trips start blank — the compose page reveals itself as answers land.
  const stay = stayLoc(city, undefined)
  return {
    arriving: '',
    departing: '',
    pace: 'balanced',
    interests: [],
    stayHood: '',
    planId: null,
    days: Array.from({ length: MAX_DAYS }, () => blankDay(city, stay)),
  }
}

function loadTrips(): TripMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* fall through to empty */
  }
  return {}
}

interface TripStore {
  trips: TripMap
  setTrip: (cityId: string, updater: (prev: TripState) => TripState, fallback: TripState) => void
}

const TripStoreContext = createContext<TripStore | null>(null)

export function TripProvider({ children }: { children: ReactNode }) {
  const [trips, setTrips] = useState<TripMap>(loadTrips)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trips))
    } catch {
      /* private mode etc. — state still works in memory */
    }
  }, [trips])

  const store = useMemo<TripStore>(
    () => ({
      trips,
      setTrip: (cityId, updater, fallback) => setTrips((t) => ({ ...t, [cityId]: updater(t[cityId] ?? fallback) })),
    }),
    [trips],
  )

  return <TripStoreContext.Provider value={store}>{children}</TripStoreContext.Provider>
}

interface TripContextValue {
  trip: TripState
  update: (patch: Partial<TripState>) => void
  updateDay: (index: number, day: DayState) => void
  resetDay: (index: number) => void
  setDays: (days: DayState[]) => void
  /** Number of trip days derived from the dates, clamped to 1–7. */
  dayCount: number
}

/** The active city's trip — dates, pace, plan, and built days — persisted per city. */
export function useTrip(): TripContextValue {
  const city = useCity()
  const store = useContext(TripStoreContext)
  if (!store) throw new Error('useTrip must be used within TripProvider')

  return useMemo<TripContextValue>(() => {
    const fallback = defaultTrip(city)
    const stored = store.trips[city.id]
    // Trips saved before stay support get the default base; shorter saved
    // day arrays (pre 7-day trips) get padded with blank days.
    const trip = stored ? { ...fallback, ...stored } : fallback
    // Hood names changed over time (arrondissements added) — remap stale stays.
    // Empty means "not chosen yet", which is a valid wizard state.
    if (trip.stayHood && !city.hoodOrder.includes(trip.stayHood)) trip.stayHood = city.hoodOrder[0]
    if (trip.days.length < MAX_DAYS) {
      const stay = stayLoc(city, trip.stayHood)
      trip.days = [...trip.days, ...Array.from({ length: MAX_DAYS - trip.days.length }, () => blankDay(city, stay))]
    }
    const update = (patch: Partial<TripState>) =>
      store.setTrip(
        city.id,
        (t) => {
          const next = { ...fallback, ...t, ...patch }
          // Moving home base re-roots any day not yet built.
          if (patch.stayHood && patch.stayHood !== t.stayHood) {
            const stay = stayLoc(city, patch.stayHood)
            next.days = next.days.map((d) => (d.committed.length === 0 ? blankDay(city, stay) : d))
          }
          return next
        },
        fallback,
      )
    const updateDay = (index: number, day: DayState) =>
      store.setTrip(city.id, (t) => ({ ...t, days: t.days.map((d, i) => (i === index ? day : d)) }), fallback)
    const resetDay = (index: number) =>
      store.setTrip(
        city.id,
        (t) => ({ ...t, days: t.days.map((d, i) => (i === index ? blankDay(city, stayLoc(city, t.stayHood)) : d)) }),
        fallback,
      )
    const setDays = (days: DayState[]) => store.setTrip(city.id, (t) => ({ ...t, days }), fallback)
    const nights = Math.round((Date.parse(trip.departing) - Date.parse(trip.arriving)) / 86_400_000)
    const dayCount = Number.isFinite(nights) ? Math.min(MAX_DAYS, Math.max(1, nights)) : 4
    return { trip, update, updateDay, resetDay, setDays, dayCount }
  }, [store, city])
}
