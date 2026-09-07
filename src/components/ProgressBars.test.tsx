/** @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { StackedProgress } from './ProgressBars'

afterEach(() => {
  cleanup()
})

describe('StackedProgress', () => {
  it('starts full blue when everything is due', () => {
    render(<StackedProgress stats={{ new: 3, learning: 0, mastered: 0, due: 3 }} />)
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-label', '3 of 3 cards due, 0 mastered')
    expect(bar.firstElementChild).toHaveStyle({ width: '100%' })
  })

  it('shrinks the blue fill as cards are mastered', () => {
    render(<StackedProgress stats={{ new: 1, learning: 1, mastered: 8, due: 2 }} />)
    const bar = screen.getByRole('progressbar')
    expect(bar.firstElementChild).toHaveStyle({ width: '20%' })
  })

  it('renders an empty track when there is nothing due', () => {
    render(<StackedProgress stats={{ new: 0, learning: 0, mastered: 5, due: 0 }} />)
    expect(screen.getByRole('progressbar').firstElementChild).toHaveStyle({ width: '0%' })
  })
})
