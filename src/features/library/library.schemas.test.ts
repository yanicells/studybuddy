import { describe, expect, it } from 'vitest'

import {
  cardSchema,
  importSchema,
  moveSchema,
  nameSchema,
  recordAnswerSchema,
} from './library.schemas'

describe('library server boundaries', () => {
  it('trims names and rejects empty values', () => {
    expect(nameSchema.parse({ id: null, parentId: null, name: '  Biology  ' }).name).toBe(
      'Biology',
    )
    expect(() => nameSchema.parse({ id: null, parentId: null, name: '   ' })).toThrow()
  })

  it('allows library as a nullable move target and requires a positive id', () => {
    expect(moveSchema.parse({ id: '2', parentId: null })).toEqual({ id: '2', parentId: null })
    expect(() => moveSchema.parse({ id: '', parentId: null })).toThrow()
  })

  it('requires a card front and valid highlight sides', () => {
    expect(
      cardSchema.parse({
        id: null,
        deckId: '1',
        front: ' Question ',
        back: 'Answer',
      }).front,
    ).toBe('Question')
    expect(() =>
      cardSchema.parse({ id: null, deckId: '1', front: '', back: 'Answer' }),
    ).toThrow()
  })

  it('caps import input and accepts boolean review answers', () => {
    expect(importSchema.parse({ deckId: '1', folderId: null, text: 'A\n- B' }).text).toBe(
      'A\n- B',
    )
    expect(() =>
      importSchema.parse({ deckId: '1', folderId: null, text: 'x'.repeat(500_001) }),
    ).toThrow()
    expect(recordAnswerSchema.parse({ cardId: '4', correct: false })).toEqual({
      cardId: '4',
      correct: false,
    })
  })
})
