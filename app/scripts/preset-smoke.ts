/** Engine quality invariants — regression guards for the recommendation engine. */
import { CITIES } from '../src/cities'
import { generatePlan, PLAN_PRESETS, type GeneratedPlan } from '../src/lib/plan-presets'
import { dayWeekday, stayLoc } from '../src/lib/planner'

const city = CITIES.paris
const ARRIVING = '2026-09-12' // Sat → days fall Sat, Sun, Mon (Orsay closed), Tue (Louvre closed)…
const STAY = stayLoc(city, city.hoodOrder[0])
const placeOf = (id: string) => city.places.find((p) => p.id === id)

let fail = 0
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok || !detail ? '' : ` — ${detail}`}`)
  if (!ok) fail++
}

const gen = (presetId: string, dayCount: number) =>
  generatePlan(city, PLAN_PRESETS.find((p) => p.id === presetId)!, dayCount, 'balanced', STAY, ARRIVING, [])

function checkDays(tag: string, plan: GeneratedPlan, dayCount: number) {
  const allIds = plan.days.flatMap((d) => d.committed.map((c) => c.id))
  check(`${tag}: no repeats across the trip`, new Set(allIds).size === allIds.length)

  plan.days.slice(0, dayCount).forEach((d, i) => {
    const day = `${tag} day ${i + 1}`
    const wd = dayWeekday(ARRIVING, i)!
    const isDayTrip = d.committed.some((c) => placeOf(c.id)?.dayTrip)
    const minStops = isDayTrip ? 1 : i === 6 ? 2 : 3
    check(`${day}: populated (${minStops}–8 stops)`, d.committed.length >= minStops && d.committed.length <= 8, `${d.committed.length}`)

    const late = d.committed.filter((c) => c.timeIn + c.dur > 22 * 60)
    check(`${day}: home by 22:00`, late.length === 0, late.map((c) => c.name).join(', '))

    const anchors = d.committed.filter((c) => placeOf(c.id)?.role === 'anchor').length
    check(`${day}: ≤1 anchor`, anchors <= 1, `${anchors}`)

    const timed = d.committed.filter((c) => placeOf(c.id)?.timed).length
    check(`${day}: ≤2 timed`, timed <= 2, `${timed}`)

    const longLegs = d.committed.filter((c, j) => j > 0 && c.travelMode === 'metro' && c.travelMin >= 20).length
    check(`${day}: ≤1 long transfer`, longLegs <= 1, `${longLegs}`)

    const closed = d.committed.filter((c) => placeOf(c.id)?.closedOn?.includes(wd))
    check(`${day}: nothing visited on its closing day`, closed.length === 0, closed.map((c) => c.name).join(', '))

    const earlyLunch = d.committed.filter((c) => c.meal === 'lunch' && c.timeIn < 11 * 60)
    check(`${day}: no lunch before 11:00`, earlyLunch.length === 0, earlyLunch.map((c) => c.name).join(', '))

    const offWindow = d.committed.filter((c) => {
      const best = placeOf(c.id)?.best
      if (!best) return false
      const h = c.timeIn / 60
      return h < best[0] - 0.5 || h > best[1] + 0.5
    })
    check(`${day}: best-time respected (±30 min)`, offWindow.length === 0, offWindow.map((c) => c.name).join(', '))
  })
}

// Determinism + distinctness at the 4-day core.
const seq = (x: GeneratedPlan) => x.days.flatMap((d) => d.committed.map((c) => c.id)).join(',')
for (const p of PLAN_PRESETS) {
  const a = gen(p.id, 4)
  const b = gen(p.id, 4)
  check(`${p.id}: deterministic`, seq(a) === seq(b))
  checkDays(p.id, a, 4)
}
check('three presets produce distinct itineraries', new Set(PLAN_PRESETS.map((p) => seq(gen(p.id, 4)))).size === 3)

// The 7-day trip: Orsay day, Versailles day-trip, buffer day.
const seven = gen('first-time', 7)
checkDays('7-day', seven, 7)
check('7-day: day 5 contains Orsay', seven.days[4].committed.some((c) => c.id === 'orsay'), seven.days[4].committed.map((c) => c.id).join(','))
check('7-day: day 6 is the Versailles day-trip', seven.days[5].committed.some((c) => c.id === 'versailles'))
check('7-day: day 7 is a small buffer day', seven.days[6].committed.length <= 4 && !seven.days[6].committed.some((c) => placeOf(c.id)?.role === 'anchor'))
check('7-day: purposes present', seven.purposes.slice(0, 7).every((p) => p.length > 0))

process.exit(fail ? 1 : 0)
