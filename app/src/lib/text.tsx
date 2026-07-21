import { Fragment, type ReactNode } from 'react'

/** Renders **bold** and *italics* markup in city/stop copy. */
export function em(text: string): ReactNode {
  return text
    .split('**')
    .map((chunk, i) => (i % 2 === 1 ? <strong key={`b${i}`}>{ital(chunk)}</strong> : <Fragment key={`b${i}`}>{ital(chunk)}</Fragment>))
}

function ital(text: string): ReactNode {
  const parts = text.split('*')
  return parts.map((p, i) => (i % 2 === 1 ? <em key={i}>{p}</em> : <Fragment key={i}>{p}</Fragment>))
}
