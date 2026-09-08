import type { DragEvent, ReactNode } from 'react'
import { useState } from 'react'
import { ArrowRight, ChevronDown, ChevronUp, Folder, FolderPlus, GripVertical, Layers3, Pencil, Trash2 } from 'lucide-react'

import { Button } from '../../components/Button'
import { CardText } from '../../components/CardText'
import { OverflowMenu } from '../../components/OverflowMenu'
import { StackedProgress } from '../../components/ProgressBars'
import { phrasesForSide } from '../../core/quiz'
import { descendantDeckIds, rollupStats } from '../../core/stats'
import { EMPTY_STATS, type Card, type DeckStats, type LibrarySnapshot, type Status } from '../../core/types'
import { createNameDialog, type LibraryDialog, type Selection, type StatusFilter } from './library.types'
import {
  dropSibling,
  isDropAfter,
  moveSibling,
  readReorderDrag,
  startReorderDrag,
  type ReorderKind,
  type ReorderRequest,
} from './reorder'

interface LibraryContentProps {
  library: LibrarySnapshot
  selection: Selection
  filter: StatusFilter
  reordering: boolean
  onFilter: (filter: StatusFilter) => void
  onSelect: (selection: Selection) => void
  onDialog: (dialog: LibraryDialog) => void
  onReorder: (request: ReorderRequest) => void
}

interface TileDragState {
  draggingId: string | null
  dropTarget: { id: string; after: boolean } | null
}

export function LibraryContent(props: LibraryContentProps) {
  if (props.selection === null) return <LibraryHome {...props} />
  if (props.selection.kind === 'folder') return <FolderContent {...props} />
  return <DeckContent {...props} />
}

