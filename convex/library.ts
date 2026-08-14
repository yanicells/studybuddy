import { v } from 'convex/values'

import { buildStudyQueue } from '../src/core/queue'
import { applyAnswer } from '../src/core/srs'
import { reviewedToday, studyStreak, sumStats } from '../src/core/stats'
import {
  EMPTY_STATS,
  isDue,
  type Card,
  type Deck,
  type DeckStats,
  type Folder,
  type Highlight,
  type NewCard,
  type Status,
} from '../src/core/types'
import type { Doc, Id } from './_generated/dataModel'
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server'

type DbCtx = QueryCtx | MutationCtx

const highlightValidator = v.object({
  side: v.union(v.literal('front'), v.literal('back')),
  text: v.string(),
})

const newCardValidator = v.object({
  front: v.string(),
  back: v.string(),
  highlights: v.array(highlightValidator),
})

export const getSnapshot = query({
  args: {},
  handler: (ctx) => loadSnapshot(ctx),
})

export const listCards = query({
  args: { deckId: v.id('decks') },
  handler: (ctx, args) => listCardRecords(ctx, args.deckId),
})

export const dueCards = query({
  args: { deckId: v.id('decks') },
  handler: async (ctx, args) => buildStudyQueue(await listCardRecords(ctx, args.deckId)),
})

export const startStudy = query({
  args: { deckId: v.id('decks') },
  handler: async (ctx, args) => {
    const deckCards = await listCardRecords(ctx, args.deckId)
    return { dueCards: buildStudyQueue(deckCards), deckCards }
  },
})

export const createFolder = mutation({
  args: { parentId: v.union(v.id('folders'), v.null()), name: v.string() },
  handler: async (ctx, args) => createFolderRecord(ctx, args.parentId, args.name),
})

export const renameFolder = mutation({
  args: { id: v.id('folders'), name: v.string() },
  handler: async (ctx, args) => {
    await requireDoc(ctx, args.id, 'Folder not found')
    await ctx.db.patch(args.id, { name: requireName(args.name, 'folder') })
  },
})

export const moveFolder = mutation({
  args: { id: v.id('folders'), parentId: v.union(v.id('folders'), v.null()) },
  handler: async (ctx, args) => {
    if (args.parentId === args.id) throw new Error('A folder cannot be moved into itself')
    await requireDoc(ctx, args.id, 'Folder not found')
    if (args.parentId !== null) {
      await requireDoc(ctx, args.parentId, 'Folder not found')
      if ((await folderDescendants(ctx, args.id)).includes(args.parentId)) {
        throw new Error('A folder cannot be moved into its own child')
      }
    }
    await ctx.db.patch(args.id, { parentId: args.parentId })
  },
})

export const deleteFolder = mutation({
  args: { id: v.id('folders') },
  handler: async (ctx, args) => {
    await requireDoc(ctx, args.id, 'Folder not found')
    const folderIds = [args.id, ...(await folderDescendants(ctx, args.id))]
    for (const folderId of folderIds) {
      const decks = await ctx.db
        .query('decks')
        .withIndex('by_folder', (q) => q.eq('folderId', folderId))
        .collect()
      for (const deck of decks) await deleteDeckRecord(ctx, deck._id)
    }
    for (const folderId of folderIds) await ctx.db.delete(folderId)
  },
})

export const createDeck = mutation({
  args: { folderId: v.union(v.id('folders'), v.null()), name: v.string() },
  handler: async (ctx, args) => createDeckRecord(ctx, args.folderId, args.name),
})

export const renameDeck = mutation({
  args: { id: v.id('decks'), name: v.string() },
  handler: async (ctx, args) => {
    await requireDoc(ctx, args.id, 'Deck not found')
    await ctx.db.patch(args.id, { name: requireName(args.name, 'deck') })
  },
})

export const moveDeck = mutation({
  args: { id: v.id('decks'), folderId: v.union(v.id('folders'), v.null()) },
  handler: async (ctx, args) => {
    await requireDoc(ctx, args.id, 'Deck not found')
    if (args.folderId !== null) await requireDoc(ctx, args.folderId, 'Folder not found')
    await ctx.db.patch(args.id, { folderId: args.folderId })
  },
})

export const deleteDeck = mutation({
  args: { id: v.id('decks') },
  handler: async (ctx, args) => {
    await requireDoc(ctx, args.id, 'Deck not found')
    await deleteDeckRecord(ctx, args.id)
  },
})

export const createCard = mutation({
  args: { deckId: v.id('decks'), card: newCardValidator },
  handler: async (ctx, args) => createCardRecord(ctx, args.deckId, args.card),
})

export const updateCard = mutation({
  args: { id: v.id('cards'), card: newCardValidator },
  handler: async (ctx, args) => {
    await requireDoc(ctx, args.id, 'Card not found')
    await ctx.db.patch(args.id, {
      front: requireFront(args.card.front),
      back: args.card.back,
      highlights: args.card.highlights,
    })
  },
})

