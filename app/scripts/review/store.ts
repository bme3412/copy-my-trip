import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { CITIES } from '../../src/cities'
import batch from './paris-pilot.json'
import { hash, type JsonRecord, type Run, type Snapshot } from './core'

export const APP = process.cwd()
export const OUTPUT = join(APP, '.review-pilot')
export const PROMPT_VERSION = 'paris-review-v1'
export const DEFAULT_MODEL = 'gpt-6-astra'
export function catalogHash(): string {
  const dir = join(APP, 'src/cities/paris/data')
  return hash(readdirSync(dir).filter(f => f.endsWith('.json')).sort().map(f => [f, readFileSync(join(dir, f), 'utf8')]))
}
export function prepare(kind: Run['kind'] = 'live'): Run {
  if (!existsSync(join(APP, 'src/cities/paris/data/places.json'))) throw new Error('Run this command from app/')
  const city = CITIES.paris
  if (batch.places.length !== 20 || new Set(batch.places.map(p => p.id)).size !== 20) throw new Error('Pilot must have exactly 20 distinct places')
  const snapshots: Snapshot[] = batch.places.map(({ id, domains }) => {
    const place = city.places.find(p => p.id === id)
    if (!place) throw new Error(`Unknown pilot place ${id}`)
    const media = city.media[id]
    const slots = [...(media?.plates?.map(p => p.id) ?? []), ...(media?.webImage ? [media.webImage.id] : [])]
    const assets = slots.flatMap(slotId => [city.slotFiles?.[slotId]?.img, city.slotFiles?.[slotId]?.video]
      .filter((file): file is string => Boolean(file)).map(file => ({ file, slotId, captureMonth: city.mediaDates?.[file] ?? null })))
    return { id, name: place.name, domains, place: structuredClone(place) as unknown as JsonRecord,
      entry: structuredClone(city.entry[id] ?? {}) as unknown as JsonRecord, media: structuredClone(media ?? {}) as unknown as JsonRecord, assets }
  })
  return { version: 1, id: `${kind}-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`,
    kind, createdAt: new Date().toISOString(), batchId: batch.id, catalogHash: catalogHash(),
    model: process.env.REVIEW_MODEL || DEFAULT_MODEL, promptVersion: PROMPT_VERSION, revision: 0, snapshots,
    places: Object.fromEntries(snapshots.map(p => [p.id, { status: 'pending', handledCalls: {} }])), cost: null }
}
export function runDir(id: string): string {
  if (!/^(live|fixture)-[a-zA-Z0-9-]+$/.test(id)) throw new Error('Invalid run ID')
  return join(OUTPUT, id)
}
export function load(id: string): Run {
  const run = JSON.parse(readFileSync(join(runDir(id), 'run.json'), 'utf8')) as Run
  if (run.version !== 1 || run.id !== id || run.snapshots.length !== 20) throw new Error('Unsupported or damaged run file')
  return run
}
export function save(run: Run): void {
  const dir = runDir(run.id); mkdirSync(dir, { recursive: true, mode: 0o700 })
  const dest = join(dir, 'run.json'); const tmp = `${dest}.${randomUUID()}.tmp`
  run.revision++
  writeFileSync(tmp, `${JSON.stringify(run, null, 2)}\n`, { mode: 0o600 }); renameSync(tmp, dest)
}
/** One local process owns writes. A stale lock is deliberately not auto-stolen. */
export function lock(id: string): () => void {
  const file = join(runDir(id), 'writer.lock')
  let fd: number
  try { fd = openSync(file, 'wx', 0o600); writeFileSync(fd, String(process.pid)) }
  catch { throw new Error(`Run is locked. Stop its other process first. If it crashed, inspect ${file} and remove that stale lock.`) }
  return () => { closeSync(fd); unlinkSync(file) }
}
export function readKey(): string | undefined {
  if (process.env.OPENAI_API_KEY?.trim()) return process.env.OPENAI_API_KEY.trim()
  const file = join(APP, '.env.local')
  if (!existsSync(file)) return undefined
  // Read this one credential only. Never echo it or load unrelated environment settings.
  const line = readFileSync(file, 'utf8').split(/\r?\n/).find(s => /^\s*(?:export\s+)?OPENAI_API_KEY\s*=/.test(s))
  if (!line) return undefined
  const value = line.slice(line.indexOf('=') + 1).trim()
  return value.startsWith('"') || value.startsWith("'") ? value.slice(1, value.indexOf(value[0], 1)).trim() || undefined : value.split(/\s+#/)[0].trim() || undefined
}
export function assetPath(run: Run, file: string): string {
  if (!run.snapshots.some(p => p.assets.some(a => a.file === file)) || file !== file.split(/[\\/]/).pop()) throw new Error('Unknown asset')
  return resolve(APP, 'public/media/paris', file)
}
