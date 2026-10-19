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
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Outlet,
  getRouteApi,
  useMatch,
  useNavigate,
  useParams,
  useRouter,
} from '@tanstack/react-router'

import { AppIcon } from '../../components/AppIcon'
import { Button } from '../../components/Button'
import { OverflowMenu } from '../../components/OverflowMenu'
import type { StudyMode } from '../../core/queue'
import { folderPath, rollupStats } from '../../core/stats'
import { studyDeckIds, type StudySource } from '../../core/studyScope'
import type { Folder, LibrarySnapshot } from '../../core/types'
import { readExpandedFolders, saveExpandedFolders } from './expandedFolders'
import { reorderDecksFn, reorderFoldersFn } from './library.functions'
import { selectionLocation, studySearch } from './library.navigation'
import { CreatePlaceButtons } from './LibraryContent'
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
} from './library.types'
import { applyReorder, type ReorderRequest } from './reorder'
import { WorkspaceContext, type Workspace } from './WorkspaceContext'

const libraryRoute = getRouteApi('/_library')

/**
 * Layout for every library route: the folder rail, header actions, dialogs, and notices.
 * The open folder or deck comes from the URL; the screen itself renders in the outlet.
 * Study sessions take over the whole screen.
 */
export function LibraryWorkspace() {
  const snapshot = libraryRoute.useLoaderData()
  const router = useRouter()
  const navigate = useNavigate()
  const params = useParams({ strict: false })
  const studying = useMatch({ from: '/_library/study', shouldThrow: false }) !== undefined
  const [pendingReorder, setPendingReorder] = useState<ReorderRequest | null>(null)
  const library = useMemo(
    () => (pendingReorder ? applyReorder(snapshot, pendingReorder) : snapshot),
    [pendingReorder, snapshot],
  )
  const [expanded, setExpanded] = useState(
    () => readExpandedFolders() ?? initialExpanded(snapshot),
  )
  const [dialog, setDialog] = useState<LibraryDialog>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [startingStudy, setStartingStudy] = useState(false)
  const reordering = pendingReorder !== null

  const selection: Selection = params.deckId
    ? { kind: 'deck', id: params.deckId }
    : params.folderId
      ? { kind: 'folder', id: params.folderId }
      : null
  const selectedFolder =
    selection?.kind === 'folder'
      ? library.folders.find((folder) => folder.id === selection.id)
      : undefined
  const selectedDeck =
    selection?.kind === 'deck'
      ? library.decks.find((deck) => deck.id === selection.id)
      : undefined
  const activeSelection = selectedFolder || selectedDeck ? selection : null

  // Reveal the open item in the rail whenever the URL points somewhere new.
  const openFolderId = selectedFolder?.id ?? selectedDeck?.folderId ?? null
  const [revealedFolderId, setRevealedFolderId] = useState<string | null>(null)
  if (revealedFolderId !== openFolderId) {
    setRevealedFolderId(openFolderId)
    setExpanded((current) => withFolderPath(current, library.folders, openFolderId))
  }

  // Remember which folders are open so the rail looks the same on the next visit.
  useEffect(() => {
    const folderIds = new Set(library.folders.map((folder) => folder.id))
    saveExpandedFolders([...expanded].filter((id) => folderIds.has(id)))
  }, [expanded, library.folders])

  useEffect(() => {
    if (!notice) return
    const timeout = window.setTimeout(() => setNotice(null), 6000)
    return () => window.clearTimeout(timeout)
  }, [notice])

  const select = useCallback(async (next: Selection) => {
    setDrawerOpen(false)
    await navigate(selectionLocation(next))
  }, [navigate])

  const closeDialog = useCallback(() => setDialog(null), [])
  const createParentId = selectedFolder?.id ?? null

  // Shows the new order immediately, then keeps it until the refreshed snapshot confirms it.
  const handleReorder = useCallback(async (request: ReorderRequest) => {
    setPendingReorder(request)
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
      await router.invalidate({ sync: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      setNotice(
        /changed|reload/i.test(message)
          ? message
          : 'The new order could not be saved. Reload and try again.',
      )
    } finally {
      setPendingReorder(null)
    }
  }, [router])

  const workspace = useMemo<Workspace>(() => ({
    library,
    reordering,
    select,
    openDialog: setDialog,
    reorder: (request) => void handleReorder(request),
    notify: setNotice,
  }), [handleReorder, library, reordering, select])

  async function beginStudy(deckIds: string[], source: StudySource, mode: StudyMode) {
    if (deckIds.length === 0) return
    setStartingStudy(true)
    try {
      await navigate({ to: '/study', search: studySearch(library, source, deckIds, mode) })
    } finally {
      setStartingStudy(false)
    }
  }

  const title = selectedFolder?.name ?? selectedDeck?.name ?? 'Library'
  const studySource: StudySource = selectedDeck
    ? { kind: 'deck', id: selectedDeck.id }
    : selectedFolder
      ? { kind: 'folder', id: selectedFolder.id }
      : { kind: 'library' }
  const scopedDeckIds = studyDeckIds(library, studySource)
  const due = rollupStats(library, scopedDeckIds).due
  const noticeBar = notice ? (
    <Notice message={notice} floating={studying} onDismiss={() => setNotice(null)} />
  ) : null

  if (studying) {
    return (
      <WorkspaceContext.Provider value={workspace}>
        <Outlet />
        {noticeBar}
      </WorkspaceContext.Provider>
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
            {scopedDeckIds.length > 0 ? (
              <Button
                variant="primary"
                size="small"
                icon={<Play size={16} fill="currentColor" />}
                disabled={startingStudy}
                onClick={() => setDialog(studyDialog(studySource))}
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
        <div className="workspace-scroll" data-scroll-restoration-id="workspace">
          <WorkspaceContext.Provider value={workspace}>
            <Outlet />
          </WorkspaceContext.Provider>
        </div>
        </div>
        {noticeBar}
      </section>

      <LibraryDialogs
        dialog={dialog}
        library={library}
        selection={activeSelection}
        onClose={closeDialog}
        onSelect={select}
        onNotice={setNotice}
        onStartStudy={(deckIds, source, mode) => void beginStudy(deckIds, source, mode)}
      />
    </main>
  )
}

/** Dismissible status message; floats over the study screen when a session is open. */
function Notice({
  message,
  floating,
  onDismiss,
}: Readonly<{ message: string; floating: boolean; onDismiss: () => void }>) {
  return (
    <div className={`notice${floating ? ' notice--floating' : ''}`} role="status">
      <span>{message}</span>
      <button type="button" aria-label="Dismiss message" onClick={onDismiss}><X size={16} /></button>
    </div>
  )
}

function withFolderPath(expanded: Set<string>, folders: Folder[], folderId: string | null): Set<string> {
  const path = folderPath(folders, folderId)
  if (path.every((id) => expanded.has(id))) return expanded
  return new Set([...expanded, ...path])
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
