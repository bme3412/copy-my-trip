/** Reading the archive itself: which master a derived file inherits from, and
 * the moment a file was actually captured.
 *
 * `extract-dates.sh` already harvests capture dates, but truncates them to
 * YYYY-MM — enough for a plate caption, and nothing else. The hour is the part
 * the engine needs and the part no other source has: a place's `best` window,
 * how long a visit ran, how long the walk between two places really took. This
 * module keeps the full local timestamp so the rest of the tooling can use it.
 *
 * Local time throughout, deliberately. A photograph's evidence is "quarter past
 * five in the afternoon, there" — converting to UTC would destroy exactly the
 * fact being measured.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

export const isVideo = (f: string) => /\.(mov|mp4)$/i.test(f)
export const isPhoto = (f: string) => /\.(jpe?g|png|heic)$/i.test(f)

/** Derived files inherit their source video's metadata. Kept in step with the
 * identical table in scripts/extract-dates.sh — if you add a conversion, add
 * it in both places. */
export const GEN_SOURCE: [RegExp, string][] = [
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
export const genSource = (f: string) => GEN_SOURCE.find(([re]) => re.test(f))?.[1]

export interface Capture {
  /** Local calendar date, YYYY-MM-DD. */
  date: string
  /** Local minutes past midnight. */
  minutes: number
  /** How the moment was read — QuickTime carries a UTC offset, EXIF does not
   * (it is already local, with no way to prove it). */
  from: 'quicktime' | 'exif'
}

export interface Coords {
  lat: number
  lon: number
}

/** EXIF, read directly. `sips` reports a capture date but will not surrender
 * coordinates, and no dependency is worth adding for two IFD lookups — so the
 * few hundred bytes of TIFF that matter are parsed here.
 *
 * Only the prefix is read: APP1 sits immediately after the SOI marker, so a
 * quarter-megabyte covers it without pulling whole 25 MB files into memory. */
function readExif(file: string): { capture?: Capture; coords?: Coords } {
  let buf: Buffer
  try {
    const fd = fs.openSync(file, 'r')
    buf = Buffer.alloc(256 * 1024)
    const read = fs.readSync(fd, buf, 0, buf.length, 0)
    fs.closeSync(fd)
    buf = buf.subarray(0, read)
  } catch {
    return {}
  }
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return {} // not a JPEG

  // Walk the marker segments looking for APP1/Exif.
  let seg = 2
  let tiff = -1
  while (seg + 4 <= buf.length && buf[seg] === 0xff) {
    const marker = buf[seg + 1]
    if (marker === 0xda) break // image data begins; metadata is behind us
    const len = buf.readUInt16BE(seg + 2)
    if (marker === 0xe1 && buf.subarray(seg + 4, seg + 10).toString('latin1') === 'Exif\0\0') {
      tiff = seg + 10
      break
    }
    seg += 2 + len
  }
  if (tiff < 0 || tiff + 8 > buf.length) return {}

  const le = buf.subarray(tiff, tiff + 2).toString('latin1') === 'II'
  const u16 = (o: number) => (o + 2 <= buf.length ? (le ? buf.readUInt16LE(o) : buf.readUInt16BE(o)) : 0)
  const u32 = (o: number) => (o + 4 <= buf.length ? (le ? buf.readUInt32LE(o) : buf.readUInt32BE(o)) : 0)
  if (u16(tiff + 2) !== 0x2a) return {}

  interface Entry {
    type: number
    count: number
    at: number
  }
  /** An IFD is a count followed by 12-byte entries. A value larger than the
   * four bytes an entry carries is stored elsewhere, addressed from the TIFF
   * header — hence `at` rather than a value. */
  const readIfd = (offset: number): Map<number, Entry> => {
    const out = new Map<number, Entry>()
    if (offset <= 0 || offset + 2 > buf.length) return out
    const n = u16(offset)
    for (let i = 0; i < n; i++) {
      const e = offset + 2 + i * 12
      if (e + 12 > buf.length) break
      const type = u16(e + 2)
      const count = u32(e + 4)
      const SIZE = [0, 1, 1, 2, 4, 8, 1, 1, 2, 4, 8][type] ?? 0
      const bytes = SIZE * count
      out.set(u16(e), { type, count, at: bytes > 4 ? tiff + u32(e + 8) : e + 8 })
    }
    return out
  }

  const rational = (at: number) => {
    const denom = u32(at + 4)
    return denom ? u32(at) / denom : 0
  }
  /** Degrees, minutes, seconds — three rationals back to back. */
  const dms = (e: Entry) => rational(e.at) + rational(e.at + 8) / 60 + rational(e.at + 16) / 3600
  const ascii = (e: Entry) => buf.subarray(e.at, e.at + e.count).toString('latin1').replace(/\0.*$/, '')

  const ifd0 = readIfd(tiff + u32(tiff + 4))
  const out: { capture?: Capture; coords?: Coords } = {}

  const gpsPtr = ifd0.get(0x8825)
  if (gpsPtr) {
    const gps = readIfd(tiff + u32(gpsPtr.at))
    const latE = gps.get(0x0002)
    const lonE = gps.get(0x0004)
    const latRef = gps.get(0x0001)
    const lonRef = gps.get(0x0003)
    if (latE?.count === 3 && lonE?.count === 3) {
      const lat = dms(latE) * (latRef && ascii(latRef).startsWith('S') ? -1 : 1)
      const lon = dms(lonE) * (lonRef && ascii(lonRef).startsWith('W') ? -1 : 1)
      if (lat || lon) out.coords = { lat, lon }
    }
  }

  // DateTimeOriginal is when the shutter fired; the IFD0 DateTime can be a
  // later edit. Prefer the former, fall back to the latter.
  const exifPtr = ifd0.get(0x8769)
  const exifIfd = exifPtr ? readIfd(tiff + u32(exifPtr.at)) : new Map<number, Entry>()
  const dt = exifIfd.get(0x9003) ?? exifIfd.get(0x9004) ?? ifd0.get(0x0132)
  if (dt) {
    const cap = parseExif(ascii(dt))
    if (cap) out.capture = cap
  }
  return out
}

const parseQuickTime = (s: string): Capture | null => {
  // 2024-12-26T16:34:14+01:00 — already local at the point of capture.
  const m = s.trim().match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/)
  return m ? { date: m[1], minutes: Number(m[2]) * 60 + Number(m[3]), from: 'quicktime' } : null
}

