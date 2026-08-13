/** @vitest-environment jsdom */

import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Card } from '../../core/types'
import { recordAnswerFn } from '../library/library.functions'
import { StudySession } from './StudySession'

vi.mock('../library/library.functions', () => ({
  recordAnswerFn: vi.fn(),
}))

afterEach(() => {
  cleanup()
  vi.mocked(recordAnswerFn).mockReset()
})

describe('StudySession', () => {
  it('shows feedback immediately without waiting for the answer to save', async () => {
    const user = userEvent.setup()
    const deferred = defer<Card>()
    vi.mocked(recordAnswerFn).mockReturnValue(deferred.promise)

    renderSession()

    await user.click(firstChoice())

    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument()
    expect(screen.queryByText('Saving answer…')).not.toBeInTheDocument()
    expect(screen.getByText(/Correct|Not quite/)).toBeInTheDocument()
    expect(recordAnswerFn).toHaveBeenCalledTimes(1)

    deferred.resolve(dueCards[0]!)
    await deferred.promise
  })

  it('lets the next card be answered while a previous save is still in flight', async () => {
    const user = userEvent.setup()
    const first = defer<Card>()
    vi.mocked(recordAnswerFn).mockReturnValueOnce(first.promise)
    vi.mocked(recordAnswerFn).mockResolvedValueOnce(dueCards[1]!)

    renderSession()

    await user.click(firstChoice())
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await user.click(firstChoice())

    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument()
    expect(recordAnswerFn).toHaveBeenCalledTimes(2)

    first.resolve(dueCards[0]!)
    await first.promise
  })
})

function firstChoice() {
  return within(screen.getByLabelText('Answer choices')).getAllByRole('button')[0]!
}

function renderSession() {
  render(
    <StudySession
      deckName="Anatomy"
      dueCards={dueCards}
      deckCards={dueCards}
      onLeave={() => undefined}
      onNotice={() => undefined}
    />,
  )
}

function defer<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((next) => {
    resolve = next
  })
  return { promise, resolve }
}

const dueCards: Card[] = [
  {
    id: 1,
    deckId: 1,
    front: 'The mitochondria is the powerhouse of the cell',
    back: 'mitochondria',
    highlights: [{ side: 'front', text: 'mitochondria' }],
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
  {
    id: 2,
    deckId: 1,
    front: 'The control center of the cell',
    back: 'nucleus',
    highlights: [{ side: 'back', text: 'nucleus' }],
    position: 1,
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
  {
    id: 3,
    deckId: 1,
    front: 'The watery interior of the cell',
    back: 'cytoplasm',
    highlights: [{ side: 'back', text: 'cytoplasm' }],
    position: 2,
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
  {
    id: 4,
    deckId: 1,
    front: 'The outer boundary of the cell',
    back: 'membrane',
    highlights: [{ side: 'back', text: 'membrane' }],
    position: 3,
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
]
