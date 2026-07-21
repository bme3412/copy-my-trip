import { useEffect, useRef } from 'react'
import type { City, StartLoc } from '../cities/types'
import type { Candidate, DayState } from '../lib/planner'

interface Props {
  token: string
  city: City
  home: StartLoc
  day: DayState
  candidates: Candidate[]
  hoverId: string | null
  onHover: (id: string | null) => void
  onChoose: (c: Candidate) => void
}

/** Live map for the day builder: the committed route draws from home as a
 * gold line; the current candidates are clickable pins that hover-sync with
 * the cards. mapbox-gl loads dynamically — SSR/smoke never touch it. */
export function BuilderMap({ token, city, home, day, candidates, hoverId, onHover, onChoose }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null)
  const readyRef = useRef(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<any[]>([])
  const candElsRef = useRef<Map<string, HTMLDivElement>>(new Map())

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sync = (mapboxgl: any, map: any) => {
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

    addMarker(node('map-ring-home', 'your place'), [home.lon, home.lat])

    day.committed.forEach((c, i) => {
      const p = placeOf(c.id)
      if (p) addMarker(node('map-ring-v map-ring-num', c.name, String(i + 1)), [p.lon, p.lat])
    })

    for (const cand of candidates) {
      const el = node('map-ring-cand', cand.p.name)
      el.classList.add('map-cand')
      el.addEventListener('mouseenter', () => onHover(cand.p.id))
      el.addEventListener('mouseleave', () => onHover(null))
      el.addEventListener('click', () => onChoose(cand))
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

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const mapboxgl = (await import('mapbox-gl')).default
      if (cancelled || !containerRef.current || mapRef.current) return
      mapboxgl.accessToken = token
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [home.lon, home.lat],
        zoom: 12.5,
        scrollZoom: false,
      })
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')
      map.on('load', () => {
        map.addSource('route', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } } })
        map.addLayer({
          id: 'route',
          type: 'line',
          source: 'route',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#b68235', 'line-width': 2.5, 'line-opacity': 0.8 },
        })
        readyRef.current = true
        map.resize()
        sync(mapboxgl, map)
      })
      mapRef.current = map
    })()
    return () => {
      cancelled = true
      readyRef.current = false
      mapRef.current?.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    if (!readyRef.current || !mapRef.current) return
    ;(async () => {
      const mapboxgl = (await import('mapbox-gl')).default
      if (readyRef.current && mapRef.current) sync(mapboxgl, mapRef.current)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, candidates])

  useEffect(() => {
    for (const [id, el] of candElsRef.current) el.classList.toggle('gnode-hot', id === hoverId)
  }, [hoverId])

  return <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
}
