import { ChevronRight, Ellipsis, Folder, Layers3, Move, Pencil, Trash2 } from 'lucide-react'
import { useRef, type CSSProperties } from 'react'

import { Button } from '../../components/Button'
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

interface LibraryTreeProps {
  library: LibrarySnapshot
  selection: Selection
  expanded: Set<number>
  onToggleFolder: (id: number) => void
  onSelect: (selection: Selection) => void
  onDialog: (dialog: LibraryDialog) => void
}

export function LibraryTree({
  library,
  selection,
  expanded,
  onToggleFolder,
  onSelect,
  onDialog,
}: LibraryTreeProps) {
  const rootFolders = library.folders.filter((folder) => folder.parentId === null)
  const rootDecks = library.decks.filter((deck) => deck.folderId === null)

  return (
    <nav className="library-tree" aria-label="Study library">
      {rootFolders.map((folder) => (
        <FolderBranch
          key={folder.id}
          folder={folder}
          depth={0}
          library={library}
          selection={selection}
          expanded={expanded}
          onToggleFolder={onToggleFolder}
          onSelect={onSelect}
          onDialog={onDialog}
        />
      ))}
      {rootDecks.map((deck) => (
        <DeckRow
          key={deck.id}
          deck={deck}
          depth={0}
          library={library}
          selected={selection?.kind === 'deck' && selection.id === deck.id}
          onSelect={onSelect}
          onDialog={onDialog}
        />
      ))}
    </nav>
  )
}

interface FolderBranchProps extends LibraryTreeProps {
  folder: FolderType
  depth: number
}

function FolderBranch({
  folder,
  depth,
  library,
  selection,
  expanded,
  onToggleFolder,
  onSelect,
  onDialog,
}: FolderBranchProps) {
  const open = expanded.has(folder.id)
  const selected = selection?.kind === 'folder' && selection.id === folder.id
  const childFolders = library.folders.filter((child) => child.parentId === folder.id)
  const childDecks = library.decks.filter((deck) => deck.folderId === folder.id)

  return (
    <div>
      <div
        className={`tree-row ${selected ? 'tree-row--selected' : ''}`}
        style={{ '--tree-depth': depth } as CSSProperties}
      >
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
              library={library}
              selection={selection}
              expanded={expanded}
              onToggleFolder={onToggleFolder}
              onSelect={onSelect}
              onDialog={onDialog}
            />
          ))}
          {childDecks.map((deck) => (
            <DeckRow
              key={deck.id}
              deck={deck}
              depth={depth + 1}
              library={library}
              selected={selection?.kind === 'deck' && selection.id === deck.id}
              onSelect={onSelect}
              onDialog={onDialog}
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
  library,
  selected,
  onSelect,
  onDialog,
}: {
  deck: Deck
  depth: number
  library: LibrarySnapshot
  selected: boolean
  onSelect: (selection: Selection) => void
  onDialog: (dialog: LibraryDialog) => void
}) {
  const due = library.statsByDeck[deck.id]?.due ?? 0
  return (
    <div
      className={`tree-row tree-row--deck ${selected ? 'tree-row--selected' : ''}`}
      style={{ '--tree-depth': depth } as CSSProperties}
    >
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
        onRename={() => onDialog(renameDeckDialog(deck))}
        onMove={() => onDialog(moveItemDialog('deck', deck.id))}
        onDelete={() => onDialog(deleteDeckDialog(deck.id))}
      />
    </div>
  )
}

function RowMenu({
  name,
  onRename,
  onMove,
  onDelete,
}: Readonly<{
  name: string
  onRename: () => void
  onMove: () => void
  onDelete: () => void
}>) {
  const menu = useRef<HTMLDetailsElement>(null)
  function run(action: () => void) {
    menu.current?.removeAttribute('open')
    action()
  }
  return (
    <details ref={menu} className="tree-row__menu actions-menu" name="sidebar-row-menu">
      <summary aria-label={`More actions for ${name}`}><Ellipsis size={14} /></summary>
      <div>
        <Button variant="ghost" size="small" icon={<Pencil size={16} />} onClick={() => run(onRename)}>Rename</Button>
        <Button variant="ghost" size="small" icon={<Move size={16} />} onClick={() => run(onMove)}>Move</Button>
        <Button variant="ghost" size="small" icon={<Trash2 size={16} />} onClick={() => run(onDelete)}>Delete</Button>
      </div>
    </details>
  )
}
