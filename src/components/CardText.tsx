import { backBlocks, contentBlocks } from '../core/blocks'
import { HighlightedText } from './HighlightedText'

export function CardText({
  text,
  phrases,
  asBack = false,
}: Readonly<{ text: string; phrases: string[]; asBack?: boolean }>) {
  const blocks = asBack ? backBlocks(text) : contentBlocks(text)
  if (blocks.length === 0) return null
  return (
    <div className="card-text">
      {blocks.map((block, index) =>
        block.kind === 'ul' ? (
          <ul key={index} role="list">
            {block.items.map((item, itemIndex) => (
              <li key={`${itemIndex}-${item}`}>
                <HighlightedText text={item} phrases={phrases} />
              </li>
            ))}
          </ul>
        ) : (
          <p key={index}>
            <HighlightedText text={block.text} phrases={phrases} />
          </p>
        ),
      )}
    </div>
  )
}