const parseExif = (s: string): Capture | null => {
  // 2022:07:19 19:51:51 — EXIF's colon-separated date, local by convention.
  const m = s.trim().match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2})/)
  return m ? { date: `${m[1]}-${m[2]}-${m[3]}`, minutes: Number(m[4]) * 60 + Number(m[5]), from: 'exif' } : null
}

function videoCapture(file: string): Capture | null {
  try {
    const out = execFileSync(
      'ffprobe',
      ['-v', 'error', '-show_entries', 'format_tags=com.apple.quicktime.creationdate', '-of', 'csv=p=0', file],
      { encoding: 'utf8' },
    )
    return parseQuickTime(out)
  } catch {
    return null // no ffprobe, or a video that never carried the tag
  }
}

function videoCoords(file: string): Coords | null {
  try {
    const out = execFileSync(
      'ffprobe',
      ['-v', 'error', '-show_entries', 'format_tags=com.apple.quicktime.location.ISO6709', '-of', 'csv=p=0', file],
      { encoding: 'utf8' },
    )
    const m = out.match(/([+-]\d+\.\d+)([+-]\d+\.\d+)/)
    return m ? { lat: Number(m[1]), lon: Number(m[2]) } : null
  } catch {
    return null
  }
}

/** Where each file was taken, derived files resolved through their master.
 * Absence is ordinary: location services are a per-shot setting, and a phone
 * indoors may fail to fix at all. */
export function fileCoords(dir: string, files: string[]): Map<string, Coords> {
  const direct = new Map<string, Coords>()
  const out = new Map<string, Coords>()
  for (const f of files) {
    const master = genSource(f) ?? f
    if (!direct.has(master)) {
      const c = isVideo(master) ? videoCoords(path.join(dir, master)) : readExif(path.join(dir, master)).coords
      if (c) direct.set(master, c)
    }
    const c = direct.get(master)
    if (c) out.set(f, c)
  }
  return out
}

/** `sips` accepts many files at once and prints a path line followed by its
 * tags — one process for the whole archive instead of one per photograph.
 * Only consulted for photographs whose own EXIF gave nothing. */
function photoCaptures(dir: string, files: string[]): Map<string, Capture> {
  const found = new Map<string, Capture>()
  const remaining: string[] = []
  for (const f of files) {
    const cap = readExif(path.join(dir, f)).capture
    if (cap) found.set(f, cap)
    else remaining.push(f)
  }
  const BATCH = 50
  for (let i = 0; i < remaining.length; i += BATCH) {
    const batch = remaining.slice(i, i + BATCH)
    let out = ''
    try {
      out = execFileSync('sips', ['-g', 'creation', ...batch.map((f) => path.join(dir, f))], { encoding: 'utf8' })
    } catch {
      continue // sips is macOS-only; elsewhere photos simply have no evidence
    }
    let current = ''
    for (const line of out.split('\n')) {
      if (!line.startsWith(' ')) current = path.basename(line.trim())
      else {
        const m = line.match(/creation:\s*(.+)$/)
        const cap = m && parseExif(m[1])
        if (cap && current) found.set(current, cap)
      }
    }
  }
  return found
}

/** Every file's capture moment, derived files resolved through their master.
 * Files whose metadata was stripped in export are simply absent — unknown is a
 * legitimate state here too. */
export function captureTimes(dir: string, files: string[]): Map<string, Capture> {
  const masters = new Set<string>()
  for (const f of files) {
    const src = genSource(f) ?? f
    masters.add(src)
  }

  const direct = new Map<string, Capture>()
  for (const m of masters) if (isVideo(m)) {
    const cap = videoCapture(path.join(dir, m))
    if (cap) direct.set(m, cap)
  }
  for (const [f, cap] of photoCaptures(dir, [...masters].filter(isPhoto))) direct.set(f, cap)

  const out = new Map<string, Capture>()
  for (const f of files) {
    const cap = direct.get(genSource(f) ?? f)
    if (cap) out.set(f, cap)
  }
  return out
}
