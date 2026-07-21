import { Fragment, type ReactNode } from 'react'

/** Renders *italics* between asterisks in city/stop copy. */
export function em(text: string): ReactNode {
  const parts = text.split('*')
  return parts.map((p, i) => (i % 2 === 1 ? <em key={i}>{p}</em> : <Fragment key={i}>{p}</Fragment>))
}
