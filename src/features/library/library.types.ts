import type { Card, Deck, Folder } from '../../core/types'

export type Selection =
  | { kind: 'folder'; id: number }
  | { kind: 'deck'; id: number }
  | null

export type StatusFilter = 'all' | 'new' | 'learning' | 'mastered'

export type LibraryDialog =
  | {
      kind: 'name'
      entity: 'folder' | 'deck'
      mode: 'create' | 'rename'
      id: number | null
      parentId: number | null
      initialName: string
    }
  | {
      kind: 'confirm'
      entity: 'folder' | 'deck' | 'card'
      id: number
      title: string
      description: string
    }
  | { kind: 'move'; entity: 'folder' | 'deck'; id: number }
  | { kind: 'import'; deckId: number | null; folderId: number | null }
  | { kind: 'card'; deckId: number; card: Card | null }
  | null

export function createNameDialog(
  entity: 'folder' | 'deck',
  parentId: number | null,
): Extract<LibraryDialog, { kind: 'name' }> {
  return {
    kind: 'name',
    entity,
    mode: 'create',
    id: null,
    parentId,
    initialName: '',
  }
}

export function renameFolderDialog(folder: Folder): LibraryDialog {
  return {
    kind: 'name',
    entity: 'folder',
    mode: 'rename',
    id: folder.id,
    parentId: folder.parentId,
    initialName: folder.name,
  }
}

export function renameDeckDialog(deck: Deck): LibraryDialog {
  return {
    kind: 'name',
    entity: 'deck',
    mode: 'rename',
    id: deck.id,
    parentId: deck.folderId,
    initialName: deck.name,
  }
}

export function moveItemDialog(entity: 'folder' | 'deck', id: number): LibraryDialog {
  return { kind: 'move', entity, id }
}

export function deleteFolderDialog(id: number): LibraryDialog {
  return {
    kind: 'confirm',
    entity: 'folder',
    id,
    title: 'Delete folder?',
    description: 'Every folder, deck, card, and review inside will be removed.',
  }
}

export function deleteDeckDialog(id: number): LibraryDialog {
  return {
    kind: 'confirm',
    entity: 'deck',
    id,
    title: 'Delete deck?',
    description: 'Every card and review in this deck will be removed.',
  }
}