export const deleteCard = mutation({
  args: { id: v.id('cards') },
  handler: async (ctx, args) => {
    await requireDoc(ctx, args.id, 'Card not found')
    await deleteCardRecord(ctx, args.id)
  },
})

export const importCards = mutation({
  args: { deckId: v.id('decks'), cards: v.array(newCardValidator) },
  handler: async (ctx, args) => importCardRecords(ctx, args.deckId, args.cards),
})

export const recordAnswer = mutation({
  args: {
    cardId: v.id('cards'),
    correct: v.boolean(),
    reviewedAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const row = await requireDoc(ctx, args.cardId, 'Card not found')
    const now = args.reviewedAt ? new Date(args.reviewedAt) : new Date()
    const updated = applyAnswer(mapCard(row), args.correct, now)
    await ctx.db.patch(args.cardId, {
      status: updated.status,
      ease: updated.ease,
      intervalDays: updated.intervalDays,
      dueAt: updated.dueAt,
      reps: updated.reps,
      lapses: updated.lapses,
      streak: updated.streak,
      learningStep: updated.learningStep,
      lastReviewedAt: updated.lastReviewedAt,
    })
    await ctx.db.insert('reviews', {
      cardId: args.cardId,
      correct: args.correct,
      reviewedAt: now.toISOString(),
    })
    return updated
  },
})

export async function createFolderRecord(
  ctx: MutationCtx,
  parentId: Id<'folders'> | null,
  rawName: string,
): Promise<Folder> {
  if (parentId !== null) await requireDoc(ctx, parentId, 'Folder not found')
  const id = await ctx.db.insert('folders', {
    parentId,
    name: requireName(rawName, 'folder'),
    position: await nextPosition(ctx, 'folders', parentId),
    createdAt: nowIso(),
  })
  return mapFolder((await ctx.db.get(id))!)
}

export async function createDeckRecord(
  ctx: MutationCtx,
  folderId: Id<'folders'> | null,
  rawName: string,
): Promise<Deck> {
  if (folderId !== null) await requireDoc(ctx, folderId, 'Folder not found')
  const id = await ctx.db.insert('decks', {
    folderId,
    name: requireName(rawName, 'deck'),
    position: await nextPosition(ctx, 'decks', folderId),
    createdAt: nowIso(),
  })
  return mapDeck((await ctx.db.get(id))!)
}

export async function createCardRecord(
  ctx: MutationCtx,
  deckId: Id<'decks'>,
  card: NewCard,
): Promise<Card> {
  await requireDoc(ctx, deckId, 'Deck not found')
  const id = await ctx.db.insert('cards', {
    deckId,
    front: requireFront(card.front),
    back: card.back,
    highlights: card.highlights,
    position: await nextPosition(ctx, 'cards', deckId),
    createdAt: nowIso(),
    status: 'new',
    ease: 2.5,
    intervalDays: 0,
    dueAt: null,
    reps: 0,
    lapses: 0,
    streak: 0,
    learningStep: 0,
    lastReviewedAt: null,
  })
  return mapCard((await ctx.db.get(id))!)
}

export async function importCardRecords(
  ctx: MutationCtx,
  deckId: Id<'decks'>,
  incoming: NewCard[],
): Promise<number> {
  let count = 0
  for (const card of incoming) {
    if (!card.front.trim()) continue
    await createCardRecord(ctx, deckId, card)
    count += 1
  }
  return count
}

export async function listFolderDocs(ctx: DbCtx): Promise<Doc<'folders'>[]> {
  const rows = await ctx.db.query('folders').collect()
  rows.sort((left, right) => left.position - right.position || left.name.localeCompare(right.name))
  return rows
}

export async function loadSnapshot(ctx: DbCtx) {
  const folderRows = await listFolderDocs(ctx)
  const deckRows = await ctx.db.query('decks').collect()
  deckRows.sort((left, right) => left.position - right.position || left.name.localeCompare(right.name))
  const cardRows = await ctx.db.query('cards').collect()
  cardRows.sort(
    (left, right) =>
      left.deckId.localeCompare(right.deckId) || left.position - right.position || left._id.localeCompare(right._id),
  )
  const folders = folderRows.map(mapFolder)
  const decks = deckRows.map(mapDeck)
  const cardsByDeck: Record<string, Card[]> = {}
  const statsByDeck: Record<string, DeckStats> = {}
  const now = new Date()

  for (const deck of decks) {
    cardsByDeck[deck.id] = []
    statsByDeck[deck.id] = { ...EMPTY_STATS }
  }
  for (const row of cardRows) {
    const card = mapCard(row)
    cardsByDeck[card.deckId] ??= []
    cardsByDeck[card.deckId]!.push(card)
    statsByDeck[card.deckId] ??= { ...EMPTY_STATS }
    const stats = statsByDeck[card.deckId]!
    stats[card.status] += 1
    if (isDue(card, now)) stats.due += 1
  }
  const reviewRows = await ctx.db.query('reviews').collect()
  const totals = sumStats(statsByDeck)
  return {
    folders,
    decks,
    cardsByDeck,
    statsByDeck,
    study: {
      due: totals.due,
      reviewedToday: reviewedToday(
        reviewRows.map((row) => row.reviewedAt),
        now,
      ),
      streak: studyStreak(
        reviewRows.map((row) => row.reviewedAt),
        now,
      ),
    },
  }
}

