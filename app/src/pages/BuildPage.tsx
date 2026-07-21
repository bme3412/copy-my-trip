import { Fragment, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BuilderMap } from '../components/BuilderMap'
import { FlowStepper } from '../components/FlowStepper'
import { Page } from '../components/Layout'
import { CheckIcon, ClockIcon, MenuIcon, TicketIcon, WalkIcon } from '../components/icons'
import type { Pace } from '../cities/types'
import { CoverageStrip } from '../components/CoverageStrip'
import { placeLatestLabel } from '../lib/media'
import { buildCandidates, commitCandidate, dayAnchor, dayDate, dayWeekday, fmt, isDayDone, stayLoc, tripThemes, type Candidate } from '../lib/planner'
import { useCity } from '../state/CityContext'
import { useTrip } from '../state/TripContext'

const MAPBOX_TOKEN: string | undefined = import.meta.env ? import.meta.env.VITE_MAPBOX_TOKEN : undefined

const PACE_LABELS: { key: Pace; label: string }[] = [
  { key: 'gentle', label: 'Gentle' },
  { key: 'balanced', label: 'Balanced' },
  { key: 'full', label: 'Full' },
]

function CandidateCard({
  cand,
  onChoose,
  exitClass,
  delay,
  hovered,
  onHover,
}: {
  cand: Candidate
  onChoose: () => void
  exitClass: string
  delay: number
  hovered: boolean
  onHover: (id: string | null) => void
}) {
  const city = useCity()
  const info = city.info[cand.p.id]
  const entry = city.entry[cand.p.id]
  const verified = cand.p.src === 'verified'
  return (
    <div
      className={`card deal-in ${exitClass}`}
      onMouseEnter={() => onHover(cand.p.id)}
      onMouseLeave={() => onHover(null)}
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 200px',
        gap: 22,
        alignItems: 'center',
        padding: '20px 22px',
        animationDelay: exitClass ? '0ms' : `${delay}ms`,
        borderColor: hovered ? 'var(--color-accent)' : undefined,
      }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 7, flexWrap: 'wrap' }}>
          <span className="tag tag-outline">{cand.p.label}</span>
          <span className={verified ? 'tag tag-accent' : 'tag tag-neutral'}>
            {verified
              ? `From your archive${placeLatestLabel(city, cand.p.id) ? ` · shot ${placeLatestLabel(city, cand.p.id)}` : ''}`
              : 'From web notes'}
          </span>
          {cand.p.role === 'anchor' && <span className="tag tag-accent-2">Anchor · one per day</span>}
          {cand.p.timed && <span className="tag tag-neutral">timed entry</span>}
        </div>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 600, lineHeight: 1.15 }}>{cand.p.name}</div>
        <div className="text-muted" style={{ fontSize: 12.5, marginBottom: 9 }}>
          {cand.p.area}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            flexWrap: 'wrap',
            fontFamily: 'var(--font-body)',
            fontSize: 12,
            color: 'color-mix(in srgb, var(--color-text) 68%, transparent)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <WalkIcon size={12} />
            {cand.t.min} min {cand.t.mode} · {cand.t.measured ? 'measured' : 'estimated'}
          </span>
          <span>arrive {fmt(cand.arrive)}</span>
          <span>{cand.dur} min here</span>
        </div>
        {cand.p.open[1] < 22 && (
          <div className="text-muted" style={{ fontSize: 11, marginTop: 5 }}>
            open to {cand.p.open[1]}:00
          </div>
        )}
        {info && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, fontSize: 12, flexWrap: 'wrap' }}>
            <span style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: 1.5 }}>
              <span style={{ color: 'var(--color-text)' }}>{info.price}</span>
              <span className="text-muted">{'$$$$'.slice(info.price.length)}</span>
            </span>
            <a href={info.menu} target="_blank" rel="noopener" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <MenuIcon size={12} />
              View menu
            </a>
            <span className="text-muted">{info.lang === 'FR' ? 'menu · FR→EN' : 'menu in English'}</span>
          </div>
        )}
        {entry && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, fontSize: 12, flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontVariantNumeric: 'tabular-nums' }}>
              <TicketIcon size={12} />
              {entry.cost}
            </span>
            {entry.url && (
              <a href={entry.url} target="_blank" rel="noopener">
                {entry.needed ? 'Book tickets' : 'Reserve slot'}
              </a>
            )}
            {entry.note && <span className="text-muted">{entry.note}</span>}
          </div>
        )}
      </div>
      <div
        style={{
          borderLeft: '1px solid var(--color-divider)',
          paddingLeft: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          alignSelf: 'stretch',
          justifyContent: 'center',
        }}
      >
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, lineHeight: 1.5, color: 'var(--color-accent-700)', fontVariantNumeric: 'tabular-nums' }}>
          {cand.forecast}
        </div>
        <button className="btn btn-primary" style={{ width: '100%' }} onClick={onChoose}>
          Choose this
        </button>
      </div>
    </div>
  )
}

