import type { Highlight, NewCard, Side } from './types'

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'of', 'and', 'or', 'to', 'in', 'on', 'for', 'is', 'are',
  'was', 'were', 'be', 'as', 'by', 'with', 'that', 'this', 'from', 'it', 'its',
  'at', 'into', 'than', 'then', 'also', 'can', 'may', 'not', 'but', 'if', 'we',
  'you', 'they', 'their', 'our', 'your',
])

export interface MarkedSpan {
  text: string
  highlighted: boolean
}

export function parseCards(input: string): NewCard[] {
  const blocks = input
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/g)
    .map((block) => block.trim())
    .filter(Boolean)

  return blocks.flatMap((block) => {
    const card = parseBlock(block)
    return card ? [card] : []
  })
}

function parseBlock(block: string): NewCard | null {
  let inBack = false
  const frontLines: string[] = []
  let backLines: string[] = []

  for (const line of block.split('\n')) {
    const trimmed = line.trim()
    const bullet = trimmed.match(/^[-*]\s+(.*)$/)
    if (bullet) {
      inBack = true
      backLines.push(bullet[1]!.trim())
    } else if (inBack) {
      backLines.push(trimmed)
    } else {
      frontLines.push(trimmed)
    }
  }

  if (frontLines.length === 0) return null
  if (backLines.length === 0 && frontLines.length > 1) {
    backLines = frontLines.splice(1)
  }

  const frontResult = stripMarks(frontLines.join('\n'))
  const backResult = stripMarks(backLines.join('\n'))
  if (!frontResult.text.trim()) return null

  const highlights: Highlight[] = [
    ...frontResult.highlights.map((text) => ({ side: 'front' as const, text })),
    ...backResult.highlights.map((text) => ({ side: 'back' as const, text })),
  ]

  return {
    front: frontResult.text,
    back: backResult.text,
    highlights:
      highlights.length > 0
        ? highlights
        : heuristicHighlights(frontResult.text, backResult.text),
  }
}

export function stripMarks(input: string): { text: string; highlights: string[] } {
  const highlights: string[] = []
  let text = ''
  let cursor = 0

  while (cursor < input.length) {
    const start = input.indexOf('==', cursor)
    if (start < 0) {
      text += input.slice(cursor)
      break
    }
    text += input.slice(cursor, start)
    const end = input.indexOf('==', start + 2)
    if (end < 0) {
      text += input.slice(start)
      break
    }
    const phrase = input.slice(start + 2, end).trim()
    if (phrase) {
      highlights.push(phrase)
      text += phrase
    }
    cursor = end + 2
  }

  return { text, highlights }
}

export function heuristicHighlights(front: string, back: string): Highlight[] {
  const bullets = back
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const shortBullets =
    bullets.length > 0 &&
    bullets.length <= 8 &&
    bullets.every(
      (bullet) => bullet.split(/\s+/).length <= 5 && isGoodKeyword(bullet),
    )

  if (shortBullets) {
    return bullets.map((text) => ({ side: 'back', text }))
  }

  const found: Highlight[] = []
  for (const [side, text] of [
    ['back', back],
    ['front', front],
  ] as const satisfies ReadonlyArray<readonly [Side, string]>) {
    for (const phrase of quotedPhrases(text)) addUnique(found, side, phrase)
    if (found.length >= 3) break
    for (const phrase of properPhrases(text)) {
      addUnique(found, side, phrase)
      if (found.length >= 3) break
    }
  }

  if (
    found.length === 0 &&
    isGoodKeyword(back) &&
    back.trim().split(/\s+/).length <= 8
  ) {
    found.push({ side: 'back', text: back.trim() })
  }
  return found
}

function addUnique(found: Highlight[], side: Side, phrase: string) {
  if (
    isGoodKeyword(phrase) &&
    !found.some((highlight) => equalIgnoreCase(highlight.text, phrase))
  ) {
    found.push({ side, text: phrase })
  }
}

export function markSpans(text: string, phrases: string[]): MarkedSpan[] {
  const lower = text.toLocaleLowerCase()
  const spans: Array<[number, number]> = []

  for (const phrase of phrases) {
    if (!phrase) continue
    const needle = phrase.toLocaleLowerCase()
    let from = 0
    while (from < lower.length) {
      const start = lower.indexOf(needle, from)
      if (start < 0) break
      const end = start + phrase.length
      if (!spans.some(([existingStart, existingEnd]) => start < existingEnd && end > existingStart)) {
        spans.push([start, end])
      }
      from = end
    }
  }

  spans.sort(([a], [b]) => a - b)
  const result: MarkedSpan[] = []
  let cursor = 0
  for (const [start, end] of spans) {
    if (start > cursor) result.push({ text: text.slice(cursor, start), highlighted: false })
    if (end <= text.length) {
      result.push({ text: text.slice(start, end), highlighted: true })
      cursor = end
    }
  }
  if (cursor < text.length) result.push({ text: text.slice(cursor), highlighted: false })
  return result.length > 0 ? result : [{ text, highlighted: false }]
}

export function wrapMarks(text: string, phrases: string[]): string {
  const lower = text.toLocaleLowerCase()
  const spans: Array<[number, number]> = []
  for (const phrase of phrases) {
    if (!phrase) continue
    const start = lower.indexOf(phrase.toLocaleLowerCase())
    if (start < 0) continue
    const end = start + phrase.length
    if (!spans.some(([existingStart, existingEnd]) => start < existingEnd && end > existingStart)) {
      spans.push([start, end])
    }
  }

  return spans
    .sort(([a], [b]) => b - a)
    .reduce(
      (result, [start, end]) =>
        `${result.slice(0, start)}==${result.slice(start, end)}==${result.slice(end)}`,
      text,
    )
}

function quotedPhrases(text: string): string[] {
  return [...text.matchAll(/(["`])([^"`]+)\1/g)]
    .map((match) => match[2]!.trim())
    .filter(Boolean)
}

function properPhrases(text: string): string[] {
  const phrases: string[] = []
  let current: string[] = []
  for (const token of text.split(/\s+/)) {
    const cleaned = token.replace(/^[^\p{L}\p{N}-]+|[^\p{L}\p{N}-]+$/gu, '')
    const startsUpper = /^\p{Lu}/u.test(cleaned)
    if (cleaned && startsUpper && !STOP_WORDS.has(cleaned.toLocaleLowerCase())) {
      current.push(cleaned)
    } else if (current.length > 0) {
      phrases.push(current.join(' '))
      current = []
    }
  }
  if (current.length > 0) phrases.push(current.join(' '))
  return phrases
}

function isGoodKeyword(value: string): boolean {
  const text = value.trim()
  if (text.length < 2) return false
  if (/\d/.test(text)) return true
  return (
    text.split(/\s+/).some((word) => word.length >= 4 && !STOP_WORDS.has(word.toLocaleLowerCase())) ||
    /\p{Lu}/u.test(text)
  )
}

function equalIgnoreCase(left: string, right: string): boolean {
  return left.trim().localeCompare(right.trim(), undefined, { sensitivity: 'accent' }) === 0
}
