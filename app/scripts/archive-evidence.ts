/** What the archive witnesses about WHEN — read out of the photographs and
 * compared against what the city data claims.
 *
 * `validate:cities` proves the data agrees with itself. `media:audit` proves
 * the files on disk agree with the data about WHERE. Neither can see the one
 * fact only a photograph carries: the moment the shutter fired. That moment is
 * evidence for four fields the engine treats as authored opinion —
 * `best` (the hour a place is worth being at), `visits`, `last`, and the
 * travel times between places — and for the seasons the archive can actually
 * show a traveler.
 *
 * The prompt for this tool: Pont des Arts was scheduled at 10:23 with a
 * description reading "come at dusk". The archive already knew better — its
 * clips are stamped 16:34 in December and 21:31 in June. Nothing read them.
 *
 * Report-only, always. A capture time is strong evidence and still not proof:
 * a phone clock can be wrong, a file can be re-exported, and one shot in the
 * rain is not a preferred window. Every line below is a PROPOSAL for the
 * curator to confirm. Nothing here writes to data/.
 *
 * Usage: npm run archive:evidence [city]
 */
import fs from 'node:fs'
import path from 'node:path'
import { CITIES } from '../src/cities'
import { euTzOffsetMin, sunTimes } from '../src/lib/sun'
import { captureTimes, fileCoords, isPhoto, isVideo, type Capture, type Coords } from './archive-files'

const cityId = process.argv[2] ?? 'paris'
const city = CITIES[cityId]
if (!city) {
  console.error(`Unknown city: ${cityId}`)
  process.exit(1)
}

const mediaDir = path.join(process.cwd(), 'public', 'media', cityId)
const files = fs.readdirSync(mediaDir).filter((f) => isVideo(f) || isPhoto(f))
const captures = captureTimes(mediaDir, files)
const coords = fileCoords(mediaDir, files)

// ── the join: which place does each file speak for? ───────────────────────
// Same three hops media-audit walks — plates name slots, slot-files name
// filenames — but followed for the place's sake rather than the file's.

const slotFiles = city.slotFiles ?? {}
const slotOwner = new Map<string, string>()
for (const [placeId, m] of Object.entries(city.media)) {
  for (const pl of m.plates ?? []) slotOwner.set(pl.id, placeId)
  if (m.webImage) slotOwner.set(m.webImage.id, placeId)
}

/** A moment the curator stood somewhere. Derived files collapse into their
 * master's moment — one shutter press, not three. */
interface Moment extends Capture {
  file: string
  coords?: Coords
}
const byPlace = new Map<string, Moment[]>()
for (const [slot, entry] of Object.entries(slotFiles)) {
  const placeId = slotOwner.get(slot)
  if (!placeId) continue
  for (const f of [entry.img, entry.video].filter(Boolean) as string[]) {
    const cap = captures.get(f)
    if (!cap) continue
    const list = byPlace.get(placeId) ?? []
    if (!list.some((m) => m.date === cap.date && m.minutes === cap.minutes)) list.push({ ...cap, file: f, coords: coords.get(f) })
    byPlace.set(placeId, list)
  }
}
for (const list of byPlace.values()) list.sort((a, b) => (a.date === b.date ? a.minutes - b.minutes : a.date < b.date ? -1 : 1))

const place = (id: string) => city.places.find((p) => p.id === id)
// Round once, then split: rounding only the minute turns 16:59.6 into 16:00.
const hhmm = (min: number) => {
  const t = Math.round(min)
  return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}
