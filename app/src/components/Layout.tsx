import type { CSSProperties, ReactNode } from 'react'
import { Link, Navigate, Outlet, useLocation, useParams } from 'react-router-dom'
import { CITIES, DEFAULT_CITY } from '../cities'
import { CityContext } from '../state/CityContext'

export function Layout() {
  const { city: cityId } = useParams()
  const { pathname } = useLocation()
  const city = cityId ? CITIES[cityId] : undefined
  if (!city) return <Navigate to={`/${DEFAULT_CITY}`} replace />

  const base = `/${city.id}`
  const tripLinks = [
    { to: `${base}/compose`, label: 'Plan a visit' },
    { to: `${base}/itinerary/1`, label: 'Itinerary', match: `${base}/itinerary` },
  ]
  const archiveLinks = [
    { to: `${base}/archive`, label: 'Map' },
    { to: `${base}/neighbourhoods`, label: 'Neighborhoods' },
  ]
  const navLink = (l: { to: string; label: string; match?: string }) => {
    const active = l.match ? pathname.startsWith(l.match) : pathname === l.to
    return (
      <Link key={l.to} to={l.to} viewTransition aria-current={active ? 'page' : undefined}>
        {l.label}
      </Link>
    )
  }

  return (
    <CityContext.Provider value={city}>
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
        <nav className="nav site-nav" style={{ position: 'sticky', top: 0, background: 'var(--color-bg)', zIndex: 10 }}>
          <Link to={base} viewTransition className="nav-brand" style={{ textDecoration: 'none', color: 'inherit' }}>
            Copy My Trip{' '}
            <span className="text-muted" style={{ fontSize: 13, fontFamily: 'var(--font-body)' }}>
              · {city.name}
            </span>
          </Link>
          {tripLinks.map(navLink)}
          <span aria-hidden style={{ alignSelf: 'stretch', borderLeft: '1px solid var(--color-divider)' }} />
          {archiveLinks.map(navLink)}
        </nav>
        <Outlet />
      </div>
    </CityContext.Provider>
  )
}

export function Page({
  kicker,
  title,
  sub,
  aside,
  topBar,
  children,
  style,
}: {
  kicker?: string
  title?: string
  sub?: ReactNode
  aside?: ReactNode
  topBar?: ReactNode
  children: ReactNode
  style?: CSSProperties
}) {
  return (
    <div className="page-enter page-shell" style={style}>
      {topBar}
      {(kicker || title || aside) && (
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap', marginBottom: 28 }}>
          <div>
            {kicker && (
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--color-accent)' }}>
                {kicker}
              </div>
            )}
            {title && (
              <h1 style={{ fontSize: 38, fontWeight: 400, margin: '8px 0 0', viewTransitionName: 'page-title' }}>{title}</h1>
            )}
            {sub && (
              <p className="text-muted" style={{ fontSize: 14.5, margin: '10px 0 0', maxWidth: 640, lineHeight: 1.6 }}>
                {sub}
              </p>
            )}
          </div>
          {aside && <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12 }}>{aside}</div>}
        </div>
      )}
      {children}
    </div>
  )
}
