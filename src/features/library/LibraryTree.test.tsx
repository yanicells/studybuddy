/** @vitest-environment jsdom */

import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { EMPTY_STATS, type LibrarySnapshot } from '../../core/types'
import { LibraryTree } from './LibraryTree'
import type { LibraryDialog } from './library.types'

afterEach(() => {
  cleanup()
})

describe('LibraryTree', () => {
  it('selects a folder without collapsing it', async () => {
    const user = userEvent.setup()
    const onToggleFolder = vi.fn()
    const onSelect = vi.fn()
    renderTree({ onToggleFolder, onSelect })

    await user.click(screen.getByRole('button', { name: 'Course' }))

    expect(onSelect).toHaveBeenCalledWith({ kind: 'folder', id: '1' })
    expect(onToggleFolder).not.toHaveBeenCalled()
  })

  it('expands and collapses only from the chevron', async () => {
    const user = userEvent.setup()
    const onToggleFolder = vi.fn()
    const onSelect = vi.fn()
    renderTree({ onToggleFolder, onSelect })

    await user.click(screen.getByRole('button', { name: 'Collapse Course' }))

    expect(onToggleFolder).toHaveBeenCalledWith('1')
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('opens rename from a folder row without selecting it', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const onDialog = vi.fn()
    renderTree({ onSelect, onDialog })

    const menu = screen.getByLabelText('More actions for Course').closest('details')
    await user.click(screen.getByLabelText('More actions for Course'))
    await user.click(within(menu as HTMLElement).getByRole('button', { name: 'Rename' }))

    expect(onSelect).not.toHaveBeenCalled()
    expect(onDialog).toHaveBeenCalledWith({
      kind: 'name',
      entity: 'folder',
      mode: 'rename',
      id: '1',
      parentId: null,
      initialName: 'Course',
    })
  })

  it('opens delete from a deck row without selecting it', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const onDialog = vi.fn()
    renderTree({ onSelect, onDialog })

    const menu = screen.getByLabelText('More actions for Cells').closest('details')
    await user.click(screen.getByLabelText('More actions for Cells'))
    await user.click(within(menu as HTMLElement).getByRole('button', { name: 'Delete' }))

    expect(onSelect).not.toHaveBeenCalled()
    expect(onDialog).toHaveBeenCalledWith({
      kind: 'confirm',
      entity: 'deck',
      id: '10',
      title: 'Delete deck?',
      description: 'Every card and review in this deck will be removed.',
    })
  })
})

function renderTree({
  onToggleFolder = vi.fn(),
  onSelect = vi.fn(),
  onDialog = vi.fn(),
}: {
  onToggleFolder?: (id: string) => void
  onSelect?: (selection: { kind: 'folder' | 'deck'; id: string } | null) => void
  onDialog?: (dialog: LibraryDialog) => void
} = {}) {
  render(
    <LibraryTree
      library={library}
      selection={{ kind: 'folder', id: '1' }}
      expanded={new Set(['1'])}
      onToggleFolder={onToggleFolder}
      onSelect={onSelect}
      onDialog={onDialog}
    />,
  )
}

const library: LibrarySnapshot = {
  folders: [{ id: '1', parentId: null, name: 'Course', position: 0 }],
  decks: [{ id: '10', folderId: '1', name: 'Cells', position: 0 }],
  cardsByDeck: {},
  statsByDeck: { '10': { ...EMPTY_STATS } },
  study: { due: 0, reviewedToday: 0, streak: 0 },
}
