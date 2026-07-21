/** City-data schema gate — validates every registered city's JSON beyond what
 * the type casts in `cities/<id>/index.ts` can promise. Run: npm run validate:cities.
 * Follows the assert style of preset-smoke.ts: PASS/FAIL lines, exit 1 on any FAIL. */
import { CITIES } from '../src/cities'
import type { City, Theme } from '../src/cities/types'

const MEALS = ['coffee', 'lunch', 'dinner', null]
const GROUPS = ['food', 'sight', 'indoor', 'park']
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

  for (const n of city.nodes) {
    check(`${tag} node "${n.name}" is a place`, nameSet.has(n.name))
    const p = byName.get(n.name)
    if (p) check(`${tag} node "${n.name}" hood matches its place`, n.hood === p.hood, `${n.hood} ≠ ${p.hood}`)
    check(`${tag} node "${n.name}" position 0–100`, n.x >= 0 && n.x <= 100 && n.y >= 0 && n.y <= 100)
  }

  // ── Curated days ──
  const slotIds = new Set<string>()
  for (const m of Object.values(city.media)) {
    for (const pl of m.plates ?? []) slotIds.add(pl.id)
    if (m.webImage) slotIds.add(m.webImage.id)
  }
  for (const d of city.curatedDays) {
    const t = `${tag} curated day ${d.index}`
    check(`${t}: title and verifiedLabel`, d.title.length > 0 && d.verifiedLabel.length > 0)
    for (const s of d.stops) {
      check(`${t} stop "${s.name}": kind valid`, ['verified', 'web-pin', 'web-image'].includes(s.kind))
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
