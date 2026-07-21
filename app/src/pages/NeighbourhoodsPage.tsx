import { Link } from 'react-router-dom'
import { ImageSlot } from '../components/ImageSlot'
import { Page } from '../components/Layout'
import { CameraIcon, VideoIcon } from '../components/icons'
import { slotDatesLabel, slotSrc } from '../lib/media'
import { useCity } from '../state/CityContext'

export function NeighbourhoodsPage() {
  const city = useCity()
  return (
    <Page
      kicker="The archive"
      title="The neighborhoods"
      sub={`${city.name}, to me, is ${city.hoods.length} neighborhoods I know by heart and a lot of city I don't. The plans lean on them — each one is years of photos and video of the same streets, not a single afternoon.`}
    >
      <hr className="hr hr-draw" style={{ margin: '0 0 4px' }} />
      {city.hoods.map((hood, i) => (
        <div
          key={hood.id}
          className="hood-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: '400px 1fr',
            gap: 38,
            padding: i === city.hoods.length - 1 ? '30px 0 6px' : '30px 0',
            borderTop: i > 0 ? '1px solid var(--color-divider)' : undefined,
          }}
        >
          <figure style={{ margin: 0 }}>
            <div className="plate" style={{ height: 280, position: 'relative' }}>
              <div style={{ position: 'absolute', inset: 0 }}>
                <ImageSlot src={slotSrc(city, hood.id)} placeholder={hood.image} />
              </div>
            </div>
            {city.slotFiles?.[hood.id]?.img && (
              <figcaption className="plate-cap">
                {hood.image}
                {slotDatesLabel(city, [hood.id]) && <span className="cap-date"> · {slotDatesLabel(city, [hood.id])}</span>}
              </figcaption>
            )}
          </figure>
          <div>
            <div className="card-kicker">{hood.kicker}</div>
            <h4 style={{ fontSize: 25, margin: '6px 0 10px', fontWeight: 600 }}>{hood.title}</h4>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 14.5, lineHeight: 1.7, textAlign: 'justify', maxWidth: 600 }}>{hood.body}</p>
            <div
              className="text-muted"
              style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 12, fontVariantNumeric: 'tabular-nums', marginTop: 6 }}
            >
              <span>{hood.places}</span>
              <span>·</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <CameraIcon size={13} />
                <VideoIcon size={13} />
                photos & video
              </span>
              {hood.days.length > 0 && (
                <>
                  <span>·</span>
                  <span style={{ display: 'inline-flex', gap: 8 }}>
                    {hood.days.map((d) => (
                      <Link key={d} to={`/${city.id}/day/${d}`} viewTransition style={{ fontSize: 12 }}>
                        Day {d}
                      </Link>
                    ))}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      ))}
    </Page>
  )
}
