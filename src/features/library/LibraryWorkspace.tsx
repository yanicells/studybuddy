import {
  Ellipsis,
  Import,
  Menu,
  Move,
  Pencil,
  Play,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from '@tanstack/react-router'

import { AppIcon } from '../../components/AppIcon'
import { Button } from '../../components/Button'
import { folderPath, highestDueDeck } from '../../core/stats'
import type { Deck, LibrarySnapshot } from '../../core/types'
import { StudySession } from '../study/StudySession'
import { startStudyFn } from './library.functions'
import { LibraryContent, CreatePlaceButtons } from './LibraryContent'
import { LibraryDialogs } from './LibraryDialogs'
import { LibraryTree } from './LibraryTree'
import {
  deleteDeckDialog,
  deleteFolderDialog,
  moveItemDialog,
  renameDeckDialog,
  renameFolderDialog,
  type LibraryDialog,
  type Selection,
  type StatusFilter,
} from './library.types'

interface StudyPayload {
  deckName: string
  dueCards: Awaited<ReturnType<typeof startStudyFn>>['dueCards']
  deckCards: Awaited<ReturnType<typeof startStudyFn>>['deckCards']
}

export function LibraryWorkspace({ library }: Readonly<{ library: LibrarySnapshot }>) {
  const router = useRouter()
  const [selection, setSelection] = useState<Selection>(null)
  const [expanded, setExpanded] = useState(() => initialExpanded(library))
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [dialog, setDialog] = useState<LibraryDialog>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [startingStudy, setStartingStudy] = useState(false)
  const [study, setStudy] = useState<StudyPayload | null>(null)

  const selectedFolderCandidate =
    selection?.kind === 'folder'
      ? library.folders.find((folder) => folder.id === selection.id)
      : undefined
  const selectedDeckCandidate =
    selection?.kind === 'deck'
      ? library.decks.find((deck) => deck.id === selection.id)
      : undefined
  const activeSelection =
    (selection?.kind === 'folder' && selectedFolderCandidate) ||
    (selection?.kind === 'deck' && selectedDeckCandidate)
      ? selection
      : null
  const selectedFolder = activeSelection?.kind === 'folder' ? selectedFolderCandidate : undefined
  const selectedDeck = activeSelection?.kind === 'deck' ? selectedDeckCandidate : undefined

  useEffect(() => {
    if (!notice) return
    const timeout = window.setTimeout(() => setNotice(null), 6000)
    return () => window.clearTimeout(timeout)
  }, [notice])

  const select = useCallback((next: Selection) => {
    setSelection((current) => {
      if (current?.kind !== next?.kind || current?.id !== next?.id) setFilter('all')
      return next
    })
    if (next) {
      const startId =
        next.kind === 'folder'
          ? next.id
          : library.decks.find((deck) => deck.id === next.id)?.folderId ?? null
      const path = folderPath(library.folders, startId)
      if (path.length > 0) {
        setExpanded((current) => {
          const nextExpanded = new Set(current)
          for (const id of path) nextExpanded.add(id)
          return nextExpanded
        })
      }
    }
    setDrawerOpen(false)
  }, [library.decks, library.folders])

  const closeDialog = useCallback(() => setDialog(null), [])
  const createParentId = selectedFolder?.id ?? null

  async function beginStudy(deck?: Deck) {
    const target = deck ?? selectedDeck ?? highestDueDeck(library)
    if (!target) return
    setStartingStudy(true)
    try {
      const payload = await startStudyFn({ data: { deckId: target.id } })
      if (payload.dueCards.length === 0) {
        setNotice('This deck has no cards yet.')
        return
      }
      setStudy({ deckName: target.name, ...payload })
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'The study session could not start.')
    } finally {
      setStartingStudy(false)
    }
  }

  if (study) {
    return (
      <StudySession
        {...study}
        onNotice={setNotice}
        onLeave={async () => {
          setStudy(null)
          await router.invalidate()
        }}
      />
    )
  }

  const title = selectedFolder?.name ?? selectedDeck?.name ?? 'Library'
  const studyDeck = selectedDeck ?? (activeSelection === null ? highestDueDeck(library) : undefined)
  const due = studyDeck ? (library.statsByDeck[studyDeck.id]?.due ?? 0) : 0

  return (
    <main className="app-shell">
      <button
        type="button"
        className={`drawer-scrim ${drawerOpen ? 'is-open' : ''}`}
        aria-label="Close library"
        onClick={() => setDrawerOpen(false)}
      />
      <aside className={`library-rail ${drawerOpen ? 'is-open' : ''}`}>
        <div className="rail-brand">
          <button type="button" className="rail-home" onClick={() => select(null)}>
            <AppIcon />
            <strong>StudyBuddy</strong>
          </button>
          <Button className="rail-close" variant="ghost" size="small" aria-label="Close library" onClick={() => setDrawerOpen(false)}>
            <X size={18} />
          </Button>
        </div>
        <LibraryTree
          library={library}
          selection={activeSelection}
          expanded={expanded}
          onToggleFolder={(id) =>
            setExpanded((current) => {
              const next = new Set(current)
              if (next.has(id)) next.delete(id)
              else next.add(id)
              return next
            })
          }
          onSelect={select}
          onDialog={setDialog}
        />
      </aside>

      <section className="workspace">
        <div className="workspace-column">
        <header className="workspace-header">
          <Button
            className="rail-open"
            variant="ghost"
            size="small"
            aria-label="Open library"
            onClick={() => setDrawerOpen(true)}
          >
            <Menu size={20} />
          </Button>
          <div className="workspace-title">
            <h1>{title}</h1>
          </div>
          <div className="header-actions">
            {studyDeck ? (
              <Button
                variant="primary"
                size="small"
                icon={<Play size={16} fill="currentColor" />}
                disabled={startingStudy}
                onClick={() => void beginStudy(studyDeck)}
              >
                {startingStudy ? 'Starting…' : due > 0 ? `Study ${due}` : 'Study'}
              </Button>
            ) : null}
            {selectedDeck ? (
              <>
                <Button
                  className="header-actions__wide"
                  size="small"
                  icon={<Import size={16} />}
                  onClick={() => setDialog({ kind: 'import', deckId: selectedDeck.id, folderId: selectedDeck.folderId })}
                >Import</Button>
                <Button
                  className="header-actions__wide"
                  variant="ghost"
                  size="small"
                  icon={<Plus size={16} />}
                  onClick={() => setDialog({ kind: 'card', deckId: selectedDeck.id, card: null })}
                >Card</Button>
              </>
            ) : (
              <CreatePlaceButtons
                parentId={createParentId}
                className="header-actions__wide"
                onDialog={setDialog}
              />
            )}
            <details className={`actions-menu${selectedFolder || selectedDeck ? '' : ' actions-menu--mobile-only'}`}>
              <summary aria-label="More actions"><Ellipsis size={18} /></summary>
              <div>
                {selectedDeck ? (
                  <>
                    <Button
                      className="header-actions__narrow"
                      size="small"
                      icon={<Import size={16} />}
                      onClick={() => setDialog({ kind: 'import', deckId: selectedDeck.id, folderId: selectedDeck.folderId })}
                    >Import</Button>
                    <Button
                      className="header-actions__narrow"
                      variant="ghost"
                      size="small"
                      icon={<Plus size={16} />}
                      onClick={() => setDialog({ kind: 'card', deckId: selectedDeck.id, card: null })}
                    >Card</Button>
                    <Button
                      variant="ghost"
                      size="small"
                      icon={<Pencil size={16} />}
                      onClick={() => setDialog(renameDeckDialog(selectedDeck))}
                    >Rename</Button>
                    <Button
                      variant="ghost"
                      size="small"
                      icon={<Move size={16} />}
                      onClick={() => setDialog(moveItemDialog('deck', selectedDeck.id))}
                    >Move</Button>
                    <Button
                      variant="ghost"
                      size="small"
                      icon={<Trash2 size={16} />}
                      onClick={() => setDialog(deleteDeckDialog(selectedDeck.id))}
                    >Delete</Button>
                  </>
                ) : (
                  <>
                    <CreatePlaceButtons
                      parentId={createParentId}
                      className="header-actions__narrow"
                      onDialog={setDialog}
                    />
                    {selectedFolder ? (
                      <>
                        <Button
                          variant="ghost"
                          size="small"
                          icon={<Pencil size={16} />}
                          onClick={() => setDialog(renameFolderDialog(selectedFolder))}
                        >Rename</Button>
                        <Button
                          variant="ghost"
                          size="small"
                          icon={<Move size={16} />}
                          onClick={() => setDialog(moveItemDialog('folder', selectedFolder.id))}
                        >Move</Button>
                        <Button
                          variant="ghost"
                          size="small"
                          icon={<Trash2 size={16} />}
                          onClick={() => setDialog(deleteFolderDialog(selectedFolder.id))}
                        >Delete</Button>
                      </>
                    ) : null}
                  </>
                )}
              </div>
            </details>
          </div>
        </header>
        <div className="workspace-scroll">
          <LibraryContent
            library={library}
            selection={activeSelection}
            filter={filter}
            onFilter={setFilter}
            onSelect={select}
            onDialog={setDialog}
          />
        </div>
        </div>
        {notice ? (
          <div className="notice" role="status">
            <span>{notice}</span>
            <button type="button" aria-label="Dismiss message" onClick={() => setNotice(null)}><X size={16} /></button>
          </div>
        ) : null}
      </section>

      <LibraryDialogs
        dialog={dialog}
        library={library}
        selection={activeSelection}
        onClose={closeDialog}
        onSelect={select}
        onNotice={setNotice}
      />
    </main>
  )
}

function initialExpanded(library: LibrarySnapshot): Set<string> {
  const expanded = new Set<string>()
  for (const folder of library.folders) {
    if (folder.parentId === null) expanded.add(folder.id)
  }
  for (const deck of library.decks) {
    for (const id of folderPath(library.folders, deck.folderId)) expanded.add(id)
  }
  return expanded
}
