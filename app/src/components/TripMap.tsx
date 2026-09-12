import { useEffect, useRef, useState } from 'react'
import type { Map as MapboxMap, Marker, GeoJSONSource, LngLatBounds } from 'mapbox-gl'
import type { FeatureCollection, LineString } from 'geojson'
import type { City, StartLoc } from '../cities/types'
import type { Candidate, DayState } from '../lib/planner'
import { itineraryLegs, walkingGeometry, walkingGroups, type Coordinate } from '../lib/map-route'

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
const EMPTY_CANDIDATES: Candidate[] = []
const emptyRoutes: FeatureCollection<LineString> = { type: 'FeatureCollection', features: [] }
const line = (coordinates: Coordinate[], kind: string) => ({ type: 'Feature' as const, properties: { kind }, geometry: { type: 'LineString' as const, coordinates } })

export function TripMap({ token, city, home, day, candidates = EMPTY_CANDIDATES, hoverId = null, onHover, onChoose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapboxMap | null>(null)
  const boundsRef = useRef<LngLatBounds | null>(null)
  const markersRef = useRef<Marker[]>([])
  const candElsRef = useRef(new Map<string, HTMLElement>())
  const callbacks = useRef({ onHover, onChoose })
  callbacks.current = { onHover, onChoose }
  const [attempt, setAttempt] = useState(0)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [routesLoading, setRoutesLoading] = useState(false)
  const [routesUnavailable, setRoutesUnavailable] = useState(false)
  const initialCenter = useRef<Coordinate>([home.lon, home.lat])

  function fitDay(duration = 500) {
    const map = mapRef.current
    const bounds = boundsRef.current
    if (!map || !bounds || bounds.isEmpty()) return
    const height = map.getContainer().clientHeight
    map.fitBounds(bounds, { padding: { top: 110, bottom: Math.min(255, height * .4), left: 55, right: 80 }, maxZoom: 15, duration })
  }

  useEffect(() => {
    let cancelled = false
    let resize: ResizeObserver | undefined
    setStatus('loading')
    const timeout = window.setTimeout(() => { if (!cancelled) setStatus('error') }, 20000)
    void (async () => {
      try {
        const mapboxgl = (await import('mapbox-gl')).default
        if (cancelled || !containerRef.current) return
        const map = new mapboxgl.Map({ container: containerRef.current, accessToken: token, style: 'mapbox://styles/mapbox/streets-v12', center: initialCenter.current, zoom: 12, scrollZoom: false })
        mapRef.current = map
        map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')
        map.on('error', () => {
          // A failed optional tile must not replace an otherwise usable map.
          if (!map.isStyleLoaded() && !cancelled) setStatus('error')
        })
        map.on('load', () => {
          if (cancelled) return
          window.clearTimeout(timeout)
          map.addSource('route', { type: 'geojson', data: emptyRoutes })
          map.addLayer({ id: 'route-connectors', type: 'line', source: 'route', filter: ['!=', ['get', 'kind'], 'walking'], paint: { 'line-color': '#59677f', 'line-width': 2.5, 'line-dasharray': [2, 2], 'line-opacity': .8 } })
          map.addLayer({ id: 'route-walking', type: 'line', source: 'route', filter: ['==', ['get', 'kind'], 'walking'], layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#cf490c', 'line-width': 4 } })
          map.resize()
          setStatus('ready')
        })
        resize = new ResizeObserver(() => { map.resize(); fitDay(0) })
        resize.observe(containerRef.current)
      } catch { if (!cancelled) setStatus('error') }
    })()
    return () => {
      cancelled = true
      window.clearTimeout(timeout)
      resize?.disconnect()
      markersRef.current.forEach(marker => marker.remove())
      markersRef.current = []
      candElsRef.current.clear()
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [token, attempt])

  useEffect(() => {
    const map = mapRef.current
    if (status !== 'ready' || !map) return
    const abort = new AbortController()
    void (async () => {
      const mapboxgl = (await import('mapbox-gl')).default
      if (abort.signal.aborted) return
      markersRef.current.forEach(marker => marker.remove())
      markersRef.current = []
      candElsRef.current.clear()
      const bounds = new mapboxgl.LngLatBounds()
      const addMarker = (label: string, coordinate: Coordinate, number?: number, candidate?: Candidate) => {
        const el = document.createElement('button')
        el.type = 'button'
        el.className = `map-node map-pin-button${candidate ? ' map-cand' : ''}`
        el.setAttribute('aria-label', candidate ? `Add ${label} to itinerary` : `${number ? `Stop ${number}: ` : 'Home base: '}${label}`)
        const ring = document.createElement('span')
        ring.className = `map-ring ${candidate ? 'map-ring-cand' : number ? 'map-ring-v map-ring-num' : 'map-ring-home'}`
        ring.textContent = number ? String(number) : ''
        const name = document.createElement('span')
        name.className = 'map-name'
        name.textContent = label
        el.append(ring, name)
        if (candidate) {
          const enter = () => callbacks.current.onHover?.(candidate.p.id)
          const leave = () => callbacks.current.onHover?.(null)
          el.addEventListener('mouseenter', enter)
          el.addEventListener('focus', enter)
          el.addEventListener('mouseleave', leave)
          el.addEventListener('blur', leave)
          el.addEventListener('click', () => callbacks.current.onChoose?.(candidate))
          candElsRef.current.set(candidate.p.id, el)
        } else el.addEventListener('click', () => map.easeTo({ center: coordinate, zoom: Math.max(map.getZoom(), 15), duration: 500, padding: { top: 100, bottom: 240, left: 40, right: 40 } }))
        markersRef.current.push(new mapboxgl.Marker({ element: el, anchor: 'center' }).setLngLat(coordinate).addTo(map))
        // Mapbox assigns role=img to markers; retain the native button interaction.
        el.setAttribute('role', 'button')
        bounds.extend(coordinate)
      }
      addMarker(home.name, [home.lon, home.lat])
      day.committed.forEach((stop, i) => {
        const place = city.places.find(p => p.id === stop.id)
        if (place) addMarker(stop.name, [place.lon, place.lat], i + 1)
        if (stop.returnAfter) bounds.extend([stop.returnAfter.to.lon, stop.returnAfter.to.lat])
      })
      for (const candidate of candidates) addMarker(candidate.p.name, [candidate.p.lon, candidate.p.lat], undefined, candidate)
      boundsRef.current = bounds
      fitDay()
      const legs = itineraryLegs(city, home, day)
      const source = map.getSource('route') as GeoJSONSource
      source.setData({ type: 'FeatureCollection', features: legs.map(leg => line(leg.coordinates, leg.mode)) })
      const groups = walkingGroups(legs)
      setRoutesLoading(groups.length > 0)
      setRoutesUnavailable(false)
      // Each contiguous walking section gets one bounded request; completed paths are cached.
      const results = await Promise.allSettled(groups.map(group => walkingGeometry(group, token, abort.signal)))
      if (abort.signal.aborted) return
      const features = legs.filter(leg => leg.mode === 'metro').map(leg => line(leg.coordinates, 'metro'))
      results.forEach((result, i) => features.push(line(result.status === 'fulfilled' ? result.value : groups[i], result.status === 'fulfilled' ? 'walking' : 'unavailable')))
      source.setData({ type: 'FeatureCollection', features })
      setRoutesLoading(false)
      setRoutesUnavailable(results.some(result => result.status === 'rejected'))
    })()
    return () => abort.abort()
  }, [status, city, day, home, candidates, token])

  useEffect(() => {
    for (const [id, el] of candElsRef.current) el.classList.toggle('gnode-hot', id === hoverId)
  }, [hoverId])

  return <>
    <div ref={containerRef} className="trip-map" aria-label={`${city.name} itinerary street map`} />
    {status === 'ready' && <><button className="map-fit-day" onClick={() => fitDay()}>Fit day ↗</button><div className="map-route-key" role="status">{routesLoading ? 'Finding walking paths…' : routesUnavailable ? 'Paths unavailable · dashed links show connections' : 'Solid: walking paths · dashed: métro connections'}</div></>}
    {status !== 'ready' && <div className="map-load-state" role="status">{status === 'loading' ? 'Loading street map…' : <><strong>The map couldn’t load.</strong><span>Your itinerary is still available.</span><button onClick={() => setAttempt(value => value + 1)}>Retry map</button></>}</div>}
  </>
}
