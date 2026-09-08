import { describe, expect, it } from 'vitest'

import type { LibrarySnapshot } from './types'
import { studyDeckIds, studySourceName } from './studyScope'

describe('study scopes', () => {
  it('includes every nested deck in a folder scope', () => {
    expect(studyDeckIds(library, { kind: 'folder', id: 'folder-1' })).toEqual([
      'deck-1',
      'deck-2',
    ])
  })

  it('includes every deck at library scope and one deck at deck scope', () => {
    expect(studyDeckIds(library, { kind: 'library' })).toEqual(['deck-1', 'deck-2'])
    expect(studyDeckIds(library, { kind: 'deck', id: 'deck-2' })).toEqual(['deck-2'])
  })

  it('names each scope for the study session', () => {
    expect(studySourceName(library, { kind: 'library' })).toBe('Library')
    expect(studySourceName(library, { kind: 'folder', id: 'folder-2' })).toBe('Week 1')
    expect(studySourceName(library, { kind: 'deck', id: 'deck-1' })).toBe('Cells')
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
  ],
  cardsByDeck: {},
  statsByDeck: {},
  study: { due: 0, reviewedToday: 0, streak: 0 },
}
