import { createHash } from 'node:crypto'
import { readFile, writeFile, readdir, mkdir, stat } from 'node:fs/promises'
import { resolve, extname, basename } from 'node:path'
import sharp from 'sharp'

const app = resolve(import.meta.dirname, '..')
const media = resolve(app, 'public/media')
const widths = [320, 800, 1440]
const manifest = {}
let originalBytes = 0
let largestBytes = 0
let count = 0
// Content-addressed URLs allow long-lived caching without stale replacements.
for (const city of await readdir(media, { withFileTypes: true })) {
  if (!city.isDirectory() || city.name === 'optimized') continue
  const output = resolve(media, 'optimized', city.name)
  await mkdir(output, { recursive: true })
  for (const file of await readdir(resolve(media, city.name))) {
    if (!/\.(jpe?g|png)$/i.test(file)) continue
    const input = await readFile(resolve(media, city.name, file))
    const hash = createHash('sha256').update(input).update('webp-q78-auto-orient-v1').digest('hex').slice(0, 12)
    const metadata = await sharp(input).metadata()
    const sourceWidth = metadata.autoOrient?.width ?? (metadata.orientation >= 5 ? metadata.height : metadata.width)
    const sourceHeight = metadata.autoOrient?.height ?? (metadata.orientation >= 5 ? metadata.width : metadata.height)
    const sizes = [...new Set(widths.map(w => Math.min(w, sourceWidth)))].sort((a,b)=>a-b)
    const variants = []
    for (const width of sizes) {
      const name = `${basename(file, extname(file))}.${hash}-${width}.webp`
      const target = resolve(output, name)
      try { await stat(target) } catch {
        await sharp(input).rotate().resize({ width, withoutEnlargement: true }).webp({quality:78, effort:4}).toFile(target)
      }
      variants.push({ width, path: `/media/optimized/${city.name}/${name}`, bytes: (await stat(target)).size })
    }
    manifest[`${city.name}/${file}`] = { width: sourceWidth, height: sourceHeight, variants }
    originalBytes += input.length
    largestBytes += variants.at(-1).bytes
    count++
  }
}
await mkdir(resolve(app,'src/media'),{recursive:true})
await writeFile(resolve(app,'src/media/variants.json'),JSON.stringify(manifest,null,2)+'\n')
console.log(JSON.stringify({ images:count, originalBytes, largestVariantBytes:largestBytes, reductionPercent:Math.round((1-largestBytes/originalBytes)*100) }))
