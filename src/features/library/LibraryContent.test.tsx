/** @vitest-environment jsdom */

import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { EMPTY_STATS, type LibrarySnapshot } from '../../core/types'
import { LibraryContent } from './LibraryContent'
import type { ReorderRequest } from './reorder'

afterEach(() => {
  cleanup()
})

describe('LibraryContent reorder', () => {
  it('moves a deck up from its tile order menu', async () => {
    const user = userEvent.setup()
    const onReorder = vi.fn()
    render(
      <LibraryContent
        library={library}
        selection={null}
        filter="all"
        reordering={false}
        onFilter={vi.fn()}
        onSelect={vi.fn()}
        onDialog={vi.fn()}
        onReorder={onReorder}
      />,
    )

    const menus = screen.getAllByLabelText('Change order')
    expect(menus).toHaveLength(2)
    const secondMenu = menus[1]!.closest('details') as HTMLElement
    await user.click(menus[1]!)
    await user.click(within(secondMenu).getByRole('button', { name: 'Move up' }))

    const request: ReorderRequest = {
      kind: 'deck',
      parentId: null,
      orderedIds: ['20', '10'],
    }
    expect(onReorder).toHaveBeenCalledWith(request)
  })

  it('still opens a deck when its tile is clicked', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <LibraryContent
        library={library}
        selection={null}
        filter="all"
        reordering={false}
        onFilter={vi.fn()}
        onSelect={onSelect}
        onDialog={vi.fn()}
        onReorder={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: /Cells/ }))
    expect(onSelect).toHaveBeenCalledWith({ kind: 'deck', id: '10' })
  })
})

const library: LibrarySnapshot = {
  folders: [],
  decks: [
    { id: '10', folderId: null, name: 'Cells', position: 0 },
    { id: '20', folderId: null, name: 'Organs', position: 1 },
  ],
  cardsByDeck: {},
  statsByDeck: {
    '10': { ...EMPTY_STATS },
    '20': { ...EMPTY_STATS },
  },
  study: { due: 0, reviewedToday: 0, streak: 0 },
}
