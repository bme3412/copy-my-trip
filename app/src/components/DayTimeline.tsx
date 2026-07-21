import { Fragment, useState } from 'react'
import { Link } from 'react-router-dom'
import { ImageSlot } from './ImageSlot'
import { VideoBadge } from './VideoBadge'
import { CameraIcon, InfoIcon, MapPinIcon, WalkIcon } from './icons'
import type { DayStop, Plate } from '../cities/types'
import { slotDatesLabel, slotHasVideo, slotSrc, slotVideoSrc } from '../lib/media'
// (captions use slotDatesLabel per-plate for the "· Jul 2024" suffix)
import { slug } from '../lib/slug'
import { em } from '../lib/text'
import { useReveal } from '../lib/useReveal'
import { useCity } from '../state/CityContext'

/** Plates render at 2× the design-doc sizes — the photos carry the page. */
const PLATE_SCALE = 2

function TransitChip({ min, measured, hidden }: { min: number; measured: boolean; hidden: boolean }) {
  return (
    <div className={`fold ${hidden ? 'fold-closed' : ''}`}>
      <div className="fold-inner">
        <div style={{ display: 'grid', gridTemplateColumns: '76px 1fr', gap: 28 }} className="stop-grid">
          <div className="stop-time-col" />
          <div
            className="transit-cell"
            style={{
              borderLeft: `1.5px solid ${measured ? 'var(--color-accent)' : 'var(--color-neutral-300)'}`,
              padding: '0 0 0 28px',
              position: 'relative',
              marginTop: -24,
              marginBottom: 24,
            }}
          >
            <span
              className={measured ? 'cmt-chip' : 'cmt-chip text-muted'}
              style={measured ? { color: 'var(--color-accent-700)', borderColor: 'var(--color-accent-200)', background: 'var(--color-accent-100)' } : undefined}
            >
              <WalkIcon size={13} />
              {min} min · {measured ? 'measured' : 'estimated'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

/** A plate's media: slots with real footage play it (looping, muted) and fall
 * back to the photo, which falls back to the placeholder. */
function PlateMedia({ city, plate }: { city: ReturnType<typeof useCity>; plate: Plate }) {
  const [videoFailed, setVideoFailed] = useState(false)
  if (plate.video && !videoFailed) {
    return (
      <video
        src={slotVideoSrc(city, plate.id)}
        poster={slotSrc(city, plate.id)}
        autoPlay
        muted
        loop
        playsInline
        onError={() => setVideoFailed(true)}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    )
  }
  return <ImageSlot src={slotSrc(city, plate.id)} placeholder={plate.caption} />
}

/** How much a clicked plate grows — same framing, just larger. */
const EXPAND_FACTOR = 1.35

/** One plate: click and it pops out smoothly to 1.35× — same crop, same
 * aspect, just bigger, with a whisper of elevation. Click again to settle
 * back. Only plates with real media respond — placeholders stay inert.
 * Filled plates carry an archival caption: what it is · when it was shot. */
function PlateFrame({ city, plate, delayIndex }: { city: ReturnType<typeof useCity>; plate: Plate; delayIndex: number }) {
  const [expanded, setExpanded] = useState(false)
  const entry = city.slotFiles?.[plate.id]
  const expandable = !!(entry?.img || entry?.video)
  const badge = plate.video && slotHasVideo(city, plate.id)
  const scale = PLATE_SCALE * (expanded ? EXPAND_FACTOR : 1)
  const date = slotDatesLabel(city, [plate.id])
  return (
    <figure className="plate-fig" style={{ margin: 0, flex: 'none', ['--stagger' as string]: `${delayIndex * 50}ms` }}>
      <div
        className="plate plate-item"
        onClick={expandable ? () => setExpanded((e) => !e) : undefined}
        role={expandable ? 'button' : undefined}
        style={{
          position: 'relative',
          width: plate.w * scale,
          height: plate.h * scale,
          cursor: expandable ? 'pointer' : undefined,
          boxShadow: expanded ? 'var(--shadow-md)' : undefined,
        }}
      >
        <div className="cmt-slot">
          <PlateMedia city={city} plate={plate} />
        </div>
        {badge && <VideoBadge time={plate.video!} />}
      </div>
      {expandable && (
        <figcaption className="plate-cap">
          {plate.caption}
          {date && <span className="cap-date"> · {date}</span>}
        </figcaption>
      )}
    </figure>
  )
}

/** Web-reference frame with the same pop-out-in-place behavior and caption. */
function WebFrame({ city, webImage }: { city: ReturnType<typeof useCity>; webImage: { id: string; caption: string } }) {
  const [expanded, setExpanded] = useState(false)
  const expandable = !!city.slotFiles?.[webImage.id]?.img
  const f = expanded ? EXPAND_FACTOR : 1
  const date = slotDatesLabel(city, [webImage.id])
  return (
    <figure style={{ margin: 0 }}>
      <div
        className="web-frame"
        onClick={expandable ? () => setExpanded((e) => !e) : undefined}
        role={expandable ? 'button' : undefined}
        style={{
          width: 640 * f,
          height: 375 * f,
          border: '1px solid var(--color-divider)',
          borderRadius: 4,
          overflow: 'hidden',
          position: 'relative',
          cursor: expandable ? 'pointer' : undefined,
          boxShadow: expanded ? 'var(--shadow-md)' : undefined,
          transition: 'width var(--dur-base) var(--ease-out), height var(--dur-base) var(--ease-out), box-shadow var(--dur-base) var(--ease-out)',
        }}
      >
        <ImageSlot src={slotSrc(city, webImage.id)} placeholder={webImage.caption} />
      </div>
      {expandable && (
        <figcaption className="plate-cap">
          {webImage.caption}
          {date && <span className="cap-date"> · {date}</span>}
        </figcaption>
      )}
    </figure>
  )
}

function Stop({ stop, isLast }: { stop: DayStop; isLast: boolean }) {
  const city = useCity()
  const { ref, revealed } = useReveal<HTMLDivElement>()
  const verified = stop.kind === 'verified'
  const lineColor = verified ? 'var(--color-accent)' : 'var(--color-neutral-300)'
  const dimText = verified ? undefined : 'color-mix(in srgb, var(--color-text) 88%, transparent)'
  const id = slug(stop.name)
  // Real capture dates of the media shown, straight from file metadata.
  const shotLabel = verified ? slotDatesLabel(city, (stop.plates ?? []).map((p) => p.id)) : null
  return (
    <div
      ref={ref}
      id={id}
      className={`stop-grid reveal ${revealed ? 'is-revealed' : ''}`}
      style={{ display: 'grid', gridTemplateColumns: '76px 1fr', gap: 28 }}
    >
      <div className="stop-time-col" style={{ textAlign: 'right', paddingTop: 2 }}>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 19, fontVariantNumeric: 'tabular-nums' }}>{stop.time}</div>
        {stop.timeNote && (
          <div className="text-muted" style={{ fontSize: 11 }}>
            {stop.timeNote}
          </div>
        )}
      </div>
      <div className="stop-body" style={{ borderLeft: `1.5px solid ${lineColor}`, padding: `0 0 ${isLast ? 8 : 40}px 28px`, position: 'relative' }}>
        {verified ? (
          <span className="stop-dot" style={{ position: 'absolute', left: -6.5, top: 6, width: 11, height: 11, borderRadius: '50%', background: 'var(--color-accent)' }} />
        ) : (
          <span
            className="stop-dot"
            style={{
              position: 'absolute',
              left: -6,
              top: 6,
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: 'var(--color-bg)',
              border: '1.5px solid var(--color-neutral-400)',
            }}
          />
        )}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <h4 style={{ fontSize: 22, margin: 0, fontWeight: 600 }}>
            <span className="stop-time-inline" style={{ fontVariantNumeric: 'tabular-nums', marginRight: 10 }}>
              {stop.time}
            </span>
            <Link to={`/${city.id}/archive?place=${id}`} viewTransition className="stop-name-link" style={{ color: dimText ?? 'inherit' }}>
              {stop.name}
            </Link>
          </h4>
          <span className="text-muted" style={{ fontSize: 13 }}>
            {stop.sub}
          </span>
        </div>
        {stop.desc && (
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 14.5,
              lineHeight: 1.6,
              margin: '8px 0 16px',
              maxWidth: 560,
              color: verified ? undefined : 'color-mix(in srgb, var(--color-text) 78%, transparent)',
            }}
          >
            {em(stop.desc)}
          </p>
        )}

        {stop.kind === 'verified' && stop.plates && (
          <div className="plate-row" style={{ display: 'flex', gap: 12 }}>
            {stop.plates.map((pl, i) => (
              <PlateFrame key={pl.id} city={city} plate={pl} delayIndex={i} />
            ))}
          </div>
        )}

        {stop.kind === 'web-pin' && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '14px 18px',
              border: '1px solid var(--color-divider)',
              borderRadius: 4,
              width: 'max-content',
              background: 'var(--color-neutral-100)',
            }}
          >
            <MapPinIcon size={20} stroke="var(--color-neutral-600)" />
            <div>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 14 }}>{stop.pin}</div>
              <div className="text-muted" style={{ fontSize: 12 }}>
                Web-filled · one clean pin, no shots of my own
              </div>
            </div>
          </div>
        )}

        {stop.kind === 'web-image' && stop.webImage && <WebFrame city={city} webImage={stop.webImage} />}

        {(shotLabel || !verified) && (
          <div className="text-muted" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginTop: 12 }}>
            {verified ? (
              <>
                <CameraIcon size={13} />
                Shot {shotLabel}
              </>
            ) : (
              <>
                <InfoIcon size={13} />
                {stop.kind === 'web-pin'
                  ? 'Suggested from web · est. from posted hours & reviews'
                  : 'Suggested from web · single reference image, no shots of my own'}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export function DayTimeline({ stops, verifiedOnly }: { stops: DayStop[]; verifiedOnly: boolean }) {
  const isHidden = (s: DayStop) => verifiedOnly && s.kind !== 'verified'
  const visible = stops.filter((s) => !isHidden(s))
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {stops.map((stop, i) => {
        const hidden = isHidden(stop)
        const isLast = visible.length > 0 && stop === visible[visible.length - 1]
        const next = stops[i + 1]
        // A transit chip only makes sense when both of its endpoints are on the page.
        const transitHidden = hidden || !next || isHidden(next)
        return (
          <Fragment key={stop.time + stop.name}>
            <div className={`fold ${hidden ? 'fold-closed' : ''}`}>
              <div className="fold-inner">
                <Stop stop={stop} isLast={isLast} />
              </div>
            </div>
            {stop.transitAfter && <TransitChip min={stop.transitAfter.min} measured={stop.transitAfter.measured} hidden={transitHidden} />}
          </Fragment>
        )
      })}
    </div>
  )
}
