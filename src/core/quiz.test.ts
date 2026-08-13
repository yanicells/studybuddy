import { describe, expect, it } from 'vitest'

import { buildQuestion } from './quiz'
import type { Card } from './types'

const card: Card = {
  id: 1,
  deckId: 1,
  front: 'The mitochondria is the powerhouse of the cell',
  back: 'mitochondria',
  highlights: [{ side: 'front', text: 'mitochondria' }],
  position: 0,
  status: 'new',
  ease: 2.5,
  intervalDays: 0,
  dueAt: null,
  reps: 0,
  lapses: 0,
  streak: 0,
  learningStep: 0,
  lastReviewedAt: null,
}

const other: Card = {
  ...card,
  id: 2,
  front: 'The control center of the cell',
  back: 'nucleus',
  highlights: [{ side: 'back', text: 'nucleus' }],
}

describe('quiz construction', () => {
  it('blanks an explicit keyword and provides four unique choices', () => {
    const question = buildQuestion(card, [card, other], () => 0.4)

    expect(question.prompt.kind).toBe('cloze')
    if (question.prompt.kind === 'cloze') {
      expect(question.prompt.segments).toContainEqual({
        kind: 'blank',
        text: 'mitochondria',
        target: true,
      })
    }
    expect(question.choices).toHaveLength(4)
    expect(new Set(question.choices).size).toBe(4)
    expect(question.choices[question.answerIndex]).toBe('mitochondria')
    expect(question.choices).toContain('nucleus')
  })

  it('uses a front prompt when a card has no highlights', () => {
    const question = buildQuestion({ ...card, highlights: [] }, [], () => 0.5)
    expect(question.prompt).toEqual({
      kind: 'front',
      text: 'The mitochondria is the powerhouse of the cell',
    })
    expect(question.choices[question.answerIndex]).toBe('mitochondria')
  })
})
