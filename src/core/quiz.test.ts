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
        step: 0,
      })
    }
    expect(question.steps).toHaveLength(1)
    expect(question.steps[0]!.choices).toHaveLength(4)
    expect(new Set(question.steps[0]!.choices).size).toBe(4)
    expect(question.steps[0]!.choices[question.steps[0]!.answerIndex]).toBe('mitochondria')
    expect(question.steps[0]!.choices).toContain('nucleus')
  })

  it('asks each blank in left-to-right order on a mastered card', () => {
    const multi: Card = {
      ...card,
      status: 'mastered',
      front: 'The mitochondria produces ATP in the cell',
      highlights: [
        { side: 'front', text: 'mitochondria' },
        { side: 'front', text: 'ATP' },
      ],
    }
    const question = buildQuestion(multi, [multi, other], () => 0.4)

    expect(question.prompt.kind).toBe('cloze')
    expect(question.steps.map((step) => step.answer)).toEqual(['mitochondria', 'ATP'])
    if (question.prompt.kind === 'cloze') {
      expect(question.prompt.segments.filter((segment) => segment.kind === 'blank')).toEqual([
        { kind: 'blank', text: 'mitochondria', step: 0 },
        { kind: 'blank', text: 'ATP', step: 1 },
      ])
    }
    expect(question.steps[0]!.choices[question.steps[0]!.answerIndex]).toBe('mitochondria')
    expect(question.steps[1]!.choices[question.steps[1]!.answerIndex]).toBe('ATP')
  })

  it('keeps new cards to a single blank even when more highlights exist', () => {
    const question = buildQuestion(
      {
        ...card,
        front: 'The mitochondria produces ATP in the cell',
        highlights: [
          { side: 'front', text: 'mitochondria' },
          { side: 'front', text: 'ATP' },
        ],
      },
      [card, other],
      () => 0.4,
    )
    expect(question.steps).toHaveLength(1)
  })

  it('uses a front prompt when a card has no highlights', () => {
    const question = buildQuestion({ ...card, highlights: [] }, [], () => 0.5)
    expect(question.prompt).toEqual({
      kind: 'front',
      text: 'The mitochondria is the powerhouse of the cell',
    })
    expect(question.steps[0]!.choices[question.steps[0]!.answerIndex]).toBe('mitochondria')
  })
})
