import variants from '../media/variants.json'

type ImageVariants = { width: number; height: number; variants: { width: number; path: string; bytes: number }[] }
const images: Record<string, ImageVariants> = variants

/** Adapt known archive images for display only; saved evidence keeps its original URL. */
export function responsiveImage(src?: string) {
  if (!src) return null
  try {
    const path = decodeURIComponent(new URL(src, 'https://copy-my-trip.com').pathname)
    const match = path.match(/^\/media\/([^/]+\/[^/]+)$/)
    const image = match ? images[match[1]] : undefined
    if (!image) return null
    return {
      src: (image.variants.find(v => v.width >= 800) ?? image.variants.at(-1)!).path,
      srcSet: image.variants.map(v => `${v.path} ${v.width}w`).join(', '),
      width: image.width,
      height: image.height,
    }
  } catch { return null }
}
