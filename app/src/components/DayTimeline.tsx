import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ImageSlot } from './ImageSlot'
import { VideoBadge } from './VideoBadge'
import { CameraIcon, CloseIcon, FanIcon, InfoIcon, MapPinIcon, TicketIcon, WalkIcon } from './icons'
import type { DayStop, Plate } from '../cities/types'
import { slotDatesLabel, slotHasVideo, slotSrc, slotVideoSrc } from '../lib/media'
// (captions use slotDatesLabel per-plate for the "· Jul 2024" suffix)
import { slug } from '../lib/slug'
import { em } from '../lib/text'
import { useReveal } from '../lib/useReveal'
import { claimVideo, directVideo } from '../lib/video-director'
import { useCity } from '../state/CityContext'

/** The lead plate's height; its width follows the plate's own aspect. */
const LEAD_H = 520

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

/** A plate's media: slots with real footage render it muted and looping, but
 * playback is granted by the video director — one plate plays at a time,
 * document-wide. Falls back to the photo, then to the placeholder. */
function PlateMedia({ city, plate, eager = false, claim = false }: { city: ReturnType<typeof useCity>; plate: Plate; eager?: boolean; claim?: boolean }) {
  const [videoFailed, setVideoFailed] = useState(false)
  const ref = useRef<HTMLVideoElement | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const release = directVideo(el)
    if (claim) claimVideo(el)
    return release
  }, [claim, videoFailed])
  if (plate.video && !videoFailed) {
    return (
      <video
        ref={ref}
        src={slotVideoSrc(city, plate.id)}
        poster={slotSrc(city, plate.id)}
        muted
        loop
        playsInline
        preload={eager ? 'auto' : 'metadata'}
        onError={() => setVideoFailed(true)}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    )
  }
  return <ImageSlot src={slotSrc(city, plate.id)} placeholder={plate.caption} eager={eager} />
}

/** How much a clicked frame grows — same framing, just larger. */
const EXPAND_FACTOR = 1.35

/** A stop's archive, structured: one lead plate carrying the caption line
 * ("what it is · when it was shot"), and a strip of uniform thumbnails to
 * leaf through the rest. Selecting a thumb settles it into the lead — and a
 * selected video takes the playback stage. Plates whose shot is still pending
 * appear as placeholder thumbs; the claim stays visible, unfilled. */
