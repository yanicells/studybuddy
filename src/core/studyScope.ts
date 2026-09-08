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
