/** @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { EMPTY_STATS, type LibrarySnapshot } from '../../core/types'
import { QuickSearch } from './QuickSearch'

afterEach(() => {
  cleanup()
})

const library: LibrarySnapshot = {
  folders: [{ id: 'f1', parentId: null, name: 'Biology', position: 0 }],
  decks: [{ id: 'd1', folderId: 'f1', name: 'Cells', position: 0 }],
  cardsByDeck: {
    d1: [
      {
        id: 'c1',
        deckId: 'd1',
        front: 'What is biology?',
        back: 'The study of life',
        highlights: [],
        position: 0,
        status: 'new',
        ease: 2.5,
        intervalDays: 0,
        dueAt: null,
        reps: 0,
        lapses: 0,
        streak: 0,
        learningStep: 0,
        lastReviewedAt: null,
      },
    ],
  },
  statsByDeck: { d1: EMPTY_STATS },
  study: { due: 0, reviewedToday: 0, streak: 0 },
}

describe('QuickSearch', () => {
  it('moves through results with the arrow keys and opens the active one with Enter', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const onSelect = vi.fn()
    render(<QuickSearch library={library} onClose={onClose} onSelect={onSelect} />)

    const input = screen.getByRole('combobox', { name: /search/i })
    expect(input).toHaveFocus()
    await user.type(input, 'bio')

    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(2)
    expect(options[0]).toHaveAttribute('aria-selected', 'true')
    expect(options[1]).toHaveTextContent('Card · Cells')

    await user.keyboard('{ArrowDown}')
    expect(input).toHaveAttribute('aria-activedescendant', options[1]!.id)
    await user.keyboard('{Enter}')

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith({ kind: 'deck', id: 'd1' })
  })
})
