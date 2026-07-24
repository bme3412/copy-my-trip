/** Audits public/media/<city>/ against the city's data — the join that
 * `slot-files.json` makes by hand, checked against what is actually on disk.
 *
 * `validate:cities` proves the data agrees with ITSELF: a curated stop's
 * `kind` matches its place's `src`, a provenance string requires visits. It
 * cannot see the archive, so a place can be internally consistent and still
 * contradict the photographs sitting next to it. That is the gap this fills.
 *
 * Report-only, always. Every finding is a PROPOSAL for a human to confirm —
 * filenames and EXIF are evidence about a place, not proof the curator stood
 * there, and promoting a place to `verified` is a provenance claim the
 * product makes in the curator's voice. Nothing here writes to data/.
 *
 * Usage: npm run media:audit [city]
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { CITIES } from '../src/cities'

const cityId = process.argv[2] ?? 'paris'
const city = CITIES[cityId]
if (!city) {
  console.error(`Unknown city: ${cityId}`)
  process.exit(1)
}

const mediaDir = path.join(process.cwd(), 'public', 'media', cityId)
const srcDir = path.join(process.cwd(), 'src')
const files = fs.readdirSync(mediaDir).filter((f) => !f.endsWith('.md'))
const isVideo = (f: string) => /\.(mov|mp4)$/i.test(f)

/** Derived files inherit their source video's metadata. Kept in step with the
 * identical table in scripts/extract-dates.sh — if you add a conversion,
 * add it in both places. */
const GEN_SOURCE: [RegExp, string][] = [
  [/^_gen-vosges-/, 'paris-place-des-vosges.mov'],
  [/^_gen-maison-rose/, 'paris-montmartre-maison-rose.mov'],
  [/^_gen-notre-dame-pano/, 'paris-notre-dame-pano-empty.mov'],
  [/^_gen-vert-galant-pano/, 'paris-vert-gallant-pano.mov'],
  [/^_gen-seine-boat-pano/, 'paris-bridge-seine-boat-pano.mov'],
  [/^_gen-pont-neuf-dec26/, 'paris-pont-neuf-dec26.mov'],
  [/^_gen-saint-germain-bonaparte/, 'paris-saint-germain-bonaparte.mov'],
  [/^_gen-chez-janou/, 'paris-marais-chez-janou.mov'],
  [/^_gen-pont-des-arts-stevie/, 'paris-pont-des-arts-stevie-wonder.mov'],
  [/^_gen-pont-des-arts/, 'paris-pont-des-arts-pano.mov'],
  [/^_gen-pompidou/, 'paris-centre-pompidou.mov'],
  [/^_gen-st-germain-christmas/, 'paris-saint-germain-christmas.mov'],
  [/^_gen-arc-pano/, 'paris-arc-triomphe-pano.mov'],
  [/^_gen-sacre-pano/, 'paris-steps-sacre-coeur-pano-summer.mov'],
  [/^_gen-sacre-steps-music/, 'paris-sacre-coeur-steps-music.mov'],
  [/^_gen-sacre-rhcp/, 'paris-sacre-coeur-redhotchilipeppers.mov'],
  [/^_gen-sacre-sunny/, 'sacre-coeur-steps-sunny.mov'],
  [/^_gen-tournelle-golden/, 'paris-tournelle-golden.mov'],
  [/^_gen-buci-fete/, 'paris-buci-fete-musique.mov'],
  [/^_gen-bateau-mouche/, 'paris-bateau-mouche.mov'],
]
const genSource = (f: string) => GEN_SOURCE.find(([re]) => re.test(f))?.[1]

// ── evidence: where and when each file was taken ──────────────────────────

/** Videos keep their QuickTime location tag; ffmpeg drops it, so `_gen-*`
 * conversions inherit from the master exactly as their dates do. */
function gps(file: string): { lat: number; lon: number } | null {
  const source = genSource(file) ?? file
  if (!isVideo(source)) return null
  try {
    const out = execFileSync(
      'ffprobe',
      ['-v', 'error', '-show_entries', 'format_tags=com.apple.quicktime.location.ISO6709', '-of', 'csv=p=0', path.join(mediaDir, source)],
      { encoding: 'utf8' },
    ).trim()
    const m = out.match(/([+-]\d+\.\d+)([+-]\d+\.\d+)/)
    return m ? { lat: Number(m[1]), lon: Number(m[2]) } : null
  } catch {
    return null // no ffprobe, or no tag — the filename still carries a guess
  }
}

