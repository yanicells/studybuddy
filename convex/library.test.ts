/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'

import { parseCards } from '../src/core/import'
import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'
import schema from './schema'
const modules = import.meta.glob('./**/*.ts')

function testConvex() {
  return convexTest(schema, modules)
}

function folderId(id: string): Id<'folders'> {
  return id as Id<'folders'>
}

function deckId(id: string): Id<'decks'> {
  return id as Id<'decks'>
}

function cardId(id: string): Id<'cards'> {
  return id as Id<'cards'>
}

describe('library repository', () => {
  it('creates nested folders and rejects descendant cycles', async () => {
    const t = testConvex()
    const root = await t.mutation(api.library.createFolder, { parentId: null, name: 'Biology' })
    const child = await t.mutation(api.library.createFolder, {
      parentId: folderId(root.id),
      name: 'Week 1',
    })

    await expect(
      t.mutation(api.library.moveFolder, { id: folderId(root.id), parentId: folderId(child.id) }),
    ).rejects.toThrow(/own child/)
    await t.mutation(api.library.moveFolder, { id: folderId(child.id), parentId: null })
    await t.mutation(api.library.deleteFolder, { id: folderId(root.id) })

    expect((await t.query(api.library.getSnapshot, {})).folders).toEqual([
      expect.objectContaining({ id: child.id, parentId: null }),
    ])
  })

  it('imports cards transactionally and calculates due status totals', async () => {
    const t = testConvex()
    const deck = await t.mutation(api.library.createDeck, { folderId: null, name: 'Cells' })
    const count = await t.mutation(api.library.importCards, {
      deckId: deckId(deck.id),
      cards: parseCards(
        'The **mitochondria** is the powerhouse of the cell\n- mitochondria\n\nNucleus\n- control center',
      ),
    })

    expect(count).toBe(2)
    expect((await t.query(api.library.getSnapshot, {})).statsByDeck[deck.id]).toEqual({
      new: 2,
      learning: 0,
      mastered: 0,
      due: 2,
    })
  })

  it('persists scheduling and review logs', async () => {
    const t = testConvex()
    const deck = await t.mutation(api.library.createDeck, { folderId: null, name: 'Review' })
    const card = await t.mutation(api.library.createCard, {
      deckId: deckId(deck.id),
      card: { front: 'Question', back: 'Answer', highlights: [] },
    })
    const updated = await t.mutation(api.library.recordAnswer, {
      cardId: cardId(card.id),
      correct: true,
      reviewedAt: '2026-08-13T03:00:00.000Z',
    })

    expect(updated).toMatchObject({ status: 'learning', reps: 1 })
    expect(await t.query(api.library.listCards, { deckId: deckId(deck.id) })).toEqual([
      expect.objectContaining({ id: card.id, status: 'learning', reps: 1 }),
    ])
    const reviews = await t.run(async (ctx) => ctx.db.query('reviews').collect())
    expect(reviews).toEqual([
      expect.objectContaining({ cardId: card.id, correct: true }),
    ])
  })

  it('cascades deck deletion to cards', async () => {
    const t = testConvex()
    const deck = await t.mutation(api.library.createDeck, { folderId: null, name: 'Temporary' })
    await t.mutation(api.library.createCard, {
      deckId: deckId(deck.id),
      card: { front: 'A', back: 'B', highlights: [] },
    })
    await t.mutation(api.library.deleteDeck, { id: deckId(deck.id) })
    expect(await t.query(api.library.listCards, { deckId: deckId(deck.id) })).toEqual([])
  })

  it('seeds the nested sample library only once', async () => {
    const t = testConvex()
    expect(await t.mutation(api.seed.seedSampleIfMissing, {})).toBe(true)
    expect(await t.mutation(api.seed.seedSampleIfMissing, {})).toBe(false)

    const snapshot = await t.query(api.library.getSnapshot, {})
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