const H = (s: string) => `\n\x1b[1m${s}\x1b[0m`
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`
const warn = (s: string) => `\x1b[33m${s}\x1b[0m`
const good = (s: string) => `\x1b[32m${s}\x1b[0m`
const pad = (s: string, n: number) => s.padEnd(n)
let proposals = 0

const sunsetFor = (p: { lat: number; lon: number }, date: string) =>
  sunTimes(p.lat, p.lon, date, euTzOffsetMin(date)).sunset

// ── 1 · best windows ──────────────────────────────────────────────────────
// The engine hard-filters on `best` (planner.ts: more than 30 min outside the
// window disqualifies a candidate), so a wrong or missing window is not a
// cosmetic problem — it puts a dusk place in a morning slot, or refuses a
// place all afternoon.

console.log(H('1 · BEST WINDOW vs THE ARCHIVE'))
console.log(dim('   `best` is the hour a place is worth being at. The archive knows when'))
console.log(dim('   the curator actually chose to be there. TOLERANCE is the engine\'s own'))
console.log(dim('   ±30 min grace, so anything flagged here would be hard-filtered today.'))

const bestRows: string[] = []
for (const p of city.places) {
  const moments = byPlace.get(p.id)
  if (!moments?.length) continue
  const lo = Math.min(...moments.map((m) => m.minutes))
  const hi = Math.max(...moments.map((m) => m.minutes))
  const declared = p.best
  const outside = declared ? moments.filter((m) => m.minutes < (declared[0] - 0.5) * 60 || m.minutes > (declared[1] + 0.5) * 60) : []

  if (declared && outside.length) {
    proposals++
    bestRows.push(
      `   ${pad(p.id, 16)}${warn('DIFFERS')}  declared ${declared[0]}:00–${declared[1]}:00 · shot ${hhmm(lo)}–${hhmm(hi)}\n` +
        outside.map((m) => `        ${pad(m.file, 42)}${m.date} ${hhmm(m.minutes)}  ${dim('outside the declared window')}`).join('\n'),
    )
  } else if (!declared && moments.length >= 2 && hi - lo <= 5 * 60) {
    // A tight cluster across several visits is a preference, not a coincidence.
    proposals++
    const from = Math.floor(lo / 60)
    const to = Math.min(24, Math.ceil(hi / 60))
    bestRows.push(
      `   ${pad(p.id, 16)}${dim('no `best`')} ${moments.length} shots inside ${hhmm(lo)}–${hhmm(hi)} ` +
        `${good(`→ propose best: [${from}, ${to}]`)}`,
    )
  }
}
console.log(bestRows.length ? bestRows.join('\n') : '   none')

// ── 2 · light, not clock time ─────────────────────────────────────────────

console.log(H('2 · LIGHT, NOT CLOCK TIME'))
console.log(dim('   Places the curator shoots around sunset. A fixed clock window cannot'))
console.log(dim('   express this: in Paris sunset moves ~5 hours between June and December,'))
console.log(dim('   so one `best` tuple is wrong in at least one season. src/lib/sun.ts'))
console.log(dim('   already computes these times for the day narration.'))

const sunRows: string[] = []
for (const p of city.places) {
  const moments = byPlace.get(p.id)
  if (!moments || moments.length < 2) continue
  const deltas = moments.map((m) => ({ m, d: m.minutes - sunsetFor(p, m.date) }))
  // Shot near sunset every time, but at clock times that scatter — the
  // signature of a place chosen for its light rather than its hour.
  const nearSunset = deltas.filter((x) => x.d >= -150 && x.d <= 60)
  if (nearSunset.length < 2 || nearSunset.length < moments.length * 0.6) continue
  const clockSpan = Math.max(...moments.map((m) => m.minutes)) - Math.min(...moments.map((m) => m.minutes))
  if (clockSpan < 90) continue
  proposals++
  sunRows.push(
    `   ${pad(p.id, 16)}clock spans ${Math.round(clockSpan / 60)}h · ${nearSunset.length} of ${moments.length} shots sit near sunset\n` +
      deltas
        .map(
          (x) =>
            `        ${x.m.date} ${hhmm(x.m.minutes)}  sunset ${hhmm(sunsetFor(p, x.m.date))}  ` +
            `${x.d <= 0 ? `${Math.abs(Math.round(x.d))} min before` : `${Math.round(x.d)} min after`}`,
        )
        .join('\n') +
      `\n        ${good('→ a sun-relative window would hold in every month; a clock window cannot')}`,
  )
}
console.log(sunRows.length ? sunRows.join('\n') : '   none')

// ── 3 · visits and last ───────────────────────────────────────────────────
// These two fields ARE the provenance claim the UI renders ("From 3 visits —
// last Apr '22"). The audit already found them fabricated in curated data;
// here they can simply be counted.

console.log(H('3 · VISITS AND LAST, COUNTED'))
console.log(dim('   Declared vs distinct capture days in the archive. A count can only be a'))
console.log(dim('   floor — the curator visited places they did not photograph — so DECLARED'))
console.log(dim('   BELOW EVIDENCE is a contradiction, while above it may be true and unshot.'))

const visitRows: string[] = []
for (const p of city.places) {
  const moments = byPlace.get(p.id)
  if (!moments?.length) continue
  const days = [...new Set(moments.map((m) => m.date))].sort()
  const lastSeen = days[days.length - 1]
  const declared = p.visits ?? 0
  const contradiction = declared < days.length
  const lastYear = p.last?.match(/\d{2}$/)?.[0]
  const lastDisagrees = lastYear ? !lastSeen.startsWith(`20${lastYear}`) && lastSeen.slice(0, 4) > `20${lastYear}` : false
  if (!contradiction && !lastDisagrees) continue
  proposals++
  visitRows.push(
    `   ${pad(p.id, 16)}${pad(p.src, 10)}declared ${pad(`${declared} visit(s), last ${p.last || '—'}`, 30)}` +
      `${contradiction ? warn(`evidence: ${days.length} day(s)`) : `evidence: ${days.length} day(s)`}, last ${lastSeen}\n` +
      `        ${dim(days.join('  '))}`,
  )
}
console.log(visitRows.length ? visitRows.join('\n') : '   none')

// ── 4 · season coverage ───────────────────────────────────────────────────
// The one thing a scraped catalog structurally cannot do: show a traveler the
// month they are actually coming in.

console.log(H('4 · SEASON COVERAGE'))
console.log(dim('   Which months this city can be shown in, and the places with enough'))
console.log(dim('   spread to be rendered as the same corner across different seasons.'))

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const monthPlaces = new Map<string, Set<string>>()
for (const [placeId, moments] of byPlace) for (const m of moments) {
  const key = m.date.slice(5, 7)
  monthPlaces.set(key, (monthPlaces.get(key) ?? new Set()).add(placeId))
}
console.log(
  '   ' +
    MONTHS.map((name, i) => {
      const n = monthPlaces.get(String(i + 1).padStart(2, '0'))?.size ?? 0
      return n ? `${name} ${n}` : dim(`${name} –`)
    }).join('   '),
)

const multiSeason = [...byPlace.entries()]
  .map(([id, moments]) => ({ id, months: new Set(moments.map((m) => m.date.slice(5, 7))), years: new Set(moments.map((m) => m.date.slice(0, 4))) }))
  .filter((x) => x.months.size >= 2)
  .sort((a, b) => b.months.size - a.months.size)
console.log(dim(`\n   ${multiSeason.length} place(s) shot in more than one month:`))
console.log(
  multiSeason.length
    ? multiSeason
        .map(
          (x) =>
            `   ${pad(x.id, 16)}${pad(`${x.months.size} month(s)`, 12)}${pad(`${x.years.size} year(s)`, 12)}` +
            dim([...x.months].sort().map((m) => MONTHS[Number(m) - 1]).join(', ')),
        )
        .join('\n')
    : '   none',
)

// ── 5 · observed transitions ──────────────────────────────────────────────
// The engine's travel times are haversine arithmetic; `04-engine-audit.md`
// improvement 6 notes that even its `measured` legs are inferred, not walked.
// Two places photographed on the same day put a real elapsed time on the
// board — an upper bound, since the gap includes lingering.
//
// A gap too short to have crossed the distance is the more interesting
// finding, and it is not about travel at all: it means the camera was not at
// the place it was photographing. That matters here more than anywhere,
// because `measured` legs assert the curator WALKED between two points.

console.log(H('5 · OBSERVED TRANSITIONS'))
console.log(dim('   Consecutive shots at two places on one day. Elapsed bounds the journey,'))
console.log(dim('   so an estimate above it is provably wrong. A gap too short for any'))
console.log(dim('   journey at all is not speed — it is a photograph taken from elsewhere.'))

const rad = Math.PI / 180
/** The planner's haversine, in km. Mirrors travel() in src/lib/planner.ts —
 * if the walking model changes there, change it here. */
function km(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const dLat = (b.lat - a.lat) * rad
  const dLon = (b.lon - a.lon) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}
const estimate = (d: number) => (d <= 1.2 ? { mode: 'walk', min: Math.round((d / 4.5) * 60) } : { mode: 'metro', min: Math.round(11 + 4 * d) })
const metres = (aLat: number, aLon: number, bLat: number, bLon: number) => km({ lat: aLat, lon: aLon }, { lat: bLat, lon: bLon }) * 1000

/** Every dated moment, flattened back into a single chronological trail. */
const trail: { placeId: string; date: string; minutes: number }[] = []
for (const [placeId, moments] of byPlace) for (const m of moments) trail.push({ placeId, date: m.date, minutes: m.minutes })
trail.sort((a, b) => (a.date === b.date ? a.minutes - b.minutes : a.date < b.date ? -1 : 1))

const legs: string[] = []
for (let i = 1; i < trail.length; i++) {
  const from = trail[i - 1]
  const to = trail[i]
  if (from.date !== to.date || from.placeId === to.placeId) continue
  const a = place(from.placeId)
  const b = place(to.placeId)
  if (!a || !b) continue
  const elapsed = to.minutes - from.minutes
  if (elapsed <= 0 || elapsed > 180) continue
  const d = km(a, b)
  const est = estimate(d)
  // The fastest this leg could conceivably go: a brisk 6 km/h walk, or a metro
  // running at 30 km/h with only five minutes at each end. Below that, no
  // journey happened — the two coordinates cannot both be where the camera
  // stood, so one of these places was photographed from somewhere else.
  const floor = Math.min(10 * d, 10 + 2 * d)
  const verdict =
    elapsed < floor
      ? warn('shot from a distance — the camera was not at both places')
      : est.min > elapsed
        ? warn(`engine says ${est.min} min ${est.mode} — too slow`)
        : dim(`engine ${est.min} min ${est.mode}`)
  legs.push(
    `   ${pad(`${from.placeId} → ${to.placeId}`, 34)}${pad(from.date, 12)}${pad(`${hhmm(from.minutes)}→${hhmm(to.minutes)}`, 14)}` +
      `${pad(`${elapsed} min elapsed`, 16)}${pad(`${d.toFixed(2)} km`, 10)}${verdict}`,
  )
  if (elapsed < floor || est.min > elapsed) proposals++
}
console.log(legs.length ? legs.join('\n') : '   none')

// ── 6 · where the camera stood ────────────────────────────────────────────
// Section 5 infers, from a gap too short to cross, that a place was shot from
// elsewhere. Coordinates settle it — and settle the place's own lat/lon too,
// which is hand-authored today and drives every distance the engine computes.

console.log(H('6 · WHERE THE CAMERA STOOD'))
console.log(dim('   Coordinates against the place they are filed under. A far shot is not an'))
console.log(dim('   error — the tower is best photographed from anywhere but the tower — but'))
console.log(dim('   it is not evidence the curator stood there, which is what `verified` says.'))

// A viewpoint and a mis-filing look identical to a distance check, so the
// bands are what make this readable: a few hundred metres is how you
// photograph a cathedral, a kilometre is a different place.
const VIEWPOINT = 150
const ELSEWHERE = 1000
const farRows: string[] = []
const viewRows: string[] = []
const driftRows: string[] = []
for (const p of city.places) {
  const located = (byPlace.get(p.id) ?? []).filter((m) => m.coords)
  if (!located.length) continue
  for (const m of located) {
    const d = metres(m.coords!.lat, m.coords!.lon, p.lat, p.lon)
    if (d <= VIEWPOINT) continue
    const row = `   ${pad(p.id, 16)}${pad(m.file, 42)}${Math.round(d).toString().padStart(5)} m  ${dim(m.date)}`
    if (d >= ELSEWHERE) farRows.push(`${row}  ${warn('another place entirely')}`)
    else viewRows.push(row)
  }
  // Where the curator actually stands, averaged over the shots that are
  // plausibly AT the place — a better pin than a hand-typed coordinate.
  const at = located.filter((m) => metres(m.coords!.lat, m.coords!.lon, p.lat, p.lon) <= 150)
  if (at.length < 2) continue
  const lat = at.reduce((s, m) => s + m.coords!.lat, 0) / at.length
  const lon = at.reduce((s, m) => s + m.coords!.lon, 0) / at.length
  const drift = metres(lat, lon, p.lat, p.lon)
  if (drift > 60)
    driftRows.push(
      `   ${pad(p.id, 16)}${pad(`declared ${p.lat.toFixed(4)}, ${p.lon.toFixed(4)}`, 32)}` +
        `${good(`${at.length} shots centre on ${lat.toFixed(4)}, ${lon.toFixed(4)}`)} ${dim(`(${Math.round(drift)} m)`)}`,
    )
}
proposals += farRows.length + driftRows.length
console.log(farRows.length ? farRows.join('\n') : `   no shot sits more than ${ELSEWHERE} m from the place it is filed under`)
if (viewRows.length) {
  console.log(dim(`\n   Shot from ${VIEWPOINT}–${ELSEWHERE} m — a viewpoint. Expected for anything large,`))
  console.log(dim('   but each one is a stop whose plate does not show the curator standing there:'))
  console.log(viewRows.join('\n'))
}
if (driftRows.length) {
  console.log(dim('\n   Declared coordinates more than 60 m from where the shots cluster:'))
  console.log(driftRows.join('\n'))
}

// ── coverage of the instrument itself ─────────────────────────────────────

const dated = captures.size
const located = coords.size
const placesWithEvidence = byPlace.size
console.log(H('COVERAGE'))
console.log(`   ${dated} of ${files.length} files carry a readable capture time.`)
console.log(`   ${located} of ${files.length} files carry coordinates.`)
console.log(`   ${placesWithEvidence} of ${city.places.length} places have any temporal evidence at all.`)

// Location services are a per-era setting, not a per-file accident: knowing
// WHICH years are blind tells the curator what can never be auto-placed.
const byYear = new Map<string, { located: number; total: number }>()
for (const f of files) {
  const y = captures.get(f)?.date.slice(0, 4)
  if (!y) continue
  const row = byYear.get(y) ?? { located: 0, total: 0 }
  row.total++
  if (coords.has(f)) row.located++
  byYear.set(y, row)
}
const blind = [...byYear.entries()].filter(([, r]) => r.located === 0).map(([y]) => y)
console.log(dim(`   coordinates by year: ${[...byYear.entries()].sort().map(([y, r]) => `${y} ${r.located}/${r.total}`).join('  ')}`))
if (blind.length) console.log(dim(`   ${blind.join(', ')} predate location services here — those places can only be placed by hand.`))

console.log(`\n${proposals} proposal(s) from ${dated} dated file(s) across ${placesWithEvidence} place(s).`)
console.log(dim('Report only — nothing was written. Confirm each proposal before editing data/.'))