const rad = Math.PI / 180
/** Metres between two coordinates — the planner's haversine, in metres. */
function metres(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const dLat = (bLat - aLat) * rad
  const dLon = (bLon - aLon) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLon / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h)) * 1000
}

// Words that appear in half the filenames and every third place name — they
// carry no signal about WHICH place a file shows.
const STOP = new Set(['paris', 'the', 'de', 'du', 'des', 'la', 'le', 'les', 'a', 'gen', 'pano', 'jpeg', 'jpg', 'mov', 'mp4', 'and'])
const tokens = (s: string) =>
  new Set(
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 2 && !STOP.has(t)),
  )

const placeTokens = new Map(city.places.map((p) => [p.id, tokens(`${p.id} ${p.name} ${p.area ?? ''}`)]))
/** Filename-token overlap — "paris-ile-st-louis-berthillon" → berthillon. */
function byName(file: string): { id: string; score: number }[] {
  const ft = tokens(file)
  return city.places
    .map((p) => {
      const pt = placeTokens.get(p.id)!
      let score = 0
      for (const t of ft) if (pt.has(t)) score += t.length
      return { id: p.id, score }
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
}

// ── the current join, read three hops deep ────────────────────────────────

const slotFiles = city.slotFiles ?? {}
/** Every slot id some place or hood actually renders. */
const rendered = new Set<string>()
for (const m of Object.values(city.media)) {
  for (const pl of m.plates ?? []) rendered.add(pl.id)
  if (m.webImage) rendered.add(m.webImage.id)
}
for (const day of city.curatedDays) {
  for (const stop of day.stops) {
    for (const pl of stop.plates ?? []) rendered.add(pl.id)
    if (stop.webImage) rendered.add(stop.webImage.id)
  }
}
for (const h of city.hoods) rendered.add(h.id)

/** file -> the places that display it, through slot-files and the plates. */
const shownBy = new Map<string, string[]>()
const slotOwner = new Map<string, string>()
for (const [placeId, m] of Object.entries(city.media)) {
  for (const pl of m.plates ?? []) slotOwner.set(pl.id, placeId)
  if (m.webImage) slotOwner.set(m.webImage.id, placeId)
}
for (const [slot, entry] of Object.entries(slotFiles)) {
  for (const f of [entry.img, entry.video].filter(Boolean) as string[]) {
    const owner = slotOwner.get(slot) ?? `(slot ${slot})`
    shownBy.set(f, [...(shownBy.get(f) ?? []), owner])
  }
}

// Files a component names directly (hero photos) are used, not orphans.
const sourceText = (function walk(dir: string): string {
  let out = ''
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) out += walk(p)
    else if (/\.tsx?$/.test(e.name)) out += fs.readFileSync(p, 'utf8')
  }
  return out
})(srcDir)

// ── findings ──────────────────────────────────────────────────────────────

