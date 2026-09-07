import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Ellipsis,
  Folder,
  GripVertical,
  Layers3,
  Move,
  Pencil,
  Trash2,
} from 'lucide-react'
import { useState, type CSSProperties, type DragEvent, type ReactNode } from 'react'

import { Button } from '../../components/Button'
import { OverflowMenu } from '../../components/OverflowMenu'
import type { Deck, Folder as FolderType, LibrarySnapshot } from '../../core/types'
import {
  deleteDeckDialog,
  deleteFolderDialog,
  moveItemDialog,
  renameDeckDialog,
  renameFolderDialog,
  type LibraryDialog,
  type Selection,
} from './library.types'
import {
  dropSibling,
  isDropAfter,
  moveSibling,
  readReorderDrag,
  startReorderDrag,
  type ReorderKind,
  type ReorderRequest,
} from './reorder'

interface LibraryTreeProps {
  library: LibrarySnapshot
  selection: Selection
  expanded: Set<string>
  reordering: boolean
  onToggleFolder: (id: string) => void
  onSelect: (selection: Selection) => void
  onDialog: (dialog: LibraryDialog) => void
  onReorder: (request: ReorderRequest) => void
}

interface DragState {
  draggingId: string | null
  dropTarget: { id: string; after: boolean } | null
}

export function LibraryTree({
  library,
  selection,
  expanded,
  reordering,
  onToggleFolder,
  onSelect,
  onDialog,
  onReorder,
}: LibraryTreeProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<DragState['dropTarget']>(null)
  const rootFolders = library.folders.filter((folder) => folder.parentId === null)
  const rootDecks = library.decks.filter((deck) => deck.folderId === null)
  const drag: DragState = { draggingId, dropTarget }
  const setDrag = { setDraggingId, setDropTarget }

  return (
    <nav className="library-tree" aria-label="Study library">
      {rootFolders.map((folder) => (
        <FolderBranch
          key={folder.id}
          folder={folder}
          depth={0}
          siblingIds={rootFolders.map((sibling) => sibling.id)}
          library={library}
          selection={selection}
          expanded={expanded}
          reordering={reordering}
          drag={drag}
          setDrag={setDrag}
          onToggleFolder={onToggleFolder}
          onSelect={onSelect}
          onDialog={onDialog}
          onReorder={onReorder}
        />
      ))}
      {rootDecks.map((deck) => (
        <DeckRow
          key={deck.id}
          deck={deck}
          depth={0}
          siblingIds={rootDecks.map((sibling) => sibling.id)}
          library={library}
          selected={selection?.kind === 'deck' && selection.id === deck.id}
          reordering={reordering}
          drag={drag}
          setDrag={setDrag}
          onSelect={onSelect}
          onDialog={onDialog}
          onReorder={onReorder}
        />
      ))}
    </nav>
  )
}

interface BranchProps extends LibraryTreeProps {
  folder: FolderType
  depth: number
  siblingIds: string[]
  drag: DragState
  setDrag: {
    setDraggingId: (id: string | null) => void
    setDropTarget: (target: DragState['dropTarget']) => void
  }
}

