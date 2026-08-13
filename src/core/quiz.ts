import type { Card, Highlight, Question, Segment, Side, Status } from './types'

type Random = () => number

export function buildQuestion(
  card: Card,
  deck: Card[],
  random: Random = Math.random,
): Question {
  const highlights = card.highlights.filter((highlight) => {
    const text = highlight.side === 'front' ? card.front : card.back
    return findIgnoreCase(text, highlight.text) >= 0
  })
  return buildClozeQuestion(card, highlights, deck, random) ?? buildFullChoice(card, deck, random)
}

function buildClozeQuestion(
  card: Card,
  highlights: Highlight[],
  deck: Card[],
  random: Random,
): Question | null {
  if (highlights.length === 0) return null
  const order = shuffle(
    highlights.map((_, index) => index),
    random,
  ).slice(0, Math.max(1, blankCount(card.status, highlights.length)))
  const targetIndex = order[0]!
  const target = highlights[targetIndex]!
  const side = target.side
  const text = side === 'front' ? card.front : card.back
  const blanks = highlights.filter(
    (highlight, index) => highlight.side === side && order.includes(index),
  )
  const segments = splitCloze(text, blanks, target.text)
  if (segments === null) return null
  const { choices, answerIndex } = makeChoices(target.text, card, deck, random)
  return {
    cardId: card.id,
    front: card.front,
    back: card.back,
    prompt: { kind: 'cloze', segments },
    clozeSide: side,
    choices,
    answerIndex,
    answer: target.text,
  }
}

function buildFullChoice(card: Card, deck: Card[], random: Random): Question {
  const answer = card.back.trim() ? card.back : card.front
  const { choices, answerIndex } = makeChoices(answer, card, deck, random)
  return {
    cardId: card.id,
    front: card.front,
    back: card.back,
    prompt: { kind: 'front', text: card.front },
    clozeSide: null,
    choices,
    answerIndex,
    answer,
  }
}

function blankCount(status: Status, count: number): number {
  if (count === 0) return 0
  if (status === 'new') return 1
  if (status === 'learning') return Math.max(1, Math.ceil(count / 2))
  return count
}

function splitCloze(text: string, blanks: Highlight[], target: string): Segment[] | null {
  const spans: Array<{ start: number; end: number; target: boolean }> = []
  for (const blank of blanks) {
    const start = findIgnoreCase(text, blank.text)
    if (start < 0) continue
    const end = start + blank.text.length
    if (spans.some((span) => start < span.end && end > span.start)) continue
    spans.push({ start, end, target: equalIgnoreCase(blank.text, target) })
  }
  if (spans.length === 0) return null
  spans.sort((left, right) => left.start - right.start)

  const segments: Segment[] = []
  let cursor = 0
  for (const span of spans) {
    if (span.start > cursor) segments.push({ kind: 'text', text: text.slice(cursor, span.start) })
    segments.push({
      kind: 'blank',
      text: text.slice(span.start, span.end),
      target: span.target,
    })
    cursor = span.end
  }
  if (cursor < text.length) segments.push({ kind: 'text', text: text.slice(cursor) })
  return segments
}

function makeChoices(
  answer: string,
  card: Card,
  deck: Card[],
  random: Random,
): { choices: string[]; answerIndex: number } {
  const choices = [answer]
  const pool: string[] = []
  for (const candidateCard of deck) {
    if (candidateCard.id === card.id) continue
    pool.push(...candidateCard.highlights.map((highlight) => highlight.text))
    if (candidateCard.back.trim()) pool.push(candidateCard.back)
    pool.push(...candidateCard.back.split('\n').map((line) => line.trim()).filter(Boolean))
  }
  pool.push(
    ...card.highlights
      .filter((highlight) => !equalIgnoreCase(highlight.text, answer))
      .map((highlight) => highlight.text),
  )

  for (const candidate of shuffle(pool, random)) {
    if (choices.length >= 4) break
    if (choices.some((choice) => equalIgnoreCase(choice, candidate))) continue
    choices.push(candidate)
  }

  if (choices.length < 4) {
    for (const word of `${card.front} ${card.back}`.split(/\s+/)) {
      const candidate = word.replace(/[^\p{L}\p{N}]/gu, '')
      if (candidate.length < 4 || choices.some((choice) => equalIgnoreCase(choice, candidate))) {
        continue
      }
      choices.push(candidate)
      if (choices.length >= 4) break
    }
  }
  for (const filler of ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta']) {
    if (choices.length >= 4) break
    if (!choices.some((choice) => equalIgnoreCase(choice, filler))) choices.push(filler)
  }

  const shuffled = shuffle(choices.slice(0, 4), random)
  return {
    choices: shuffled,
    answerIndex: shuffled.findIndex((choice) => equalIgnoreCase(choice, answer)),
  }
}

function shuffle<T>(input: T[], random: Random): T[] {
  const result = [...input]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1))
    ;[result[index], result[target]] = [result[target]!, result[index]!]
  }
  return result
}

function findIgnoreCase(text: string, phrase: string): number {
  if (!phrase) return -1
  return text.toLocaleLowerCase().indexOf(phrase.toLocaleLowerCase())
}

function equalIgnoreCase(left: string, right: string): boolean {
  return left.trim().toLocaleLowerCase() === right.trim().toLocaleLowerCase()
}

export function phrasesForSide(card: Card, side: Side): string[] {
  return card.highlights
    .filter((highlight) => highlight.side === side)
    .map((highlight) => highlight.text)
}
