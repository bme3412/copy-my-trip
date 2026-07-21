/** Deterministic solar times — no API, just astronomy. NOAA-style
 * approximation (zenith 90.833° for official rise/set); accuracy within a
 * few minutes, which is all a "golden hour from about…" sentence needs. */

const rad = Math.PI / 180
const deg = 180 / Math.PI
const norm = (x: number, max: number) => ((x % max) + max) % max

function dayOfYear(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number)
  const start = Date.UTC(y, 0, 1)
  return Math.round((Date.UTC(y, m - 1, d) - start) / 86400000) + 1
}

/** Sunrise/sunset as minutes-of-day, local time via tzOffsetMin. */
export function sunTimes(lat: number, lon: number, isoDate: string, tzOffsetMin: number): { sunrise: number; sunset: number } {
  const N = dayOfYear(isoDate)
  const lngHour = lon / 15
  const zenith = 90.833

  const calc = (rising: boolean): number => {
    const t = N + ((rising ? 6 : 18) - lngHour) / 24
    const M = 0.9856 * t - 3.289
    const L = norm(M + 1.916 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 282.634, 360)
    let RA = norm(deg * Math.atan(0.91764 * Math.tan(L * rad)), 360)
    // RA must sit in the same quadrant as L
    RA += Math.floor(L / 90) * 90 - Math.floor(RA / 90) * 90
    RA /= 15
    const sinDec = 0.39782 * Math.sin(L * rad)
    const cosDec = Math.cos(Math.asin(sinDec))
    const cosH = (Math.cos(zenith * rad) - sinDec * Math.sin(lat * rad)) / (cosDec * Math.cos(lat * rad))
    // Polar edge cases clamp to midnight/noon-ish; irrelevant for Paris/Rome.
    const H = (rising ? 360 - deg * Math.acos(Math.max(-1, Math.min(1, cosH))) : deg * Math.acos(Math.max(-1, Math.min(1, cosH)))) / 15
    const T = H + RA - 0.06571 * t - 6.622
    const UT = norm(T - lngHour, 24)
    return norm(UT * 60 + tzOffsetMin, 24 * 60)
  }

  return { sunrise: calc(true), sunset: calc(false) }
}

/** CET/CEST offset in minutes for a date — the EU rule: summer time from the
 * last Sunday of March to the last Sunday of October. Correct for Paris and
 * Rome alike. */
export function euTzOffsetMin(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number)
  const lastSunday = (month: number) => {
    const last = new Date(Date.UTC(y, month, 0)) // day 0 of next month = last day
    return last.getUTCDate() - last.getUTCDay()
  }
  const afterMarch = m > 3 || (m === 3 && d >= lastSunday(3))
  const beforeOctEnd = m < 10 || (m === 10 && d < lastSunday(10))
  return afterMarch && beforeOctEnd ? 120 : 60
}
