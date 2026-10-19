import { descendantDeckIds } from './stats'
import type { LibrarySnapshot } from './types'

export type StudySource =
  | { kind: 'library' }
  | { kind: 'folder'; id: string }
  | { kind: 'deck'; id: string }

export function studyDeckIds(library: LibrarySnapshot, source: StudySource): string[] {
  if (source.kind === 'library') return library.decks.map((deck) => deck.id)
  if (source.kind === 'folder') return descendantDeckIds(library, source.id)
  return library.decks.some((deck) => deck.id === source.id) ? [source.id] : []
}

export function studySourceName(library: LibrarySnapshot, source: StudySource): string {
  if (source.kind === 'library') return 'Library'
  if (source.kind === 'folder') {
    return library.folders.find((folder) => folder.id === source.id)?.name ?? 'Folder'
  }
  return library.decks.find((deck) => deck.id === source.id)?.name ?? 'Deck'
}

/** True when the folder or deck behind a study source still exists. */
export function studySourceExists(library: LibrarySnapshot, source: StudySource): boolean {
  if (source.kind === 'library') return true
  if (source.kind === 'folder') return library.folders.some((folder) => folder.id === source.id)
  return library.decks.some((deck) => deck.id === source.id)
}

/**
 * Narrows requested decks to the ones still inside the source scope, in scope order.
 * Without a request the whole scope is studied.
 */
export function resolveStudyDeckIds(
  library: LibrarySnapshot,
  source: StudySource,
  requested?: readonly string[],
): string[] {
  const scope = studyDeckIds(library, source)
  if (!requested) return scope
  const wanted = new Set(requested)
  return scope.filter((id) => wanted.has(id))
}
