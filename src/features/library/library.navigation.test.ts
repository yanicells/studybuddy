import { describe, expect, it } from 'vitest'

import type { LibrarySnapshot } from '../../core/types'
import { selectionAfterDelete, studySearch } from './library.navigation'

describe('selectionAfterDelete', () => {
  it('moves to the parent folder when the open deck is deleted', () => {
    expect(selectionAfterDelete(library, { kind: 'deck', id: 'deck-2' }, 'deck', 'deck-2')).toEqual({
      kind: 'folder',
      id: 'folder-2',
    })
  })

  it('leaves a deleted folder subtree for the folder above it', () => {
    expect(selectionAfterDelete(library, { kind: 'deck', id: 'deck-3' }, 'folder', 'folder-2')).toEqual({
      kind: 'folder',
      id: 'folder-1',
    })
    expect(selectionAfterDelete(library, { kind: 'folder', id: 'folder-1' }, 'folder', 'folder-1')).toBeNull()
  })

  it('stays put when the open screen survives', () => {
    expect(selectionAfterDelete(library, { kind: 'deck', id: 'deck-1' }, 'folder', 'folder-2')).toBeUndefined()
    expect(selectionAfterDelete(library, { kind: 'deck', id: 'deck-1' }, 'deck', 'deck-2')).toBeUndefined()
    expect(selectionAfterDelete(library, null, 'deck', 'deck-1')).toBeUndefined()
  })
})

describe('studySearch', () => {
  it('omits the deck list when the whole scope is studied', () => {
    expect(studySearch(library, { kind: 'folder', id: 'folder-2' }, ['deck-3', 'deck-2'], 'due')).toEqual({
      folder: 'folder-2',
      deck: undefined,
      decks: undefined,
      mode: 'due',
    })
    expect(studySearch(library, { kind: 'library' }, ['deck-1'], 'all').decks).toEqual(['deck-1'])
  })
})

const library: LibrarySnapshot = {
  folders: [
    { id: 'folder-1', parentId: null, name: 'Biology', position: 0 },
    { id: 'folder-2', parentId: 'folder-1', name: 'Week 1', position: 0 },
  ],
  decks: [
    { id: 'deck-1', folderId: 'folder-1', name: 'Cells', position: 0 },
    { id: 'deck-2', folderId: 'folder-2', name: 'Genetics', position: 0 },
    { id: 'deck-3', folderId: 'folder-2', name: 'Traits', position: 1 },
  ],
  cardsByDeck: {},
  statsByDeck: {},
  study: { due: 0, reviewedToday: 0, streak: 0 },
}
