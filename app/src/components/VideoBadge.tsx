import { VideoIcon } from './icons'

/** Duration badge overlaid on a plate that carries video in the archive. */
export function VideoBadge({ time, small }: { time: string; small?: boolean }) {
  return (
    <span
      style={{
        position: 'absolute',
        bottom: 8,
        left: 8,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        background: 'rgba(20,18,16,.72)',
        color: '#f4efe6',
        fontFamily: 'var(--font-body)',
        fontSize: small ? 10 : 11,
        padding: small ? '3px 7px' : '3px 8px',
        borderRadius: 3,
      }}
    >
      <VideoIcon size={small ? 11 : 12} strokeWidth={1.8} />
      {time}
    </span>
  )
}
