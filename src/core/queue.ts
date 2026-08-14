import { isDue, type Card } from './types'

export const NEW_CARD_LIMIT = 20

export function buildStudyQueue(cards: Card[], now = new Date()): Card[] {
  const due = cards.filter((card) => isDue(card, now))
  const learning = due.filter((card) => card.status === 'learning').sort(byPosition)
  const reviews = due.filter((card) => card.status === 'mastered').sort(byDueThenPosition)
  const news = due
    .filter((card) => card.status === 'new')
    .sort(byPosition)
    .slice(0, NEW_CARD_LIMIT)
  const queue = [...learning, ...reviews, ...news]
  if (queue.length > 0) return queue
  return cards.filter((card) => card.status === 'mastered').sort(byDueThenPosition)
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
