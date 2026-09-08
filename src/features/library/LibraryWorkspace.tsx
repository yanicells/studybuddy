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
import { OverflowMenu } from '../../components/OverflowMenu'
import type { StudyMode } from '../../core/queue'
import { folderPath, highestDueDeck } from '../../core/stats'
import type { LibrarySnapshot } from '../../core/types'
import { StudySession } from '../study/StudySession'
import { reorderDecksFn, reorderFoldersFn, startStudyFn } from './library.functions'
import { LibraryContent, CreatePlaceButtons } from './LibraryContent'
import { LibraryDialogs } from './LibraryDialogs'
import { LibraryTree } from './LibraryTree'
import {
  deleteDeckDialog,
  deleteFolderDialog,
  moveItemDialog,
  renameDeckDialog,
  renameFolderDialog,
  studyDialog,
  type LibraryDialog,
  type Selection,
  type StatusFilter,
} from './library.types'
import type { ReorderRequest } from './reorder'

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
  const [reordering, setReordering] = useState(false)
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

  const handleReorder = useCallback(async (request: ReorderRequest) => {
    setReordering(true)
    try {
      if (request.kind === 'folder') {
        await reorderFoldersFn({
          data: { parentId: request.parentId, orderedIds: request.orderedIds },
        })
      } else {
        await reorderDecksFn({
          data: { parentId: request.parentId, orderedIds: request.orderedIds },
        })
      }
      await router.invalidate()
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      setNotice(
        /changed|reload/i.test(message) && message.length > 0
          ? message
          : 'The new order could not be saved. Run `npx convex deploy` so the reorder functions exist, reload, and try again.',
      )
    } finally {
      setReordering(false)
    }
  }, [router])

  async function beginStudy(deckIds: string[], mode: StudyMode) {
    const target = library.decks.find((deck) => deck.id === deckIds[0])
    if (!target) return
    setStartingStudy(true)
    try {
      const payload = await startStudyFn({ data: { deckIds, mode } })
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

  const title = selectedFolder?.name ?? selectedDeck?.name ?? 'Library'
  const studyDeck = selectedDeck ?? (activeSelection === null ? highestDueDeck(library) : undefined)
  const due = studyDeck ? (library.statsByDeck[studyDeck.id]?.due ?? 0) : 0

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
          reordering={reordering}
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
          onReorder={(request) => void handleReorder(request)}
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
                onClick={() => setDialog(studyDialog(studyDeck.id))}
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
            <OverflowMenu
              label="More actions"
              icon={<Ellipsis size={18} />}
              className={`actions-menu${selectedFolder || selectedDeck ? '' : ' actions-menu--mobile-only'}`}
            >
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
            </OverflowMenu>
          </div>
        </header>
        <div className="workspace-scroll">
          <LibraryContent
            library={library}
            selection={activeSelection}
            filter={filter}
            reordering={reordering}
            onFilter={setFilter}
            onSelect={select}
            onDialog={setDialog}
            onReorder={(request) => void handleReorder(request)}
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
        onStartStudy={(deckId, mode) => void beginStudy([deckId], mode)}
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
