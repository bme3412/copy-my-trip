import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { DayTimeline } from '../components/DayTimeline'
import { FlowStepper } from '../components/FlowStepper'
import { Page } from '../components/Layout'
import { CheckIcon } from '../components/icons'
import { builtDayStops, builtDayVerifiedLabel } from '../lib/built-day'
import { useCity } from '../state/CityContext'
import { useTrip } from '../state/TripContext'

export function DayPage() {
  const { n } = useParams()
  const { hash } = useLocation()
  const city = useCity()
  const { trip, dayCount } = useTrip()
  const [verifiedOnly, setVerifiedOnly] = useState(false)

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
  const title = isBuilt ? `Day ${num} — your path` : (curated?.title ?? `Day ${num}`)
  const verifiedLabel = isBuilt ? builtDayVerifiedLabel(built) : (curated?.verifiedLabel ?? 'nothing planned yet')
  const purpose = isBuilt ? trip.dayPurposes?.[num - 1] : undefined
  const timedNames = isBuilt
    ? built.committed.filter((c) => city.places.find((p) => p.id === c.id)?.timed).map((c) => c.name)
    : []

  const setLeafDir = (target: number) => {
    document.documentElement.dataset.navDir = target > num ? 'fwd' : 'back'
  }

  return (
    <Page
      topBar={<FlowStepper />}
      kicker={`Day ${num} of ${dayCount}`}
      title={title}
      aside={
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-accent-700)' }}>
            <CheckIcon size={15} strokeWidth={2.2} />
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{verifiedLabel}</span>
          </div>
          <div className="seg">
            <label className="seg-opt">
              <input type="radio" name="day-filter" checked={!verifiedOnly} onChange={() => setVerifiedOnly(false)} />
              Full plan
            </label>
            <label className="seg-opt">
              <input type="radio" name="day-filter" checked={verifiedOnly} onChange={() => setVerifiedOnly(true)} />
              Verified only
            </label>
          </div>
        </>
      }
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 22, fontFamily: 'var(--font-heading)', fontSize: 15 }}>
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

      {isBuilt && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
          <span className="tag tag-accent">Built by you in the day builder</span>
          <Link to={`/${city.id}/build`} viewTransition style={{ fontSize: 13, fontFamily: 'var(--font-body)' }}>
            Keep editing
          </Link>
          {timedNames.length > 0 && (
            <span className="text-muted" style={{ fontFamily: 'var(--font-body)', fontSize: 12.5 }}>
              · Book ahead: {timedNames.join(' · ')}
            </span>
          )}
        </div>
      )}
      {purpose && (
        <p className="text-muted" style={{ fontFamily: 'var(--font-body)', fontSize: 13.5, fontStyle: 'italic', margin: '14px 0 0' }}>
          {purpose}
        </p>
      )}

      <hr className="hr hr-draw" style={{ margin: '24px 0 8px' }} />

      <div style={{ viewTransitionName: 'day-timeline' }}>
        {stops.length > 0 ? (
          <DayTimeline stops={stops} verifiedOnly={verifiedOnly} />
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
