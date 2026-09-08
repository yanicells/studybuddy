/** @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { EMPTY_STATS, type LibrarySnapshot } from '../../core/types'
import type { StudySource } from '../../core/studyScope'
import { LibraryDialogs } from './LibraryDialogs'
import type { LibraryDialog } from './library.types'

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
    expect(onStartStudy).toHaveBeenCalledWith(
      ['10'],
      { kind: 'deck', id: '10' },
      'due',
    )
  })

  it('starts an all-card session', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const onStartStudy = vi.fn()
    renderDialog({ onClose, onStartStudy })
    await user.click(screen.getByRole('button', { name: /All cards/ }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onStartStudy).toHaveBeenCalledWith(
      ['10'],
      { kind: 'deck', id: '10' },
      'all',
    )
  })

  it('selects and clears every nested deck from a folder row', async () => {
    const user = userEvent.setup()
    const onStartStudy = vi.fn()
    renderDialog({
      dialog: { kind: 'study', source: { kind: 'folder', id: '1' } },
      library: nestedLibrary,
      onStartStudy,
    })

    expect(document.querySelector('.study-picker__summary')).toHaveTextContent('2 of 2 decks')
    const unit = screen.getByRole('checkbox', { name: /Unit 1/ })
    expect(unit).toHaveAttribute('aria-checked', 'true')
    await user.click(unit)
    expect(unit).toHaveAttribute('aria-checked', 'false')
    expect(document.querySelector('.study-picker__summary')).toHaveTextContent('1 of 2 decks')

    await user.click(screen.getByRole('button', { name: /All cards/ }))
    expect(onStartStudy).toHaveBeenCalledWith(
      ['10'],
      { kind: 'folder', id: '1' },
      'all',
    )
  })

  it('shows partial selection on a parent folder', async () => {
    const user = userEvent.setup()
    renderDialog({
      dialog: { kind: 'study', source: { kind: 'library' } },
      library: nestedLibrary,
    })

    const course = screen.getByRole('checkbox', { name: /Course/ })
    await user.click(screen.getByRole('checkbox', { name: /Cells/ }))
    expect(course).toHaveAttribute('aria-checked', 'mixed')
  })
})

function renderDialog({
  onClose = vi.fn(),
  onStartStudy = vi.fn(),
  dialog = { kind: 'study', source: { kind: 'deck', id: '10' } },
  library: nextLibrary = library,
}: {
  onClose?: () => void
  onStartStudy?: (deckIds: string[], source: StudySource, mode: 'due' | 'all') => void
  dialog?: LibraryDialog
  library?: LibrarySnapshot
} = {}) {
  return render(
    <LibraryDialogs
      dialog={dialog}
      library={nextLibrary}
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

const nestedLibrary: LibrarySnapshot = {
  folders: [
    { id: '1', parentId: null, name: 'Course', position: 0 },
    { id: '2', parentId: '1', name: 'Unit 1', position: 0 },
  ],
  decks: [
    { id: '10', folderId: '1', name: 'Cells', position: 0 },
    { id: '20', folderId: '2', name: 'Genetics', position: 0 },
  ],
  cardsByDeck: {},
  statsByDeck: {
    '10': { ...EMPTY_STATS, new: 3, due: 3 },
    '20': { ...EMPTY_STATS, new: 2, due: 2 },
  },
  study: { due: 5, reviewedToday: 0, streak: 0 },
}
