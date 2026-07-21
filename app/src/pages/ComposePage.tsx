import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DateRangePicker } from '../components/DateRangePicker'
import { HeroPhoto } from '../components/HeroPhoto'
import { Page } from '../components/Layout'
import { CheckIcon } from '../components/icons'
import type { Pace } from '../cities/types'
import { generatePlan, PLAN_PRESETS, type GeneratedPlan } from '../lib/plan-presets'
import { stayLoc } from '../lib/planner'
import { useCity } from '../state/CityContext'
import { useTrip } from '../state/TripContext'

const PACES: { key: Pace; label: string }[] = [
  { key: 'gentle', label: 'Gentle' },
  { key: 'balanced', label: 'Balanced' },
  { key: 'full', label: 'Full' },
]

const pretty = (v: string) =>
  v ? new Date(v + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : ''


export function ComposePage() {
  const city = useCity()
  const { trip, update, dayCount } = useTrip()
  const navigate = useNavigate()
  const [choosing, setChoosing] = useState<string | null>(null)
  const [editing, setEditing] = useState<1 | 2 | null>(null)
  const selectedId = trip.planId

  // Until a plan is chosen or days are built, compose starts fresh each visit —
  // half-entered answers don't survive as phantom "defaults".
  useEffect(() => {
    const committed = trip.planId !== null || trip.days.some((d) => d.committed.length > 0)
    if (!committed && (trip.arriving || trip.departing || trip.stayHood || trip.interests.length > 0)) {
      update({ arriving: '', departing: '', stayHood: '', interests: [] })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Plans regenerate live as the form changes — same engine as the builder.
  // Real dates matter now: closures (Louvre Tue, Orsay Mon) prune the days.
  const planSeed = trip.planSeed ?? 0
  const plans = useMemo(
    () =>
      PLAN_PRESETS.map((p) =>
        generatePlan(city, p, dayCount, trip.pace, stayLoc(city, trip.stayHood), trip.arriving, trip.interests, planSeed),
      ),
    [city, dayCount, trip.pace, trip.stayHood, trip.arriving, trip.interests, planSeed],
  )

  const month = trip.arriving
    ? new Date(trip.arriving + 'T12:00:00').toLocaleDateString('en-US', { month: 'long' })
    : ''
  const where = `${dayCount} ${dayCount === 1 ? 'day' : 'days'} in ${city.name} in ${month}`
  const dayCountNote =
    dayCount <= 3
      ? `${where} — short and sweet. We'll keep it to the heart of things.`
      : dayCount === 4
        ? `${where} — the classic first trip.`
        : dayCount === 5
          ? `${where} — lovely. Enough room for Orsay and a slow Left Bank day.`
          : dayCount === 6
            ? `${where} — now we're talking. Versailles makes the cut (or a day of pure neighborhoods).`
            : `${where} — delightful. We'll leave the last day open.`

  // Progressive reveal: dates → preferences → plans.
  const datesSet =
    !!trip.arriving && !!trip.departing && Date.parse(trip.departing + 'T12:00:00') > Date.parse(trip.arriving + 'T12:00:00')
  const staySet = datesSet && !!trip.stayHood

  const stage1Open = !datesSet || editing === 1
  const stage2Open = datesSet && (!staySet || editing === 2)

  const choose = (plan: GeneratedPlan) => {
    if (choosing) return
    const builtStops = trip.days.reduce((a, d) => a + d.committed.length, 0)
    if (trip.planId !== plan.preset.id && builtStops > 0) {
      const ok = window.confirm('This replaces the days currently on your trip (including any you built yourself). Continue?')
      if (!ok) return
    }
    update({ planId: plan.preset.id, days: plan.days, dayPurposes: plan.purposes })
    const go = () => navigate(`/${city.id}/day/1`, { viewTransition: true })
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      go()
      return
    }
    setChoosing(plan.preset.id)
    window.setTimeout(go, 450)
  }

  return (
    <Page>
      {/* Same grid geometry as the landing hero, so the shared photo plate
          stays pinned while the left column swaps copy for the form. */}
      <div
        className="hero-grid"
        style={{ display: 'grid', gridTemplateColumns: '1fr 460px', gap: 64, alignItems: 'start', padding: '24px 0 24px' }}
      >
        <div style={{ maxWidth: 640 }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--color-accent)' }}>
            Plan a visit
          </div>
          <h1 style={{ fontSize: 30, fontWeight: 400, margin: '6px 0 16px', viewTransitionName: 'page-title', maxWidth: 560 }}>
            Tell me about the trip. When do you arrive to {city.name}?
          </h1>

          {/* Stage 1 — dates: open form folds into a one-line summary once answered. */}
          <div className={`fold ${stage1Open ? '' : 'fold-closed'}`}>
            <div className="fold-inner">
              <div style={{ paddingBottom: 4 }}>
                <DateRangePicker
                  arriving={trip.arriving}
                  departing={trip.departing}
                  onChange={(range) => {
                    update(range)
                    if (range.arriving && range.departing) setEditing(null)
                  }}
                />
                {datesSet && (
                  <div className="deal-in text-muted" style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, marginTop: 8 }}>
                    {dayCountNote}
                  </div>
                )}
              </div>
            </div>
          </div>
          {!stage1Open && (
            <button type="button" className="wiz-summary deal-in" onClick={() => setEditing(1)}>
              <span className="wiz-label">Dates</span>
              <span>
                {pretty(trip.arriving)} → {pretty(trip.departing)}
                <span className="text-muted" style={{ fontVariantNumeric: 'tabular-nums' }}> · {dayCount} days</span>
              </span>
              <span className="wiz-edit">edit</span>
            </button>
          )}

          {/* Stage 2 — where you're staying + pace; folds to a summary too. */}
          {datesSet && (
            <>
              <div className={`fold ${stage2Open ? '' : 'fold-closed'}`}>
                <div className="fold-inner">
                  <div className="deal-in" style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 20, alignItems: 'end', padding: '18px 0 6px' }}>
                    <div className="field">
                      <label>Staying in</label>
                      <select
                        className="input"
                        value={trip.stayHood}
                        onChange={(e) => {
                          update({ stayHood: e.target.value })
                          setEditing(null)
                        }}
                      >
                        <option value="" disabled>
                          Choose a neighborhood…
                        </option>
                        {city.hoodOrder.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label>Pace</label>
                      <div className="seg" role="group">
                        {PACES.map((p) => (
                          <label key={p.key} className="seg-opt">
                            <input type="radio" name="pace" checked={trip.pace === p.key} onChange={() => update({ pace: p.key })} />
                            {p.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {!stage2Open && (
                <button type="button" className="wiz-summary deal-in" onClick={() => setEditing(2)}>
                  <span className="wiz-label">Staying</span>
                  <span>
                    {trip.stayHood}
                    <span className="text-muted" style={{ textTransform: 'capitalize' }}> · {trip.pace}</span>
                  </span>
                  <span className="wiz-edit">edit</span>
                </button>
              )}
            </>
          )}

          {/* Stage 3 — the plans, once the trip has a home base. */}
          {staySet && (
            <div className="deal-in">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, margin: '20px 0 10px', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: 22, fontWeight: 400, margin: 0 }}>Choose a plan</h2>
            <span className="text-muted" style={{ fontSize: 12.5 }}>
              composed from the archive as you type
            </span>
            <button
              className="btn btn-secondary"
              style={{ marginLeft: 'auto', fontSize: 12.5, padding: '5px 14px' }}
              onClick={() => update({ planSeed: planSeed + 1 })}
              title="Same dates, different picks — reshuffles which stops each plan favors"
            >
              Shuffle the plans
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {plans.map((plan, i) => {
              const selected = plan.preset.id === selectedId
              return (
                <div
                  key={plan.preset.id}
                  className={`deal-in ${selected ? 'card elev-sm' : 'card'}`}
                  style={{
                    padding: '10px 16px',
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: 14,
                    alignItems: 'center',
                    animationDelay: `${i * 60}ms`,
                    ...(selected || choosing === plan.preset.id ? { borderColor: 'var(--color-accent)', borderWidth: 1.5 } : {}),
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <span className="card-kicker">{plan.preset.kicker}</span>
                      {selected && <CheckIcon size={11} strokeWidth={2.6} stroke="var(--color-accent)" />}
                    </div>
                    <div className="card-title" style={{ fontSize: 16, margin: '1px 0 0' }}>
                      {plan.preset.title}
                    </div>
                  </div>
                  <button className={selected ? 'btn btn-primary' : 'btn btn-secondary'} style={{ fontSize: 12 }} onClick={() => choose(plan)}>
                    {choosing === plan.preset.id ? 'Laying out…' : `View ${dayCount} day trip`}
                  </button>
                </div>
              )
            })}
          </div>
          <p className="text-muted" style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, margin: '14px 0 0' }}>
            Or skip the presets and{' '}
            <button className="linklike" style={{ fontSize: 12.5 }} onClick={() => navigate(`/${city.id}/build`, { viewTransition: true })}>
              build each day yourself
            </button>{' '}
            — one next move at a time.
          </p>
            </div>
          )}
        </div>
        <div style={{ position: 'sticky', top: 78, alignSelf: 'start' }}>
          <HeroPhoto
            src="paris-bridge-tables.jpeg"
            objectPosition="center"
            height="clamp(420px, calc(100vh - 180px), 640px)"
            caption="Lunch tables above the Seine, Île Saint-Louis"
          />
        </div>
      </div>
    </Page>
  )
}
