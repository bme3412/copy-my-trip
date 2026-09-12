import { plannedDays, PLANNER_VERSION } from '../lib/trips/schema'
import { catalogVersion } from '../lib/trips/snapshot'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DateRangePicker } from '../components/DateRangePicker'
import { HeroPhoto } from '../components/HeroPhoto'
import { Page } from '../components/Layout'
import { CheckIcon } from '../components/icons'
import type { Pace } from '../cities/types'
import { generatePlan, PLAN_PRESETS, type GeneratedPlan } from '../lib/plan-presets'
import { aiAvailable } from '../lib/ai-availability'
import { extractPreferences } from '../lib/extract'
import { stayLoc } from '../lib/planner'
import type { City } from '../cities/types'
import { useCity } from '../state/CityContext'
import { useTrip } from '../state/TripContext'

const PACES: { key: Pace; label: string }[] = [
  { key: 'gentle', label: 'Gentle' },
  { key: 'balanced', label: 'Balanced' },
  { key: 'full', label: 'Full' },
]

const pretty = (v: string) =>
  v ? new Date(v + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : ''

/** The stops this plan is really about — judged by the preset's own idea of
 * what belongs in its shop window, so "Food & markets" leads with the tables,
 * not the same anchors every other plan visits. Deduped, coffee left out. */
function planHighlights(city: City, plan: GeneratedPlan) {
  const byId = new Map(city.places.map((p) => [p.id, p]))
  const stops = plan.days.flatMap((d) => d.committed).filter((c) => c.meal !== 'coffee')
  const uniq = [...new Map(stops.map((s) => [s.id, s])).values()]
  const tier = (s: (typeof uniq)[number]) => {
    const p = byId.get(s.id)
    if (p && plan.preset.highlight?.(p)) return 0
    if (p?.role === 'anchor' || p?.dayTrip) return 1
    if (p?.rank === 1) return 2
    return s.src === 'verified' ? 3 : 4
  }
  return uniq
    .map((s, i) => ({ s, i }))
    .sort((a, b) => tier(a.s) - tier(b.s) || a.i - b.i)
    .slice(0, 8)
    .map(({ s }) => ({ id: s.id, name: s.name, verified: s.src === 'verified' }))
}


export function ComposePage() {
  const city = useCity()
  const { trip, update, dayCount } = useTrip()
  const navigate = useNavigate()
  const [choosing, setChoosing] = useState<string | null>(null)
  const [editing, setEditing] = useState<1 | 2 | null>(null)
  // The style rotor: three cards visible, the rest a wheel-turn away.
  const [rotorAt, setRotorAt] = useState(0)
  const rotorRef = useRef<HTMLDivElement | null>(null)
  const lastTurn = useRef(0)
  const [briefDraft, setBriefDraft] = useState(trip.brief ?? '')
  const [briefOpen, setBriefOpen] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const briefFocused = useRef(false)
  const lastTried = useRef<string | null>(null)
  const selectedId = trip.planId

  // The brief reads itself: no button. Debounced while typing, immediate on
  // blur; failures are silent (no API locally just means no extraction) and
  // each text is tried once. Results are stored, so plans regenerate
  // deterministically without another call.
  const runExtract = async (text: string) => {
    const trimmed = text.trim()
    if (!aiAvailable) { if (trimmed !== trip.brief) update({ brief: trimmed, extracted: undefined }); return }
    if (extracting || trimmed.length < 12 || trimmed === trip.brief || lastTried.current === trimmed) return
    lastTried.current = trimmed
    setExtracting(true)
    try {
      const extracted = await extractPreferences(trimmed, city)
      update({
        brief: trimmed,
        extracted,
        interests: extracted.interests,
        ...(extracted.pace ? { pace: extracted.pace } : {}),
      })
      if (!briefFocused.current) setBriefOpen(false)
    } catch (err) {
      // Quiet in the UI — the itinerary works without the reading — but
      // visible in the console so a missing API isn't a mystery in dev.
      console.warn('[brief] extraction skipped:', err instanceof Error ? err.message : err)
    } finally {
      setExtracting(false)
    }
  }
  useEffect(() => {
    const t = window.setTimeout(() => runExtract(briefDraft), 1400)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [briefDraft])

  // Plans regenerate live as the form changes — same engine as the builder.
  // Real dates matter now: closures (Louvre Tue, Orsay Mon) prune the days.
  const planSeed = trip.planSeed ?? 0
  const plans = useMemo(
    () =>
      PLAN_PRESETS.map((p) =>
        generatePlan(
          city, p, dayCount, trip.pace, stayLoc(city, trip.stayHood), trip.arriving, trip.interests,
          planSeed, trip.extracted?.themeWeights, trip.extracted?.requests,
        ),
      ),
    [city, dayCount, trip.pace, trip.stayHood, trip.arriving, trip.interests, planSeed, trip.extracted],
  )

  const turn = (d: number) => setRotorAt((o) => (o + d + PLAN_PRESETS.length) % PLAN_PRESETS.length)

  // Wheel over the stack turns the rotor instead of scrolling the page —
  // registered natively because React's onWheel can't preventDefault.
  useEffect(() => {
    const el = rotorRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const now = performance.now()
      if (now - lastTurn.current < 350 || Math.abs(e.deltaY) < 8) return
      lastTurn.current = now
      setRotorAt((o) => (o + (e.deltaY > 0 ? 1 : -1) + PLAN_PRESETS.length) % PLAN_PRESETS.length)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  })

  const month = trip.arriving
    ? new Date(trip.arriving + 'T12:00:00').toLocaleDateString('en-US', { month: 'long' })
    : ''
  const where = `${dayCount} ${dayCount === 1 ? 'day' : 'days'} in ${city.name} in ${month}`
  const dayCountNote = city.id !== 'paris' ? `${where} — composed from this city’s researched catalog.` :
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
    plannedDays(trip) > 0
  const staySet = datesSet && !!trip.stayHood

  const stage1Open = !datesSet || editing === 1
  const stage2Open = datesSet && (!staySet || editing === 2)

  // Only hand-built days need protecting — switching between presets is free.
  const guardHandBuilt = () => {
    const builtStops = trip.days.reduce((a, d) => a + d.committed.length, 0)
    if ((trip.edited || trip.planId === null) && builtStops > 0) {
      return window.confirm('This replaces the days you built yourself. Continue?')
    }
    return true
  }

  /** Clicking a card makes it the active plan — no navigation. */
  const select = (plan: GeneratedPlan) => {
    if (choosing || plan.preset.id === selectedId) return
    if (!guardHandBuilt()) return
    update({ planId: plan.preset.id, originPresetId: plan.preset.id, scheduledFor: { arriving: trip.arriving, departing: trip.departing, stayHood: trip.stayHood }, edited: false, demo: false, unplaced: plan.unplaced, days: plan.days, dayPurposes: plan.purposes, dayPaces: plan.paces, dayContexts: plan.contexts, dayNarrations: {}, release: { planner: PLANNER_VERSION, catalog: catalogVersion(city) } })
  }

  /** The card's button applies the plan and goes to day 1. */
  const choose = (plan: GeneratedPlan) => {
    if (choosing || !plannedDays(trip)) return
    if ((trip.edited || plan.preset.id !== selectedId) && !guardHandBuilt()) return
    update({ planId: plan.preset.id, originPresetId: plan.preset.id, scheduledFor: { arriving: trip.arriving, departing: trip.departing, stayHood: trip.stayHood }, edited: false, demo: false, unplaced: plan.unplaced, days: plan.days, dayPurposes: plan.purposes, dayPaces: plan.paces, dayContexts: plan.contexts, dayNarrations: {}, release: { planner: PLANNER_VERSION, catalog: catalogVersion(city) } })
    const go = () => navigate(`/${city.id}/itinerary/1`, { viewTransition: true })
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      go()
      return
    }
    setChoosing(plan.preset.id)
    window.setTimeout(go, 450)
  }

  return (
    <Page>
      {trip.arriving && trip.departing && !datesSet && <p role="alert">Choose 1–7 planned days. The departure date is checkout and is not a planned day.</p>}
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

          {/* Stage 2½ — the brief (optional): free text in, engine inputs out.
              The LLM interprets; the deterministic planner still schedules.
              Folds to a one-line summary like the other stages. */}
          {staySet && !briefOpen && (
            <button type="button" className="wiz-summary deal-in" onClick={() => setBriefOpen(true)}>
              <span className="wiz-label">Brief</span>
              <span className={trip.extracted ? undefined : 'text-muted'} style={{ fontStyle: trip.extracted ? 'italic' : undefined }}>
                {trip.extracted ? trip.extracted.summary : 'in your own words — optional'}
              </span>
              <span className="wiz-edit">{trip.extracted ? 'edit' : 'add'}</span>
            </button>
          )}
          {staySet && briefOpen && (
            <div className="deal-in" style={{ margin: '18px 0 4px' }}>
              <div className="field">
                <label>In your own words — what kind of trip? (optional)</label>
                <textarea
                  className="input"
                  rows={2}
                  placeholder="e.g. We love food and wandering neighborhoods; save the Seine cruise for the last night. Not into big crowded monuments."
                  value={briefDraft}
                  onChange={(e) => setBriefDraft(e.target.value)}
                  onFocus={() => (briefFocused.current = true)}
                  onBlur={() => {
                    briefFocused.current = false
                    runExtract(briefDraft)
                  }}
                  style={{ resize: 'vertical', fontFamily: 'var(--font-body)', fontSize: 13.5, lineHeight: 1.55 }}
                />
              </div>
              {!aiAvailable && <p className="text-muted">Your note is saved with the trip. Automatic interpretation is unavailable; use the interests and pace controls to shape your itinerary.</p>}
              {extracting && (
                <p className="text-muted" style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontStyle: 'italic', margin: '8px 0 0' }}>
                  reading…
                </p>
              )}
              {trip.extracted && !extracting && (
                <div className="deal-in" style={{ marginTop: 10 }}>
                  <p className="text-muted" style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontStyle: 'italic', margin: '0 0 8px' }}>
                    {trip.extracted.summary}
                  </p>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: 11 }}>
                    {trip.extracted.interests.map((i) => (
                      <span key={i} className="tag tag-accent">{i}</span>
                    ))}
                    {Object.entries(trip.extracted.themeWeights).map(([th, w]) => (
                      <span key={th} className={w > 0 ? 'tag tag-outline' : 'tag tag-neutral'}>
                        {w > 0 ? '+' : '−'} {th}
                      </span>
                    ))}
                    {trip.extracted.requests.map((r) => {
                      const place = city.places.find((p) => p.id === r.placeId)
                      if (!place) return null
                      const when = [r.day === 'first' ? 'first day' : r.day === 'last' ? 'last day' : typeof r.day === 'number' ? `day ${r.day}` : '', r.slot ?? '']
                        .filter(Boolean)
                        .join(' ')
                      return (
                        <span key={`${r.placeId}-${r.kind}`} className="tag tag-accent-2">
                          {r.kind === 'avoid' ? `skip ${place.name}` : `${place.name}${when ? ` · ${when}` : ''}`}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Stage 3 — the plans, once the trip has a home base. */}
          {staySet && (
            <div className="deal-in" style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, margin: '0 0 8px' }}>
            <span className="text-muted" style={{ fontFamily: 'var(--font-heading)', fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase' }}>
              Trip styles
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="text-muted" style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontVariantNumeric: 'tabular-nums' }}>
                {plans.length} styles · scroll to turn
              </span>
              <button type="button" className="rotor-btn" aria-label="Previous styles" onClick={() => turn(-1)}>
                ‹
              </button>
              <button type="button" className="rotor-btn" aria-label="More styles" onClick={() => turn(1)}>
                ›
              </button>
            </div>
          </div>
          <div ref={rotorRef} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Array.from({ length: Math.min(3, plans.length) }, (_, k) => plans[(rotorAt + k) % plans.length]).map((plan, i) => {
              const selected = plan.preset.id === selectedId
              const detail = selected ? planHighlights(city, plan) : []
              return (
                <div
                  key={plan.preset.id}
                  className={`deal-in ${selected ? 'card elev-sm' : 'card'}`}
                  onClick={() => select(plan)}
                  style={{
                    padding: '10px 16px',
                    animationDelay: `${i * 60}ms`,
                    cursor: selected ? 'default' : 'pointer',
                    ...(selected || choosing === plan.preset.id ? { borderColor: 'var(--color-accent)', borderWidth: 1.5 } : {}),
                  }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 14, alignItems: 'center' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                        <span className="card-kicker">{plan.preset.kicker}</span>
                        {selected && <CheckIcon size={11} strokeWidth={2.6} stroke="var(--color-accent)" />}
                      </div>
                      <div className="card-title" style={{ fontSize: 16, margin: '1px 0 0' }}>
                        {plan.preset.title}
                      </div>
                      {plan.unplaced.length > 0 && (
                        <p className="text-muted" style={{ fontFamily: 'var(--font-body)', fontSize: 12, margin: '3px 0 0' }}>
                          Couldn't fit{' '}
                          {plan.unplaced
                            .map((u) => city.places.find((p) => p.id === u.placeId)?.name)
                            .filter(Boolean)
                            .join(' or ')}{' '}
                          — {plan.unplaced[0].reason}.
                        </p>
                      )}
                    </div>
                    <button
                      className={selected ? 'btn btn-primary' : 'btn btn-secondary'}
                      style={{ fontSize: 12 }}
                      onClick={(e) => {
                        e.stopPropagation()
                        choose(plan)
                      }}
                    >
                      {choosing === plan.preset.id ? 'Laying out…' : `View ${dayCount} day trip`}
                    </button>
                  </div>

                  {/* The chosen card opens a line further: what these days focus on. */}
                  <div className={`fold ${selected ? '' : 'fold-closed'}`}>
                    <div className="fold-inner">
                      {selected && (
                        <div
                          style={{
                            padding: '10px 0 4px',
                            maxWidth: 560,
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '5px 24px',
                          }}
                        >
                          {detail.map((h) => (
                            <div key={h.id} style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontFamily: 'var(--font-body)', fontSize: 13.5, lineHeight: 1.45 }}>
                              <span
                                style={{
                                  flex: 'none',
                                  width: 8,
                                  height: 8,
                                  borderRadius: '50%',
                                  ...(h.verified
                                    ? { background: 'var(--color-accent)' }
                                    : { background: 'var(--color-bg)', border: '1.5px solid var(--color-neutral-400)' }),
                                }}
                              />
                              {h.name}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          <p className="text-muted" style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, margin: '14px 0 0' }}>
            Or skip the presets and{' '}
            <button className="linklike" style={{ fontSize: 12.5 }} onClick={() => navigate(`/${city.id}/itinerary/1`, { viewTransition: true })}>
              build each day yourself
            </button>{' '}
            — one next move at a time, right on the itinerary.
          </p>
            </div>
          )}
        </div>
        <div style={{ position: 'sticky', top: 78, alignSelf: 'start' }}>
          {city.id === 'paris' ? <HeroPhoto
            src="paris-bridge-tables.jpeg"
            objectPosition="center"
            height="clamp(420px, calc(100vh - 180px), 640px)"
            caption="Lunch tables above the Seine, Île Saint-Louis"
          /> : <div className="companion-panel"><h2>Researched places in {city.name}</h2><p>This city has no firsthand archive imagery yet.</p></div>}
        </div>
      </div>
    </Page>
  )
}
