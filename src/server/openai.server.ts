import 'dotenv/config'

import OpenAI from 'openai'
import { zodTextFormat } from 'openai/helpers/zod'
import { z } from 'zod'

import type { NewCard } from '../core/types'

const KeywordPayload = z.object({
  items: z.array(
    z.object({
      index: z.number().int().nonnegative(),
      keywords: z.array(z.string().min(1).max(79)).max(3),
    }),
  ),
})

export async function fillMissingKeywords(cards: NewCard[]): Promise<number> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) return 0

  const pending = cards
    .map((card, index) => ({ card, index }))
    .filter(({ card }) => card.highlights.length === 0)
  if (pending.length === 0) return 0

  const response = await new OpenAI({ apiKey }).responses.parse({
    model: 'gpt-4o-mini',
    input: [
      {
        role: 'system',
        content:
          'Pick 1 to 3 short study keywords per flashcard. Every keyword must appear verbatim in that card text.',
      },
      {
        role: 'user',
        content: pending
          .map(
            ({ card }, index) =>
              `[${index}] FRONT: ${card.front}\nBACK: ${card.back}`,
          )
          .join('\n\n'),
      },
    ],
    text: { format: zodTextFormat(KeywordPayload, 'flashcard_keywords') },
  })

  let filled = 0
  for (const item of response.output_parsed?.items ?? []) {
    const pendingCard = pending[item.index]
    if (!pendingCard) continue
    const card = pendingCard.card
    for (const rawKeyword of item.keywords) {
      const keyword = rawKeyword.trim()
      const side = includesIgnoreCase(card.back, keyword)
        ? 'back'
        : includesIgnoreCase(card.front, keyword)
          ? 'front'
          : null
      if (
        side &&
        !card.highlights.some(
          (highlight) => highlight.text.toLocaleLowerCase() === keyword.toLocaleLowerCase(),
        )
      ) {
        card.highlights.push({ side, text: keyword })
      }
    }
    if (card.highlights.length > 0) filled += 1
  }
  return filled
}

function includesIgnoreCase(text: string, phrase: string): boolean {
  return text.toLocaleLowerCase().includes(phrase.toLocaleLowerCase())
}
