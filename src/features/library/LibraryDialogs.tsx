import { FileText, Folder, Layers3, Upload } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { useRouter } from '@tanstack/react-router'

import { Button } from '../../components/Button'
import { Dialog } from '../../components/Dialog'
import { withBulletPrefix } from '../../core/blocks'
import { wrapMarks } from '../../core/import'
import type { LibrarySnapshot } from '../../core/types'
import {
  createDeckFn,
  createFolderFn,
  deleteCardFn,
  deleteDeckFn,
  deleteFolderFn,
  importCardsFn,
  moveDeckFn,
  moveFolderFn,
  renameDeckFn,
  renameFolderFn,
  saveCardFn,
} from './library.functions'
import type { LibraryDialog, Selection } from './library.types'

interface LibraryDialogsProps {
  dialog: LibraryDialog
  library: LibrarySnapshot
  selection: Selection
  onClose: () => void
  onSelect: (selection: Selection) => void
  onNotice: (message: string) => void
}

export function LibraryDialogs({
  dialog,
  ...props
}: LibraryDialogsProps) {
  if (dialog === null) return null
  return <LibraryDialogContent key={dialogKey(dialog)} dialog={dialog} {...props} />
}

interface LibraryDialogContentProps extends Omit<LibraryDialogsProps, 'dialog'> {
  dialog: NonNullable<LibraryDialog>
}