function LibraryHome({ library, onSelect, reordering, onReorder }: LibraryContentProps) {
  const folders = library.folders.filter((folder) => folder.parentId === null)
  const decks = library.decks.filter((deck) => deck.folderId === null)
  const dragProps = { reordering, ...useTileDrag(), onReorder }
  const dueDecks = library.decks
    .filter((deck) => (library.statsByDeck[deck.id]?.due ?? 0) > 0)
    .sort((left, right) => (library.statsByDeck[right.id]?.due ?? 0) - (library.statsByDeck[left.id]?.due ?? 0))
  const cardCount = Object.values(library.cardsByDeck).reduce(
    (total, cards) => total + cards.length,
    0,
  )

  return (
    <section className="home">
      <div className="home-today">
        <p className="home-today__due">
          <strong>{library.study.due}</strong>
          <span>due today</span>
        </p>
        <p>
          {library.study.streak} {library.study.streak === 1 ? 'day' : 'days'} streak
          {' · '}
          {library.study.reviewedToday} reviewed today
          {' · '}
          {library.decks.length} {library.decks.length === 1 ? 'deck' : 'decks'}
          {' · '}
          {cardCount} {cardCount === 1 ? 'card' : 'cards'}
        </p>
      </div>

      {folders.length === 0 && decks.length === 0 ? (
        <EmptyState
          icon={<Folder />}
          title="Nothing here yet"
          body="Use Folder or Deck above to add something to the library."
        />
      ) : (
        <div className="folder-grid" aria-label="Folders and decks">
          {folders.map((folder) => {
            const deckIds = descendantDeckIds(library, folder.id)
            const stats = rollupStats(library, deckIds)
            const nested = library.folders.filter((child) => child.parentId === folder.id).length
            const deckCount = deckIds.length
            return (
              <SortableTile
                key={folder.id}
                tileClass="folder-tile"
                name={folder.name}
                kind="folder"
                parentId={null}
                itemId={folder.id}
                siblingIds={folders.map((sibling) => sibling.id)}
                onOpen={() => onSelect({ kind: 'folder', id: folder.id })}
                {...dragProps}
              >
                <span className="tile-icon"><Folder size={18} /></span>
                <span className="deck-tile__copy">
                  <strong>{folder.name}</strong>
                  <small>
                    {stats.due} due · {totalCards(stats)} {totalCards(stats) === 1 ? 'card' : 'cards'} · {deckCount} {deckCount === 1 ? 'deck' : 'decks'}
                    {nested > 0 ? ` · ${nested} ${nested === 1 ? 'folder' : 'folders'}` : ''}
                  </small>
                  <StackedProgress stats={stats} />
                </span>
                <ArrowRight size={16} />
              </SortableTile>
            )
          })}
          {decks.map((deck) => (
            <DeckTile
              key={deck.id}
              name={deck.name}
              stats={library.statsByDeck[deck.id] ?? EMPTY_STATS}
              kind="deck"
              parentId={null}
              itemId={deck.id}
              siblingIds={decks.map((sibling) => sibling.id)}
              onOpen={() => onSelect({ kind: 'deck', id: deck.id })}
              {...dragProps}
            />
          ))}
        </div>
      )}

      {dueDecks.length > 0 ? (
        <div className="home-section">
          <h2>Due now</h2>
          <div className="due-list" aria-label="Decks with cards due">
            {dueDecks.map((deck) => {
              const stats = library.statsByDeck[deck.id] ?? EMPTY_STATS
              return (
                <button
                  type="button"
                  className="due-row"
                  key={deck.id}
                  onClick={() => onSelect({ kind: 'deck', id: deck.id })}
                >
                  <span>
                    <strong>{deck.name}</strong>
                    <small>{stats.learning} learning · {stats.mastered} mastered</small>
                  </span>
                  <span className="due-row__count">{stats.due}</span>
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </section>
  )
}

function FolderContent({ library, selection, onSelect, reordering, onReorder }: LibraryContentProps) {
  const dragProps = { reordering, ...useTileDrag(), onReorder }
  if (selection?.kind !== 'folder') return null
  const folders = library.folders.filter((folder) => folder.parentId === selection.id)
  const decks = library.decks.filter((deck) => deck.folderId === selection.id)

  if (folders.length === 0 && decks.length === 0) {
    return <EmptyState icon={<Folder />} title="This folder is empty" body="Use Folder or Deck above to add something here." />
  }

  return (
    <section className="folder-grid" aria-label="Folder contents">
      {folders.map((folder) => {
        const deckIds = descendantDeckIds(library, folder.id)
        const stats = rollupStats(library, deckIds)
        return (
          <SortableTile
            key={folder.id}
            tileClass="folder-tile"
            name={folder.name}
            kind="folder"
            parentId={selection.id}
            itemId={folder.id}
            siblingIds={folders.map((sibling) => sibling.id)}
            onOpen={() => onSelect({ kind: 'folder', id: folder.id })}
            {...dragProps}
          >
            <span className="tile-icon"><Folder size={18} /></span>
            <span className="deck-tile__copy">
              <strong>{folder.name}</strong>
              <small>
                {stats.due} due · {totalCards(stats)} {totalCards(stats) === 1 ? 'card' : 'cards'} · {deckIds.length} {deckIds.length === 1 ? 'deck' : 'decks'}
              </small>
              <StackedProgress stats={stats} />
            </span>
            <ArrowRight size={16} />
          </SortableTile>
        )
      })}
      {decks.map((deck) => (
        <DeckTile
          key={deck.id}
          name={deck.name}
          stats={library.statsByDeck[deck.id] ?? EMPTY_STATS}
          kind="deck"
          parentId={selection.id}
          itemId={deck.id}
          siblingIds={decks.map((sibling) => sibling.id)}
          onOpen={() => onSelect({ kind: 'deck', id: deck.id })}
          {...dragProps}
        />
      ))}
    </section>
  )
}

function DeckTile({
  name,
  stats,
  kind,
  parentId,
  itemId,
  siblingIds,
  reordering,
  drag,
  setDrag,
  onOpen,
  onReorder,
}: Readonly<{
  name: string
  stats: DeckStats
  kind: ReorderKind
  parentId: string | null
  itemId: string
  siblingIds: string[]
  reordering: boolean
  drag: TileDragState
  setDrag: TileSetDrag
  onOpen: () => void
  onReorder: (request: ReorderRequest) => void
}>) {
  const total = totalCards(stats)
  return (
    <SortableTile
      tileClass="deck-tile"
      name={name}
      kind={kind}
      parentId={parentId}
      itemId={itemId}
      siblingIds={siblingIds}
      reordering={reordering}
      drag={drag}
      setDrag={setDrag}
      onOpen={onOpen}
      onReorder={onReorder}
    >
      <span className="tile-icon"><Layers3 size={18} /></span>
      <span className="deck-tile__copy">
        <strong>{name}</strong>
        <small>{stats.due} due · {total} {total === 1 ? 'card' : 'cards'}</small>
        <StackedProgress stats={stats} />
      </span>
      <ArrowRight size={16} />
    </SortableTile>
  )
}

interface TileSortableProps {
  reordering: boolean
  drag: TileDragState
  setDrag: TileSetDrag
  onReorder: (request: ReorderRequest) => void
}

interface TileSetDrag {
  setDraggingId: (id: string | null) => void
  setDropTarget: (target: TileDragState['dropTarget']) => void
}

function useTileDrag(): { drag: TileDragState; setDrag: TileSetDrag } {
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<TileDragState['dropTarget']>(null)
  return { drag: { draggingId, dropTarget }, setDrag: { setDraggingId, setDropTarget } }
}

function SortableTile({
  tileClass,
  name,
  kind,
  parentId,
  itemId,
  siblingIds,
  reordering,
  drag,
  setDrag,
  onOpen,
  onReorder,
  children,
}: Readonly<{
  tileClass: 'folder-tile' | 'deck-tile'
  name: string
  kind: ReorderKind
  parentId: string | null
  itemId: string
  siblingIds: string[]
  onOpen: () => void
  children: ReactNode
} & TileSortableProps>) {
  const index = siblingIds.indexOf(itemId)
  const canMoveUp = index > 0
  const canMoveDown = index >= 0 && index < siblingIds.length - 1
  function move(delta: -1 | 1) {
    const orderedIds = moveSibling(siblingIds, itemId, delta)
    if (orderedIds) onReorder({ kind, parentId, orderedIds })
  }
  let dropClass = ''
  if (drag.draggingId === itemId) dropClass = ' is-dragging'
  else if (drag.dropTarget?.id === itemId) {
    dropClass = drag.dropTarget.after ? ' is-drop-after' : ' is-drop-before'
  }
  function onDragOver(event: DragEvent) {
    const draggedId = readReorderDrag(event, kind)
    if (!draggedId || draggedId === itemId || !siblingIds.includes(draggedId)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setDrag.setDropTarget({ id: itemId, after: isDropAfter(event, event.currentTarget as HTMLElement) })
  }
  function onDrop(event: DragEvent) {
    event.preventDefault()
    const after = isDropAfter(event, event.currentTarget as HTMLElement)
    const draggedId = readReorderDrag(event, kind)
    setDrag.setDropTarget(null)
    setDrag.setDraggingId(null)
    if (!draggedId) return
    const orderedIds = dropSibling(siblingIds, draggedId, itemId, after)
    if (orderedIds) onReorder({ kind, parentId, orderedIds })
  }
  return (
    <div className="tile-wrap" role="group" aria-label={name}>
      <button
        type="button"
        className={`${tileClass}${dropClass}`}
        onClick={onOpen}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        {children}
      </button>
      <OverflowMenu
        label="Change order"
        icon={<GripVertical size={14} />}
        className="tile-reorder actions-menu"
        summaryDrag={{
          onDragStart: (event) => {
            startReorderDrag(event, { kind, id: itemId })
            setDrag.setDraggingId(itemId)
          },
          onDragEnd: () => {
            setDrag.setDraggingId(null)
            setDrag.setDropTarget(null)
          },
        }}
      >
        <Button
          variant="ghost"
          size="small"
          icon={<ChevronUp size={16} />}
          disabled={reordering || !canMoveUp}
          onClick={() => move(-1)}
        >
          Move up
        </Button>
        <Button
          variant="ghost"
          size="small"
          icon={<ChevronDown size={16} />}
          disabled={reordering || !canMoveDown}
          onClick={() => move(1)}
        >
          Move down
        </Button>
      </OverflowMenu>
    </div>
  )
}

function DeckContent({ library, selection, filter, onFilter, onDialog }: LibraryContentProps) {
  if (selection?.kind !== 'deck') return null
  const cards = library.cardsByDeck[selection.id] ?? []
  const stats = library.statsByDeck[selection.id] ?? EMPTY_STATS
  const filtered = filter === 'all' ? cards : cards.filter((card) => card.status === filter)

  return (
    <section className="deck-content">
      <div className="deck-overview">
        <p className="deck-overview__summary">
          <span><strong>{stats.due}</strong> due</span>
          <span><strong>{stats.learning}</strong> learning</span>
          <span><strong>{stats.mastered}</strong> mastered</span>
        </p>
        <StackedProgress stats={stats} />
      </div>

      <div className="filter-tabs" role="group" aria-label="Filter cards by status">
        {([
          ['all', 'All', totalCards(stats)],
          ['new', 'New', stats.new],
          ['learning', 'Learning', stats.learning],
          ['mastered', 'Mastered', stats.mastered],
        ] as const).map(([value, label, count]) => (
          <button
            type="button"
            key={value}
            className={filter === value ? 'is-active' : ''}
            aria-pressed={filter === value}
            onClick={() => onFilter(filter === value && value !== 'all' ? 'all' : value)}
          >
            {label} <span>{count}</span>
          </button>
        ))}
      </div>

      {cards.length === 0 ? (
        <EmptyState
          icon={<Layers3 />}
          title="No cards yet"
          body="Import a list or add your first card."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Layers3 />}
          title={`No ${filter} cards`}
          body="Choose another status to see the rest of this deck."
        />
      ) : (
        <div className="card-list">
          {filtered.map((card) => (
            <CardNote key={card.id} card={card} onDialog={onDialog} />
          ))}
        </div>
      )}
    </section>
  )
}

function CardNote({ card, onDialog }: Readonly<{ card: Card; onDialog: (dialog: LibraryDialog) => void }>) {
  return (
    <article className="note-card">
      <div className="note-card__front">
        <CardText text={card.front} phrases={phrasesForSide(card, 'front')} />
      </div>
      {card.back.trim() ? (
        <div className="note-card__back">
          <CardText text={card.back} phrases={phrasesForSide(card, 'back')} asBack />
        </div>
      ) : null}
      <footer>
        <StatusChip status={card.status} />
        <div>
          <Button
            variant="ghost"
            size="small"
            icon={<Pencil size={15} />}
            onClick={() => onDialog({ kind: 'card', deckId: card.deckId, card })}
          >
            Edit
          </Button>
          <Button
            variant="ghost"
            size="small"
            icon={<Trash2 size={15} />}
            onClick={() =>
              onDialog({
                kind: 'confirm',
                entity: 'card',
                id: card.id,
                title: 'Delete card?',
                description: 'This card and its review history will be removed.',
              })
            }
          >
            Delete
          </Button>
        </div>
      </footer>
    </article>
  )
}

function StatusChip({ status }: Readonly<{ status: Status }>) {
  return <span className={`status-chip status-chip--${status}`}>{capitalize(status)}</span>
}

function EmptyState({ icon, title, body }: Readonly<{ icon: ReactNode; title: string; body: string }>) {
  return (
    <div className="empty-state">
      <span>{icon}</span>
      <h2>{title}</h2>
      <p>{body}</p>
    </div>
  )
}

export function CreatePlaceButtons({
  parentId,
  className,
  onDialog,
}: Readonly<{
  parentId: string | null
  className?: string
  onDialog: (dialog: LibraryDialog) => void
}>) {
  return (
    <>
      <Button
        className={className}
        variant="ghost"
        size="small"
        icon={<FolderPlus size={16} />}
        onClick={() => onDialog(createNameDialog('folder', parentId))}
      >
        Folder
      </Button>
      <Button
        className={className}
        size="small"
        icon={<Layers3 size={16} />}
        onClick={() => onDialog(createNameDialog('deck', parentId))}
      >
        Deck
      </Button>
    </>
  )
}

function totalCards(stats: DeckStats): number {
  return stats.new + stats.learning + stats.mastered
}

function capitalize(value: string): string {
  return value[0]!.toUpperCase() + value.slice(1)
}