export function BuildPage() {
  const city = useCity()
  const { trip, update, updateDay, resetDay, dayCount } = useTrip()
  const [dayIdx, setDayIdx] = useState(0)
  useEffect(() => {
    if (dayIdx >= dayCount) setDayIdx(0)
  }, [dayIdx, dayCount])

  const day = trip.days[dayIdx]
  const pace = trip.pace
  const visited = useMemo(() => {
    const set = new Set<string>()
    trip.days.forEach((d) => d.committed.forEach((c) => set.add(c.id)))
    return set
  }, [trip.days])
  const covered = useMemo(() => tripThemes(city, trip.days), [city, trip.days])
  const weekday = dayWeekday(trip.arriving, dayIdx)
  const date = dayDate(trip.arriving, dayIdx)
  const candidates = useMemo(
    () => buildCandidates(city, day, pace, visited, { weekday, date, covered }),
    [city, day, pace, visited, weekday, date, covered],
  )
  const done = isDayDone(day, pace, candidates)
  const anchor = dayAnchor(city, day, visited)
  const daySpan = city.dayEnd - city.dayStart

  const [exitingId, setExitingId] = useState<string | null>(null)
  const [hoverCandId, setHoverCandId] = useState<string | null>(null)
  const home = useMemo(() => stayLoc(city, trip.stayHood), [city, trip.stayHood])
  const choose = (c: Candidate) => updateDay(dayIdx, { ...day, ...commitCandidate(day, c) })
  const startChoose = (c: Candidate) => {
    if (exitingId) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      choose(c)
      return
    }
    setExitingId(c.p.id)
    window.setTimeout(() => {
      choose(c)
      setExitingId(null)
    }, 300)
  }

  const lunchState = day.meals.lunch ? 'done' : day.clock > 15 * 60 ? 'ahead' : day.clock >= 11 * 60 ? 'now' : 'ahead'
  const dinnerState = day.meals.dinner ? 'done' : day.clock >= 18 * 60 ? 'now' : 'ahead'
  const chipClass = (st: string) => 'tag ' + (st === 'done' ? 'tag-accent' : st === 'now' ? 'tag-outline' : 'tag-neutral')

  const verifiedCount = day.committed.filter((c) => c.src === 'verified').length
  const walk = day.committed.filter((c) => c.travelMode === 'walk').reduce((a, c) => a + c.travelMin, 0)
  let tripStops = 0
  let tripVerified = 0
  trip.days.forEach((d) => {
    tripStops += d.committed.length
    tripVerified += d.committed.filter((c) => c.src === 'verified').length
  })
  const tripLabel =
    tripStops > 0
      ? `${tripVerified} of ${tripStops} stops verified across the trip so far`
      : 'Choices carry across all days — nothing repeats'
  const stayName = trip.stayHood || city.hoodOrder[0]
  const homeBase = `your place in ${stayName}`
  const currentPlace = day.committed.length ? day.committed[day.committed.length - 1].name : homeBase

  return (
    <Page
      topBar={<FlowStepper />}
      kicker="Day builder"
      title={`Your place, ${stayName} · ${fmt(city.dayStart)} start`}
      aside={
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <span className="tag tag-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <ClockIcon size={12} />
              <span key={day.clock} className="fade-swap">
                Now {fmt(day.clock)}
              </span>
            </span>
            <span key={`l-${lunchState}`} className={`${chipClass(lunchState)} fade-swap`}>{day.meals.lunch ? 'Lunch ✓' : 'Lunch'}</span>
            <span key={`d-${dinnerState}`} className={`${chipClass(dinnerState)} fade-swap`}>{day.meals.dinner ? 'Dinner ✓' : 'Dinner'}</span>
            <span className="tag tag-neutral">Home by {fmt(city.dayEnd)}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="text-muted" style={{ fontSize: 10, letterSpacing: '.1em' }}>
              PACE
            </span>
            <div className="seg">
              {PACE_LABELS.map((p) => (
                <label
                  key={p.key}
                  className="seg-opt"
                  style={
                    pace === p.key
                      ? { color: 'var(--color-accent)', boxShadow: 'inset 0 0 0 1px var(--color-accent)', cursor: 'pointer' }
                      : { cursor: 'pointer' }
                  }
                  onClick={() => update({ pace: p.key })}
                >
                  {p.label}
                </label>
              ))}
            </div>
          </div>
        </>
      }
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 20, fontFamily: 'var(--font-heading)', fontSize: 15, marginBottom: 4 }}>
        {trip.days.slice(0, dayCount).map((d, i) => (
          <span
            key={i}
            style={
              i === dayIdx
                ? { color: 'var(--color-accent)', borderBottom: '2px solid var(--color-accent)', paddingBottom: 6, cursor: 'pointer' }
                : { color: 'color-mix(in srgb, var(--color-text) 45%, transparent)', paddingBottom: 6, cursor: 'pointer' }
            }
            onClick={() => setDayIdx(i)}
          >
            Day {i + 1}
            {d.committed.length > 0 && <span style={{ fontVariantNumeric: 'tabular-nums' }}> · {d.committed.length}</span>}
          </span>
        ))}
        <span key={anchor} className="text-muted fade-swap" style={{ fontFamily: 'var(--font-body)', fontSize: 12 }}>
          {day.committed.length > 0 ? 'leaning ' : 'suggested: '}
          <span style={{ color: 'var(--color-accent-700)' }}>{anchor}</span>
        </span>
      </div>

      {/* day meter — each choice deposits a block; travel time reads as gaps */}
      <div style={{ margin: '22px 0 6px', height: 6, display: 'flex', background: 'var(--color-neutral-300)', borderRadius: 3, overflow: 'hidden' }}>
        {day.committed.map((c, i) => (
          <Fragment key={c.id}>
            <span style={{ width: `${(c.travelMin / daySpan) * 100}%`, flex: 'none' }} />
            <span
              className={i === day.committed.length - 1 ? 'meter-seg meter-seg-new' : 'meter-seg'}
              style={{
                width: `${(c.dur / daySpan) * 100}%`,
                flex: 'none',
                background: c.src === 'verified' ? 'var(--color-accent)' : 'var(--color-neutral-500)',
              }}
            />
          </Fragment>
        ))}
      </div>
      <div className="text-muted" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>
        <span>{fmt(city.dayStart)}</span>
        <span>the day fills in as you choose</span>
        <span>{fmt(city.dayEnd)}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap', marginTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-accent-700)' }}>
          <CheckIcon size={13} strokeWidth={2} />
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{tripLabel}</span>
        </div>
        <CoverageStrip covered={covered} compact />
      </div>

      <hr className="hr" style={{ margin: '20px 0 24px' }} />

      {MAPBOX_TOKEN && (
        <div
          className="builder-map-panel"
          style={{ position: 'relative', height: 360, border: '1px solid var(--color-divider)', borderRadius: 8, overflow: 'hidden', marginBottom: 32 }}
        >
          <BuilderMap
            token={MAPBOX_TOKEN}
            city={city}
            home={home}
            day={day}
            candidates={done ? [] : candidates}
            hoverId={hoverCandId}
            onHover={setHoverCandId}
            onChoose={startChoose}
          />
        </div>
      )}

      <div className="builder-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(280px,1fr) minmax(360px,1.25fr)', gap: 44, alignItems: 'start' }}>
        {/* LEFT — the day so far */}
        <div>
          <h4
            style={{
              fontSize: 15,
              margin: '0 0 18px',
              fontFamily: 'var(--font-heading)',
              letterSpacing: '.06em',
              textTransform: 'uppercase',
              color: 'var(--color-accent)',
            }}
          >
            The day so far
          </h4>
          {day.committed.length === 0 ? (
            <div style={{ border: '1px dashed var(--color-divider)', borderRadius: 6, padding: 28, textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 19, marginBottom: 6 }}>Nothing chosen yet</div>
              <p className="text-muted" style={{ fontSize: 13.5, lineHeight: 1.6, margin: 0 }}>
                You're at {homeBase} at {fmt(city.dayStart)}. Pick your first move on the right — every choice sets the clock and the map for
                the next one.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {day.committed.map((c, i) => {
                const verified = c.src === 'verified'
                const info = city.info[c.id]
                const entry = city.entry[c.id]
                const isNew = i === day.committed.length - 1
                return (
                  <div key={c.id} className={isNew ? 'commit-enter' : undefined} style={{ display: 'grid', gridTemplateColumns: '56px 1fr', gap: 14 }}>
                    <div style={{ textAlign: 'right', paddingTop: 1 }}>
                      <div style={{ fontFamily: 'var(--font-heading)', fontSize: 17, fontVariantNumeric: 'tabular-nums' }}>{fmt(c.timeIn)}</div>
                    </div>
                    <div style={{ borderLeft: '1.5px solid var(--color-neutral-300)', padding: '0 0 22px 22px', position: 'relative' }}>
                      {verified ? (
                        <span
                          className={isNew ? 'dot-stamp' : undefined}
                          style={{ position: 'absolute', left: -6.5, top: 5, width: 11, height: 11, borderRadius: '50%', background: 'var(--color-accent)' }}
                        />
                      ) : (
                        <span
                          className={isNew ? 'dot-stamp' : undefined}
                          style={{
                            position: 'absolute',
                            left: -6,
                            top: 5,
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            background: 'var(--color-bg)',
                            border: '1.5px solid var(--color-neutral-400)',
                          }}
                        />
                      )}
                      <div className="text-muted" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, marginBottom: 5 }}>
                        <WalkIcon size={12} />
                        {i === 0
                          ? `${c.travelMin} min ${c.travelMode} from your place`
                          : `${c.travelMin} min ${c.travelMode}${c.measured ? ' · measured' : ' · est.'}`}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: 'var(--font-heading)', fontSize: 18, fontWeight: 600 }}>{c.name}</span>
                        <span className="text-muted" style={{ fontSize: 12 }}>
                          {c.area}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, fontSize: 11 }}>
                        <span className={verified ? 'tag tag-accent' : 'tag tag-neutral'}>
                          {verified ? (placeLatestLabel(city, c.id) ? `shot ${placeLatestLabel(city, c.id)}` : 'from your archive') : 'from web notes'}
                        </span>
                        <span className="text-muted">{c.dur} min here</span>
                        {info && (
                          <span className="text-muted" style={{ letterSpacing: 1.5 }}>
                            <span style={{ color: 'var(--color-text)' }}>{info.price}</span>
                            {'$$$$'.slice(info.price.length)}
                          </span>
                        )}
                        {entry && (
                          <span className="text-muted" style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {entry.cost}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* RIGHT — the decision */}
        <div>
          {!done ? (
            <>
              <h4
                style={{
                  fontSize: 15,
                  margin: '0 0 4px',
                  fontFamily: 'var(--font-heading)',
                  letterSpacing: '.06em',
                  textTransform: 'uppercase',
                  color: 'var(--color-accent)',
                }}
              >
                Choose your next move
              </h4>
              <p className="text-muted" style={{ fontSize: 13, lineHeight: 1.55, margin: '0 0 18px' }}>
                Three ways forward from <span style={{ color: 'var(--color-text)' }}>{currentPlace}</span>. You can only take one — its length
                and location decide what's still reachable after.
              </p>
              <div key={`${dayIdx}-${day.committed.length}`} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {candidates.map((cand, i) => (
                  <CandidateCard
                    key={cand.p.id}
                    cand={cand}
                    onChoose={() => startChoose(cand)}
                    delay={i * 60}
                    exitClass={exitingId ? (exitingId === cand.p.id ? 'cand-chosen-exit' : 'cand-rejected-exit') : ''}
                    hovered={hoverCandId === cand.p.id}
                    onHover={setHoverCandId}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="card elev-sm" style={{ padding: 30 }}>
              <span className="card-kicker">Day complete</span>
              <h3 style={{ fontSize: 26, fontWeight: 400, margin: '4px 0 2px' }}>One path through the day</h3>
              <p className="text-muted" style={{ fontSize: 14, margin: '0 0 14px', fontVariantNumeric: 'tabular-nums' }}>
                {day.committed.length} stops · {day.committed.length ? `${fmt(day.committed[0].timeIn)} – ${fmt(day.clock)}` : ''} · {walk} min
                on foot
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-accent-700)', marginBottom: 16 }}>
                <CheckIcon size={15} strokeWidth={2.2} />
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {verifiedCount} of {day.committed.length} personally verified
                </span>
              </div>
              {(() => {
                const timedNames = day.committed
                  .filter((c) => city.places.find((p) => p.id === c.id)?.timed)
                  .map((c) => `${c.name} (${fmt(c.timeIn)})`)
                return timedNames.length > 0 ? (
                  <p className="text-muted" style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, margin: '0 0 12px' }}>
                    Book ahead: {timedNames.join(' · ')}
                  </p>
                ) : null
              })()}
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 13.5, lineHeight: 1.65, margin: '0 0 20px' }}>
                Every choice above forked the rest of the day — a longer stop or a hop across the river would have closed off everything
                downstream. View it as a seamless day, or start over and feel how a different first move reshapes the whole thing.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <Link to={`/${city.id}/day/${dayIdx + 1}`} viewTransition className="btn btn-primary">
                  View this day
                </Link>
                <button className="btn btn-secondary" onClick={() => resetDay(dayIdx)}>
                  Start over
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <p className="text-muted" style={{ maxWidth: 620, fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: 1.7, margin: '28px 0 0' }}>
        Travel times between two places I've both photographed are <span style={{ color: 'var(--color-accent-700)' }}>measured</span> from the
        archive; anywhere else they're estimated. Commit a full path and it renders as a seamless day.
      </p>
    </Page>
  )
}
