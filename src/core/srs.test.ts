import { describe, expect, it } from 'vitest'

import type { Card, Status } from './types'
import { applyAnswer } from './srs'

const NOW = new Date('2026-08-13T03:00:00.000Z')

function card(status: Status): Card {
  return {
    id: 1,
    deckId: 1,
    front: 'front',
    back: 'back',
    highlights: [],
    position: 0,
    status,
    ease: 2.5,
    intervalDays: 0,
    dueAt: null,
    reps: 0,
    lapses: 0,
    streak: 0,
    learningStep: 0,
    lastReviewedAt: null,
  }
}

describe('spaced repetition', () => {
  it('graduates a new card after two correct answers', () => {
    const first = applyAnswer(card('new'), true, NOW)
    const second = applyAnswer(first, true, NOW)

    expect(first.status).toBe('learning')
    expect(second.status).toBe('mastered')
    expect(second.dueAt).toBe('2026-08-14T03:00:00.000Z')
  })

  it('resets a missed mastered card to learning', () => {
    const result = applyAnswer({ ...card('mastered'), intervalDays: 6 }, false, NOW)

    expect(result).toMatchObject({
      status: 'learning',
      streak: 0,
      intervalDays: 0,
      lapses: 1,
      ease: 2.3,
    })
  })

  it('grows mastered intervals from one to three days and then by ease', () => {
    const first = applyAnswer({ ...card('mastered'), intervalDays: 1 }, true, NOW)
    const second = applyAnswer(first, true, NOW)

    expect(first.intervalDays).toBe(3)
    expect(second.intervalDays).toBeCloseTo(7.8)
  })

  it('does not mutate its input', () => {
    const original = card('new')
    applyAnswer(original, false, NOW)
    expect(original.reps).toBe(0)
  })
})
