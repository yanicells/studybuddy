import { ArrowRight, Edit3, Folder, Layers3, Trash2 } from 'lucide-react'

import { AppIcon } from '../../components/AppIcon'
import { Button } from '../../components/Button'
import { HighlightedText } from '../../components/HighlightedText'
import { StackedProgress } from '../../components/ProgressBars'
import type { Card, DeckStats, LibrarySnapshot, Side, Status } from '../../core/types'
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
  if (props.selection === null) return <LibraryLanding library={props.library} />
  if (props.selection.kind === 'folder') return <FolderContent {...props} />
  return <DeckContent {...props} />
}

function LibraryLanding({ library }: Readonly<{ library: LibrarySnapshot }>) {
  const cardCount = Object.values(library.cardsByDeck).reduce(
    (total, cards) => total + cards.length,
    0,
  )
  return (
    <section className="library-landing">
      <div className="landing-copy">
        <span className="eyebrow">Your study library</span>
        <h1>One small set.<br />One clear session.</h1>
        <p>
          Choose a deck from the library, or shape a new one from the notes you already have.
        </p>
        <div className="library-totals" aria-label="Library totals">
          <span><strong>{library.decks.length}</strong> decks</span>
          <span><strong>{cardCount}</strong> cards</span>
        </div>
      </div>
      <div className="index-stack" aria-hidden="true">
        <div className="index-card index-card--back" />
        <div className="index-card index-card--middle" />
        <div className="index-card index-card--front">
          <AppIcon size="large" />
          <span>Pick a deck</span>
          <i />
          <i />
          <i />
        </div>
      </div>
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
      {folders.map((folder) => (
        <button
          type="button"
          className="folder-tile"
          key={folder.id}
          onClick={() => onSelect({ kind: 'folder', id: folder.id })}
        >
          <span className="tile-icon"><Folder size={20} /></span>
          <span><strong>{folder.name}</strong><small>Folder</small></span>
          <ArrowRight size={17} />
        </button>
      ))}
      {decks.map((deck) => {
        const stats = library.statsByDeck[deck.id] ?? emptyStats()
        const total = totalCards(stats)
        return (
          <button
            type="button"
            className="deck-tile"
            key={deck.id}
            onClick={() => onSelect({ kind: 'deck', id: deck.id })}
          >
            <span className="tile-icon"><Layers3 size={20} /></span>
            <span className="deck-tile__copy">
              <strong>{deck.name}</strong>
              <small>{stats.due} due · {total} {total === 1 ? 'card' : 'cards'}</small>
              <StackedProgress stats={stats} />
            </span>
            <ArrowRight size={17} />
          </button>
        )
      })}
    </section>
  )
}

function DeckContent({ library, selection, filter, onFilter, onDialog }: LibraryContentProps) {
  if (selection?.kind !== 'deck') return null
  const cards = library.cardsByDeck[selection.id] ?? []
  const stats = library.statsByDeck[selection.id] ?? emptyStats()
  const filtered = filter === 'all' ? cards : cards.filter((card) => card.status === filter)

  return (
    <section className="deck-content">
      <div className="deck-overview">
        <div className="deck-overview__summary">
          <span><strong>{stats.due}</strong><small>Due now</small></span>
          <span><strong>{stats.learning}</strong><small>Learning</small></span>
          <span><strong>{stats.mastered}</strong><small>Mastered</small></span>
        </div>
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
      <div className="note-card__pin" aria-hidden="true" />
      <div className="note-card__front">
        <span className="section-kicker">Prompt</span>
        <p><HighlightedText text={card.front} phrases={phrases(card, 'front')} /></p>
      </div>
      {card.back.trim() ? (
        <div className="note-card__back">
          <span className="section-kicker">Answer</span>
          {card.back.split('\n').filter(Boolean).map((line, index) => (
            <p key={`${index}-${line}`}>
              <span aria-hidden="true">•</span>
              <HighlightedText text={line} phrases={phrases(card, 'back')} />
            </p>
          ))}
        </div>
      ) : null}
      <footer>
        <StatusChip status={card.status} />
        <div>
          <Button
            variant="ghost"
            size="small"
            icon={<Edit3 size={15} />}
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

function EmptyState({ icon, title, body }: Readonly<{ icon: React.ReactNode; title: string; body: string }>) {
  return (
    <div className="empty-state">
      <span>{icon}</span>
      <h2>{title}</h2>
      <p>{body}</p>
    </div>
  )
}

function phrases(card: Card, side: Side): string[] {
  return card.highlights.filter((highlight) => highlight.side === side).map((highlight) => highlight.text)
}

function totalCards(stats: DeckStats): number {
  return stats.new + stats.learning + stats.mastered
}

function emptyStats(): DeckStats {
  return { new: 0, learning: 0, mastered: 0, due: 0 }
}

function capitalize(value: string): string {
  return value[0]!.toUpperCase() + value.slice(1)
}
