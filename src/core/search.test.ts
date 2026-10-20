import { describe, expect, it } from 'vitest'

import { searchLibrary } from './search'
import { EMPTY_STATS, type Card, type LibrarySnapshot } from './types'

function card(id: string, deckId: string, front: string, back: string): Card {
  return {
    id,
    deckId,
    front,
    back,
    highlights: [],
    position: Number(id),
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
}

const library: LibrarySnapshot = {
  folders: [
    { id: 'f1', parentId: null, name: 'Science', position: 0 },
    { id: 'f2', parentId: 'f1', name: 'Microbiology', position: 0 },
    { id: 'f3', parentId: 'f1', name: 'Biology', position: 1 },
  ],
  decks: [
    { id: 'd1', folderId: 'f3', name: 'Cell biology', position: 0 },
    { id: 'd2', folderId: null, name: 'Bio', position: 1 },
  ],
  cardsByDeck: {
    d1: [
      card('1', 'd1', 'What does the nucleus hold?', '- DNA\n- the biology of heredity'),
      card('2', 'd1', 'Biology studies life', 'Yes'),
    ],
    d2: [card('3', 'd2', 'Mitochondria', `${'filler '.repeat(20)}makes ATP ${'tail '.repeat(20)}`)],
  },
  statsByDeck: { d1: EMPTY_STATS, d2: EMPTY_STATS },
  study: { due: 0, reviewedToday: 0, streak: 0 },
}

describe('library search', () => {
  it('returns nothing for a blank query', () => {
    expect(searchLibrary(library, '   ')).toEqual([])
  })

  it('ranks exact, prefix, word-start, then substring names, folders before decks, then cards', () => {
    const results = searchLibrary(library, 'BIO')
    expect(results.map((result) => `${result.kind}:${result.id}`)).toEqual([
      'deck:d2',
      'folder:f3',
      'deck:d1',
      'folder:f2',
      'card:2',
      'card:1',
    ])
  })

  it('describes where folders and decks live', () => {
    const results = searchLibrary(library, 'cell')
    expect(results[0]).toEqual({ kind: 'deck', id: 'd1', name: 'Cell biology', path: 'Science / Biology' })
    expect(searchLibrary(library, 'science')[0]).toMatchObject({ kind: 'folder', path: 'Library' })
  })

  it('matches card text without bullet markers and names the deck', () => {
    expect(searchLibrary(library, 'dna · the')).toEqual([
      { kind: 'card', id: '1', deckId: 'd1', deckName: 'Cell biology', snippet: 'DNA · the biology of heredity' },
    ])
  })

  it('trims long card text to a snippet around the match', () => {
    const [result] = searchLibrary(library, 'atp')
    expect(result?.kind).toBe('card')
    const snippet = result?.kind === 'card' ? result.snippet : ''
    expect(snippet).toMatch(/^….*makes ATP.*…$/)
    expect(snippet.length).toBeLessThanOrEqual(92)
  })

  it('caps the number of results', () => {
    expect(searchLibrary(library, 'i', 3)).toHaveLength(3)
  })
})
