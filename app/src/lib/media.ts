import type { City } from '../cities/types'

/** Slot media resolves through the city's slot-file map first (archive files
 * keep their own names), then falls back to the `<slot-id>.jpg` /
 * `<slot-id>.mp4` filename convention. Missing files render as the styled
 * placeholder at runtime. */
export function slotSrc(city: City, slotId: string): string {
  const mapped = city.slotFiles?.[slotId]?.img
  return `/media/${city.id}/${mapped ?? `${slotId}.jpg`}`
}

export function slotVideoSrc(city: City, slotId: string): string {
  const mapped = city.slotFiles?.[slotId]?.video
  return `/media/${city.id}/${mapped ?? `${slotId}.mp4`}`
}

/** True when real footage is mapped to this slot — badges only for real video. */
export function slotHasVideo(city: City, slotId: string): boolean {
  return !!city.slotFiles?.[slotId]?.video
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const fmtYm = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`

/** Sorted unique capture months for a set of slots (from real file metadata). */
function slotYms(city: City, slotIds: string[]): string[] {
  const yms = new Set<string>()
  for (const id of slotIds) {
    const entry = city.slotFiles?.[id]
    for (const f of [entry?.img, entry?.video]) {
      const ym = f && city.mediaDates?.[f]
      if (ym) yms.add(ym)
    }
  }
  return [...yms].sort()
}

/** "Jul 2024", "Jul 2024 · Dec 2024", or "Jul 2024 – Jun 2026". */
export function slotDatesLabel(city: City, slotIds: string[]): string | null {
  const s = slotYms(city, slotIds)
  if (s.length === 0) return null
  if (s.length === 1) return fmtYm(s[0])
  if (s.length === 2) return `${fmtYm(s[0])} · ${fmtYm(s[1])}`
  return `${fmtYm(s[0])} – ${fmtYm(s[s.length - 1])}`
}

function placeSlotIds(city: City, placeId: string): string[] {
  const media = city.media[placeId]
  if (!media) return []
  return [...(media.plates?.map((p) => p.id) ?? []), ...(media.webImage ? [media.webImage.id] : [])]
}

export function placeDatesLabel(city: City, placeId: string): string | null {
  return slotDatesLabel(city, placeSlotIds(city, placeId))
}

/** Most recent capture month for a place's mapped media. */
export function placeLatestLabel(city: City, placeId: string): string | null {
  const s = slotYms(city, placeSlotIds(city, placeId))
  return s.length ? fmtYm(s[s.length - 1]) : null
}

/** Capture month of a specific archive file ("Jul 2024"), if known. */
export function fileDateLabel(city: City, file: string): string | null {
  const ym = city.mediaDates?.[file]
  return ym ? fmtYm(ym) : null
}
