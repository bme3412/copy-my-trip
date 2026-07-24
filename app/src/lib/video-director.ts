/** One plate plays at a time, document-wide. The clips are mostly slow pans —
 * one reads as a living still, several at once read as a control room. The
 * playing plate holds the stage until it scrolls out of the viewport's middle;
 * then the most visible candidate takes over. Users who prefer reduced motion
 * get no automatic playback at all — a plate they select still plays. */

const RATIO_PLAY = 0.5

const ratios = new Map<HTMLVideoElement, number>()
let current: HTMLVideoElement | null = null
let raf = 0

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const io =
  typeof IntersectionObserver !== 'undefined'
    ? new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            const el = e.target as HTMLVideoElement
            if (ratios.has(el)) ratios.set(el, e.intersectionRatio)
          }
          schedule()
        },
        { threshold: [0, 0.25, RATIO_PLAY, 0.75, 1] },
      )
    : null

function schedule() {
  cancelAnimationFrame(raf)
  raf = requestAnimationFrame(elect)
}

function elect() {
  if (reducedMotion()) return
  // Stability first: whoever is playing keeps playing while still in the middle.
  if (current && (ratios.get(current) ?? 0) >= RATIO_PLAY) {
    play(current)
    return
  }
  let best: HTMLVideoElement | null = null
  for (const [el, r] of ratios) {
    if (r < RATIO_PLAY) continue
    const bestR = best ? ratios.get(best)! : -1
    if (r > bestR || (r === bestR && best && precedes(el, best))) best = el
  }
  handOff(best)
}

function precedes(a: HTMLVideoElement, b: HTMLVideoElement): boolean {
  return !!(b.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_PRECEDING)
}

function handOff(next: HTMLVideoElement | null) {
  if (current && current !== next) current.pause()
  current = next
  if (current) play(current)
}

function play(el: HTMLVideoElement) {
  if (el.paused) el.play().catch(() => {})
}

/** Register a plate's video for direction. Returns its cleanup. */
export function directVideo(el: HTMLVideoElement): () => void {
  ratios.set(el, 0)
  io?.observe(el)
  schedule()
  return () => {
    io?.unobserve(el)
    ratios.delete(el)
    if (current === el) {
      current = null
      schedule()
    }
  }
}

/** A user chose this plate — it takes the stage regardless of scroll position. */
export function claimVideo(el: HTMLVideoElement) {
  handOff(el)
}
