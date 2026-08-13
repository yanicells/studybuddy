import { ChevronRight, Folder, Layers3 } from 'lucide-react'

import type { Deck, Folder as FolderType, LibrarySnapshot } from '../../core/types'
import type { Selection } from './library.types'

interface LibraryTreeProps {
  library: LibrarySnapshot
  selection: Selection
  expanded: Set<number>
  onToggleFolder: (id: number) => void
  onSelect: (selection: Selection) => void
}

export function LibraryTree({
  library,
  selection,
  expanded,
  onToggleFolder,
  onSelect,
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
}: FolderBranchProps) {
  const open = expanded.has(folder.id)
  const selected = selection?.kind === 'folder' && selection.id === folder.id
  const childFolders = library.folders.filter((child) => child.parentId === folder.id)
  const childDecks = library.decks.filter((deck) => deck.folderId === folder.id)

  return (
    <div>
      <div
        className={`tree-row ${selected ? 'tree-row--selected' : ''}`}
        style={{ '--tree-depth': depth } as React.CSSProperties}
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
          <span>{folder.name}</span>
        </button>
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
}: {
  deck: Deck
  depth: number
  library: LibrarySnapshot
  selected: boolean
  onSelect: (selection: Selection) => void
}) {
  const due = library.statsByDeck[deck.id]?.due ?? 0
  return (
    <button
      type="button"
      className={`tree-row tree-row--deck ${selected ? 'tree-row--selected' : ''}`}
      style={{ '--tree-depth': depth } as React.CSSProperties}
      onClick={() => onSelect({ kind: 'deck', id: deck.id })}
    >
      <span className="tree-row__deck-spacer" />
      <Layers3 size={16} />
      <span>{deck.name}</span>
      {due > 0 ? <span className="tree-row__count">{due}</span> : null}
    </button>
  )
}