function PlateGallery({ city, plates, eager = false }: { city: ReturnType<typeof useCity>; plates: Plate[]; eager?: boolean }) {
  const hasMedia = (p: Plate) => {
    const entry = city.slotFiles?.[p.id]
    return !!(entry?.img || entry?.video)
  }
  const firstFilled = Math.max(0, plates.findIndex(hasMedia))
  const [sel, setSel] = useState(firstFilled)
  const [picked, setPicked] = useState(false)
  const lead = plates[sel] ?? plates[0]
  const date = slotDatesLabel(city, [lead.id])
  // A pending shot is a visible claim, not a hero — it holds a modest frame.
  const leadH = hasMedia(lead) ? LEAD_H : 240
  const leadW = Math.round((lead.w / lead.h) * leadH)
  return (
    <figure className="plate-fig" style={{ margin: 0 }}>
      <div className="plate" style={{ position: 'relative', width: leadW, maxWidth: '100%', aspectRatio: `${lead.w} / ${lead.h}` }}>
        <div key={lead.id} className="cmt-slot plate-lead-media">
          <PlateMedia city={city} plate={lead} eager={eager} claim={picked} />
        </div>
        {lead.video && slotHasVideo(city, lead.id) && <VideoBadge time={lead.video} />}
      </div>
      <figcaption className="plate-cap" style={{ maxWidth: leadW }}>
        {hasMedia(lead) ? lead.caption : `${lead.caption} — shot pending`}
        {date && <span className="cap-date"> · {date}</span>}
      </figcaption>
      {plates.length > 1 && (
        <div className="plate-thumbs">
          {plates.map((p, i) => (
            <button
              key={p.id}
              type="button"
              className={`plate-thumb ${i === sel ? 'is-active' : ''}`}
              aria-label={p.caption}
              aria-pressed={i === sel}
              title={p.caption}
              onClick={() => {
                setSel(i)
                setPicked(true)
              }}
            >
              <ImageSlot src={slotSrc(city, p.id)} placeholder="" />
              {p.video && slotHasVideo(city, p.id) && <span className="thumb-time">{p.video}</span>}
            </button>
          ))}
        </div>
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
          width: 760 * f,
          height: 445 * f,
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

function Stop({
  stop,
  number,
  isLast,
  eager = false,
  onReconsider,
  onRemove,
  open = false,
}: {
  stop: DayStop
  number: number
  isLast: boolean
  eager?: boolean
  onReconsider?: () => void
  onRemove?: () => void
  open?: boolean
}) {
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
        {stop.timeNote &&
          (stop.timeNote === 'lunch' || stop.timeNote === 'dinner' || stop.timeNote === 'coffee' ? (
            <span className="tag tag-meal" style={{ marginTop: 3 }}>{stop.timeNote}</span>
          ) : (
            <div className="text-muted" style={{ fontSize: 11 }}>
              {stop.timeNote}
            </div>
          ))}
      </div>
      <div className="stop-body" style={{ borderLeft: `1.5px solid ${lineColor}`, padding: `0 0 ${isLast ? 8 : 40}px 28px`, position: 'relative' }}>
        <span className={`stop-number ${verified ? '' : 'stop-number-web'}`} aria-label={`Stop ${number}`}>{number}</span>
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
          {stop.tag && <span className="tag tag-accent-2">{stop.tag}</span>}
          <span className="text-muted" style={{ fontSize: 13 }}>
            {stop.sub}
          </span>
          {onReconsider && (
            <button
              type="button"
              className="reconsider-btn"
              aria-expanded={open}
              aria-label={`Reconsider ${stop.name}`}
              title="Other ways from the stop before"
              onClick={onReconsider}
            >
              <FanIcon size={15} />
            </button>
          )}
          {onRemove && (
            <button
              type="button"
              className="remove-btn"
              aria-label={`Remove ${stop.name} — the day re-routes and re-times itself`}
              title="Remove this stop"
              onClick={onRemove}
            >
              <CloseIcon size={12} />
            </button>
          )}
        </div>
        {stop.evidenceNote && <p className="evidence-label">{stop.evidenceNote}</p>}
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

        {stop.booking && (
          <div
            style={{
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
              border: '1px solid var(--color-accent-300)',
              borderLeft: '3px solid var(--color-accent)',
              background: 'var(--color-accent-100)',
              borderRadius: 4,
              padding: '14px 16px',
              margin: '0 0 16px',
              maxWidth: 560,
            }}
          >
            <TicketIcon size={16} stroke="var(--color-accent-700)" style={{ flex: 'none', marginTop: 2 }} />
            <div>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 14, fontWeight: 600, color: 'var(--color-accent-800)' }}>
                Book a timed slot before you go
              </div>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, lineHeight: 1.6, color: 'var(--color-accent-800)', margin: '4px 0 10px' }}>
                {stop.booking.cost}
                {stop.booking.site ? ` · ${stop.booking.site}` : ''}
                {stop.booking.note ? ` — ${stop.booking.note}` : ''}
              </div>
              {stop.booking.rates && stop.booking.rates.length > 0 && (
                <div style={{ margin: '0 0 10px' }}>
                  {stop.booking.rates.map((r) => (
                    <div
                      key={r.label}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 18,
                        fontFamily: 'var(--font-body)',
                        fontSize: 12,
                        lineHeight: 1.7,
                        color: 'var(--color-accent-800)',
                      }}
                    >
                      <span>{r.label}</span>
                      <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{r.price}</span>
                    </div>
                  ))}
                  {stop.booking.asOf && (
                    <div className="text-muted" style={{ fontFamily: 'var(--font-body)', fontSize: 11, marginTop: 4 }}>
                      rates as posted on the official ticketing site, {stop.booking.asOf}
                    </div>
                  )}
                </div>
              )}
              {stop.booking.offerings && stop.booking.offerings.length > 0 && (
                <div style={{ margin: '0 0 10px' }}>
                  <div style={{ fontFamily: 'var(--font-heading)', fontSize: 12, fontWeight: 600, color: 'var(--color-accent-800)', marginBottom: 2 }}>
                    Also bookable there
                  </div>
                  {stop.booking.offerings.map((o) => (
                    <div key={o} style={{ fontFamily: 'var(--font-body)', fontSize: 12, lineHeight: 1.7, color: 'var(--color-accent-800)' }}>
                      · {o}
                    </div>
                  ))}
                </div>
              )}
              {stop.booking.url && (
                <a className="btn btn-secondary" style={{ fontSize: 12 }} href={stop.booking.url} target="_blank" rel="noopener">
                  {stop.booking.needed ? 'Book tickets' : 'Reserve a slot'}
                </a>
              )}
            </div>
          </div>
        )}

        {stop.kind === 'verified' && stop.plates && stop.plates.length > 0 && <PlateGallery city={city} plates={stop.plates} eager={eager} />}

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

        {stop.flagNote && (
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, lineHeight: 1.55, marginTop: 10, color: 'var(--color-accent-2-700)' }}>
            <span style={{ letterSpacing: 1.2, textTransform: 'uppercase', fontSize: 10.5 }}>Needs a look · </span>
            {stop.flagNote}
          </div>
        )}
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

export function DayTimeline({
  stops,
  onReconsider,
  onRemove,
  openIndex = null,
  deck,
}: {
  stops: DayStop[]
  /** When given, each stop carries the reconsider affordance. */
  onReconsider?: (i: number) => void
  /** When given, each stop carries the remove affordance — the day re-times. */
  onRemove?: (i: number) => void
  /** Stop whose reconsider deck is open — `deck` renders right below it. */
  openIndex?: number | null
  deck?: ReactNode
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {stops.map((stop, i) => {
        const isLast = i === stops.length - 1
        const next = stops[i + 1]
        return (
          <Fragment key={stop.time + stop.name}>
            <div className="fold">
              <div className="fold-inner">
                <Stop
                  stop={stop}
                  number={i + 1}
                  isLast={isLast}
                  eager={i === 0}
                  onReconsider={onReconsider ? () => onReconsider(i) : undefined}
                  onRemove={onRemove ? () => onRemove(i) : undefined}
                  open={openIndex === i}
                />
              </div>
            </div>
            {openIndex === i && deck}
            {stop.transitAfter && <TransitChip min={stop.transitAfter.min} measured={stop.transitAfter.measured} hidden={!next} />}
          </Fragment>
        )
      })}
    </div>
  )
}
