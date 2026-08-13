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

function play(session: Session, count: number, correct = true): number[] {
  const seen: number[] = []
  for (let index = 0; index < count; index += 1) {
    const id = session.nextCard()
    expect(id).not.toBeNull()
    seen.push(id!)
    session.answer(id!, correct)
  }
  return seen
}

describe('study session rounds', () => {
  it('opens a new deck with eight cards', () => {
    const session = new Session(cards(30))
    const first = play(session, 8)
    expect(new Set(first).size).toBe(8)
    expect(session.round).toBe(1)
    const next = session.nextCard()
    expect(session.round).toBe(2)
    expect(first).not.toContain(next)
  })

  it('starts a learning session at twelve cards', () => {
    const session = new Session(cards(20, 'learning'))
    play(session, 12)
    expect(session.round).toBe(1)
    session.nextCard()
    expect(session.round).toBe(2)
  })

  it('keeps a first-round hit out of the next set and brings it back later', () => {
    const session = new Session(cards(30))
    const first = play(session, 8)
    const second = play(session, 12)
    expect(second.some((id) => first.includes(id))).toBe(false)
    const third: number[] = []
    for (let index = 0; index < 8; index += 1) {
      const id = session.nextCard()!
      third.push(id)
      session.answer(id, true)
    }
    expect(third).toEqual(first)
    expect(session.round).toBe(3)
  })

  it('returns a miss in the following round', () => {
    const session = new Session(cards(20))
    const missed = session.nextCard()!
    session.answer(missed, false)
    play(session, 7)
    expect(session.nextCard()).toBe(missed)
    expect(session.round).toBe(2)
  })

  it('retires a new card after two spaced hits', () => {
    const session = new Session(cards(1))
    const id = session.nextCard()!
    session.answer(id, true)
    expect(session.nextCard()).toBe(id)
    expect(session.round).toBe(3)
    session.answer(id, true)
    expect(session.nextCard()).toBeNull()
    expect(session.completed).toBe(1)
  })

  it('retires a mastered card after one hit', () => {
    const session = new Session(cards(1, 'mastered'))
    const id = session.nextCard()!
    session.answer(id, true)
    expect(session.nextCard()).toBeNull()
    expect(session.cardHits(id)).toEqual([1, 1])
  })

  it('makes a missed review earn two spaced hits', () => {
    const session = new Session(cards(1, 'mastered'))
    const id = session.nextCard()!
    session.answer(id, false)
    expect(session.nextCard()).toBe(id)
    session.answer(id, true)
    expect(session.nextCard()).toBe(id)
    session.answer(id, true)
    expect(session.nextCard()).toBeNull()
  })
})
