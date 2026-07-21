import { useEffect, useRef } from 'react'
import type { City, StartLoc } from '../cities/types'
import type { Candidate, DayState } from '../lib/planner'

interface Props {
  token: string
  city: City
  home: StartLoc
  day: DayState
  candidates?: Candidate[]
  hoverId?: string | null
  onHover?: (id: string | null) => void
  onChoose?: (c: Candidate) => void
}

/** Live Mapbox map for the itinerary: the committed route draws from home as
 * a gold dashed line with numbered ring markers (filled = archive, dashed =
 * web-tier candidates); an open deck's candidates are clickable pins that
 * hover-sync with the cards. mapbox-gl is dynamically imported so SSR and
 * smoke tests never touch it. Without a token, RouteMap stands in. */
export function TripMap({ token, city, home, day, candidates = [], hoverId = null, onHover, onChoose }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapboxRef = useRef<any>(null)
  const readyRef = useRef(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<any[]>([])
  const candElsRef = useRef<Map<string, HTMLDivElement>>(new Map())

  const sync = () => {
    const mapboxgl = mapboxRef.current
    const map = mapRef.current
    if (!mapboxgl || !map || !readyRef.current) return
    for (const m of markersRef.current) m.remove()
    markersRef.current = []
    candElsRef.current.clear()

    const placeOf = (id: string) => city.places.find((p) => p.id === id)
    const routeCoords: [number, number][] = [[home.lon, home.lat]]
    for (const c of day.committed) {
      const p = placeOf(c.id)
      if (p) routeCoords.push([p.lon, p.lat])
    }

    const addMarker = (el: HTMLDivElement, lngLat: [number, number]) => {
      markersRef.current.push(new mapboxgl.Marker({ element: el, anchor: 'center' }).setLngLat(lngLat).addTo(map))
    }
    const node = (ringClass: string, label: string, ringText?: string) => {
      const el = document.createElement('div')
      el.className = 'map-node'
      const ring = document.createElement('span')
      ring.className = `map-ring ${ringClass}`
      if (ringText) ring.textContent = ringText
      const name = document.createElement('span')
      name.className = 'map-name'
      name.textContent = label
      el.append(ring, name)
      return el
    }

    addMarker(node('map-ring-home', home.name), [home.lon, home.lat])

    day.committed.forEach((c, i) => {
      const p = placeOf(c.id)
      if (p) addMarker(node(c.src === 'verified' ? 'map-ring-v map-ring-num' : 'map-ring-w map-ring-num', c.name, String(i + 1)), [p.lon, p.lat])
    })

    for (const cand of candidates) {
      const el = node('map-ring-cand', cand.p.name)
      el.classList.add('map-cand')
      if (onHover) {
        el.addEventListener('mouseenter', () => onHover(cand.p.id))
        el.addEventListener('mouseleave', () => onHover(null))
      }
      if (onChoose) el.addEventListener('click', () => onChoose(cand))
      candElsRef.current.set(cand.p.id, el)
      addMarker(el, [cand.p.lon, cand.p.lat])
    }

    const src = map.getSource('route')
    if (src) src.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: routeCoords } })

    const bounds = new mapboxgl.LngLatBounds()
    for (const c of routeCoords) bounds.extend(c)
    for (const cand of candidates) bounds.extend([cand.p.lon, cand.p.lat])
    if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 64, duration: 500, maxZoom: 14.5 })
  }
  const syncRef = useRef(sync)
  syncRef.current = sync

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const mapboxgl = (await import('mapbox-gl')).default
      if (cancelled || !containerRef.current || mapRef.current) return
      mapboxgl.accessToken = token
      mapboxRef.current = mapboxgl
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [city.start.lon, city.start.lat],
        zoom: 12,
        scrollZoom: false,
      })
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-left')
      map.on('load', () => {
        map.addSource('route', {
          type: 'geojson',
          data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } },
        })
        map.addLayer({
          id: 'route',
          type: 'line',
          source: 'route',
          paint: { 'line-color': '#b68235', 'line-width': 2, 'line-dasharray': [1.5, 1.5], 'line-opacity': 0.8 },
        })
        map.resize()
        readyRef.current = true
        syncRef.current()
      })
      mapRef.current = map
    })()
    return () => {
      cancelled = true
      markersRef.current = []
      candElsRef.current.clear()
      readyRef.current = false
      mapRef.current?.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => syncRef.current(), [city, day, candidates, home])

  useEffect(() => {
    for (const [id, el] of candElsRef.current) el.classList.toggle('gnode-hot', id === hoverId)
  }, [hoverId])

  return <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
}
