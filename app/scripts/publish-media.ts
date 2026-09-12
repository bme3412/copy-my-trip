import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { dirname, extname, join } from 'node:path'
import { spawnSync } from 'node:child_process'

type SlotFiles = Record<string, { img?: string; video?: string }>
type ExtraFiles = Record<string, string[]>
type StackOutputs = Record<string, Record<string, string>>

interface MediaAsset {
  city: string
  file: string
  source: string
}

const ROOT = process.cwd()
const CITIES_DIR = join(ROOT, 'src/cities')
const MEDIA_DIR = join(ROOT, 'public/media')
const STAGE_DIR = join(ROOT, 'node_modules/.tmp/media-publish')
const OUTPUTS_FILE = join(ROOT, '../infra/outputs.json')
const EXTRAS_FILE = join(ROOT, 'media-extras.json')
const WEB_EXTENSIONS = new Set(['.jpg', '.jpeg', '.mp4'])

function json<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T
}

function collectAssets(): MediaAsset[] {
  const extras = json<ExtraFiles>(EXTRAS_FILE)
  const assets = new Map<string, MediaAsset>()

  for (const city of readdirSync(CITIES_DIR, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name)) {
    const slotsPath = join(CITIES_DIR, city, 'data/slot-files.json')
    if (!existsSync(slotsPath)) continue

    const slots = json<SlotFiles>(slotsPath)
    const files = [
      ...Object.values(slots).flatMap((entry) => [entry.img, entry.video]),
      ...(extras[city] ?? []),
    ].filter((file): file is string => !!file)

    for (const file of files) {
      const extension = extname(file).toLowerCase()
      if (!WEB_EXTENSIONS.has(extension)) {
        throw new Error(`${city}/${file} is not a browser-ready JPEG or MP4`)
      }
      const source = join(MEDIA_DIR, city, file)
      if (!existsSync(source)) throw new Error(`Missing runtime media: ${source}`)
      assets.set(`${city}/${file}`, { city, file, source })
    }
  }

  return [...assets.values()].sort((a, b) => `${a.city}/${a.file}`.localeCompare(`${b.city}/${b.file}`))
}

function readDeployment(): { bucket: string; distributionId: string } {
  let output: Record<string, string> = {}
  if (existsSync(OUTPUTS_FILE)) {
    const stacks = Object.values(json<StackOutputs>(OUTPUTS_FILE))
    output = stacks[0] ?? {}
  }

  const bucket = process.env.MEDIA_BUCKET ?? output.MediaBucketName
  const distributionId = process.env.MEDIA_DISTRIBUTION_ID ?? output.MediaDistributionId
  if (!bucket || !distributionId) {
    throw new Error(
      'Missing AWS destination. Deploy infra with `npm run deploy` or set MEDIA_BUCKET and MEDIA_DISTRIBUTION_ID.',
    )
  }
  return { bucket, distributionId }
}

function run(command: string, args: string[]): void {
  const result = spawnSync(command, args, { stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${command} exited with status ${result.status}`)
}

const assets = collectAssets()
const bytes = assets.reduce((total, asset) => total + statSync(asset.source).size, 0)
const cities = [...new Set(assets.map((asset) => asset.city))]
console.log(`Runtime manifest: ${assets.length} files across ${cities.join(', ')} (${(bytes / 1024 / 1024).toFixed(1)} MiB)`)

if (process.argv.includes('--check')) process.exit(0)

const { bucket, distributionId } = readDeployment()
rmSync(STAGE_DIR, { recursive: true, force: true })

for (const asset of assets) {
  const destination = join(STAGE_DIR, 'media', asset.city, asset.file)
  mkdirSync(dirname(destination), { recursive: true })
  copyFileSync(asset.source, destination)
}

const syncArgs = [
  's3',
  'sync',
  join(STAGE_DIR, 'media'),
  `s3://${bucket}/media`,
  '--cache-control',
  'public,max-age=31536000,immutable',
  '--only-show-errors',
]
if (process.argv.includes('--delete')) syncArgs.push('--delete')

run('aws', syncArgs)

if (!process.argv.includes('--no-invalidate')) {
  run('aws', [
    'cloudfront',
    'create-invalidation',
    '--distribution-id',
    distributionId,
    '--paths',
    '/media/*',
  ])
}

console.log(`Published ${assets.length} files to s3://${bucket}/media`)
