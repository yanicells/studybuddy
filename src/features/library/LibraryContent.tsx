import type { ReactNode } from 'react'
import { ArrowRight, Folder, Layers3, Pencil, Trash2 } from 'lucide-react'

import { Button } from '../../components/Button'
import { CardText } from '../../components/CardText'
import { StackedProgress } from '../../components/ProgressBars'
import { phrasesForSide } from '../../core/quiz'
import { descendantDeckIds, rollupStats } from '../../core/stats'
import { EMPTY_STATS, type Card, type DeckStats, type LibrarySnapshot, type Status } from '../../core/types'
import type { LibraryDialog, Selection, StatusFilter } from './library.types'

interface LibraryContentProps {
  library: LibrarySnapshot
  selection: Selection
  filter: StatusFilter
  onFilter: (filter: StatusFilter) => void
  onSelect: (selection: Selection) => void
  onDialog: (dialog: LibraryDialog) => void
}

export function LibraryContent(props: LibraryContentProps) {
  if (props.selection === null) return <LibraryHome {...props} />
  if (props.selection.kind === 'folder') return <FolderContent {...props} />
  return <DeckContent {...props} />
}

function LibraryHome({ library, onSelect }: LibraryContentProps) {
  const folders = library.folders.filter((folder) => folder.parentId === null)
  const decks = library.decks.filter((deck) => deck.folderId === null)
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
          body="Create a folder or deck in the library to start."
        />
      ) : (
        <div className="folder-grid" aria-label="Folders and decks">
          {folders.map((folder) => {
            const deckIds = descendantDeckIds(library, folder.id)
            const stats = rollupStats(library, deckIds)
            const nested = library.folders.filter((child) => child.parentId === folder.id).length
            const deckCount = deckIds.length
            return (
              <button
                type="button"
                className="folder-tile"
                key={folder.id}
                onClick={() => onSelect({ kind: 'folder', id: folder.id })}
              >
                <span className="tile-icon"><Folder size={18} /></span>
                <span className="deck-tile__copy">
                  <strong>{folder.name}</strong>
                  <small>
                    {stats.due} due · {deckCount} {deckCount === 1 ? 'deck' : 'decks'}
                    {nested > 0 ? ` · ${nested} ${nested === 1 ? 'folder' : 'folders'}` : ''}
                  </small>
                  <StackedProgress stats={stats} />
                </span>
                <ArrowRight size={16} />
              </button>
            )
          })}
          {decks.map((deck) => (
            <DeckTile
              key={deck.id}
              name={deck.name}
              stats={library.statsByDeck[deck.id] ?? EMPTY_STATS}
              onClick={() => onSelect({ kind: 'deck', id: deck.id })}
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

function FolderContent({ library, selection, onSelect }: LibraryContentProps) {
  if (selection?.kind !== 'folder') return null
  const folders = library.folders.filter((folder) => folder.parentId === selection.id)
  const decks = library.decks.filter((deck) => deck.folderId === selection.id)

  if (folders.length === 0 && decks.length === 0) {
    return <EmptyState icon={<Folder />} title="This folder is empty" body="Add a folder or deck from the toolbar." />
  }

  return (
    <section className="folder-grid" aria-label="Folder contents">
      {folders.map((folder) => {
        const stats = rollupStats(library, descendantDeckIds(library, folder.id))
        return (
          <button
            type="button"
            className="folder-tile"
            key={folder.id}
            onClick={() => onSelect({ kind: 'folder', id: folder.id })}
          >
            <span className="tile-icon"><Folder size={18} /></span>
            <span className="deck-tile__copy">
              <strong>{folder.name}</strong>
              <small>{stats.due} due · Folder</small>
              <StackedProgress stats={stats} />
            </span>
            <ArrowRight size={16} />
          </button>
        )
      })}
      {decks.map((deck) => (
        <DeckTile
          key={deck.id}
          name={deck.name}
          stats={library.statsByDeck[deck.id] ?? EMPTY_STATS}
          onClick={() => onSelect({ kind: 'deck', id: deck.id })}
        />
      ))}
    </section>
  )
}

function DeckTile({
  name,
  stats,
  onClick,
}: Readonly<{ name: string; stats: DeckStats; onClick: () => void }>) {
  const total = totalCards(stats)
  return (
    <button type="button" className="deck-tile" onClick={onClick}>
      <span className="tile-icon"><Layers3 size={18} /></span>
      <span className="deck-tile__copy">
        <strong>{name}</strong>
        <small>{stats.due} due · {total} {total === 1 ? 'card' : 'cards'}</small>
        <StackedProgress stats={stats} />
      </span>
      <ArrowRight size={16} />
    </button>
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

function totalCards(stats: DeckStats): number {
  return stats.new + stats.learning + stats.mastered
}

function capitalize(value: string): string {
  return value[0]!.toUpperCase() + value.slice(1)
}
