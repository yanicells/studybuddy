import { isDue, type Card } from './types'

export const NEW_CARD_LIMIT = 20

export type StudyMode = 'due' | 'all'

export function buildStudyQueue(cards: Card[], now = new Date(), mode: StudyMode = 'due'): Card[] {
  if (mode === 'all') {
    return orderedQueue(cards)
  }
  const due = cards.filter((card) => isDue(card, now))
  const queue = orderedQueue(due, NEW_CARD_LIMIT)
  if (queue.length > 0) return queue
  return cards.filter((card) => card.status === 'mastered').sort(byDueThenPosition)
}

function orderedQueue(cards: Card[], newLimit = Number.POSITIVE_INFINITY): Card[] {
  const learning = cards.filter((card) => card.status === 'learning').sort(byPosition)
  const reviews = cards.filter((card) => card.status === 'mastered').sort(byDueThenPosition)
  const news = cards
    .filter((card) => card.status === 'new')
    .sort(byPosition)
    .slice(0, newLimit)
  return [...learning, ...reviews, ...news]
}

function byPosition(left: Card, right: Card): number {
  return left.position - right.position || left.id.localeCompare(right.id)
}

function byDueThenPosition(left: Card, right: Card): number {
  return dueTime(left) - dueTime(right) || left.position - right.position
}

function dueTime(card: Card): number {
  return card.dueAt ? new Date(card.dueAt).getTime() : 0
}
