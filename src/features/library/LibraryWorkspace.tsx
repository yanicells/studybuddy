import {
  Ellipsis,
  FolderPlus,
  Import,
  Layers3,
  Menu,
  Pencil,
  Play,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from '@tanstack/react-router'

import { AppIcon } from '../../components/AppIcon'
import { Button } from '../../components/Button'
import type { LibrarySnapshot } from '../../core/types'
import { StudySession } from '../study/StudySession'
import { startStudyFn } from './library.functions'
import { LibraryContent } from './LibraryContent'
import { LibraryDialogs } from './LibraryDialogs'
import { LibraryTree } from './LibraryTree'
import type { LibraryDialog, Selection, StatusFilter } from './library.types'

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
    setDrawerOpen(false)
  }, [])

  const closeDialog = useCallback(() => setDialog(null), [])
  const currentFolderId = useMemo(() => {
    if (activeSelection?.kind === 'folder') return activeSelection.id
    if (activeSelection?.kind === 'deck') return selectedDeck?.folderId ?? null
    return null
  }, [activeSelection, selectedDeck?.folderId])

  async function beginStudy() {
    if (!selectedDeck) return
    setStartingStudy(true)
    try {
      const payload = await startStudyFn({ data: { deckId: selectedDeck.id } })
      if (payload.dueCards.length === 0) {
        setNotice('Nothing is due in this deck yet.')
        return
      }
      setStudy({ deckName: selectedDeck.name, ...payload })
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
  const due = selectedDeck ? (library.statsByDeck[selectedDeck.id]?.due ?? 0) : 0

  const actions = (
    <>
      {selectedFolder ? (
        <>
          <Button
            variant="ghost"
            size="small"
            icon={<Pencil size={16} />}
            onClick={() =>
              setDialog({
                kind: 'name',
                entity: 'folder',
                mode: 'rename',
                id: selectedFolder.id,
                parentId: selectedFolder.parentId,
                initialName: selectedFolder.name,
              })
            }
          >Rename</Button>
          <Button variant="ghost" size="small" onClick={() => setDialog({ kind: 'move', entity: 'folder', id: selectedFolder.id })}>Move</Button>
          <Button
            variant="ghost"
            size="small"
            icon={<Trash2 size={16} />}
            onClick={() =>
              setDialog({
                kind: 'confirm',
                entity: 'folder',
                id: selectedFolder.id,
                title: 'Delete folder?',
                description: 'Every folder, deck, card, and review inside will be removed.',
              })
            }
          >Delete</Button>
        </>
      ) : null}
      {selectedDeck ? (
        <>
          <Button
            variant="primary"
            size="small"
            icon={<Play size={16} fill="currentColor" />}
            disabled={startingStudy}
            onClick={() => void beginStudy()}
          >
            {startingStudy ? 'Starting…' : due > 0 ? `Study ${due}` : 'Study'}
          </Button>
          <Button
            size="small"
            icon={<Import size={16} />}
            onClick={() => setDialog({ kind: 'import', deckId: selectedDeck.id, folderId: selectedDeck.folderId })}
          >Import</Button>
          <Button
            variant="ghost"
            size="small"
            icon={<Plus size={16} />}
            onClick={() => setDialog({ kind: 'card', deckId: selectedDeck.id, card: null })}
          >Card</Button>
          <Button
            variant="ghost"
            size="small"
            onClick={() =>
              setDialog({
                kind: 'name',
                entity: 'deck',
                mode: 'rename',
                id: selectedDeck.id,
                parentId: selectedDeck.folderId,
                initialName: selectedDeck.name,
              })
            }
          >Rename</Button>
          <Button variant="ghost" size="small" onClick={() => setDialog({ kind: 'move', entity: 'deck', id: selectedDeck.id })}>Move</Button>
          <Button
            variant="ghost"
            size="small"
            icon={<Trash2 size={16} />}
            onClick={() =>
              setDialog({
                kind: 'confirm',
                entity: 'deck',
                id: selectedDeck.id,
                title: 'Delete deck?',
                description: 'Every card and review in this deck will be removed.',
              })
            }
          >Delete</Button>
        </>
      ) : null}
    </>
  )

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
          <AppIcon />
          <div><strong>Studybuddy</strong><span>Short sessions, clear recall</span></div>
          <Button className="rail-close" variant="ghost" size="small" aria-label="Close library" onClick={() => setDrawerOpen(false)}>
            <X size={18} />
          </Button>
        </div>
        <div className="rail-create">
          <Button
            variant="ghost"
            size="small"
            icon={<FolderPlus size={16} />}
            onClick={() =>
              setDialog({
                kind: 'name',
                entity: 'folder',
                mode: 'create',
                id: null,
                parentId: currentFolderId,
                initialName: '',
              })
            }
          >Folder</Button>
          <Button
            variant="ghost"
            size="small"
            icon={<Layers3 size={16} />}
            onClick={() =>
              setDialog({
                kind: 'name',
                entity: 'deck',
                mode: 'create',
                id: null,
                parentId: currentFolderId,
                initialName: '',
              })
            }
          >Deck</Button>
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
        />
        <div className="rail-footnote"><span>Local-first</span><span>SQLite</span></div>
      </aside>

      <section className="workspace">
        <div className="mobile-bar">
          <Button variant="ghost" size="small" aria-label="Open library" onClick={() => setDrawerOpen(true)}><Menu size={20} /></Button>
          <AppIcon size="small" />
          <strong>Studybuddy</strong>
        </div>
        <header className="workspace-header">
          <div className="workspace-title">
            <span className="eyebrow">{selectedDeck ? 'Deck' : selectedFolder ? 'Folder' : 'Workspace'}</span>
            <h1>{title}</h1>
          </div>
          <div className="header-actions">{actions}</div>
          {(selectedDeck || selectedFolder) ? (
            <details className="mobile-actions-menu">
              <summary aria-label="Open actions"><Ellipsis size={20} /></summary>
              <div>{actions}</div>
            </details>
          ) : null}
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

function initialExpanded(library: LibrarySnapshot): Set<number> {
  const expanded = new Set<number>()
  const parents = new Map(library.folders.map((folder) => [folder.id, folder.parentId]))
  for (const folder of library.folders) {
    if (folder.parentId === null) expanded.add(folder.id)
  }
  for (const deck of library.decks) {
    let parent = deck.folderId
    while (parent !== null) {
      expanded.add(parent)
      parent = parents.get(parent) ?? null
    }
  }
  return expanded
}
