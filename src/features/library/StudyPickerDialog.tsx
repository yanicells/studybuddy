import {
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Folder,
  Layers3,
  Minus,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import { Button } from '../../components/Button'
import { Dialog } from '../../components/Dialog'
import type { StudyMode } from '../../core/queue'
import { descendantDeckIds, rollupStats } from '../../core/stats'
import { studyDeckIds, studySourceName, type StudySource } from '../../core/studyScope'
import { EMPTY_STATS, type DeckStats, type LibrarySnapshot } from '../../core/types'
import type { LibraryDialog } from './library.types'

interface StudyPickerDialogProps {
  dialog: Extract<NonNullable<LibraryDialog>, { kind: 'study' }>
  library: LibrarySnapshot
  onClose: () => void
  onStartStudy: (deckIds: string[], source: StudySource, mode: StudyMode) => void
}

export function StudyPickerDialog({
  dialog,
  library,
  onClose,
  onStartStudy,
}: Readonly<StudyPickerDialogProps>) {
  const sourceDeckIds = useMemo(
    () => studyDeckIds(library, dialog.source),
    [dialog.source, library],
  )
  const [selectedDeckIds, setSelectedDeckIds] = useState(() => new Set(sourceDeckIds))
  const [expandedFolders, setExpandedFolders] = useState(
    () => new Set(library.folders.map((folder) => folder.id)),
  )
  const selectedIds = sourceDeckIds.filter((id) => selectedDeckIds.has(id))
  const selectedStats = rollupStats(library, selectedIds)
  const selectedCards = totalCards(selectedStats)
  const sourceName = studySourceName(library, dialog.source)
  const showTree = dialog.source.kind !== 'deck'
  const parentId = dialog.source.kind === 'folder' ? dialog.source.id : null
  const rootFolders = library.folders.filter((folder) => folder.parentId === parentId)
  const rootDecks = library.decks.filter((deck) => deck.folderId === parentId)

  function toggleDeck(deckId: string) {
    setSelectedDeckIds((current) => {
      const next = new Set(current)
      if (next.has(deckId)) next.delete(deckId)
      else next.add(deckId)
      return next
    })
  }

  function toggleFolder(folderId: string) {
    const folderDeckIds = descendantDeckIds(library, folderId)
    setSelectedDeckIds((current) => {
      const next = new Set(current)
      const remove = folderDeckIds.length > 0 && folderDeckIds.every((id) => current.has(id))
      for (const id of folderDeckIds) {
        if (remove) next.delete(id)
        else next.add(id)
      }
      return next
    })
  }

  function toggleExpanded(folderId: string) {
    setExpandedFolders((current) => {
      const next = new Set(current)
      if (next.has(folderId)) next.delete(folderId)
      else next.add(folderId)
      return next
    })
  }

  function start(mode: StudyMode) {
    if (selectedIds.length === 0 || selectedCards === 0) return
    onClose()
    onStartStudy(selectedIds, dialog.source, mode)
  }

  return (
    <Dialog
      title={`Study ${sourceName}`}
      description={
        showTree
          ? 'Choose any mix of folders and decks, then start with due cards or the full selection.'
          : `Quiz due cards only, or every card in ${sourceName}.`
      }
      onClose={onClose}
      wide={showTree}
    >
      {showTree ? (
        <>
          <div className="study-picker__summary" aria-live="polite">
            <span>
              <strong>{selectedIds.length}</strong> of {sourceDeckIds.length}{' '}
              {sourceDeckIds.length === 1 ? 'deck' : 'decks'}
            </span>
            <span><strong>{selectedCards}</strong> {selectedCards === 1 ? 'card' : 'cards'} · {selectedStats.due} due</span>
            <Button
              variant="ghost"
              size="small"
              onClick={() =>
                setSelectedDeckIds(
                  selectedIds.length === sourceDeckIds.length ? new Set() : new Set(sourceDeckIds),
                )
              }
            >
              {selectedIds.length === sourceDeckIds.length ? 'Clear' : 'Select all'}
            </Button>
          </div>
          <div className="study-tree" aria-label={`Decks in ${sourceName}`}>
            {rootFolders.map((folder) => (
              <StudyFolderOption
                key={folder.id}
                folderId={folder.id}
                library={library}
                selectedDeckIds={selectedDeckIds}
                expandedFolders={expandedFolders}
                onToggleFolder={toggleFolder}
                onToggleDeck={toggleDeck}
                onToggleExpanded={toggleExpanded}
              />
            ))}
            {rootDecks.map((deck) => (
              <StudyDeckOption
                key={deck.id}
                deckId={deck.id}
                library={library}
                selected={selectedDeckIds.has(deck.id)}
                onToggle={toggleDeck}
              />
            ))}
          </div>
        </>
      ) : null}

      <p className="study-picker__label">Choose session</p>
      <div className="move-list study-mode-list">
        <button type="button" disabled={selectedCards === 0} onClick={() => start('due')}>
          <span><Clock size={17} /> Due only</span>
          <small>{selectedStats.due} due</small>
        </button>
        <button type="button" disabled={selectedCards === 0} onClick={() => start('all')}>
          <span><Layers3 size={17} /> All cards</span>
          <small>{selectedCards} {selectedCards === 1 ? 'card' : 'cards'}</small>
        </button>
      </div>
      {sourceDeckIds.length === 0 ? (
        <p className="dialog-error" role="status">Add a deck to this folder before studying it.</p>
      ) : selectedIds.length === 0 ? (
        <p className="study-picker__hint" role="status">Select at least one deck to continue.</p>
      ) : selectedCards === 0 ? (
        <p className="study-picker__hint" role="status">The selected decks do not have any cards yet.</p>
      ) : null}
    </Dialog>
  )
}

interface StudyFolderOptionProps {
  folderId: string
  library: LibrarySnapshot
  selectedDeckIds: Set<string>
  expandedFolders: Set<string>
  onToggleFolder: (folderId: string) => void
  onToggleDeck: (deckId: string) => void
  onToggleExpanded: (folderId: string) => void
}

function StudyFolderOption({
  folderId,
  library,
  selectedDeckIds,
  expandedFolders,
  onToggleFolder,
  onToggleDeck,
  onToggleExpanded,
}: Readonly<StudyFolderOptionProps>) {
  const folder = library.folders.find((item) => item.id === folderId)
  if (!folder) return null
  const folderDeckIds = descendantDeckIds(library, folderId)
  const selectedCount = folderDeckIds.filter((id) => selectedDeckIds.has(id)).length
  const allSelected = folderDeckIds.length > 0 && selectedCount === folderDeckIds.length
  const partiallySelected = selectedCount > 0 && !allSelected
  const expanded = expandedFolders.has(folderId)
  const childFolders = library.folders.filter((item) => item.parentId === folderId)
  const childDecks = library.decks.filter((deck) => deck.folderId === folderId)
  const stats = rollupStats(library, folderDeckIds)

  return (
    <div className="study-tree__branch">
      <div className="study-tree__row">
        <button
          type="button"
          className="study-tree__expander"
          aria-label={`${expanded ? 'Collapse' : 'Expand'} ${folder.name}`}
          aria-expanded={expanded}
          onClick={() => onToggleExpanded(folderId)}
        >
          {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </button>
        <button
          type="button"
          className="study-tree__option"
          role="checkbox"
          aria-checked={partiallySelected ? 'mixed' : allSelected}
          disabled={folderDeckIds.length === 0}
          onClick={() => onToggleFolder(folderId)}
        >
          <SelectionMark selected={allSelected} partial={partiallySelected} />
          <Folder size={17} />
          <span>
            <strong>{folder.name}</strong>
            <small>{folderDeckIds.length} {folderDeckIds.length === 1 ? 'deck' : 'decks'} · {totalCards(stats)} cards</small>
          </span>
        </button>
      </div>
      {expanded ? (
        <div className="study-tree__children">
          {childFolders.map((child) => (
            <StudyFolderOption
              key={child.id}
              folderId={child.id}
              library={library}
              selectedDeckIds={selectedDeckIds}
              expandedFolders={expandedFolders}
              onToggleFolder={onToggleFolder}
              onToggleDeck={onToggleDeck}
              onToggleExpanded={onToggleExpanded}
            />
          ))}
          {childDecks.map((deck) => (
            <StudyDeckOption
              key={deck.id}
              deckId={deck.id}
              library={library}
              selected={selectedDeckIds.has(deck.id)}
              onToggle={onToggleDeck}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function StudyDeckOption({
  deckId,
  library,
  selected,
  onToggle,
}: Readonly<{
  deckId: string
  library: LibrarySnapshot
  selected: boolean
  onToggle: (deckId: string) => void
}>) {
  const deck = library.decks.find((item) => item.id === deckId)
  if (!deck) return null
  const stats = library.statsByDeck[deckId] ?? EMPTY_STATS
  return (
    <div className="study-tree__row study-tree__row--deck">
      <span className="study-tree__spacer" />
      <button
        type="button"
        className="study-tree__option"
        role="checkbox"
        aria-checked={selected}
        onClick={() => onToggle(deckId)}
      >
        <SelectionMark selected={selected} partial={false} />
        <Layers3 size={17} />
        <span>
          <strong>{deck.name}</strong>
          <small>{totalCards(stats)} cards · {stats.due} due</small>
        </span>
      </button>
    </div>
  )
}

function SelectionMark({ selected, partial }: Readonly<{ selected: boolean; partial: boolean }>) {
  return (
    <span className={`study-checkbox${selected || partial ? ' is-selected' : ''}`} aria-hidden="true">
      {partial ? <Minus size={12} /> : selected ? <Check size={12} /> : null}
    </span>
  )
}

function totalCards(stats: DeckStats): number {
  return stats.new + stats.learning + stats.mastered
}
