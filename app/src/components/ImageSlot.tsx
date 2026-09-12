import { useEffect, useState, type CSSProperties } from 'react'
import { responsiveImage } from '../lib/responsive-media'
import { ImageIcon } from './icons'

/**
 * Image tile with the prototype's placeholder as fallback: pass `src` and it
 * renders the photo (developing in like a print); if the file is missing or
 * fails to load, the warm-paper placeholder shows instead.
 */
export function ImageSlot({ placeholder, src, style, eager = false, unavailableLabel, sizes = '(max-width: 760px) calc(100vw - 60px), 600px' }: { placeholder: string; src?: string; style?: CSSProperties; eager?: boolean; unavailableLabel?: string; sizes?: string }) {
  const [failed, setFailed] = useState(false)
  const [originalOnly, setOriginalOnly] = useState(false)
  const responsive = originalOnly ? null : responsiveImage(src)
  useEffect(() => { setFailed(false); setOriginalOnly(false) }, [src])

  if (src && !failed) {
    return (
      <img
        src={responsive?.src ?? src}
        srcSet={responsive?.srcSet}
        sizes={responsive ? sizes : undefined}
        width={responsive?.width}
        height={responsive?.height}
        fetchPriority={eager ? 'high' : 'auto'}
        alt={placeholder}
        className="develop"
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        onError={() => { if (responsive) setOriginalOnly(true); else setFailed(true) }}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', ...style }}
      />
    )
  }
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        background: 'color-mix(in srgb, var(--color-surface) 75%, var(--color-accent-100))',
        color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        overflow: 'hidden',
        ...style,
      }}
    >
      <span
        style={{
          position: 'absolute',
          inset: 6,
          border: '1.5px dashed currentColor',
          opacity: 0.35,
          borderRadius: 4,
          pointerEvents: 'none',
        }}
      />
      <ImageIcon size={22} style={{ opacity: 0.45 }} />
      <span
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 12,
          maxWidth: '90%',
          textAlign: 'center',
          lineHeight: 1.35,
          opacity: 0.75,
        }}
      >
        {unavailableLabel ?? placeholder}
      </span>
    </div>
  )
}
