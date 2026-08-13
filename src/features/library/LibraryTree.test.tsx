/** @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { EMPTY_STATS, type LibrarySnapshot } from '../../core/types'
import { LibraryTree } from './LibraryTree'

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

    expect(onSelect).toHaveBeenCalledWith({ kind: 'folder', id: 1 })
    expect(onToggleFolder).not.toHaveBeenCalled()
  })

  it('expands and collapses only from the chevron', async () => {
    const user = userEvent.setup()
    const onToggleFolder = vi.fn()
    const onSelect = vi.fn()
    renderTree({ onToggleFolder, onSelect })

    await user.click(screen.getByRole('button', { name: 'Collapse Course' }))

    expect(onToggleFolder).toHaveBeenCalledWith(1)
    expect(onSelect).not.toHaveBeenCalled()
  })
})

function renderTree({
  onToggleFolder,
  onSelect,
}: {
  onToggleFolder: (id: number) => void
  onSelect: (selection: { kind: 'folder' | 'deck'; id: number } | null) => void
}) {
  render(
    <LibraryTree
      library={library}
      selection={{ kind: 'folder', id: 1 }}
      expanded={new Set([1])}
      onToggleFolder={onToggleFolder}
      onSelect={onSelect}
    />,
  )
}

const library: LibrarySnapshot = {
  folders: [{ id: 1, parentId: null, name: 'Course', position: 0 }],
  decks: [{ id: 10, folderId: 1, name: 'Cells', position: 0 }],
  cardsByDeck: {},
  statsByDeck: { 10: { ...EMPTY_STATS } },
  study: { due: 0, reviewedToday: 0, streak: 0 },
}
