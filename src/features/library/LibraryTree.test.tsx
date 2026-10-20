/** @vitest-environment jsdom */

import { cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { EMPTY_STATS, type LibrarySnapshot } from '../../core/types'
import { renderWithRouter } from '../../test/renderWithRouter'
import { LibraryTree } from './LibraryTree'
import type { LibraryDialog } from './library.types'

afterEach(() => {
  cleanup()
})

describe('LibraryTree', () => {
  it('links folders and decks to their screens and marks the open one', async () => {
    await renderTree()

    const folder = screen.getByRole('link', { name: 'Course' })
    expect(folder).toHaveAttribute('href', '/folders/1')
    expect(folder).toHaveAttribute('aria-current', 'page')
    const deck = screen.getByRole('link', { name: 'Cells' })
    expect(deck).toHaveAttribute('href', '/decks/10')
    expect(deck).not.toHaveAttribute('aria-current')
  })

  it('opens a deck without collapsing its folder', async () => {
    const user = userEvent.setup()
    const onToggleFolder = vi.fn()
    const onNavigate = vi.fn()
    const router = await renderTree({ onToggleFolder, onNavigate })

    await user.click(screen.getByRole('link', { name: 'Cells' }))

    expect(onNavigate).toHaveBeenCalled()
    expect(onToggleFolder).not.toHaveBeenCalled()
    expect(router.state.location.pathname).toBe('/decks/10')
  })

  it('expands and collapses only from the chevron', async () => {
    const user = userEvent.setup()
    const onToggleFolder = vi.fn()
    const onNavigate = vi.fn()
    const router = await renderTree({ onToggleFolder, onNavigate })

    await user.click(screen.getByRole('button', { name: 'Collapse Course' }))

    expect(onToggleFolder).toHaveBeenCalledWith('1')
    expect(onNavigate).not.toHaveBeenCalled()
    expect(router.state.location.pathname).toBe('/folders/1')
  })

  it('opens rename from a folder row without selecting it', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    const onDialog = vi.fn()
    await renderTree({ onNavigate, onDialog })

    const menu = screen.getByLabelText('More actions for Course').closest('details')
    await user.click(screen.getByLabelText('More actions for Course'))
    await user.click(within(menu as HTMLElement).getByRole('button', { name: 'Rename' }))

    expect(onNavigate).not.toHaveBeenCalled()
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
    const onNavigate = vi.fn()
    const onDialog = vi.fn()
    await renderTree({ onNavigate, onDialog })

    const menu = screen.getByLabelText('More actions for Cells').closest('details')
    await user.click(screen.getByLabelText('More actions for Cells'))
    await user.click(within(menu as HTMLElement).getByRole('button', { name: 'Delete' }))

    expect(onNavigate).not.toHaveBeenCalled()
    expect(onDialog).toHaveBeenCalledWith({
      kind: 'confirm',
      entity: 'deck',
      id: '10',
      title: 'Delete deck?',
      description: 'Every card and review in this deck will be removed.',
    })
  })

  it('dismisses an open row menu on outside click', async () => {
    const user = userEvent.setup()
    await renderTree()

    const menu = screen.getByLabelText('More actions for Course').closest('details')
    await user.click(screen.getByLabelText('More actions for Course'))
    expect(menu).toHaveAttribute('open')

    await user.click(screen.getByRole('link', { name: 'Course' }))
    expect(menu).not.toHaveAttribute('open')
  })

  it('moves a folder down within its siblings', async () => {
    const user = userEvent.setup()
    const onReorder = vi.fn()
    await renderTree({
      onReorder,
      library: {
        ...library,
        folders: [
          { id: '1', parentId: null, name: 'Course', position: 0 },
          { id: '2', parentId: null, name: 'Extra', position: 1 },
        ],
      },
    })

    const menu = screen.getByLabelText('More actions for Course').closest('details')
    await user.click(screen.getByLabelText('More actions for Course'))
    await user.click(within(menu as HTMLElement).getByRole('button', { name: 'Move down' }))

    expect(onReorder).toHaveBeenCalledWith({
      kind: 'folder',
      parentId: null,
      orderedIds: ['2', '1'],
    })
  })
})

function renderTree({
  onToggleFolder = vi.fn(),
  onNavigate = vi.fn(),
  onDialog = vi.fn(),
  onReorder = vi.fn(),
  library: nextLibrary = library,
}: {
  onToggleFolder?: (id: string) => void
  onNavigate?: () => void
  onDialog?: (dialog: LibraryDialog) => void
  onReorder?: (request: { kind: 'folder' | 'deck'; parentId: string | null; orderedIds: string[] }) => void
  library?: LibrarySnapshot
} = {}) {
  return renderWithRouter(
    <LibraryTree
      library={nextLibrary}
      selection={{ kind: 'folder', id: '1' }}
      expanded={new Set(['1'])}
      reordering={false}
      onToggleFolder={onToggleFolder}
      onNavigate={onNavigate}
      onDialog={onDialog}
      onReorder={onReorder}
    />,
    '/folders/1',
  )
}

const library: LibrarySnapshot = {
  folders: [{ id: '1', parentId: null, name: 'Course', position: 0 }],
  decks: [{ id: '10', folderId: '1', name: 'Cells', position: 0 }],
  cardsByDeck: {},
  statsByDeck: { '10': { ...EMPTY_STATS } },
  study: { due: 0, reviewedToday: 0, streak: 0 },
}
