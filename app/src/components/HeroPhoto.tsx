import { fileDateLabel } from '../lib/media'
import { useCity } from '../state/CityContext'

/** The hero plate. Shares a view-transition-name across pages, so navigating
 * Home → Compose morphs the frame while the photos crossfade. Carries an
 * archival caption: what it is · when it was shot. */
export function HeroPhoto({
  height = 580,
  src = 'paris-eiffel-tower-quai.jpeg',
  objectPosition = 'center top',
  caption,
}: {
  height?: number | string
  src?: string
  objectPosition?: string
  caption?: string
}) {
  const city = useCity()
  const date = fileDateLabel(city, src)
  return (
    <figure style={{ margin: 0 }}>
      <div className="plate hero-photo" style={{ position: 'relative', height, viewTransitionName: 'hero-photo' }}>
        <div style={{ position: 'absolute', inset: 0 }}>
          <img
            src={`/media/${city.id}/${src}`}
            alt={caption ?? ''}
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition, display: 'block' }}
          />
        </div>
      </div>
      {caption && (
        <figcaption className="plate-cap">
          {caption}
          {date && <span className="cap-date"> · {date}</span>}
        </figcaption>
      )}
    </figure>
  )
}