function FolderBranch({
  folder,
  depth,
  siblingIds,
  library,
  selection,
  expanded,
  reordering,
  drag,
  setDrag,
  onToggleFolder,
  onSelect,
  onDialog,
  onReorder,
}: BranchProps) {
  const open = expanded.has(folder.id)
  const selected = selection?.kind === 'folder' && selection.id === folder.id
  const childFolders = library.folders.filter((child) => child.parentId === folder.id)
  const childDecks = library.decks.filter((deck) => deck.folderId === folder.id)
  const order = orderHelpers('folder', folder.parentId, folder.id, siblingIds, reordering, drag, setDrag, onReorder)

  return (
    <div>
      <div
        className={`tree-row${selected ? ' tree-row--selected' : ''}${order.dropClass}`}
        style={{ '--tree-depth': depth } as CSSProperties}
        onDragOver={order.onDragOver}
        onDrop={order.onDrop}
      >
        {order.grip}
        <button
          type="button"
          className="tree-row__toggle"
          aria-expanded={open}
          aria-label={`${open ? 'Collapse' : 'Expand'} ${folder.name}`}
          onClick={() => onToggleFolder(folder.id)}
        >
          <ChevronRight className={`tree-row__chevron ${open ? 'is-open' : ''}`} size={15} />
        </button>
        <button
          type="button"
          className="tree-row__label"
          onClick={() => onSelect({ kind: 'folder', id: folder.id })}
        >
          <Folder size={16} />
          <span title={folder.name}>{folder.name}</span>
        </button>
        <RowMenu
          name={folder.name}
          reordering={reordering}
          canMoveUp={order.canMoveUp}
          canMoveDown={order.canMoveDown}
          onMoveUp={order.moveUp}
          onMoveDown={order.moveDown}
          onRename={() => onDialog(renameFolderDialog(folder))}
          onMove={() => onDialog(moveItemDialog('folder', folder.id))}
          onDelete={() => onDialog(deleteFolderDialog(folder.id))}
        />
      </div>
      {open ? (
        <div>
          {childFolders.map((child) => (
            <FolderBranch
              key={child.id}
              folder={child}
              depth={depth + 1}
              siblingIds={childFolders.map((sibling) => sibling.id)}
              library={library}
              selection={selection}
              expanded={expanded}
              reordering={reordering}
              drag={drag}
              setDrag={setDrag}
              onToggleFolder={onToggleFolder}
              onSelect={onSelect}
              onDialog={onDialog}
              onReorder={onReorder}
            />
          ))}
          {childDecks.map((deck) => (
            <DeckRow
              key={deck.id}
              deck={deck}
              depth={depth + 1}
              siblingIds={childDecks.map((sibling) => sibling.id)}
              library={library}
              selected={selection?.kind === 'deck' && selection.id === deck.id}
              reordering={reordering}
              drag={drag}
              setDrag={setDrag}
              onSelect={onSelect}
              onDialog={onDialog}
              onReorder={onReorder}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function DeckRow({
  deck,
  depth,
  siblingIds,
  library,
  selected,
  reordering,
  drag,
  setDrag,
  onSelect,
  onDialog,
  onReorder,
}: {
  deck: Deck
  depth: number
  siblingIds: string[]
  library: LibrarySnapshot
  selected: boolean
  reordering: boolean
  drag: DragState
  setDrag: BranchProps['setDrag']
  onSelect: (selection: Selection) => void
  onDialog: (dialog: LibraryDialog) => void
  onReorder: (request: ReorderRequest) => void
}) {
  const due = library.statsByDeck[deck.id]?.due ?? 0
  const order = orderHelpers('deck', deck.folderId, deck.id, siblingIds, reordering, drag, setDrag, onReorder)
  return (
    <div
      className={`tree-row tree-row--deck${selected ? ' tree-row--selected' : ''}${order.dropClass}`}
      style={{ '--tree-depth': depth } as CSSProperties}
      onDragOver={order.onDragOver}
      onDrop={order.onDrop}
    >
      {order.grip}
      <span className="tree-row__deck-spacer" />
      <button
        type="button"
        className="tree-row__label"
        onClick={() => onSelect({ kind: 'deck', id: deck.id })}
      >
        <Layers3 size={16} />
        <span title={deck.name}>{deck.name}</span>
      </button>
      {due > 0 ? <span className="tree-row__count">{due}</span> : null}
      <RowMenu
        name={deck.name}
        reordering={reordering}
        canMoveUp={order.canMoveUp}
        canMoveDown={order.canMoveDown}
        onMoveUp={order.moveUp}
        onMoveDown={order.moveDown}
        onRename={() => onDialog(renameDeckDialog(deck))}
        onMove={() => onDialog(moveItemDialog('deck', deck.id))}
        onDelete={() => onDialog(deleteDeckDialog(deck.id))}
      />
    </div>
  )
}

function orderHelpers(
  kind: ReorderKind,
  parentId: string | null,
  id: string,
  siblingIds: string[],
  reordering: boolean,
  drag: DragState,
  setDrag: BranchProps['setDrag'],
  onReorder: (request: ReorderRequest) => void,
) {
  const index = siblingIds.indexOf(id)
  const canMoveUp = index > 0
  const canMoveDown = index >= 0 && index < siblingIds.length - 1
  function move(delta: -1 | 1) {
    const orderedIds = moveSibling(siblingIds, id, delta)
    if (orderedIds) onReorder({ kind, parentId, orderedIds })
  }
  let dropClass = ''
  if (drag.draggingId === id) dropClass = ' is-dragging'
  else if (drag.dropTarget?.id === id) dropClass = drag.dropTarget.after ? ' is-drop-after' : ' is-drop-before'
  function onDragOver(event: DragEvent) {
    const draggedId = readReorderDrag(event, kind)
    if (!draggedId || draggedId === id || !siblingIds.includes(draggedId)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setDrag.setDropTarget({ id, after: isDropAfter(event, event.currentTarget as HTMLElement) })
  }
  function onDrop(event: DragEvent) {
    event.preventDefault()
    const after = isDropAfter(event, event.currentTarget as HTMLElement)
    const draggedId = readReorderDrag(event, kind)
    setDrag.setDropTarget(null)
    setDrag.setDraggingId(null)
    if (!draggedId) return
    const orderedIds = dropSibling(siblingIds, draggedId, id, after)
    if (orderedIds) onReorder({ kind, parentId, orderedIds })
  }
  const grip = (
    <span
      className="drag-grip"
      aria-hidden="true"
      draggable={!reordering}
      onDragStart={(event) => {
        startReorderDrag(event, { kind, id })
        setDrag.setDraggingId(id)
      }}
      onDragEnd={() => {
        setDrag.setDraggingId(null)
        setDrag.setDropTarget(null)
      }}
    >
      <GripVertical size={14} />
    </span>
  )
  return {
    dropClass,
    onDragOver,
    onDrop,
    grip,
    canMoveUp,
    canMoveDown,
    moveUp: () => move(-1),
    moveDown: () => move(1),
  }
}

function RowMenu({
  name,
  reordering,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onRename,
  onMove,
  onDelete,
}: Readonly<{
  name: string
  reordering: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  onRename: () => void
  onMove: () => void
  onDelete: () => void
}>) {
  return (
    <OverflowMenu
      label={`More actions for ${name}`}
      icon={<Ellipsis size={14} />}
      className="tree-row__menu actions-menu"
    >
      <RowMenuItem
        icon={<ChevronUp size={16} />}
        label="Move up"
        disabled={reordering || !canMoveUp}
        onAction={onMoveUp}
      />
      <RowMenuItem
        icon={<ChevronDown size={16} />}
        label="Move down"
        disabled={reordering || !canMoveDown}
        onAction={onMoveDown}
      />
      <Button variant="ghost" size="small" icon={<Pencil size={16} />} onClick={onRename}>Rename</Button>
      <Button variant="ghost" size="small" icon={<Move size={16} />} onClick={onMove}>Move</Button>
      <Button variant="ghost" size="small" icon={<Trash2 size={16} />} onClick={onDelete}>Delete</Button>
    </OverflowMenu>
  )
}

function RowMenuItem({
  icon,
  label,
  disabled,
  onAction,
}: Readonly<{ icon: ReactNode; label: string; disabled: boolean; onAction: () => void }>) {
  return (
    <Button variant="ghost" size="small" icon={icon} disabled={disabled} onClick={onAction}>
      {label}
    </Button>
  )
}
