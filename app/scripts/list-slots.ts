/** Generates public/media/<city>/SLOTS.md — the checklist of every media slot
 * the app renders — and reports which are filled vs missing on disk. */
import fs from 'node:fs'
import path from 'node:path'
import { CITIES } from '../src/cities'

const cityId = process.argv[2] ?? 'paris'
const city = CITIES[cityId]
if (!city) {
  console.error(`Unknown city: ${cityId}`)
  process.exit(1)
}

interface Slot {
  id: string
  place: string
  caption: string
  size: string
  video?: string
  context: string
}

const slots = new Map<string, Slot>()
const add = (s: Slot) => {
  if (!slots.has(s.id)) slots.set(s.id, s)
}

for (const day of city.curatedDays) {
  for (const stop of day.stops) {
    for (const pl of stop.plates ?? []) {
      add({ id: pl.id, place: stop.name, caption: pl.caption, size: `${pl.w}×${pl.h}`, video: pl.video, context: `Day ${day.index}` })
    }
    if (stop.webImage) add({ id: stop.webImage.id, place: stop.name, caption: stop.webImage.caption, size: '360×210', context: `Day ${day.index}` })
  }
}
for (const [placeId, media] of Object.entries(city.media)) {
  const place = city.places.find((p) => p.id === placeId)?.name ?? placeId
  for (const pl of media.plates ?? []) {
    add({ id: pl.id, place, caption: pl.caption, size: `${pl.w}×${pl.h}`, video: pl.video, context: 'Builder days' })
  }
  if (media.webImage) add({ id: media.webImage.id, place, caption: media.webImage.caption, size: '360×210', context: 'Builder days' })
}
for (const hood of city.hoods) {
  add({ id: hood.id, place: hood.title, caption: hood.image, size: '300×210', context: 'Neighbourhoods' })
}

// Resolved from the app root (npm always runs scripts with cwd = package dir);
// __dirname would point at the bundled script's location under node_modules.
const destDir = path.join(process.cwd(), 'public', 'media', cityId)
fs.mkdirSync(destDir, { recursive: true })
// A slot is filled if its mapped archive file exists, or a conventionally
// named file does.
const fileFor = (id: string, kind: 'img' | 'video'): string | null => {
  const mapped = city.slotFiles?.[id]?.[kind]
  const conventional = `${id}.${kind === 'img' ? 'jpg' : 'mp4'}`
  if (mapped && fs.existsSync(path.join(destDir, mapped))) return mapped
  if (fs.existsSync(path.join(destDir, conventional))) return conventional
  return null
}

const rows = [...slots.values()]
const contexts = [...new Set(rows.map((r) => r.context))]
let filled = 0
let md = `# Media slots — ${city.name}\n\nSlots resolve through the slot-file map (\`src/cities/${cityId}/slot-files.ts\`) first —\narchive files keep their own names — then the \`<slot-id>.jpg\` / \`<slot-id>.mp4\`\nnaming convention. Missing files simply render as placeholders.\nRe-run \`npm run media:slots\` to refresh this checklist.\n\n`
for (const ctx of contexts) {
  md += `## ${ctx}\n\n| ✓ | Slot id | Place | What the shot is | Frame | Video | Source file |\n|---|---|---|---|---|---|---|\n`
  for (const r of rows.filter((x) => x.context === ctx)) {
    const img = fileFor(r.id, 'img')
    const vid = r.video ? fileFor(r.id, 'video') : undefined
    const done = !!img && (!r.video || !!vid)
    if (img) filled++
    const videoCol = r.video ? `${r.video}${vid ? ' ✓' : ' — needs video'}` : '—'
    const srcCol = [img, vid].filter(Boolean).map((f) => `\`${f}\``).join('<br>') || ' '
    md += `| ${done ? '✓' : ' '} | \`${r.id}\` | ${r.place} | ${r.caption} | ${r.size} | ${videoCol} | ${srcCol} |\n`
  }
  md += '\n'
}
md += `---\n${filled} of ${rows.length} photo slots filled.\n`

fs.writeFileSync(path.join(destDir, 'SLOTS.md'), md)
console.log(`${filled} of ${rows.length} photo slots filled · checklist written to public/media/${cityId}/SLOTS.md`)
const missing = rows.filter((r) => !fileFor(r.id, 'img'))
if (missing.length && missing.length <= 60) {
  console.log('Still placeholders: ' + missing.map((r) => r.id).join(', '))
}
