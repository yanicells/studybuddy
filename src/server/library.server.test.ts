import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { parseCards } from '../core/import'
import { applyAnswer } from '../core/srs'
import { closeDatabase, openDatabase, type Database } from './database.server'
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

describe('library repository', () => {
  let directory: string
  let db: Database

  beforeEach(async () => {
    directory = mkdtempSync(join(tmpdir(), 'studybuddy-test-'))
    db = await openDatabase(join(directory, 'studybuddy.db'))
  })

  afterEach(async () => {
    await closeDatabase(db)
    rmSync(directory, { recursive: true, force: true })
  })

  it('creates nested folders and rejects descendant cycles', async () => {
    const root = await createFolder(db, null, 'Biology')
    const child = await createFolder(db, root.id, 'Week 1')

    expect(await folderDescendants(db, root.id)).toEqual([child.id])
    await expect(moveFolder(db, root.id, child.id)).rejects.toThrow(/own child/)
    await moveFolder(db, child.id, null)
    await deleteFolder(db, root.id)

    expect((await getLibrarySnapshot(db)).folders).toEqual([
      expect.objectContaining({ id: child.id, parentId: null }),
    ])
  })

  it('imports cards transactionally and calculates due status totals', async () => {
    const deck = await createDeck(db, null, 'Cells')
    const count = await importCards(
      db,
      deck.id,
      parseCards(
        'The **mitochondria** is the powerhouse of the cell\n- mitochondria\n\nNucleus\n- control center',
      ),
    )

    expect(count).toBe(2)
    expect((await getLibrarySnapshot(db)).statsByDeck[deck.id]).toEqual({
      new: 2,
      learning: 0,
      mastered: 0,
      due: 2,
    })
  })

  it('persists scheduling and review logs', async () => {
    const deck = await createDeck(db, null, 'Review')
    const card = await createCard(db, deck.id, {
      front: 'Question',
      back: 'Answer',
      highlights: [],
    })
    const updated = applyAnswer(card, true, new Date('2026-08-13T03:00:00.000Z'))

    await saveCardSrs(db, updated)
    await recordReview(db, card.id, true, new Date('2026-08-13T03:00:00.000Z'))

    expect(await getCard(db, card.id)).toMatchObject({ status: 'learning', reps: 1 })
    expect(await listReviews(db)).toEqual([
      expect.objectContaining({ cardId: card.id, correct: true }),
    ])
  })

  it('cascades deck deletion to cards', async () => {
    const deck = await createDeck(db, null, 'Temporary')
    await createCard(db, deck.id, { front: 'A', back: 'B', highlights: [] })
    await deleteDeck(db, deck.id)
    expect(await listCards(db, deck.id)).toEqual([])
  })

  it('seeds the nested sample library only once', async () => {
    expect(await seedSampleIfMissing(db)).toBe(true)
    expect(await seedSampleIfMissing(db)).toBe(false)

    const snapshot = await getLibrarySnapshot(db)
    const course = snapshot.folders.find((folder) => folder.name === 'CSCI 50.01')
    const lecture = snapshot.folders.find(
      (folder) => folder.name === 'Hardware Lecture' && folder.parentId === course?.id,
    )
    expect(course).toBeDefined()
    expect(lecture).toBeDefined()
    expect(
      snapshot.decks.filter((deck) => deck.folderId === lecture?.id).map((deck) => deck.name),
    ).toEqual(['Architecture vs Organization', 'Structure and Function'])
    expect(
      snapshot.decks.reduce(
        (total, deck) => total + (snapshot.cardsByDeck[deck.id]?.length ?? 0),
        0,
      ),
    ).toBeGreaterThanOrEqual(40)
  })
})
