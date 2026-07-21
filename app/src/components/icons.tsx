import type { CSSProperties } from 'react'

interface IconProps {
  size?: number
  strokeWidth?: number
  stroke?: string
  style?: CSSProperties
}

function svgProps({ size = 16, strokeWidth = 1.6, stroke = 'currentColor', style }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke,
    strokeWidth,
    style,
  }
}

export function WalkIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M4 16v-2.4C4 11.5 3 10.5 3 8c0-2.7 1.5-6 4.5-6C9.4 2 10 3.8 10 5.5c0 3.1-2 5.7-2 8.7V16a2 2 0 1 1-4 0Z" />
      <path d="M20 20v-2.4c0-2.1 1-3.1 1-5.6 0-2.7-1.5-6-4.5-6C14.6 6 14 7.8 14 9.5c0 3.1 2 5.7 2 8.7V20a2 2 0 1 0 4 0Z" />
      <path d="M16 17h4M4 13h4" />
    </svg>
  )
}

export function CameraIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  )
}

export function VideoIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="m16 13 5.2 3.5a.5.5 0 0 0 .8-.4V7.9a.5.5 0 0 0-.8-.5L16 10.5" />
      <rect x="2" y="6" width="14" height="12" rx="2" />
    </svg>
  )
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...svgProps({ strokeWidth: 2.2, ...props })}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

export function ClockIcon(props: IconProps) {
  return (
    <svg {...svgProps({ strokeWidth: 1.7, ...props })}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

export function InfoIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  )
}

export function MapPinIcon(props: IconProps) {
  return (
    <svg {...svgProps({ size: 20, strokeWidth: 1.5, ...props })}>
      <path d="M20 10c0 5-5.5 10.2-7.4 11.8a1 1 0 0 1-1.2 0C9.5 20.2 4 15 4 10a8 8 0 0 1 16 0" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

export function TicketIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
      <path d="M13 5v14" />
    </svg>
  )
}

export function MenuIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M3 6h18M3 12h18M3 18h18" />
    </svg>
  )
}

export function CalendarIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  )
}

export function SparklesIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .962 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.962 0z" />
    </svg>
  )
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}

export function ImageIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
  )
}

/** The fan of three ways — the reconsider affordance on itinerary stops. */
export function FanIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M4 12c5-.8 9.5-3 14.5-7.5" />
      <path d="M4 12h16" />
      <path d="M4 12c5 .8 9.5 3 14.5 7.5" />
      <circle cx="4" cy="12" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  )
}
