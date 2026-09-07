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

  it('starts study with due cards or the whole deck', async () => {
    const t = testConvex()
    const deck = await t.mutation(api.library.createDeck, { folderId: null, name: 'Mixed' })
    const dueCard = await t.mutation(api.library.createCard, {
      deckId: deckId(deck.id),
      card: { front: 'Due', back: 'Now', highlights: [] },
    })
    const laterCard = await t.mutation(api.library.createCard, {
      deckId: deckId(deck.id),
      card: { front: 'Later', back: 'Wait', highlights: [] },
    })
    await t.run(async (ctx) => {
      await ctx.db.patch(cardId(laterCard.id), {
        status: 'mastered',
        dueAt: '2099-01-01T00:00:00.000Z',
        intervalDays: 10,
      })
    })

    const due = await t.query(api.library.startStudy, { deckId: deckId(deck.id), mode: 'due' })
    const all = await t.query(api.library.startStudy, { deckId: deckId(deck.id), mode: 'all' })
    const fallback = await t.query(api.library.startStudy, { deckId: deckId(deck.id) })
    expect(due.dueCards.map((card) => card.id)).toEqual([dueCard.id])
    expect(all.dueCards.map((card) => card.id)).toEqual([laterCard.id, dueCard.id])
    expect(fallback.dueCards.map((card) => card.id)).toEqual([dueCard.id])
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

  it('reorders sibling folders and decks', async () => {
    const t = testConvex()
    const first = await t.mutation(api.library.createFolder, { parentId: null, name: 'A' })
    const second = await t.mutation(api.library.createFolder, { parentId: null, name: 'B' })
    const third = await t.mutation(api.library.createFolder, { parentId: null, name: 'C' })

    await t.mutation(api.library.reorderFolders, {
      parentId: null,
      orderedIds: [folderId(third.id), folderId(first.id), folderId(second.id)],
    })
    expect(
      (await t.query(api.library.getSnapshot, {})).folders.map((folder) => folder.id),
    ).toEqual([third.id, first.id, second.id])

    await expect(
      t.mutation(api.library.reorderFolders, {
        parentId: null,
        orderedIds: [folderId(first.id), folderId(second.id)],
      }),
    ).rejects.toThrow(/changed/)

    const deckA = await t.mutation(api.library.createDeck, { folderId: null, name: 'Deck A' })
    const deckB = await t.mutation(api.library.createDeck, { folderId: null, name: 'Deck B' })
    await t.mutation(api.library.reorderDecks, {
      folderId: null,
      orderedIds: [deckId(deckB.id), deckId(deckA.id)],
    })
    expect(
      (await t.query(api.library.getSnapshot, {})).decks.map((deck) => deck.id),
    ).toEqual([deckB.id, deckA.id])
  })

  it('moves decks and folders to the end of the new parent', async () => {
    const t = testConvex()
    const target = await t.mutation(api.library.createFolder, { parentId: null, name: 'Target' })
    const deck = await t.mutation(api.library.createDeck, { folderId: null, name: 'Movable' })
    await t.mutation(api.library.moveDeck, {
      id: deckId(deck.id),
      folderId: folderId(target.id),
    })
    const snapshot = await t.query(api.library.getSnapshot, {})
    expect(snapshot.decks.find((item) => item.id === deck.id)).toMatchObject({
      folderId: target.id,
      position: 0,
    })

    const root = await t.mutation(api.library.createFolder, { parentId: null, name: 'Root' })
    await t.mutation(api.library.moveFolder, {
      id: folderId(target.id),
      parentId: folderId(root.id),
    })
    const moved = (await t.query(api.library.getSnapshot, {})).folders.find(
      (folder) => folder.id === target.id,
    )
    expect(moved).toMatchObject({ parentId: root.id, position: 0 })
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
