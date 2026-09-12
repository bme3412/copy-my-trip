import { catalogVersion } from '../lib/trips/snapshot'
import { useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import type { DayStop, Pace } from '../cities/types'
import type { CandidateImpact } from '../components/CandidateCard'
import { DayTimeline } from '../components/DayTimeline'
import { FanIcon, InfoIcon, TicketIcon } from '../components/icons'
import { Page } from '../components/Layout'
import { ReconsiderDeck } from '../components/ReconsiderDeck'
import { DayMapPanel } from '../components/DayMapPanel'
import { builtDayStops, builtDayTitle, builtDayVerifiedLabel } from '../lib/built-day'
import { dayPlanContext, PLAN_PRESETS, restoreDayContext } from '../lib/plan-presets'
import { buildDayFacts, dayContentKey, ensureNarration, narrationResult, narrationUnavailable, onNarrationChunk } from '../lib/narrate'
import { em } from '../lib/text'
import {
  alternativesAt,
  buildCandidates,
  commitCandidate,
  dayDate,
  dayWeekday,
  effectiveHours,
  fmt,
  insertionSuggestions,
  isDayDone,
  removeAt,
  replayFrom,
  replayDay,
  PACE,
  ENGINE,
  replaySequence,
  stayLoc,
  stopPlace,
  tripThemes,
  truncateDay,
  type Candidate,
  type DayState,
  type ReplayResult,
  type StopFlag,
} from '../lib/planner'
import { useCity } from '../state/CityContext'
import { useTrip } from '../state/TripContext'

// Provided via app/.env.local — without it the schematic RouteMap stands in.
const MAPBOX_TOKEN: string | undefined = import.meta.env ? import.meta.env.VITE_MAPBOX_TOKEN : undefined

const PACE_LABELS: { key: Pace; label: string }[] = [
  { key: 'gentle', label: 'Gentle' },
  { key: 'balanced', label: 'Balanced' },
  { key: 'full', label: 'Full' },
]

type Slot = number | 'append'

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** Honest deltas for one alternative: what the swap does to the rest of the
 * day — the changed next leg, the shifted end, the count of broken stops. */
function impactOf(old: DayState, k: number, r: ReplayResult): CandidateImpact {
  const parts: string[] = []
  const oldNext = old.committed[k + 1]
  const newNext = r.day.committed[k + 1]
  if (oldNext && newNext) {
    const changed = oldNext.travelMin !== newNext.travelMin || oldNext.travelMode !== newNext.travelMode
    parts.push(`next leg ${newNext.travelMin} min ${newNext.travelMode}${changed ? ` (was ${oldNext.travelMin} min ${oldNext.travelMode})` : ''}`)
  }
  const endOf = (d: DayState) => {
    const l = d.committed[d.committed.length - 1]
    return l ? l.timeIn + l.dur : 0
  }
  const delta = Math.round(endOf(r.day) - endOf(old))
  parts.push(`day ends ${fmt(endOf(r.day))}${delta !== 0 ? ` (${delta > 0 ? '+' : ''}${delta} min)` : ''}`)
  return { line: parts.join(' · '), broken: new Set(r.flags.map((f) => f.index)).size }
}

export function ItineraryPage() {
  const { n } = useParams()
  const { hash } = useLocation()
  const city = useCity()
  const { trip, update, resetDay, setDayNarration, dayCount, accept, editable } = useTrip()

  const navigate = useNavigate()
  const [saveError, setSaveError] = useState('')
  const [narrationRequested, setNarrationRequested] = useState(false)

  // Arriving from the archive: scroll to the linked stop and flash it.
  useEffect(() => {
    if (!hash || hash === '#day-route-map' || hash === '#itinerary-top') return
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
  const dayIdx = num - 1
  const day = trip.days[dayIdx]
  const isBuilt = day.committed.length > 0
  // Days beyond the curated four exist only once generated or built.
  //
  // And before a trip exists at all, none of them do: the curator's days are
  // the raw material generation reads, not a plan anyone was handed. Serving
  // one on a cold load is the app claiming to have composed something for a
  // traveler it knows nothing about. No dates, no itinerary — compose first.
  const curated = !trip.release && trip.arriving ? (city.curatedDays[dayIdx] as (typeof city.curatedDays)[number] | undefined) : undefined
  const stay = useMemo(() => stayLoc(city, trip.stayHood), [city, trip.stayHood])
  const stayName = trip.stayHood || city.hoodOrder[0]
  const date = trip.arriving ? dayDate(trip.arriving, dayIdx) : undefined
  const weekday = trip.arriving ? dayWeekday(trip.arriving, dayIdx) : undefined

  // The builder, folded in: which slot's deck is open, what the last edit
  // changed, and what the last replay flagged. All reset when the day changes.
  const [openSlot, setOpenSlot] = useState<Slot | null>(null)
  const [scratch, setScratch] = useState(false)
  const flags: StopFlag[] = day.flags ?? []
  const [hoverCandId, setHoverCandId] = useState<string | null>(null)
  useEffect(() => {
    setOpenSlot(null)
    setScratch(false)
    setNarrationRequested(false)
  }, [dayIdx])

  // A curated day is editable once every stop resolves to a place record.
  const materializable = !!curated && curated.stops.length > 0 && curated.stops.every((s) => s.placeId && city.places.some((p) => p.id === s.placeId))
  const editing = isBuilt || scratch || !curated

  // Trip-wide engine context — the same the standalone builder computed.
  const visited = useMemo(() => {
    const set = new Set<string>()
    trip.days.forEach((d) => d.committed.forEach((c) => set.add(c.id)))
    return set
  }, [trip.days])
  const usedHoods = useMemo(() => {
    const set = new Set<string>()
    trip.days.forEach((d, i) => {
      if (i === dayIdx) return
      const theme = d.committed.find((c) => c.meal !== 'coffee')
      const p = theme && city.places.find((pl) => pl.id === theme.id)
      if (p) set.add(p.hood)
    })
    return set
  }, [city, trip.days, dayIdx])
  // Places committed on OTHER days: a template seed already spent elsewhere
  // resolves this day to its alt, exactly as it did during generation.
  const visitedElsewhere = useMemo(() => {
    const set = new Set<string>()
    trip.days.forEach((d, i) => {
      if (i === dayIdx) return
      d.committed.forEach((c) => set.add(c.id))
    })
    return set
  }, [trip.days, dayIdx])

  // ── The one derivation ──
  // Every edit surface below asks the engine the SAME question generation
  // asked: the brief's avoids and pins, the interest and theme weights, and
  // this day's template caps. Rebuilding these by hand is how the decks
  // drifted into re-offering what the generator forbade.
  const ctx = useMemo(
    () =>
      trip.dayContexts?.[dayIdx] ? restoreDayContext(trip.dayContexts[dayIdx]) : dayPlanContext(city, dayIdx, {
        dayCount,
        preset: PLAN_PRESETS.find((p) => p.id === (trip.originPresetId ?? trip.planId)) ?? null,
        travelerPace: trip.pace,
        stay,
        arriving: trip.arriving || undefined,
        interests: trip.interests,
        interestWeights: trip.extracted?.themeWeights,
        requests: trip.extracted?.requests,
        visitedElsewhere,
        usedHoods,
      }),
    [city, dayIdx, dayCount, trip.dayContexts, trip.originPresetId, trip.planId, trip.pace, stay, trip.arriving, trip.interests, trip.extracted, visitedElsewhere, usedHoods],
  )
  // Edit at the pace the day was BUILT at — the stored plan pace, else the
  // resolved template's. Re-timing a day at today's slider rewrites durations
  // the traveler never asked to change.
  const pace = trip.dayPaces?.[dayIdx] ?? ctx.pace
  const engineOpts = { ...ctx.opts, date, weekday, usedHoods, limit: undefined }
  const maxStops = ctx.profile.maxStops

  // A composed trip never falls back to the curator's stock day: an empty day
  // materializes the curated sequence through the engine — re-timed for this
  // trip's dates and at the day's own pace — so what renders is always the
  // traveler's own day. The pace it materialized at is recorded with the trip,
  // so later edits re-time against it rather than the current slider.
  useEffect(() => {
    if (!editable || trip.release || !trip.arriving || isBuilt || scratch || !curated || !materializable) return
    const r = replaySequence(
      city,
      curated.stops.map((s) => ({ placeId: s.placeId! })),
      pace,
      stay,
      { date, weekday },
    )
    if (r.day.committed.length === 0) return
    const dayPaces = [...(trip.dayPaces ?? [])]
    dayPaces[dayIdx] = pace
    update({ days: trip.days.map((x, i) => (i === dayIdx ? { ...r.day, flags: r.flags } : x)), dayPaces })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip.arriving, isBuilt, scratch, curated, materializable, dayIdx, pace])

  // Editing a day makes the plan yours — compose then guards it like any
  // hand-built work instead of silently replacing it with a preset.
  const commitDay = (d: DayState, dayFlags: StopFlag[]) => {
    if (!editable) return
    update({ days: trip.days.map((x, i) => (i === dayIdx ? { ...d, flags: dayFlags } : x)), edited: true, originPresetId: trip.originPresetId ?? trip.planId ?? undefined })
  }

  const appendCands = useMemo(() => {
    if (!editing) return []
    const covered = tripThemes(city, trip.days)
    return buildCandidates(city, day, pace, visited, { ...engineOpts, covered })
  }, [editing, city, trip.days, day, pace, visited, engineOpts])
  const done = editing && isBuilt && isDayDone(day, pace, appendCands, maxStops)

  // The open deck: candidates for the slot, plus a pre-flighted replay per
  // alternative so every card can say what it does to the rest of the day.
  const deck = useMemo(() => {
    if (openSlot === null || !editing) return null
    if (openSlot === 'append') return { cands: appendCands, replays: undefined, prefix: day, incumbent: undefined }
    const incumbent = day.committed[openSlot]
    if (!incumbent) return null
    const covered = tripThemes(
      city,
      trip.days.map((d, i) => (i === dayIdx ? { ...d, committed: d.committed.filter((_, j) => j !== openSlot) } : d)),
    )
    const cands = alternativesAt(city, day, openSlot, pace, visited, stay, { ...engineOpts, covered })
    const replays = cands.map((c) => replayFrom(city, day, openSlot, c, pace, stay, engineOpts))
    return { cands, replays, prefix: truncateDay(city, day, openSlot, pace, stay), incumbent }
  }, [openSlot, editing, appendCands, city, trip.days, dayIdx, day, pace, visited, stay, weekday, date, engineOpts])

  const choose = (c: Candidate) => {
    if (openSlot === null || !deck) return
    if (openSlot === 'append') {
      commitDay({ ...day, ...commitCandidate(day, c) }, flags)
      return // the deck stays open — building continues until the day is done
    }
    const i = deck.cands.indexOf(c)
    const r = deck.replays?.[i]
    if (!r) return
    commitDay(r.day, r.flags)
    setOpenSlot(null)
  }

  // Reconsidering a curated stop forks the day first: the curator's sequence,
  // re-scheduled for this trip's dates and pace. "Restore" brings it back.
  const reconsider = (i: number) => {
    if (!editing) {
      if (!curated || !materializable) return
      const r = replaySequence(
        city,
        curated.stops.map((s) => ({ placeId: s.placeId! })),
        pace,
        stay,
        { date, weekday },
      )
      commitDay(r.day, r.flags)
      setOpenSlot(i)
      return
    }
    setOpenSlot(openSlot === i ? null : i)
  }

  // Remove-and-retime: the legs close up around the gap; breaks get flagged.
  const removeStop = (i: number) => {
    const r = removeAt(city, day, i, pace, stay, engineOpts)
    commitDay(r.day, r.flags)
    setOpenSlot(null)
  }

  const startOver = () => {
    resetDay(dayIdx)
    setOpenSlot(null)
    setScratch(false)
    setNarrationRequested(false)
  }

  const rawStops = editing ? builtDayStops(city, day) : (curated?.stops ?? [])
  // Enrich every stop from its place record: the anchor chip, the timed-slot
  // note, the booking callout (entry.json facts) — and any replay flags.
  const stops = rawStops.map((s, i) => {
    let out: DayStop = s
    const ref = editing ? day.committed[i] : s.placeId ? { id: s.placeId } : null
    const v = ref ? stopPlace(city, ref) : undefined
    if (v) {
      const extra: Partial<DayStop> = {}
      if (v.role === 'anchor') extra.tag = `Anchor · the day's one ${v.label.split('·')[0].trim().toLowerCase()}`
      if (v.timed) {
        if (!out.timeNote) extra.timeNote = 'suggested entry · not booked'
        const entry = city.entry[v.id]
        if (entry) {
          let site: string | undefined
          if (entry.url) {
            try {
              site = new URL(entry.url).host.replace(/^www\./, '')
            } catch {
              /* malformed url in data — the cost line stands alone */
            }
          }
          // The date-aware line is computed, never claimed: real hours for the
          // trip's weekday, plus the scheduled slot when the day is built.
          let dateLine: string | undefined
          if (date && weekday !== undefined) {
            const hrs = effectiveHours(v, date, weekday)
            if (hrs) {
              const timeIn = editing ? day.committed[i]?.timeIn : undefined
              const slotBit =
                timeIn !== undefined
                  ? timeIn <= hrs[0] * 60 + 45
                    ? `, so take the ${fmt(hrs[0] * 60)} opening`
                    : ` — suggested slot: ${fmt(timeIn)}`
                  : ''
              dateLine = `on a ${WEEKDAYS[weekday]} it closes at ${fmt(hrs[1] * 60)}${slotBit}`
            }
          }
          const note = [dateLine, entry.note || undefined].filter(Boolean).join('. ') || undefined
          extra.booking = { cost: entry.cost, url: entry.url ?? undefined, needed: entry.needed, note, site, rates: entry.rates, offerings: entry.offerings, asOf: entry.asOf }
        }
      }
      if (Object.keys(extra).length > 0) out = { ...out, ...extra }
    }
    const notes = flags.filter((f) => f.index === i).map((f) => f.note)
    return notes.length ? { ...out, flagNote: notes.join(' · ') } : out
  })

  // "Something missing?" — clean insertions nearby, best position pre-solved.
  const suggestions = useMemo(
    () =>
      editing && isBuilt
        ? insertionSuggestions(city, day, pace, visited, stay, {
            date,
            weekday,
            exclude: engineOpts.exclude,
            blockAnchors: engineOpts.blockAnchors,
            blockTimed: engineOpts.blockTimed,
          })
        : [],
    [editing, isBuilt, city, day, pace, visited, stay, date, weekday, engineOpts],
  )
  const title = editing ? builtDayTitle(city, day) : (curated?.title ?? `Day ${num}`)

  // The intro is written by the narrator — no template fallback. The current
  // day narrates first, then the rest of the trip prefetches so every tab
  // arrives pre-written. Cached per day-content in trip state.
  const narrationKeys = useMemo(() => trip.days.map((d, i) => dayContentKey(d, { city: city.id, catalog: catalogVersion(city), date: dayDate(trip.arriving, i), purpose: trip.dayPurposes?.[i], context: trip.dayContexts?.[i] })), [city, trip.days, trip.arriving, trip.dayPurposes, trip.dayContexts])
  const narrationFor = (i: number) => {
    const d = trip.days[i]
    if (d.committed.length === 0) return undefined
    const n = trip.dayNarrations?.[i]
    return n?.key === narrationKeys[i] ? n.text : undefined
  }
  const dayKey = narrationKeys[dayIdx]
  // Trip-state cache first; the module memo backs it up (StrictMode-proof).
  const narrated = narrationFor(dayIdx) ?? narrationResult(dayKey) ?? undefined
  // The current day's paragraph streams in live; `draft` is the text so far.
  const [draft, setDraft] = useState('')
  const failedRef = useRef<Set<string>>(new Set())
  const [, bumpNarration] = useReducer((x: number) => x + 1, 0)
  useEffect(() => {
    if (!narrationRequested || !trip.arriving || narrationUnavailable()) return
    // Fetch ownership lives in lib/narrate (one fetch per content key, shared
    // across StrictMode's double-mounted effects); writes here are idempotent,
    // so there is nothing to cancel and nothing to race.
    ;(async () => {
      const order = [dayIdx]
      for (const i of order) {
        const d = trip.days[i]
        if (d.committed.length === 0) continue
        // A day mid-edit isn't settled — it narrates when the deck closes.
        if (i === dayIdx && openSlot !== null && !done) continue
        const key = narrationKeys[i]
        if (trip.dayNarrations?.[i]?.key === key) continue
        const dDate = dayDate(trip.arriving, i)
        const dWd = dayWeekday(trip.arriving, i)
        if (!dDate || dWd === undefined) continue
        const text = await ensureNarration(key, buildDayFacts(city, d, dDate, dWd, builtDayTitle(city, d), i + 1, trip.dayPurposes?.[i]))
        if (text) {
          setDayNarration(i, { key, text })
        } else {
          failedRef.current.add(key)
          bumpNarration()
        }
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [narrationRequested, trip.days, trip.arriving, dayIdx, dayCount, openSlot, done])
  // Live chunks for the day on screen — resubscribes whenever its content changes.
  useEffect(() => {
    setDraft('')
    if (day.committed.length === 0) return
    return onNarrationChunk(dayKey, setDraft)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayIdx, dayKey])
  // Ghost lines only while a fetch can actually be in flight — never while a
  // deck is open (narration deliberately waits for the day to settle).
  const narrationPending =
    narrationRequested &&
    editing &&
    isBuilt &&
    !narrated &&
    !!trip.arriving &&
    (openSlot === null || done) &&
    !narrationUnavailable() &&
    !failedRef.current.has(dayKey)

  const timedStops = editing
    ? day.committed
        .map((c) => ({ c, v: stopPlace(city, c) }))
        .filter(({ v }) => v?.timed)
        .map(({ c, v }) => ({ name: c.name, time: fmt(c.timeIn), url: (v && city.entry[v.id]?.url) || undefined }))
    : []
  const currentPlace = day.committed.length ? day.committed[day.committed.length - 1].name : `your place in ${stayName}`

  const setLeafDir = (target: number) => {
    document.documentElement.dataset.navDir = target > num ? 'fwd' : 'back'
  }

  // One deck node, aligned into the timeline's grid, mounted either under the
  // reconsidered stop or after the last stop (append).
  const alignDeck = (node: ReactNode) => (
    <div className="stop-grid" style={{ display: 'grid', gridTemplateColumns: '76px 1fr', gap: 28 }}>
      <div className="stop-time-col" />
      <div style={{ borderLeft: '1.5px dashed var(--color-neutral-300)', padding: '0 0 22px 28px' }}>{node}</div>
    </div>
  )
  const deckNode =
    deck && openSlot !== null ? (
      openSlot === 'append' ? (
        <ReconsiderDeck
          kicker="Next stop"
          heading={isBuilt ? 'Choose your next move' : 'Your first move of the day'}
          sub={
            isBuilt
              ? `Three ways forward from ${currentPlace}. You can only take one — its length and location decide what's still reachable after.`
              : `You're at your place in ${stayName} at ${fmt(city.dayStart)}. Every choice sets the clock and the map for the next one.`
          }
          cands={deck.cands}
          keepLabel="Close"
          emptyNote="Nothing left that fits — the day is full."
          onChoose={choose}
          onKeep={() => setOpenSlot(null)}
          hoverId={hoverCandId}
          onHover={setHoverCandId}
        />
      ) : (
        <ReconsiderDeck
          kicker="Reconsider"
          heading={`Other ways from ${deck.prefix.committed.length ? deck.prefix.committed[deck.prefix.committed.length - 1].name : `your place in ${stayName}`} at ${fmt(deck.prefix.clock)}`}
          sub={`Instead of ${deck.incumbent!.name} — each option shows what it does to the rest of the day.`}
          cands={deck.cands}
          impacts={deck.replays?.map((r) => impactOf(day, openSlot as number, r))}
          chooseLabel="Swap it in"
          keepLabel={`Keep ${deck.incumbent!.name}`}
          emptyNote={`Nothing else fits this slot — with the day around it, ${deck.incumbent!.name} is the move here.`}
          onChoose={choose}
          onKeep={() => setOpenSlot(null)}
          hoverId={hoverCandId}
          onHover={setHoverCandId}
        />
      )
    ) : null

  const paceControl = (
        editing ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="text-muted" style={{ fontSize: 10, letterSpacing: '.1em' }}>
              PACE
            </span>
            <div className="seg">
              {PACE_LABELS.map((p) => (
                <button type="button" aria-pressed={pace === p.key} disabled={!editable}
                  key={p.key}
                  className="seg-opt"
                  style={
                    pace === p.key
                      ? { color: 'var(--color-accent)', boxShadow: 'inset 0 0 0 1px var(--color-accent)', cursor: 'pointer' }
                      : { cursor: 'pointer' }
                  }
                  onClick={() => {
                    if (!editable) return
                    const repaced = { ...day, committed: day.committed.map(s => ({ ...s, timing: { notBefore: s.timing?.notBefore ?? s.timeIn, duration: Math.round((stopPlace(city, s)?.dur ?? s.dur) * PACE[p.key].f), linger: ENGINE.linger[p.key] } })) }
                    const result = replayDay(city, repaced, p.key, stay, engineOpts)
                    const dayPaces = [...(trip.dayPaces ?? [])]; dayPaces[dayIdx] = p.key
                    update({ dayPaces, edited: true, days: trip.days.map((d, i) => i === dayIdx ? { ...result.day, flags: result.flags } : d) })
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        ) : undefined

  )
  return (
    <div className="itinerary-workspace" id="itinerary-top">
    <Page
      topBar={
        // No trip, no days to tab between — the count would be the 4-day
        // default standing in for dates nobody has given yet.
        !trip.arriving ? undefined : (
        <div className="day-toolbar"><nav className="day-tabs" aria-label="Itinerary days">
          {Array.from({ length: dayCount }, (_, i) => i + 1).map((d) => (
            <Link
              key={d}
              to={`/${city.id}/itinerary/${d}`}
              viewTransition
              onClick={() => setLeafDir(d)}
              aria-current={d === num ? 'page' : undefined}
              className={d === num ? 'day-tab is-active' : 'day-tab'}
            >
              <span>Day</span> <strong>{d}</strong>
            </Link>
          ))}
        </nav>{paceControl}</div>
        )
      }
      title={title}

    >
      <div className="companion-actions itinerary-actions">
        {isBuilt && <button className="btn btn-primary" disabled={!editable} onClick={() => { try { const s = accept(); navigate(`/${city.id}/saved/${s.id}`) } catch(e) { setSaveError(e instanceof Error ? e.message : 'Could not save.') } }}>Accept & save itinerary</button>}
        <Link to={`/${city.id}/saved`}>Saved trip & preview</Link>
        <a className="mobile-map-jump" href="#day-route-map">View route map ↓</a>
        {isBuilt && <details className="itinerary-more"><summary>More</summary><div className="itinerary-more-menu"><button onClick={() => setNarrationRequested(true)} disabled={narrationRequested || narrationUnavailable()}>Write optional day introduction</button>{narrationUnavailable() && <p>Optional AI introductions are currently unavailable. Your itinerary is ready to use.</p>}</div></details>}
      </div>
      {saveError && <p role="alert">{saveError}</p>}
      {!editable && <p className="companion-notice">This draft belongs to an older engine/catalog. Open its saved version to view the exact schedule; compose a new plan to regenerate.</p>}
      {isBuilt && <p className="evidence-label">{builtDayVerifiedLabel(day)} · travel durations are estimates. This is the working draft.</p>}
      {narrated || draft ? (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, margin: '14px 0 0', lineHeight: 1.75, textAlign: 'justify', color: 'color-mix(in srgb, var(--color-text) 82%, transparent)' }}>
          {em(narrated ?? draft)}
        </p>
      ) : narrationPending ? (
        <div className="ghost-para" role="status" aria-label="Writing the day" style={{ margin: '18px 0 2px' }}>
          <span className="ghost-line" style={{ width: '96%' }} />
          <span className="ghost-line" style={{ width: '88%' }} />
          <span className="ghost-line" style={{ width: '58%' }} />
        </div>
      ) : null}

      {editing && isBuilt && (timedStops.length > 0 || !curated) && (
        <div
          className="text-muted"
          style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 14, flexWrap: 'wrap', fontFamily: 'var(--font-body)', fontSize: 12.5 }}
        >
          {timedStops.length > 0 && (
            <span
              className="cmt-chip"
              style={{ color: 'var(--color-accent-700)', borderColor: 'var(--color-accent-200)', background: 'var(--color-accent-100)' }}
            >
              <TicketIcon size={12} />
              <span>
                Book ahead ·{' '}
                {timedStops.map((t, i) => (
                  <span key={`${t.name}-${i}`}>
                    {i > 0 && ' · '}
                    {t.url ? (
                      <a
                        href={t.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'inherit', textDecoration: 'underline', textUnderlineOffset: 2 }}
                      >
                        {t.name} ({t.time})
                      </a>
                    ) : (
                      `${t.name} (${t.time})`
                    )}
                  </span>
                ))}
              </span>
            </span>
          )}
          {!curated && (
            <button className="linklike" style={{ fontSize: 12.5 }} onClick={startOver}>
              Start over
            </button>
          )}
        </div>
      )}

      {!editing && curated && (
        <p className="text-muted" style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, margin: '10px 0 0', maxWidth: 620, lineHeight: 1.7 }}>
          {materializable ? (
            <>
              The curator's day, as walked. Reconsider any stop <FanIcon size={12} style={{ verticalAlign: -1 }} /> to make the day yours — times
              re-set for your own trip, and your version replaces this one here.
            </>
          ) : (
            <>
              This is the composed plan for day {num}. Want a different path?{' '}
              <button className="linklike" style={{ fontSize: 12.5 }} onClick={() => { setScratch(true); setOpenSlot('append') }}>
                Build it yourself, stop by stop
              </button>{' '}
              — your version replaces this one here.
            </>
          )}
        </p>
      )}

      {(isBuilt || (openSlot !== null && editing)) && (
        <>
          {editing && isBuilt && (
            <p
              className="text-muted home-base-note"
              style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, lineHeight: 1.6, margin: '10px 0 0', maxWidth: 660, display: 'flex', gap: 8 }}
            >
              <InfoIcon size={14} style={{ flex: 'none', marginTop: 3 }} />
              <span>
                Home base at {trip.stayHood ? `your place in ${trip.stayHood}` : city.homeBase} · about{' '}
                {day.committed.reduce((a, c) => a + (c.travelMode === 'walk' ? c.travelMin : 0) + (c.returnAfter?.mode === 'walk' ? c.returnAfter.min : 0), 0)} min on foot across the day
                {(() => {
                  const hops = day.committed.reduce((sum, c) => sum + Number(c.travelMode === 'metro') + Number(c.returnAfter?.mode === 'metro'), 0)
                  return hops > 0 ? ` and ${hops} estimated métro ${hops === 1 ? 'hop' : 'hops'}` : ''
                })()}
                . Remove a stop, or add one below, and the day re-routes and re-times itself.
              </span>
            </p>
          )}
        </>
      )}

      <hr className="hr hr-draw" style={{ margin: '24px 0 8px' }} />

      <div style={{ viewTransitionName: 'day-timeline' }}>
        {stops.length > 0 ? (
          <>
            <DayTimeline
              stops={stops}
              onReconsider={editable && (editing || materializable) ? reconsider : undefined}
              onRemove={editable && editing ? removeStop : undefined}
              openIndex={typeof openSlot === 'number' ? openSlot : null}
              deck={alignDeck(deckNode)}
            />
            {editable && editing && !done && (openSlot === 'append' ? alignDeck(deckNode) : (
              alignDeck(
                <button type="button" className="append-slot" onClick={() => setOpenSlot('append')}>
                  <FanIcon size={15} />
                  Choose the next stop — three ways forward from {currentPlace}
                </button>,
              )
            ))}
            {editable && editing && isBuilt && suggestions.length > 0 && (
              <div className="card" style={{ padding: '24px 28px', marginTop: 28, maxWidth: 700 }}>
                <h3 style={{ fontSize: 21, margin: '0 0 6px' }}>Something missing?</h3>
                <p className="text-muted" style={{ fontSize: 13.5, lineHeight: 1.6, margin: '0 0 16px', maxWidth: 480 }}>
                  Add a stop from nearby and the day re-routes and re-times around it — travel, arrival times and the closing hour all
                  adjust.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {suggestions.map((s) => (
                    <button
                      key={s.p.id}
                      type="button"
                      className={s.p.src === 'verified' ? 'add-pill add-pill-verified' : 'add-pill'}
                      onClick={() => commitDay(s.result.day, s.result.flags)}
                    >
                      <span aria-hidden style={{ color: 'var(--color-accent)' }}>+</span>
                      <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 13.5 }}>
                        {s.p.name.split(',')[0].split(' — ')[0]}
                      </span>
                      <span className="text-muted" style={{ fontSize: 12 }}>{s.p.area}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : openSlot === 'append' && editing ? (
          alignDeck(deckNode)
        ) : (
          <div style={{ border: '1px dashed var(--color-divider)', borderRadius: 6, padding: 36, textAlign: 'center', maxWidth: 560 }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 20, marginBottom: 8 }}>
              {trip.arriving ? `Day ${num} isn't composed yet` : 'No trip yet'}
            </div>
            <p className="text-muted" style={{ fontSize: 13.5, lineHeight: 1.6, margin: '0 0 18px' }}>
              {trip.arriving
                ? 'Days beyond the four-day core come from a plan or your own building.'
                : 'Give me your dates, pace and interests and the days get composed out of the archive.'}
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <Link to={`/${city.id}/compose`} viewTransition className="btn btn-primary">
                {trip.arriving ? 'Choose a plan' : 'Plan a visit'}
              </Link>
              <button className="btn btn-secondary" onClick={() => setOpenSlot('append')}>
                Build it here
              </button>
            </div>
          </div>
        )}
      </div>
    </Page>
    <DayMapPanel city={city} day={openSlot !== null && deck ? deck.prefix : day} home={stay} number={num} date={date}
      token={MAPBOX_TOKEN} candidates={openSlot !== null && deck ? deck.cands : []}
      hoverId={hoverCandId} onHover={setHoverCandId} onChoose={choose} />
    </div>
  )
}
