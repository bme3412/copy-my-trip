import { useEffect, useRef } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { DayTimeline } from '../components/DayTimeline'
import { Page } from '../components/Layout'
import { DayMap } from '../components/DayMap'
import { builtDayDeck, builtDayStops, builtDayTitle } from '../lib/built-day'
import { dayDate, dayWeekday, fmt, stayLoc, stopPlace } from '../lib/planner'
import { euTzOffsetMin, sunTimes } from '../lib/sun'
import { useCity } from '../state/CityContext'
import { useTrip } from '../state/TripContext'

// Provided via app/.env.local — without it the day renders without a map.
const MAPBOX_TOKEN: string | undefined = import.meta.env ? import.meta.env.VITE_MAPBOX_TOKEN : undefined

export function DayPage() {
  const { n } = useParams()
  const { hash } = useLocation()
  const city = useCity()
  const { trip, update, dayCount } = useTrip()

  // Arriving from the archive: scroll to the linked stop and flash it.
  useEffect(() => {
    if (!hash) return
    const el = document.getElementById(hash.slice(1))
    if (!el) return
    const t = window.setTimeout(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('stop-flash')
      window.setTimeout(() => el.classList.remove('stop-flash'), 1400)
    }, 120)
    return () => window.clearTimeout(t)
  }, [hash, n])

  const num = Math.min(Math.max(Number(n) || 1, 1), dayCount)
  const built = trip.days[num - 1]
  const isBuilt = built.committed.length > 0
  // Days beyond the curated four exist only once generated or built.
  const curated = city.curatedDays[num - 1] as (typeof city.curatedDays)[number] | undefined

  const stops = isBuilt ? builtDayStops(city, built) : (curated?.stops ?? [])
  const title = isBuilt ? builtDayTitle(city, built) : (curated?.title ?? `Day ${num}`)
  const date = trip.arriving ? dayDate(trip.arriving, num - 1) : undefined
  const weekday = trip.arriving ? dayWeekday(trip.arriving, num - 1) : undefined
  const purpose = trip.dayPurposes?.[num - 1]
  const deck = isBuilt ? builtDayDeck(city, built, { purpose, date, weekday }) : undefined

  // The LLM narration: computed facts in, curator prose out — fetched once
  // per day-content, cached in trip state, deck as instant fallback.
  const dayKey = isBuilt ? built.committed.map((c) => `${c.id}@${c.timeIn}`).join(',') : ''
  const narration = trip.dayNarrations?.[num - 1]
  const narrated = narration?.key === dayKey ? narration.text : undefined
  const attemptedRef = useRef<string | null>(null)
  useEffect(() => {
    if (!isBuilt || !date || weekday === undefined || narrated || attemptedRef.current === dayKey) return
    attemptedRef.current = dayKey
    const sun = sunTimes(city.start.lat, city.start.lon, date, euTzOffsetMin(date))
    const facts = {
      stops: built.committed.map((c) => ({
        name: c.name,
        time: fmt(c.timeIn),
        minutes: c.dur,
        meal: c.meal,
        hood: stopPlace(city, c)?.hood,
        area: c.area,
        kind: stopPlace(city, c)?.label,
        fromArchive: c.src === 'verified',
        curatorNote: c.src === 'verified' ? city.media[c.id]?.desc : undefined,
      })),
      sunset: fmt(sun.sunset),
      goldenHourFrom: fmt(sun.sunset - 60),
      walkingMinutes: built.committed.filter((c) => c.travelMode === 'walk').reduce((a, c) => a + c.travelMin, 0),
      metroHops: built.committed.filter((c) => c.travelMode === 'metro').length,
      endsAround: fmt(built.committed[built.committed.length - 1].timeIn + built.committed[built.committed.length - 1].dur),
    }
    fetch('/api/narrate-day', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ city: city.name, date, title, purpose, facts }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j: { narration?: string }) => {
        if (typeof j.narration === 'string' && j.narration.length > 0) {
          update({ dayNarrations: { ...trip.dayNarrations, [num - 1]: { key: dayKey, text: j.narration } } })
        }
      })
      .catch(() => {
        /* no API locally — the deterministic deck stands */
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBuilt, dayKey, date, weekday, narrated])
  const timedNames = isBuilt
    ? built.committed.filter((c) => stopPlace(city, c)?.timed).map((c) => c.name)
    : []

  const setLeafDir = (target: number) => {
    document.documentElement.dataset.navDir = target > num ? 'fwd' : 'back'
  }

  return (
    <Page
      topBar={
        <div style={{ display: 'flex', alignItems: 'center', gap: 22, fontFamily: 'var(--font-heading)', fontSize: 15, padding: '4px 0 18px' }}>
          {Array.from({ length: dayCount }, (_, i) => i + 1).map((d) => (
            <Link
              key={d}
              to={`/${city.id}/day/${d}`}
              viewTransition
              onClick={() => setLeafDir(d)}
              style={
                d === num
                  ? { color: 'var(--color-accent)', borderBottom: '2px solid var(--color-accent)', paddingBottom: 6, textDecoration: 'none' }
                  : { color: 'color-mix(in srgb, var(--color-text) 45%, transparent)', paddingBottom: 6, textDecoration: 'none' }
              }
            >
              Day {d}
            </Link>
          ))}
        </div>
      }
      title={title}
    >
      {(narrated ?? deck) && (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 14.5, margin: '14px 0 0', maxWidth: 620, lineHeight: 1.75, color: 'color-mix(in srgb, var(--color-text) 82%, transparent)' }}>
          {narrated ?? deck}
        </p>
      )}
      {isBuilt && (
        <div
          className="text-muted"
          style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap', fontFamily: 'var(--font-body)', fontSize: 12.5 }}
        >
          <Link to={`/${city.id}/build`} viewTransition style={{ fontSize: 12.5 }}>
            Keep editing
          </Link>
          {timedNames.length > 0 && <span>· Book ahead: {timedNames.join(' · ')}</span>}
        </div>
      )}

      {isBuilt && MAPBOX_TOKEN && (
        <div
          style={{
            position: 'relative',
            height: 320,
            marginTop: 20,
            border: '1px solid var(--color-divider)',
            borderRadius: 6,
            overflow: 'hidden',
          }}
        >
          <DayMap token={MAPBOX_TOKEN} city={city} home={stayLoc(city, trip.stayHood)} day={built} />
        </div>
      )}

      <hr className="hr hr-draw" style={{ margin: '24px 0 8px' }} />

      <div style={{ viewTransitionName: 'day-timeline' }}>
        {stops.length > 0 ? (
          <DayTimeline stops={stops} />
        ) : (
          <div style={{ border: '1px dashed var(--color-divider)', borderRadius: 6, padding: 36, textAlign: 'center', maxWidth: 560 }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 20, marginBottom: 8 }}>Day {num} isn't composed yet</div>
            <p className="text-muted" style={{ fontSize: 13.5, lineHeight: 1.6, margin: '0 0 18px' }}>
              Days beyond the four-day core come from a plan or your own building.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <Link to={`/${city.id}/compose`} viewTransition className="btn btn-primary">
                Choose a plan
              </Link>
              <Link to={`/${city.id}/build`} viewTransition className="btn btn-secondary">
                Build it yourself
              </Link>
            </div>
          </div>
        )}
      </div>

      {!isBuilt && (
        <p className="text-muted" style={{ fontFamily: 'var(--font-body)', fontSize: 13, marginTop: 28, maxWidth: 560, lineHeight: 1.7 }}>
          This is the composed plan for day {num}. Want a different path?{' '}
          <Link to={`/${city.id}/build`} viewTransition style={{ fontSize: 13 }}>
            Build it yourself, stop by stop
          </Link>{' '}
          — your version replaces this one here.
        </p>
      )}
    </Page>
  )
}