function LibraryDialogContent({
  dialog,
  library,
  selection,
  onClose,
  onSelect,
  onNotice,
}: LibraryDialogContentProps) {
  const router = useRouter()
  const [name, setName] = useState(() =>
    dialog.kind === 'name' ? dialog.initialName : '',
  )
  const [front, setFront] = useState(() =>
    dialog.kind === 'card' && dialog.card
      ? wrapMarks(
          dialog.card.front,
          dialog.card.highlights
            .filter((highlight) => highlight.side === 'front')
            .map((highlight) => highlight.text),
        )
      : '',
  )
  const [back, setBack] = useState(() =>
    dialog.kind === 'card' && dialog.card
      ? withBulletPrefix(
          wrapMarks(
            dialog.card.back,
            dialog.card.highlights
              .filter((highlight) => highlight.side === 'back')
              .map((highlight) => highlight.text),
          ),
        )
      : '',
  )
  const [importText, setImportText] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const blockedFolders = useMemo(() => {
    if (dialog?.kind !== 'move' || dialog.entity !== 'folder') return new Set<number>()
    const blocked = new Set([dialog.id])
    let changed = true
    while (changed) {
      changed = false
      for (const folder of library.folders) {
        if (folder.parentId !== null && blocked.has(folder.parentId) && !blocked.has(folder.id)) {
          blocked.add(folder.id)
          changed = true
        }
      }
    }
    return blocked
  }, [dialog, library.folders])

  async function commit(work: () => Promise<unknown>, success?: () => void) {
    setPending(true)
    setError(null)
    try {
      await work()
      await router.invalidate()
      success?.()
      onClose()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The change could not be saved.')
    } finally {
      setPending(false)
    }
  }

  async function submitName(event: FormEvent) {
    event.preventDefault()
    if (dialog?.kind !== 'name') return
    await commit(async () => {
      if (dialog.entity === 'folder') {
        if (dialog.mode === 'create') {
          const result = await createFolderFn({
            data: { id: null, parentId: dialog.parentId, name },
          })
          onSelect({ kind: 'folder', id: result.id })
        } else {
          await renameFolderFn({ data: { id: dialog.id, parentId: null, name } })
        }
      } else if (dialog.mode === 'create') {
        const result = await createDeckFn({
          data: { id: null, parentId: dialog.parentId, name },
        })
        onSelect({ kind: 'deck', id: result.id })
      } else {
        await renameDeckFn({ data: { id: dialog.id, parentId: null, name } })
      }
    })
  }

  async function submitCard(event: FormEvent) {
    event.preventDefault()
    if (dialog?.kind !== 'card') return
    await commit(async () => {
      await saveCardFn({
        data: {
          id: dialog.card?.id ?? null,
          deckId: dialog.deckId,
          front,
          back,
        },
      })
    })
  }

  async function submitImport(event: FormEvent) {
    event.preventDefault()
    if (dialog?.kind !== 'import') return
    await commit(async () => {
      const result = await importCardsFn({
        data: {
          deckId: dialog.deckId,
          folderId: dialog.folderId,
          text: importText,
        },
      })
      onSelect({ kind: 'deck', id: result.deckId })
      onNotice(result.notice ?? `Imported ${result.count} ${result.count === 1 ? 'card' : 'cards'}.`)
    })
  }

  async function confirmDelete() {
    if (dialog?.kind !== 'confirm') return
    await commit(async () => {
      if (dialog.entity === 'folder') await deleteFolderFn({ data: { id: dialog.id } })
      if (dialog.entity === 'deck') await deleteDeckFn({ data: { id: dialog.id } })
      if (dialog.entity === 'card') await deleteCardFn({ data: { id: dialog.id } })
      if (
        (dialog.entity === 'folder' && selection?.kind === 'folder' && selection.id === dialog.id) ||
        (dialog.entity === 'deck' && selection?.kind === 'deck' && selection.id === dialog.id)
      ) {
        onSelect(null)
      }
    })
  }

  async function moveTo(parentId: number | null) {
    if (dialog?.kind !== 'move') return
    await commit(async () => {
      if (dialog.entity === 'folder') {
        await moveFolderFn({ data: { id: dialog.id, parentId } })
      } else {
        await moveDeckFn({ data: { id: dialog.id, parentId } })
      }
    })
  }

  if (dialog.kind === 'name') {
    const title = `${dialog.mode === 'create' ? 'New' : 'Rename'} ${dialog.entity}`
    return (
      <Dialog title={title} onClose={onClose}>
        <form className="dialog-form" onSubmit={submitName}>
          <label>
            <span>Name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} required />
          </label>
          <DialogError error={error} />
          <DialogActions pending={pending} onClose={onClose} action="Save" />
        </form>
      </Dialog>
    )
  }

  if (dialog.kind === 'confirm') {
    return (
      <Dialog title={dialog.title} description={dialog.description} onClose={onClose}>
        <DialogError error={error} />
        <div className="dialog-actions">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="danger" disabled={pending} onClick={confirmDelete}>
            {pending ? 'Deleting…' : 'Delete'}
          </Button>
        </div>
      </Dialog>
    )
  }

  if (dialog.kind === 'move') {
    return (
      <Dialog title="Move to" description="Choose a destination folder or the top-level library." onClose={onClose}>
        <div className="move-list">
          <button type="button" onClick={() => moveTo(null)} disabled={pending}>
            <span><Layers3 size={17} /> Library</span>
          </button>
          {library.folders
            .filter((folder) => !blockedFolders.has(folder.id))
            .map((folder) => (
              <button type="button" key={folder.id} onClick={() => moveTo(folder.id)} disabled={pending}>
                <span><Folder size={17} /> {folder.name}</span>
              </button>
            ))}
        </div>
        <DialogError error={error} />
      </Dialog>
    )
  }

  if (dialog.kind === 'import') {
    return (
      <Dialog
        title="Import cards"
        description="Put the prompt first, then start answer lines with a dash. Bold quiz terms with **asterisks**. Dashes stay bullets."
        onClose={onClose}
        wide
      >
        <form className="dialog-form" onSubmit={submitImport}>
          <label className="import-area">
            <span>Cards</span>
            <textarea
              rows={12}
              value={importText}
              onChange={(event) => setImportText(event.target.value)}
              placeholder={'The **mitochondria** is the powerhouse of the cell\n- mitochondria'}
              required
            />
          </label>
          <div className="file-picker">
            <FileText size={17} />
            <label>
              <span>Choose a .txt or .md file</span>
              <input
                type="file"
                accept=".txt,.md,text/plain,text/markdown"
                onChange={async (event) => {
                  const file = event.target.files?.[0]
                  if (file) setImportText(await file.text())
                }}
              />
            </label>
          </div>
          <DialogError error={error} />
          <DialogActions pending={pending} onClose={onClose} action="Import" icon={<Upload size={17} />} />
        </form>
      </Dialog>
    )
  }

  return (
    <Dialog title={dialog.card ? 'Edit card' : 'New card'} onClose={onClose} wide>
      <form className="dialog-form" onSubmit={submitCard}>
        <label>
          <span>Front</span>
          <textarea rows={5} value={front} onChange={(event) => setFront(event.target.value)} required />
        </label>
        <label>
          <span>Back <small>- bullet · **bold**</small></span>
          <textarea rows={5} value={back} onChange={(event) => setBack(event.target.value)} />
        </label>
        <DialogError error={error} />
        <DialogActions pending={pending} onClose={onClose} action="Save card" />
      </form>
    </Dialog>
  )
}

function DialogActions({
  pending,
  onClose,
  action,
  icon,
}: Readonly<{ pending: boolean; onClose: () => void; action: string; icon?: React.ReactNode }>) {
  return (
    <div className="dialog-actions">
      <Button onClick={onClose}>Cancel</Button>
      <Button type="submit" variant="primary" disabled={pending} icon={icon}>
        {pending ? `${action}…` : action}
      </Button>
    </div>
  )
}

function DialogError({ error }: Readonly<{ error: string | null }>) {
  return error ? <p className="dialog-error" role="alert">{error}</p> : null
}

function dialogKey(dialog: NonNullable<LibraryDialog>): string {
  if (dialog.kind === 'name') return `${dialog.kind}-${dialog.entity}-${dialog.mode}-${dialog.id}`
  if (dialog.kind === 'confirm' || dialog.kind === 'move') {
    return `${dialog.kind}-${dialog.entity}-${dialog.id}`
  }
  if (dialog.kind === 'card') return `${dialog.kind}-${dialog.card?.id ?? 'new'}`
  return `${dialog.kind}-${dialog.deckId ?? 'new'}`
}
