/** @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { LibraryPending, StudyPending } from './PendingScreens'

afterEach(() => {
  cleanup()
})

describe('PendingScreens', () => {
  it('announces library loading', () => {
    render(<LibraryPending />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading library')
  })

  it('announces study loading with the deck name', () => {
    render(<StudyPending name="Structure and Function" />)
    expect(screen.getByRole('status')).toHaveTextContent('Starting study for Structure and Function')
  })
})
