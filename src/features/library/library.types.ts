import type { Card } from '../../core/types'

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
