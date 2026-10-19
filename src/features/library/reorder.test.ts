import { describe, expect, it } from 'vitest'

import type { LibrarySnapshot } from '../../core/types'
import { applyReorder, dropSibling, moveSibling } from './reorder'

describe('sibling reorder', () => {
  it('moves a sibling up or down one step', () => {
    expect(moveSibling(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c'])
    expect(moveSibling(['a', 'b', 'c'], 'b', 1)).toEqual(['a', 'c', 'b'])
  })

  it('refuses to move past either edge', () => {
    expect(moveSibling(['a', 'b'], 'a', -1)).toBeNull()
    expect(moveSibling(['a', 'b'], 'b', 1)).toBeNull()
    expect(moveSibling(['a', 'b'], 'missing', 1)).toBeNull()
  })

  it('drops the dragged sibling before or after the target', () => {
    expect(dropSibling(['a', 'b', 'c'], 'a', 'c', false)).toEqual(['b', 'a', 'c'])
    expect(dropSibling(['a', 'b', 'c'], 'a', 'c', true)).toEqual(['b', 'c', 'a'])
    expect(dropSibling(['a', 'b', 'c'], 'c', 'a', false)).toEqual(['c', 'a', 'b'])
  })

  it('ignores drops onto itself or unknown ids', () => {
    expect(dropSibling(['a', 'b'], 'a', 'a', true)).toBeNull()
    expect(dropSibling(['a', 'b'], 'a', 'missing', false)).toBeNull()
    expect(dropSibling(['a', 'b'], 'missing', 'a', false)).toBeNull()
  })
})

describe('applyReorder', () => {
  it('reorders only the requested siblings and leaves other parents alone', () => {
    const library: LibrarySnapshot = {
      folders: [],
      decks: [
        { id: 'a', folderId: null, name: 'A', position: 0 },
        { id: 'x', folderId: 'f', name: 'X', position: 0 },
        { id: 'b', folderId: null, name: 'B', position: 1 },
        { id: 'c', folderId: null, name: 'C', position: 2 },
      ],
      cardsByDeck: {},
      statsByDeck: {},
      study: { due: 0, reviewedToday: 0, streak: 0 },
    }
    const next = applyReorder(library, { kind: 'deck', parentId: null, orderedIds: ['c', 'a', 'b'] })
    expect(next.decks.map((deck) => [deck.id, deck.position])).toEqual([
      ['c', 0],
      ['x', 0],
      ['a', 1],
      ['b', 2],
    ])
    expect(library.decks[0]!.id).toBe('a')
  })
})
