import type { BeforeSend } from '@vercel/analytics/react'

/** Report screen names, never saved-trip identifiers, recovery codes or dates. */
export function analyticsPath(pathname: string): string | null {
  const match = pathname.match(/^\/(paris|rome)(?:\/(.*))?$/)
  if (!match) return null
  const base = `/${match[1]}`
  const path = (match[2] ?? '').replace(/\/$/, '')
  if (!path) return base
  if (/^(compose|saved|today|archive|neighbourhoods)$/.test(path)) return `${base}/${path}`
  if (/^itinerary\/\d+$/.test(path)) return `${base}/itinerary/:day`
  if (/^saved\/[^/]+(?:\/(briefing|alternatives))?$/.test(path)) {
    const suffix = path.split('/')[2]
    return `${base}/saved/:trip${suffix ? `/${suffix}` : ''}`
  }
  if (/^mail\/[^/]+$/.test(path)) return `${base}/mail/:briefing`
  return null
}

export const redactAnalyticsUrl: BeforeSend = event => {
  try {
    const url = new URL(event.url)
    const path = analyticsPath(url.pathname)
    if (!path) return null
    return { ...event, url: `${url.origin}${path}` }
  } catch {
    return null
  }
}
