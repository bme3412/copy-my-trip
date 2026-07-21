import { useEffect, useRef } from 'react'
import type { City, StartLoc } from '../cities/types'
import type { DayState } from '../lib/planner'

interface Props {
  token: string
  city: City
  home: StartLoc
  day: DayState
}

/** Read-only route map for a finished built day: home plus the numbered stops,
 * joined by the gold route line, fitted to the day's bounds. mapbox-gl loads
 * dynamically — SSR and smoke tests never touch it. */
export function DayMap({ token, city, home, day }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null)

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
        const add = (el: HTMLDivElement, lngLat: [number, number]) =>
          new mapboxgl.Marker({ element: el, anchor: 'center' }).setLngLat(lngLat).addTo(map)

        const coords: [number, number][] = [[home.lon, home.lat]]
        add(node('map-ring-home', home.name), [home.lon, home.lat])
        day.committed.forEach((c, i) => {
          const p = city.places.find((pl) => pl.id === c.id)
          if (!p) return
          coords.push([p.lon, p.lat])
          add(node('map-ring-v map-ring-num', c.name, String(i + 1)), [p.lon, p.lat])
        })

        map.addSource('route', {
          type: 'geojson',
          data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } },
        })
        map.addLayer({
          id: 'route',
          type: 'line',
          source: 'route',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#b68235', 'line-width': 2.5, 'line-opacity': 0.8 },
        })

        const bounds = new mapboxgl.LngLatBounds()
        for (const c of coords) bounds.extend(c)
        if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 56, duration: 0, maxZoom: 14.5 })
        map.resize()
      })
      mapRef.current = map
    })()
    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
    }
    // Re-created per day: the map is read-only and the day only changes with the route param.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, day])

  return <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
}
