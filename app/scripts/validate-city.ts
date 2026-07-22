/** City-data schema gate — validates every registered city's JSON beyond what
 * the type casts in `cities/<id>/index.ts` can promise. Run: npm run validate:cities.
 * Follows the assert style of preset-smoke.ts: PASS/FAIL lines, exit 1 on any FAIL. */
import { CITIES } from '../src/cities'
import type { City, Theme } from '../src/cities/types'

const MEALS = ['coffee', 'lunch', 'dinner', null]
const GROUPS = ['food', 'sight', 'indoor', 'park']
const VENUE_TYPES = ['cafe', 'bakery', 'patisserie', 'tea_room', 'market', 'bistro', 'brasserie', 'bouillon', 'wine_bar', 'modern_bistro', 'fine_dining', 'street_food', 'creperie', 'restaurant']
const SOURCES = ['verified', 'web']
const THEMES: Theme[] = ['monumental', 'historic', 'artistic', 'neighborhood', 'everyday', 'afterdark']

let fail = 0
const check = (name: string, ok: boolean, detail = '') => {
  if (!ok) console.log(`FAIL ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) fail++
}

const isHour = (n: unknown) => typeof n === 'number' && n >= 0 && n <= 24
const isHourTuple = (t: unknown): t is [number, number] =>
  Array.isArray(t) && t.length === 2 && isHour(t[0]) && isHour(t[1]) && t[0] < t[1]

function validateCity(cid: string, city: City) {
  const tag = `[${cid}]`
  check(`${tag} id matches registry key`, city.id === cid, city.id)
  check(`${tag} day window sane`, city.dayStart >= 0 && city.dayStart < city.dayEnd && city.dayEnd <= 1440)
  check(`${tag} start location`, Math.abs(city.start.lat) <= 90 && Math.abs(city.start.lon) <= 180 && city.start.src === null)
  check(`${tag} hoodOrder non-empty and unique`, city.hoodOrder.length > 0 && new Set(city.hoodOrder).size === city.hoodOrder.length)
  if (city.river)
    check(
      `${tag} river is ≥2 valid [lat, lon] points`,
      city.river.length >= 2 && city.river.every((pt) => Array.isArray(pt) && pt.length === 2 && Math.abs(pt[0]) <= 90 && Math.abs(pt[1]) <= 180),
    )

  // ── Places ──
  const ids = city.places.map((p) => p.id)
  const names = city.places.map((p) => p.name)
  check(`${tag} place ids unique`, new Set(ids).size === ids.length)
  check(`${tag} place names unique (nodes cross-ref by name)`, new Set(names).size === names.length)

  for (const p of city.places) {
    const t = `${tag} place ${p.id}`
    check(`${t}: id/name/area/hood/label non-empty`, [p.id, p.name, p.area, p.hood, p.label].every((s) => typeof s === 'string' && s.length > 0))
    check(`${t}: coordinates`, Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180)
    check(`${t}: duration positive`, Number.isFinite(p.dur) && p.dur > 0)
    if (p.durVar !== undefined) check(`${t}: durVar non-negative`, Number.isFinite(p.durVar) && p.durVar >= 0)
    if (p.rank !== undefined) check(`${t}: rank ∈ {1,2,3}`, [1, 2, 3].includes(p.rank))
    if (p.venueType !== undefined) check(`${t}: venueType valid`, VENUE_TYPES.includes(p.venueType), p.venueType)
    check(`${t}: meal valid`, MEALS.includes(p.meal))
    check(`${t}: group valid`, GROUPS.includes(p.group))
    check(`${t}: src valid`, SOURCES.includes(p.src))
    check(`${t}: open is an hour tuple`, isHourTuple(p.open), JSON.stringify(p.open))
    if (p.best !== undefined) check(`${t}: best is an hour tuple`, isHourTuple(p.best), JSON.stringify(p.best))
    if (p.closedOn !== undefined)
      check(`${t}: closedOn ⊆ 0..6`, p.closedOn.every((d) => Number.isInteger(d) && d >= 0 && d <= 6), JSON.stringify(p.closedOn))
    // Operating rules v2: `hours` absorbs `closedOn` — declaring both is a data bug.
    check(`${t}: hours and closedOn never mix`, !(p.hours !== undefined && p.closedOn !== undefined))
    if (p.hours !== undefined) {
      check(`${t}: hours has 7 weekday entries`, p.hours.length === 7)
      check(`${t}: hours entries are null or hour tuples`, p.hours.every((h) => h === null || isHourTuple(h)), JSON.stringify(p.hours))
      check(`${t}: open at least one weekday`, p.hours.some((h) => h !== null))
    }
    if (p.experiences !== undefined) {
      check(`${t}: experiences non-empty`, p.experiences.length > 0)
      const eids = p.experiences.map((e) => e.id)
      check(`${t}: experience ids unique`, new Set(eids).size === eids.length)
      for (const e of p.experiences) {
        const et = `${t} experience ${e.id}`
        check(`${et}: id non-empty`, typeof e.id === 'string' && e.id.length > 0)
        if (e.dur !== undefined) check(`${et}: duration positive`, Number.isFinite(e.dur) && e.dur > 0)
        if (e.durVar !== undefined) check(`${et}: durVar non-negative`, Number.isFinite(e.durVar) && e.durVar >= 0)
        if (e.open !== undefined) check(`${et}: open tuple`, isHourTuple(e.open), JSON.stringify(e.open))
        if (e.best !== undefined) check(`${et}: best tuple`, isHourTuple(e.best), JSON.stringify(e.best))
        if (e.hours !== undefined) {
          check(`${et}: hours has 7 weekday entries`, e.hours.length === 7)
          check(`${et}: hours entries valid`, e.hours.every((h) => h === null || isHourTuple(h)))
          check(`${et}: open at least one weekday`, e.hours.some((h) => h !== null))
        }
        if (e.src !== undefined) check(`${et}: src valid`, SOURCES.includes(e.src))
        if (e.meal !== undefined) check(`${et}: meal valid`, MEALS.includes(e.meal))
        if (e.role !== undefined) check(`${et}: role is 'anchor'`, e.role === 'anchor')
        if (e.group !== undefined) check(`${et}: group valid`, GROUPS.includes(e.group))
        // Effective provenance must stay honest per variant.
        const src = e.src ?? p.src
        const visits = e.visits ?? p.visits
        const last = e.last ?? p.last
        if (src === 'verified') check(`${et}: verified ⇒ visits ≥ 1 and a last-visit date`, visits >= 1 && last.length > 0)
      }
    }
    if (p.exceptions !== undefined) {
      const dates = p.exceptions.map((e) => e.date)
      check(`${t}: exception dates unique`, new Set(dates).size === dates.length)
      for (const e of p.exceptions) {
        check(`${t}: exception ${e.date} is an ISO date`, /^20\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(e.date))
        check(`${t}: exception ${e.date} has exactly one of closed/open`, (e.closed === true) !== (e.open !== undefined))
        if (e.open !== undefined) check(`${t}: exception ${e.date} open tuple`, isHourTuple(e.open), JSON.stringify(e.open))
        if (e.source !== undefined) check(`${t}: exception ${e.date} source valid`, SOURCES.includes(e.source))
      }
    }
    if (p.themes !== undefined) check(`${t}: themes valid`, p.themes.every((th) => THEMES.includes(th)), JSON.stringify(p.themes))
    if (p.role !== undefined) check(`${t}: role is 'anchor'`, p.role === 'anchor')
    check(`${t}: visits a non-negative integer`, Number.isInteger(p.visits) && p.visits >= 0)
    // Provenance sanity: a verified place carries its evidence.
    if (p.src === 'verified') check(`${t}: verified ⇒ visits ≥ 1 and a last-visit date`, p.visits >= 1 && p.last.length > 0)
    // Day-trips live outside the hood rotation (e.g. Versailles); everything else must anchor to a real hood.
    if (!p.dayTrip) check(`${t}: hood in hoodOrder`, city.hoodOrder.includes(p.hood), p.hood)
  }

  // ── Cross-references ──
  const idSet = new Set(ids)
  const nameSet = new Set(names)
  const byName = new Map(city.places.map((p) => [p.name, p]))

  for (const key of Object.keys(city.info)) check(`${tag} info key is a place id`, idSet.has(key), key)
  for (const key of Object.keys(city.entry)) check(`${tag} entry key is a place id`, idSet.has(key), key)
  for (const key of Object.keys(city.media)) check(`${tag} media key is a place id`, idSet.has(key), key)

  // ── Renderability ──
  // These checks used to pass vacuously by iterating an empty map: Rome shipped
  // live with `media.json` as `{}`, so every stop rendered as a bare name and
  // the narrator was handed nothing but names and hoods. A city is renderable
  // when every schedulable place can say what it is; the archive tier owes
  // photographs on top of that.
  const has = (id: string) => (city.media[id]?.desc ?? '').trim().length > 0
  const schedulable = city.places.filter((p) => !p.dayTrip)

  // The archive tier owes both prose and photographs — it is the tier that
  // leads, and a verified stop with nothing to show is a claim with no
  // evidence behind it.
  const archive = schedulable.filter((p) => p.src === 'verified')
  const undescribed = archive.filter((p) => !has(p.id))
  check(`${tag}: every verified place has a description`, undescribed.length === 0, undescribed.map((p) => p.id).join(', '))
  const plateless = archive.filter((p) => !(city.media[p.id]?.plates ?? []).length)
  check(`${tag}: every verified place carries archive plates`, plateless.length === 0, plateless.map((p) => p.id).join(', '))

  // The web tier owes prose. Without it a stop renders as a bare name and the
  // narrator is handed nothing but a name and a hood — which is how Rome
  // shipped live with an entirely empty media.json, every check above passing
  // vacuously over zero entries.
  const web = schedulable.filter((p) => p.src !== 'verified')
  const webDescribed = web.filter((p) => has(p.id))
  check(`${tag}: the web tier is not entirely undescribed`, web.length === 0 || webDescribed.length > 0, `0 of ${web.length}`)

  // …and a ratchet over the rest, because this is real content debt, not a
  // bug: Paris still owes copy for most of its web tier. The floor stops it
  // getting worse while that is written; raise it as coverage lands.
  const FLOOR: Record<string, number> = { paris: 5, rome: 41 }
  const floor = FLOOR[tag.replace(/[[\]]/g, '')] ?? 0
  check(
    `${tag}: web-tier descriptions ≥ ${floor} (have ${webDescribed.length}/${web.length})`,
    webDescribed.length >= floor,
    `coverage fell to ${webDescribed.length}`,
  )

  for (const n of city.nodes) {
    check(`${tag} node "${n.name}" is a place`, nameSet.has(n.name))
    const p = byName.get(n.name)
    if (p) check(`${tag} node "${n.name}" hood matches its place`, n.hood === p.hood, `${n.hood} ≠ ${p.hood}`)
    check(`${tag} node "${n.name}" position 0–100`, n.x >= 0 && n.x <= 100 && n.y >= 0 && n.y <= 100)
  }

  // ── Day templates ──
  check(`${tag} dayTemplates covers the full 7-day framework`, city.dayTemplates.length === 7, `${city.dayTemplates.length}`)
  const checkTemplate = (t: (typeof city.dayTemplates)[number], label: string) => {
    check(`${tag} ${label}: purpose non-empty`, t.purpose.length > 0)
    if (t.seed !== undefined) {
      const p = city.places.find((pl) => pl.id === t.seed)
      check(`${tag} ${label}: seed "${t.seed}" is a place`, p !== undefined)
      if (p && t.seedExp !== undefined) check(`${tag} ${label}: seedExp exists on the seed`, (p.experiences ?? []).some((e) => e.id === t.seedExp))
    }
    if (t.dayTripId !== undefined) {
      const p = city.places.find((pl) => pl.id === t.dayTripId)
      check(`${tag} ${label}: dayTripId "${t.dayTripId}" is a dayTrip place`, p?.dayTrip === true)
    }
    if (t.hoodBias !== undefined) check(`${tag} ${label}: hoodBias in hoodOrder`, city.hoodOrder.includes(t.hoodBias), t.hoodBias)
    if (t.maxStops !== undefined) check(`${tag} ${label}: maxStops positive`, Number.isInteger(t.maxStops) && t.maxStops > 0)
    if (t.paceOverride !== undefined) check(`${tag} ${label}: paceOverride valid`, ['gentle', 'balanced', 'full'].includes(t.paceOverride))
  }
  city.dayTemplates.forEach((t, i) => {
    checkTemplate(t, `template ${i + 1}`)
    if (t.alt) checkTemplate(t.alt as (typeof city.dayTemplates)[number], `template ${i + 1} alt`)
  })

  // ── Curated days ──
  const slotIds = new Set<string>()
  for (const m of Object.values(city.media)) {
    for (const pl of m.plates ?? []) slotIds.add(pl.id)
    if (m.webImage) slotIds.add(m.webImage.id)
  }
  const placeIds = new Set(ids)
  for (const d of city.curatedDays) {
    const t = `${tag} curated day ${d.index}`
    check(`${t}: has a title`, d.title.length > 0)
    for (const s of d.stops) {
      check(`${t} stop "${s.name}": kind valid`, ['verified', 'web-pin', 'web-image'].includes(s.kind))
      // A witnessed claim must name the place that backs it. The old
      // name-matching fallback could not see a stop whose name matched no
      // place, which is how several stops claiming "personally verified"
      // escaped every check below. Web-tier stops may stay unlinked — they
      // are editorial, and there is nothing to back.
      if (s.kind === 'verified' || s.provenance || s.plates?.length)
        check(`${t} stop "${s.name}": a witnessed stop names its place`, s.placeId !== undefined)
      if (s.placeId !== undefined) check(`${t} stop "${s.name}": placeId resolves`, placeIds.has(s.placeId), s.placeId)
      const byName = city.places.find((p) => p.name === s.name)
      if (byName) check(`${t} stop "${s.name}": linked to its place`, s.placeId === byName.id, `expected ${byName.id}, got ${s.placeId ?? 'none'}`)
      // ── The provenance gate ──
      // A stop may not claim to be witnessed unless its place record says so.
      // Two claims for one stop is the one thing this product must never do:
      // the curated page renders the accent dot, archive plates and a visit
      // count, while the same stop materialized through the engine renders as
      // a web pin — same trip, same stop, contradictory provenance.
      const place = s.placeId !== undefined ? city.places.find((p) => p.id === s.placeId) : undefined
      if (place) {
        check(
          `${t} stop "${s.name}": kind matches the place's provenance`,
          (s.kind === 'verified') === (place.src === 'verified'),
          `kind=${s.kind} but places.json says src=${place.src}`,
        )
        check(
          `${t} stop "${s.name}": provenance only where the archive backs it`,
          !s.provenance || (place.src === 'verified' && place.visits > 0),
          `provenance "${s.provenance}" but src=${place.src}, visits=${place.visits}`,
        )
        if (s.plates?.length)
          check(`${t} stop "${s.name}": archive plates only on verified places`, place.src === 'verified', `${s.plates.length} plates on a ${place.src} place`)
      }
      for (const pl of s.plates ?? []) slotIds.add(pl.id)
      if (s.webImage) slotIds.add(s.webImage.id)
    }
  }

  // ── Media joins ──
  for (const h of city.hoods) slotIds.add(h.id) // hood cards' hero images use the hood id as slot id
  for (const key of Object.keys(city.slotFiles ?? {})) check(`${tag} slotFiles key "${key}" is a known slot`, slotIds.has(key))
  for (const [file, ym] of Object.entries(city.mediaDates ?? {}))
    check(`${tag} mediaDates "${file}" is YYYY-MM`, /^20\d{2}-(0[1-9]|1[0-2])$/.test(ym), ym)
}

for (const [cid, city] of Object.entries(CITIES)) validateCity(cid, city)

const cities = Object.keys(CITIES).length
console.log(fail ? `${fail} check(s) failed across ${cities} city(ies)` : `all checks passed for ${cities} city(ies)`)
process.exit(fail ? 1 : 0)