async function listCardRecords(ctx: DbCtx, deckId: Id<'decks'>): Promise<Card[]> {
  const rows = await ctx.db
    .query('cards')
    .withIndex('by_deck', (q) => q.eq('deckId', deckId))
    .collect()
  rows.sort((left, right) => left.position - right.position || left._id.localeCompare(right._id))
  return rows.map(mapCard)
}

async function folderDescendants(ctx: DbCtx, id: Id<'folders'>): Promise<Id<'folders'>[]> {
  const children = new Map<Id<'folders'> | null, Id<'folders'>[]>()
  for (const folder of await listFolderDocs(ctx)) {
    const siblings = children.get(folder.parentId) ?? []
    siblings.push(folder._id)
    children.set(folder.parentId, siblings)
  }
  const result: Id<'folders'>[] = []
  const stack = [...(children.get(id) ?? [])]
  while (stack.length > 0) {
    const next = stack.pop()!
    result.push(next)
    stack.push(...(children.get(next) ?? []))
  }
  return result
}

async function deleteDeckRecord(ctx: MutationCtx, deckId: Id<'decks'>): Promise<void> {
  const cards = await ctx.db
    .query('cards')
    .withIndex('by_deck', (q) => q.eq('deckId', deckId))
    .collect()
  for (const card of cards) await deleteCardRecord(ctx, card._id)
  await ctx.db.delete(deckId)
}

async function deleteCardRecord(ctx: MutationCtx, cardId: Id<'cards'>): Promise<void> {
  const reviews = await ctx.db
    .query('reviews')
    .withIndex('by_card', (q) => q.eq('cardId', cardId))
    .collect()
  for (const review of reviews) await ctx.db.delete(review._id)
  await ctx.db.delete(cardId)
}

async function nextPosition(
  ctx: DbCtx,
  table: 'folders' | 'decks' | 'cards',
  parentId: Id<'folders'> | Id<'decks'> | null,
): Promise<number> {
  if (table === 'folders') {
    const rows = await ctx.db
      .query('folders')
      .withIndex('by_parent', (q) => q.eq('parentId', parentId as Id<'folders'> | null))
      .collect()
    return rows.reduce((max, row) => Math.max(max, row.position), -1) + 1
  }
  if (table === 'decks') {
    const rows = await ctx.db
      .query('decks')
      .withIndex('by_folder', (q) => q.eq('folderId', parentId as Id<'folders'> | null))
      .collect()
    return rows.reduce((max, row) => Math.max(max, row.position), -1) + 1
  }
  const rows = await ctx.db
    .query('cards')
    .withIndex('by_deck', (q) => q.eq('deckId', parentId as Id<'decks'>))
    .collect()
  return rows.reduce((max, row) => Math.max(max, row.position), -1) + 1
}

async function requireDoc<Table extends 'folders' | 'decks' | 'cards'>(
  ctx: DbCtx,
  id: Id<Table>,
  message: string,
): Promise<Doc<Table>> {
  const row = await ctx.db.get(id)
  if (!row) throw new Error(message)
  return row
}

function mapFolder(row: Doc<'folders'>): Folder {
  return { id: row._id, parentId: row.parentId, name: row.name, position: row.position }
}

function mapDeck(row: Doc<'decks'>): Deck {
  return { id: row._id, folderId: row.folderId, name: row.name, position: row.position }
}

function mapCard(row: Doc<'cards'>): Card {
  const status: Status =
    row.status === 'learning' || row.status === 'mastered' ? row.status : 'new'
  return {
    id: row._id,
    deckId: row.deckId,
    front: row.front,
    back: row.back,
    highlights: row.highlights as Highlight[],
    position: row.position,
    status,
    ease: row.ease,
    intervalDays: row.intervalDays,
    dueAt: row.dueAt,
    reps: row.reps,
    lapses: row.lapses,
    streak: row.streak,
    learningStep: row.learningStep,
    lastReviewedAt: row.lastReviewedAt,
  }
}

function requireName(value: string, kind: 'folder' | 'deck'): string {
  const name = value.trim()
  if (!name) throw new Error(`${capitalize(kind)} name is empty`)
  return name
}

function requireFront(value: string): string {
  const front = value.trim()
  if (!front) throw new Error('Front is empty')
  return front
}

function nowIso(): string {
  return new Date().toISOString()
}

function capitalize(value: string): string {
  return value[0]!.toUpperCase() + value.slice(1)
}
