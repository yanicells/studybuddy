import { describe, expect, it } from 'vitest'

import {
  cardSchema,
  deckSearchSchema,
  importSchema,
  moveSchema,
  nameSchema,
  recordAnswerSchema,
  reorderSchema,
  startStudySchema,
  studySearchSchema,
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

  it('requires a study mode of due or all', () => {
    expect(startStudySchema.parse({ deckIds: ['1', '2'], mode: 'all' })).toEqual({
      deckIds: ['1', '2'],
      mode: 'all',
    })
    expect(() => startStudySchema.parse({ deckIds: [], mode: 'all' })).toThrow()
    expect(() => startStudySchema.parse({ deckIds: ['1', '1'], mode: 'all' })).toThrow()
    expect(() => startStudySchema.parse({ deckIds: ['1'] })).toThrow()
    expect(() => startStudySchema.parse({ deckIds: ['1'], mode: 'random' })).toThrow()
  })

  it('accepts a full sibling order for reordering', () => {
    expect(reorderSchema.parse({ parentId: null, orderedIds: ['1', '2'] })).toEqual({
      parentId: null,
      orderedIds: ['1', '2'],
    })
    expect(() => reorderSchema.parse({ parentId: null, orderedIds: [''] })).toThrow()
  })
})

describe('route search params', () => {
  it('drops an unknown deck status filter instead of failing the page', () => {
    expect(deckSearchSchema.parse({ status: 'learning' })).toEqual({ status: 'learning' })
    expect(deckSearchSchema.parse({ status: 'bogus' })).toEqual({ status: undefined })
  })

  it('defaults study mode and ignores a malformed deck list', () => {
    expect(studySearchSchema.parse({ folder: 'f1' })).toEqual({
      folder: 'f1',
      deck: undefined,
      decks: undefined,
      mode: 'due',
    })
    expect(studySearchSchema.parse({ decks: 'nope', mode: 'all' }).decks).toBeUndefined()
    expect(studySearchSchema.parse({ decks: ['d1'], mode: 'all' })).toMatchObject({ decks: ['d1'], mode: 'all' })
  })
})
