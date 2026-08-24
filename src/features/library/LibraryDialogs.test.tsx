/** @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { EMPTY_STATS, type LibrarySnapshot } from '../../core/types'
import { LibraryDialogs } from './LibraryDialogs'

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ invalidate: vi.fn() }),
}))

afterEach(() => {
  cleanup()
})

describe('LibraryDialogs study choices', () => {
  it('shows due and all-card counts', () => {
    renderDialog()
    expect(screen.getByRole('button', { name: /Due only/ })).toHaveTextContent('4 due')
    expect(screen.getByRole('button', { name: /All cards/ })).toHaveTextContent('12 cards')
  })

  it('starts a due-only session', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const onStartStudy = vi.fn()
    renderDialog({ onClose, onStartStudy })
    await user.click(screen.getByRole('button', { name: /Due only/ }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onStartStudy).toHaveBeenCalledWith('10', 'due')
  })

  it('starts an all-card session', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const onStartStudy = vi.fn()
    renderDialog({ onClose, onStartStudy })
    await user.click(screen.getByRole('button', { name: /All cards/ }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onStartStudy).toHaveBeenCalledWith('10', 'all')
  })
})

function renderDialog({
  onClose = vi.fn(),
  onStartStudy = vi.fn(),
}: {
  onClose?: () => void
  onStartStudy?: (deckId: string, mode: 'due' | 'all') => void
} = {}) {
  return render(
    <LibraryDialogs
      dialog={{ kind: 'study', deckId: '10' }}
      library={library}
      selection={{ kind: 'deck', id: '10' }}
      onClose={onClose}
      onSelect={vi.fn()}
      onNotice={vi.fn()}
      onStartStudy={onStartStudy}
    />,
  )
}

const library: LibrarySnapshot = {
  folders: [],
  decks: [{ id: '10', folderId: null, name: 'Cells', position: 0 }],
  cardsByDeck: {},
  statsByDeck: { '10': { ...EMPTY_STATS, new: 3, learning: 1, mastered: 8, due: 4 } },
  study: { due: 4, reviewedToday: 0, streak: 0 },
}