const H = (s: string) => `\n\x1b[1m${s}\x1b[0m`
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`
let findings = 0
const pad = (s: string, n: number) => s.padEnd(n)

// 1. Places whose provenance tier disagrees with the archive on disk.
console.log(H('1 · PROVENANCE vs THE ARCHIVE'))
console.log(dim('   Files naming a place that places.json says was never visited.'))
console.log(dim('   Evidence, not proof — confirm each before promoting anything.'))
const conflicts: string[] = []
for (const p of city.places) {
  if (p.src === 'verified') continue
  // Only UNASSIGNED files are evidence. A file already displayed by another
  // place says nothing about this one — `paris-notre-dame-seine.jpeg` shows
  // Notre-Dame from a bridge, not the restaurant that overlooks it.
  const hits = files.filter((f) => !f.startsWith('_gen-') && !shownBy.has(f) && byName(f)[0]?.id === p.id)
  if (!hits.length) continue
  const months = [...new Set(hits.map((f) => city.mediaDates?.[f]).filter(Boolean))].sort()
  conflicts.push(
    `   ${pad(p.id, 16)}${pad(`web · visits ${p.visits ?? 0}`, 20)}${hits.length} file(s)  ${months.length} distinct month(s): ${months.join(', ') || '—'}\n` +
      hits.map((f) => `        ${f}`).join('\n'),
  )
}
console.log(conflicts.length ? conflicts.join('\n') : '   none')
findings += conflicts.length

// 2. Verified places that claim visits and show nothing.
console.log(H('2 · BARE CLAIMS'))
console.log(dim('   Verified places declaring plates with no file behind any of them —'))
console.log(dim('   the timeline renders the accent dot over inert placeholder boxes,'))
console.log(dim('   verified chrome with nothing witnessed to show. Pending shots, not a bug.'))
const has = (slot: string) => {
  const e = slotFiles[slot]
  const conventional = [`${slot}.jpg`, `${slot}.mp4`]
  return !!((e?.img && files.includes(e.img)) || (e?.video && files.includes(e.video)) || conventional.some((c) => files.includes(c)))
}
const bare: string[] = []
for (const p of city.places) {
  if (p.src !== 'verified') continue
  const ids = (city.media[p.id]?.plates ?? []).map((pl) => pl.id)
  if (!ids.length) continue
  const filled = ids.filter(has).length
  if (filled === 0)
    bare.push(`   ${pad(p.id, 16)}${pad(`0/${ids.length} plates`, 14)}${pad(`${p.visits ?? 0} visits · last ${p.last || '—'}`, 26)}${ids.join(', ')}`)
}
console.log(bare.length ? bare.join('\n') : '   none')
findings += bare.length

// 3. Slots mapped to a file that nothing on the page renders.
console.log(H('3 · ORPHAN SLOTS'))
console.log(dim('   slot-files.json names a file, but no place or hood renders that slot.'))
const orphans = Object.keys(slotFiles)
  .filter((s) => !rendered.has(s))
  .map((s) => `   ${pad(s, 16)}${JSON.stringify(slotFiles[s])}`)
console.log(orphans.length ? orphans.join('\n') : '   none')
findings += orphans.length

// 4. Files on disk that nothing reaches.
console.log(H('4 · UNUSED FILES'))
console.log(dim('   Not in slot-files.json, not named in src/, not a master behind a _gen-*.'))
const convertedMasters = new Set(files.map(genSource).filter(Boolean) as string[])
const unused = files.filter((f) => !shownBy.has(f) && !sourceText.includes(f) && !convertedMasters.has(f))
console.log(
  unused.length
    ? unused
        .sort()
        .map((f) => {
          const guess = byName(f)[0]
          const where = guess ? `→ ${guess.id} (${city.places.find((p) => p.id === guess.id)?.src})` : '→ no place matches'
          return `   ${pad(f, 44)}${pad(city.mediaDates?.[f] ?? '—', 9)}${where}`
        })
        .join('\n')
    : '   none',
)
findings += unused.length

// 5. Masters that cannot ship — .mov is not a web format.
console.log(H('5 · UNCONVERTED MASTERS'))
console.log(dim('   .mov with no _gen-*.mp4 conversion — unplayable in the browser.'))
const unconverted = files.filter((f) => f.endsWith('.mov') && !convertedMasters.has(f))
console.log(unconverted.length ? unconverted.sort().map((f) => `   ${f}`).join('\n') : '   none')
findings += unconverted.length

// 6. What GPS says, where GPS exists.
console.log(H('6 · GPS PROPOSALS'))
console.log(dim('   Video carries coordinates. "agree" = GPS and filename pick the same place.'))
const rows: string[] = []
for (const f of files.filter(isVideo).sort()) {
  const g = gps(f)
  if (!g) continue
  const near = city.places
    .map((p) => ({ p, d: metres(g.lat, g.lon, p.lat, p.lon) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 3)
  const named = byName(f)[0]?.id
  const agree = named && named === near[0].p.id
  rows.push(
    `   ${pad(f, 40)}${agree ? '\x1b[32magree\x1b[0m ' : named ? '\x1b[33mDIFFER\x1b[0m' : dim('—     ')} ` +
      near.map((n) => `${n.p.id}(${Math.round(n.d)}m)`).join('  ') +
      (named && !agree ? dim(`   filename → ${named}`) : ''),
  )
}
console.log(rows.length ? rows.join('\n') : '   none (ffprobe unavailable?)')

console.log(`\n${findings} finding(s) across ${files.length} files and ${city.places.length} places.`)
console.log(dim('Report only — nothing was written. Confirm each finding before editing data/.'))
