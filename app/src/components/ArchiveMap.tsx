import { useEffect, useRef } from 'react'
import type { GraphNode } from '../cities/types'

export interface MapNode extends GraphNode {
  lat: number
  lon: number
}

interface Props {
  token: string
  nodes: MapNode[]
  mode: 'day' | 'hood'
  hoverName: string | null
  pulseName: string | null
  onHover: (name: string | null) => void
  onOpen: (n: MapNode) => void
}

/** Real Mapbox map for the archive — markers reuse the graph-node ring
 * styling, hover-syncs with the index table, click jumps to the stop's day.
 * mapbox-gl is dynamically imported so SSR and smoke tests never touch it. */
export function ArchiveMap({ token, nodes, mode, hoverName, pulseName, onHover, onOpen }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<{ remove(): void } | null>(null)
  const markersRef = useRef<Map<string, { root: HTMLDivElement; sub: HTMLSpanElement }>>(new Map())

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const mapboxgl = (await import('mapbox-gl')).default
      if (cancelled || !containerRef.current || mapRef.current) return
      mapboxgl.accessToken = token
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [2.3488, 48.8534],
        zoom: 12,
        scrollZoom: false,
      })
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-left')
      const bounds = new mapboxgl.LngLatBounds()
      for (const n of nodes) bounds.extend([n.lon, n.lat])
      // Keep pins clear of the floating index panel on the right.
      map.fitBounds(bounds, { padding: { top: 56, bottom: 56, left: 56, right: 480 }, duration: 0, maxZoom: 13.5 })
      // Containers can measure late inside the grid — refit once the style is up.
      map.on('load', () => {
        map.resize()
        map.fitBounds(bounds, { padding: 56, duration: 0, maxZoom: 13.5 })
      })

      for (const n of nodes) {
        const root = document.createElement('div')
        root.className = 'map-node gnode'
        const ring = document.createElement('span')
        ring.className = `gnode-ring map-ring ${n.v ? 'map-ring-v' : 'map-ring-w'}`
        const name = document.createElement('span')
        name.className = 'map-name'
        name.textContent = n.name
        const sub = document.createElement('span')
        sub.className = 'map-sub'
        root.append(ring, name, sub)
        root.addEventListener('mouseenter', () => onHover(n.name))
        root.addEventListener('mouseleave', () => onHover(null))
        root.addEventListener('click', () => onOpen(n))
        new mapboxgl.Marker({ element: root, anchor: 'center' }).setLngLat([n.lon, n.lat]).addTo(map)
        markersRef.current.set(n.name, { root, sub })
      }
      mapRef.current = map
      // Apply current mode/pulse now that markers exist.
      syncSubs()
      if (pulseName) markersRef.current.get(pulseName)?.root.classList.add('gnode-pulse')
    })()
    return () => {
      cancelled = true
      markersRef.current.clear()
      mapRef.current?.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const syncSubs = () => {
    for (const n of nodes) {
      const m = markersRef.current.get(n.name)
      if (m) m.sub.textContent = mode === 'day' ? (n.day ? `Day ${n.day}` : 'archive') : n.hood
    }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(syncSubs, [mode, nodes])

  useEffect(() => {
    for (const [name, m] of markersRef.current) {
      m.root.classList.toggle('gnode-hot', name === hoverName)
    }
  }, [hoverName])

  return (
    <div className="archive-map-panel" style={{ position: 'relative', borderRight: '1px solid var(--color-divider)' }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
      <div
        style={{
          position: 'absolute',
          left: 16,
          bottom: 28,
          zIndex: 2,
          pointerEvents: 'none',
          fontFamily: 'var(--font-body)',
          fontSize: 11,
          color: 'color-mix(in srgb, var(--color-text) 70%, transparent)',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          background: 'color-mix(in srgb, var(--color-bg) 85%, transparent)',
          padding: '4px 8px',
          borderRadius: 3,
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid var(--color-accent)', background: 'var(--color-accent-100)' }} />
          from the archive
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 12, height: 12, borderRadius: '50%', border: '1.5px dashed var(--color-neutral-500)' }} />
          web-filled
        </span>
      </div>
    </div>
  )
}
