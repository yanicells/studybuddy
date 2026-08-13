import { describe, expect, it } from 'vitest'

import { Session } from './session'
import type { Card, Status } from './types'

function cards(count: number, status: Status = 'new'): Card[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    deckId: 1,
    front: `front ${index + 1}`,
    back: `back ${index + 1}`,
    highlights: [],
    position: index,
    status,
    ease: 2.5,
    intervalDays: 0,
    dueAt: null,
    reps: 0,
    lapses: 0,
    streak: 0,
    learningStep: 0,
    lastReviewedAt: null,
  }))
}

describe('study session waves', () => {
  it('introduces eight cards in the first wave', () => {
    const session = new Session(cards(20))
    const seen: number[] = []
    for (let index = 0; index < 8; index += 1) {
      const id = session.nextCard()
      expect(id).not.toBeNull()
      seen.push(id!)
      session.answer(id!, true)
    }
    expect(seen).toHaveLength(8)
    expect(session.wave).toBe(1)
    expect(session.remaining).toBe(16)
    expect(session.nextCard()).toBe(5)
  })

  it('returns a missed card after two other queued cards', () => {
    const session = new Session(cards(5))
    const first = session.nextCard()!
    session.answer(first, false)
    const later = [session.nextCard(), session.nextCard(), session.nextCard()]
    expect(later).toContain(first)
  })

  it('retires a new card after two correct hits', () => {
    const session = new Session(cards(1))
    const id = session.nextCard()!
    session.answer(id, true)
    expect(session.nextCard()).toBe(id)
    session.answer(id, true)
    expect(session.nextCard()).toBeNull()
    expect(session.completed).toBe(1)
  })

  it('retires a mastered card after one correct hit', () => {
    const session = new Session(cards(1, 'mastered'))
    const id = session.nextCard()!
    session.answer(id, true)
    expect(session.nextCard()).toBeNull()
    expect(session.cardHits(id)).toEqual([1, 1])
  })
})
