/** Day-by-day replay of the recommendation engine for eyeballing quality.
 * Usage: npm run diag [-- presetId [dayCount [cityId]]] (defaults: first-time, 4, paris) */
import { CITIES } from '../src/cities'
import { generatePlan, PLAN_PRESETS } from '../src/lib/plan-presets'
import { dayWeekday, fmt, stayLoc, stopPlace } from '../src/lib/planner'

const city = CITIES[process.argv[4] ?? 'paris']
if (!city) {
  console.error(`Unknown city: ${process.argv[4]} (have: ${Object.keys(CITIES).join(', ')})`)
  process.exit(1)
}
const presetId = process.argv[2] ?? 'first-time'
const dayCount = Number(process.argv[3] ?? 4)
const ARRIVING = '2026-09-12'
const preset = PLAN_PRESETS.find((p) => p.id === presetId)
if (!preset) {
  console.error(`Unknown preset: ${presetId} (have: ${PLAN_PRESETS.map((p) => p.id).join(', ')})`)
  process.exit(1)
}
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const placeOf = (id: string) => city.places.find((p) => p.id === id)

console.log(`preset: ${preset.id} · ${dayCount} days from ${ARRIVING}`)
const plan = generatePlan(city, preset, dayCount, 'balanced', stayLoc(city, city.hoodOrder[0]), ARRIVING, [])
plan.days.slice(0, dayCount).forEach((day, d) => {
  const wd = dayWeekday(ARRIVING, d)
  console.log(`\n═══ DAY ${d + 1} · ${wd !== undefined ? WD[wd] : '?'} ═══  ${plan.purposes[d]}`)
  for (const s of day.committed) {
    const p = stopPlace(city, s)
    const flags = [p?.role === 'anchor' ? 'ANCHOR' : '', p?.timed ? 'timed' : '', s.experienceId ? `exp:${s.experienceId}` : ''].filter(Boolean).join(' ')
    console.log(
      `  ${fmt(s.timeIn)}–${fmt(s.timeIn + s.dur)}  ${s.name}  [${s.group}${s.meal ? '/' + s.meal : ''}] (${p?.hood ?? '?'})  ← ${s.travelMin}m ${s.travelMode}${flags ? '  · ' + flags : ''}`,
    )
    if (s.reasons?.length)
      console.log(`        why: ${s.reasons.map((r) => `${r.note}${r.value ? ` (${r.value > 0 ? '+' : ''}${r.value.toFixed(1)})` : ''}`).join(' · ')}`)
  }
  const travel = day.committed.reduce((a, c) => a + c.travelMin, 0)
  const hoods = day.committed.map((c) => placeOf(c.id)?.hood ?? '?')
  let jumps = 0
  for (let i = 1; i < hoods.length; i++) if (hoods[i] !== hoods[i - 1]) jumps++
  console.log(
    `  — ends ${fmt(day.clock)} · meals: coffee ${day.meals.coffee ? '✓' : '✗'} lunch ${day.meals.lunch ? '✓' : '✗'} dinner ${day.meals.dinner ? '✓' : '✗'} · travel ${travel}m · hood switches ${jumps}`,
  )
})
