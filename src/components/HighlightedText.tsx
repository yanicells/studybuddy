import { Fragment } from 'react'

import { markSpans } from '../core/import'

export function HighlightedText({
  text,
  phrases,
}: Readonly<{ text: string; phrases: string[] }>) {
  return text.split('\n').map((line, lineIndex) => (
    <Fragment key={`${lineIndex}-${line}`}>
      {lineIndex > 0 ? <br /> : null}
      {markSpans(line, phrases).map((span, spanIndex) =>
        span.highlighted ? (
          <mark key={`${spanIndex}-${span.text}`}>{span.text}</mark>
        ) : (
          <Fragment key={`${spanIndex}-${span.text}`}>{span.text}</Fragment>
        ),
      )}
    </Fragment>
  ))
}
