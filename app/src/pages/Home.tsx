import { Link } from 'react-router-dom'
import { HeroPhoto } from '../components/HeroPhoto'
import { Page } from '../components/Layout'
import { em } from '../lib/text'
import { useCity } from '../state/CityContext'

/** Fits the hero inside the initial viewport: nav + page padding ≈ 215px of
 * overhead; capped at the plate's full size on tall screens. */
const HERO_H = 'clamp(380px, calc(100vh - 215px), 580px)'

export function Home() {
  const city = useCity()
  const base = `/${city.id}`

  return (
    <Page style={{ paddingTop: 24, paddingBottom: 40 }}>
      <div
        className="hero-grid"
        style={{ display: 'grid', gridTemplateColumns: '1fr 460px', gap: 64, alignItems: 'start', padding: '16px 0 0' }}
      >
        <div className="hero-block" style={{ minHeight: HERO_H, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h1 style={{ fontSize: 58, fontWeight: 400, lineHeight: 1.06, letterSpacing: '-.02em', margin: '0 0 24px', viewTransitionName: 'page-title' }}>
            {city.hero.title}
          </h1>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 18,
              lineHeight: 1.65,
              color: 'color-mix(in srgb, var(--color-text) 75%, transparent)',
              maxWidth: 520,
              margin: 0,
            }}
          >
            {em(city.hero.body)}
          </p>
          <div style={{ display: 'flex', gap: 14, marginTop: 36 }}>
            <Link to={`${base}/compose`} viewTransition className="btn btn-primary" style={{ fontSize: 14, padding: '11px 22px' }}>
              Plan a visit
            </Link>
            <Link to={`${base}/archive`} viewTransition className="btn btn-secondary" style={{ fontSize: 14, padding: '11px 22px' }}>
              See the map
            </Link>
          </div>
        </div>
        <HeroPhoto height={HERO_H} caption="The Eiffel Tower from the Seine" />
      </div>
    </Page>
  )
}
