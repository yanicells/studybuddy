import { describe, expect, it } from 'vitest'

import {
  descendantDeckIds,
  folderPath,
  highestDueDeck,
  reviewedToday,
  rollupStats,
  studyStreak,
  sumStats,
} from './stats'
import { EMPTY_STATS, type LibrarySnapshot } from './types'

const NOW = new Date(2026, 7, 13, 15)

function iso(year: number, month: number, day: number, hour = 9): string {
  return new Date(year, month, day, hour).toISOString()
}

describe('study stats', () => {
  it('counts reviews from the current local day', () => {
    expect(
      reviewedToday(
        [iso(2026, 7, 13, 8), iso(2026, 7, 13, 21), iso(2026, 7, 12, 23)],
        NOW,
      ),
    ).toBe(2)
  })

  it('keeps a streak if today is not done yet', () => {
    expect(studyStreak([iso(2026, 7, 12), iso(2026, 7, 11)], NOW)).toBe(2)
  })

  it('counts consecutive days including today', () => {
    expect(
      studyStreak([iso(2026, 7, 13), iso(2026, 7, 12), iso(2026, 7, 10)], NOW),
    ).toBe(2)
  })

  it('rolls folder stats through nested decks', () => {
    const library: LibrarySnapshot = {
      folders: [
        { id: 1, parentId: null, name: 'Course', position: 0 },
        { id: 2, parentId: 1, name: 'Week', position: 0 },
      ],
      decks: [
        { id: 10, folderId: 2, name: 'A', position: 0 },
        { id: 11, folderId: null, name: 'Loose', position: 0 },
      ],
      cardsByDeck: {},
      statsByDeck: {
        10: { new: 2, learning: 1, mastered: 3, due: 4 },
        11: { new: 9, learning: 0, mastered: 0, due: 9 },
      },
      study: { due: 13, reviewedToday: 0, streak: 0 },
    }
    expect(descendantDeckIds(library, 1)).toEqual([10])
    expect(folderPath(library.folders, 2)).toEqual([2, 1])
    expect(folderPath(library.folders, 1)).toEqual([1])
    expect(folderPath(library.folders, null)).toEqual([])
    expect(rollupStats(library, descendantDeckIds(library, 1))).toEqual({
      new: 2,
      learning: 1,
      mastered: 3,
      due: 4,
    })
    expect(highestDueDeck(library)?.name).toBe('Loose')
    expect(sumStats(library.statsByDeck).due).toBe(13)
    expect(sumStats({})).toEqual(EMPTY_STATS)
  })
})
