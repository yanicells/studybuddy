import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { parseCards } from '../core/import'
import { applyAnswer } from '../core/srs'
import { openDatabase } from './database.server'
import {
  createCard,
  createDeck,
  createFolder,
  deleteDeck,
  deleteFolder,
  folderDescendants,
  getCard,
  getLibrarySnapshot,
  importCards,
  listCards,
  listReviews,
  moveFolder,
  recordReview,
  saveCardSrs,
} from './library.server'
import { seedSampleIfMissing } from './seed.server'

describe('SQLite library repository', () => {
  let directory: string
  let db: Database.Database

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'studybuddy-test-'))
    db = openDatabase(join(directory, 'studybuddy.db'))
  })

  afterEach(() => {
    db.close()
    rmSync(directory, { recursive: true, force: true })
  })

  it('creates nested folders and rejects descendant cycles', () => {
    const root = createFolder(db, null, 'Biology')
    const child = createFolder(db, root.id, 'Week 1')

    expect(folderDescendants(db, root.id)).toEqual([child.id])
    expect(() => moveFolder(db, root.id, child.id)).toThrow(/own child/)
    moveFolder(db, child.id, null)
    deleteFolder(db, root.id)

    expect(getLibrarySnapshot(db).folders).toEqual([
      expect.objectContaining({ id: child.id, parentId: null }),
    ])
  })

  it('imports cards transactionally and calculates due status totals', () => {
    const deck = createDeck(db, null, 'Cells')
    const count = importCards(
      db,
      deck.id,
      parseCards(
        'The ==mitochondria== is the powerhouse of the cell\n- mitochondria\n\nNucleus\n- control center',
      ),
    )

    expect(count).toBe(2)
    expect(getLibrarySnapshot(db).statsByDeck[deck.id]).toEqual({
      new: 2,
      learning: 0,
      mastered: 0,
      due: 2,
    })
  })

  it('persists scheduling and review logs', () => {
    const deck = createDeck(db, null, 'Review')
    const card = createCard(db, deck.id, {
      front: 'Question',
      back: 'Answer',
      highlights: [],
    })
    const updated = applyAnswer(card, true, new Date('2026-08-13T03:00:00.000Z'))

    saveCardSrs(db, updated)
    recordReview(db, card.id, true, new Date('2026-08-13T03:00:00.000Z'))

    expect(getCard(db, card.id)).toMatchObject({ status: 'learning', reps: 1 })
    expect(listReviews(db)).toEqual([
      expect.objectContaining({ cardId: card.id, correct: true }),
    ])
  })

  it('cascades deck deletion to cards', () => {
    const deck = createDeck(db, null, 'Temporary')
    createCard(db, deck.id, { front: 'A', back: 'B', highlights: [] })
    deleteDeck(db, deck.id)
    expect(listCards(db, deck.id)).toEqual([])
  })

  it('seeds the nested sample library only once', () => {
    expect(seedSampleIfMissing(db)).toBe(true)
    expect(seedSampleIfMissing(db)).toBe(false)

    const snapshot = getLibrarySnapshot(db)
    const course = snapshot.folders.find((folder) => folder.name === 'CSCI 50.01')
    const lecture = snapshot.folders.find(
      (folder) => folder.name === 'Hardware Lecture' && folder.parentId === course?.id,
    )
    expect(course).toBeDefined()
    expect(lecture).toBeDefined()
    expect(
      snapshot.decks.filter((deck) => deck.folderId === lecture?.id).map((deck) => deck.name),
    ).toEqual(['Architecture vs Organization', 'Structure and Function'])
  })
})
