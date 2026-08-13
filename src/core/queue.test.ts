import { describe, expect, it } from 'vitest'

import { buildStudyQueue, NEW_CARD_LIMIT } from './queue'
import type { Card, Status } from './types'

const NOW = new Date('2026-08-13T12:00:00.000Z')

function card(id: number, status: Status, extra: Partial<Card> = {}): Card {
  return {
    id,
    deckId: 1,
    front: `front ${id}`,
    back: `back ${id}`,
    highlights: [],
    position: id,
    status,
    ease: 2.5,
    intervalDays: status === 'mastered' ? 3 : 0,
    dueAt: status === 'mastered' ? '2026-08-12T12:00:00.000Z' : null,
    reps: 0,
    lapses: 0,
    streak: 0,
    learningStep: 0,
    lastReviewedAt: null,
    ...extra,
  }
}

describe('study queue', () => {
  it('puts learning cards first, then overdue reviews, then new cards', () => {
    const queue = buildStudyQueue(
      [
        card(1, 'new'),
        card(2, 'mastered', { dueAt: '2026-08-10T12:00:00.000Z' }),
        card(3, 'learning'),
        card(4, 'mastered', { dueAt: '2026-08-12T12:00:00.000Z' }),
      ],
      NOW,
    )
    expect(queue.map((item) => item.id)).toEqual([3, 2, 4, 1])
  })

  it('skips mastered cards that are not due yet', () => {
    const queue = buildStudyQueue(
      [card(1, 'mastered', { dueAt: '2026-08-20T12:00:00.000Z' }), card(2, 'new')],
      NOW,
    )
    expect(queue.map((item) => item.id)).toEqual([2])
  })

  it('falls back to upcoming mastered cards when nothing is due', () => {
    const queue = buildStudyQueue(
      [
        card(1, 'mastered', { dueAt: '2026-08-20T12:00:00.000Z' }),
        card(2, 'mastered', { dueAt: '2026-08-18T12:00:00.000Z' }),
      ],
      NOW,
    )
    expect(queue.map((item) => item.id)).toEqual([2, 1])
  })

  it('caps new cards so a session cannot dump the whole deck', () => {
    const cards = Array.from({ length: NEW_CARD_LIMIT + 8 }, (_, index) => card(index + 1, 'new'))
    const queue = buildStudyQueue([card(100, 'learning'), ...cards], NOW)
    expect(queue[0]?.id).toBe(100)
    expect(queue.filter((item) => item.status === 'new')).toHaveLength(NEW_CARD_LIMIT)
  })
})
