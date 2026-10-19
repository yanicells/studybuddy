import type { z } from 'zod'

import type { StudyMode } from '../../core/queue'
import { folderPath } from '../../core/stats'
import { studyDeckIds, type StudySource } from '../../core/studyScope'
import type { LibrarySnapshot } from '../../core/types'
import type { studySearchSchema } from './library.schemas'
import type { Selection } from './library.types'

export type StudySearch = z.output<typeof studySearchSchema>

/** Route for a library selection: the home screen, a folder, or a deck. */
export function selectionLocation(selection: Selection) {
  if (selection === null) return { to: '/' } as const
  if (selection.kind === 'folder') {
    return { to: '/folders/$folderId', params: { folderId: selection.id } } as const
  }
  return { to: '/decks/$deckId', params: { deckId: selection.id } } as const
}

/** The screen a study session returns to. */
export function studySourceSelection(source: StudySource): Selection {
  return source.kind === 'library' ? null : source
}

export function studySourceFromSearch(search: StudySearch): StudySource {
  if (search.deck) return { kind: 'deck', id: search.deck }
  if (search.folder) return { kind: 'folder', id: search.folder }
  return { kind: 'library' }
}

/** Search params for a study link. The deck list is left out when it covers the whole scope. */
export function studySearch(
  library: LibrarySnapshot,
  source: StudySource,
  deckIds: string[],
  mode: StudyMode,
): StudySearch {
  const scope = studyDeckIds(library, source)
  const wholeScope = scope.length === deckIds.length && scope.every((id) => deckIds.includes(id))
  return {
    folder: source.kind === 'folder' ? source.id : undefined,
    deck: source.kind === 'deck' ? source.id : undefined,
    decks: wholeScope ? undefined : deckIds,
    mode,
  }
}

/**
 * Where to go before deleting a folder or deck that contains the open screen.
 * Returns undefined when the open screen survives the delete.
 */
export function selectionAfterDelete(
  library: LibrarySnapshot,
  selection: Selection,
  entity: 'folder' | 'deck' | 'card',
  id: string,
): Selection | undefined {
  if (selection === null || entity === 'card') return undefined
  if (entity === 'deck') {
    if (selection.kind !== 'deck' || selection.id !== id) return undefined
    return folderSelection(library.decks.find((deck) => deck.id === id)?.folderId ?? null)
  }
  const openFolderId =
    selection.kind === 'folder'
      ? selection.id
      : library.decks.find((deck) => deck.id === selection.id)?.folderId ?? null
  if (!folderPath(library.folders, openFolderId).includes(id)) return undefined
  return folderSelection(library.folders.find((folder) => folder.id === id)?.parentId ?? null)
}

function folderSelection(folderId: string | null): Selection {
  return folderId === null ? null : { kind: 'folder', id: folderId }
}
