import { eq, isNull, max, sql } from 'drizzle-orm'

import { buildStudyQueue } from '../core/queue'
import { reviewedToday, studyStreak, sumStats } from '../core/stats'
import type {
  Card,
  Deck,
  DeckStats,
  Folder,
  Highlight,
  LibrarySnapshot,
  NewCard,
  Status,
} from '../core/types'
import { EMPTY_STATS, isDue } from '../core/types'
import type { Db } from './database.server'
import { cards, decks, folders, reviews } from './schema'

export interface Review {
  id: number
  cardId: number
  correct: boolean
  reviewedAt: string
}

export async function createFolder(
  db: Db,
  parentId: number | null,
  rawName: string,
): Promise<Folder> {
  const name = requireName(rawName, 'folder')
  const position = await nextPosition(db, 'folders', parentId)
  const [row] = await db
    .insert(folders)
    .values({ parentId, name, position, createdAt: nowIso() })
    .returning()
  if (!row) throw new Error('Folder not found')
  return mapFolder(row)
}

export async function renameFolder(db: Db, id: number, rawName: string): Promise<void> {
  const name = requireName(rawName, 'folder')
  const result = await db.update(folders).set({ name }).where(eq(folders.id, id))
  if (result.rowsAffected === 0) throw new Error('Folder not found')
}

export async function moveFolder(
  db: Db,
  id: number,
  parentId: number | null,
): Promise<void> {
  if (parentId === id) throw new Error('A folder cannot be moved into itself')
  if (parentId !== null && (await folderDescendants(db, id)).includes(parentId)) {
    throw new Error('A folder cannot be moved into its own child')
  }
  const result = await db.update(folders).set({ parentId }).where(eq(folders.id, id))
  if (result.rowsAffected === 0) throw new Error('Folder not found')
}

export async function deleteFolder(db: Db, id: number): Promise<void> {
  const result = await db.delete(folders).where(eq(folders.id, id))
  if (result.rowsAffected === 0) throw new Error('Folder not found')
}

export async function listFolders(db: Db): Promise<Folder[]> {
  const rows = await db.select().from(folders).orderBy(folders.position, folders.name)
  return rows.map(mapFolder)
}

export async function folderDescendants(db: Db, id: number): Promise<number[]> {
  const children = new Map<number | null, number[]>()
  for (const folder of await listFolders(db)) {
    const siblings = children.get(folder.parentId) ?? []
    siblings.push(folder.id)
    children.set(folder.parentId, siblings)
  }
  const result: number[] = []
  const stack = [...(children.get(id) ?? [])]
  while (stack.length > 0) {
    const next = stack.pop()!
    result.push(next)
    stack.push(...(children.get(next) ?? []))
  }
  return result
}

export async function createDeck(
  db: Db,
  folderId: number | null,
  rawName: string,
): Promise<Deck> {
  const name = requireName(rawName, 'deck')
  const position = await nextPosition(db, 'decks', folderId)
  const [row] = await db
    .insert(decks)
    .values({ folderId, name, position, createdAt: nowIso() })
    .returning()
  if (!row) throw new Error('Deck not found')
  return mapDeck(row)
}

export async function renameDeck(db: Db, id: number, rawName: string): Promise<void> {
  const name = requireName(rawName, 'deck')
  const result = await db.update(decks).set({ name }).where(eq(decks.id, id))
  if (result.rowsAffected === 0) throw new Error('Deck not found')
}

export async function moveDeck(
  db: Db,
  id: number,
  folderId: number | null,
): Promise<void> {
  const result = await db.update(decks).set({ folderId }).where(eq(decks.id, id))
  if (result.rowsAffected === 0) throw new Error('Deck not found')
}

export async function deleteDeck(db: Db, id: number): Promise<void> {
  const result = await db.delete(decks).where(eq(decks.id, id))
  if (result.rowsAffected === 0) throw new Error('Deck not found')
}

export async function getDeck(db: Db, id: number): Promise<Deck> {
  const [row] = await db.select().from(decks).where(eq(decks.id, id)).limit(1)
  if (!row) throw new Error('Deck not found')
  return mapDeck(row)
}

export async function listDecks(db: Db): Promise<Deck[]> {
  const rows = await db.select().from(decks).orderBy(decks.position, decks.name)
  return rows.map(mapDeck)
}

export async function createCard(db: Db, deckId: number, card: NewCard): Promise<Card> {
  const front = requireFront(card.front)
  const position = await nextPosition(db, 'cards', deckId)
  const [row] = await db
    .insert(cards)
    .values({
      deckId,
      front,
      back: card.back,
      highlights: JSON.stringify(card.highlights),
      position,
      createdAt: nowIso(),
    })
    .returning()
  if (!row) throw new Error('Card not found')
  return mapCard(row)
}

export async function updateCard(db: Db, id: number, card: NewCard): Promise<void> {
  const front = requireFront(card.front)
  const result = await db
    .update(cards)
    .set({ front, back: card.back, highlights: JSON.stringify(card.highlights) })
    .where(eq(cards.id, id))
  if (result.rowsAffected === 0) throw new Error('Card not found')
}

export async function deleteCard(db: Db, id: number): Promise<void> {
  const result = await db.delete(cards).where(eq(cards.id, id))
  if (result.rowsAffected === 0) throw new Error('Card not found')
}

export async function getCard(db: Db, id: number): Promise<Card> {
  const [row] = await db.select().from(cards).where(eq(cards.id, id)).limit(1)
  if (!row) throw new Error('Card not found')
  return mapCard(row)
}

export async function listCards(db: Db, deckId: number): Promise<Card[]> {
  const rows = await db
    .select()
    .from(cards)
    .where(eq(cards.deckId, deckId))
    .orderBy(cards.position, cards.id)
  return rows.map(mapCard)
}

export async function saveCardSrs(db: Db, card: Card): Promise<void> {
  const result = await db
    .update(cards)
    .set({
      status: card.status,
      ease: card.ease,
      intervalDays: card.intervalDays,
      dueAt: card.dueAt,
      reps: card.reps,
      lapses: card.lapses,
      streak: card.streak,
      learningStep: card.learningStep,
      lastReviewedAt: card.lastReviewedAt,
    })
    .where(eq(cards.id, card.id))
  if (result.rowsAffected === 0) throw new Error('Card not found')
}

export async function recordReview(
  db: Db,
  cardId: number,
  correct: boolean,
  reviewedAt = new Date(),
): Promise<void> {
  await db.insert(reviews).values({
    cardId,
    correct: correct ? 1 : 0,
    reviewedAt: reviewedAt.toISOString(),
  })
}

export async function listReviews(db: Db): Promise<Review[]> {
  const rows = await db.select().from(reviews).orderBy(reviews.id)
  return rows.map((row) => ({
    id: row.id,
    cardId: row.cardId,
    correct: row.correct === 1,
    reviewedAt: row.reviewedAt,
  }))
}

export async function importCards(
  db: Db,
  deckId: number,
  incoming: NewCard[],
): Promise<number> {
  return db.transaction(async (tx) => {
    let count = 0
    for (const card of incoming) {
      if (!card.front.trim()) continue
      await createCard(tx, deckId, card)
      count += 1
    }
    return count
  })
}

export async function dueCards(
  db: Db,
  deckId: number,
  now = new Date(),
): Promise<Card[]> {
  return buildStudyQueue(await listCards(db, deckId), now)
}

export async function getLibrarySnapshot(db: Db): Promise<LibrarySnapshot> {
  const folderRows = await listFolders(db)
  const deckRows = await listDecks(db)
  const rows = await db.select().from(cards).orderBy(cards.deckId, cards.position, cards.id)
  const cardsByDeck: Record<number, Card[]> = {}
  const statsByDeck: Record<number, DeckStats> = {}
  const now = new Date()

  for (const deck of deckRows) {
    cardsByDeck[deck.id] = []
    statsByDeck[deck.id] = { ...EMPTY_STATS }
  }
  for (const row of rows) {
    const card = mapCard(row)
    cardsByDeck[card.deckId] ??= []
    cardsByDeck[card.deckId]!.push(card)
    statsByDeck[card.deckId] ??= { ...EMPTY_STATS }
    const stats = statsByDeck[card.deckId]!
    stats[card.status] += 1
    if (isDue(card, now)) stats.due += 1
  }
  const reviewRows = await db.select({ reviewedAt: reviews.reviewedAt }).from(reviews)
  const reviewTimes = reviewRows.map((row) => row.reviewedAt)
  const totals = sumStats(statsByDeck)
  return {
    folders: folderRows,
    decks: deckRows,
    cardsByDeck,
    statsByDeck,
    study: {
      due: totals.due,
      reviewedToday: reviewedToday(reviewTimes, now),
      streak: studyStreak(reviewTimes, now),
    },
  }
}

function mapFolder(row: typeof folders.$inferSelect): Folder {
  return { id: row.id, parentId: row.parentId, name: row.name, position: row.position }
}

function mapDeck(row: typeof decks.$inferSelect): Deck {
  return { id: row.id, folderId: row.folderId, name: row.name, position: row.position }
}

function mapCard(row: typeof cards.$inferSelect): Card {
  let highlights: Highlight[]
  try {
    highlights = JSON.parse(row.highlights) as Highlight[]
  } catch {
    highlights = []
  }
  const validStatus: Status =
    row.status === 'learning' || row.status === 'mastered' ? row.status : 'new'
  return {
    id: row.id,
    deckId: row.deckId,
    front: row.front,
    back: row.back,
    highlights,
    position: row.position,
    status: validStatus,
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

async function nextPosition(
  db: Db,
  table: 'folders' | 'decks' | 'cards',
  parentId: number | null,
): Promise<number> {
  if (table === 'folders') {
    const [row] = await db
      .select({ position: sql<number>`coalesce(${max(folders.position)}, -1) + 1` })
      .from(folders)
      .where(parentId === null ? isNull(folders.parentId) : eq(folders.parentId, parentId))
    return row?.position ?? 0
  }
  if (table === 'decks') {
    const [row] = await db
      .select({ position: sql<number>`coalesce(${max(decks.position)}, -1) + 1` })
      .from(decks)
      .where(parentId === null ? isNull(decks.folderId) : eq(decks.folderId, parentId))
    return row?.position ?? 0
  }
  const [row] = await db
    .select({ position: sql<number>`coalesce(${max(cards.position)}, -1) + 1` })
    .from(cards)
    .where(eq(cards.deckId, parentId ?? -1))
  return row?.position ?? 0
}

function nowIso(): string {
  return new Date().toISOString()
}

function capitalize(value: string): string {
  return value[0]!.toUpperCase() + value.slice(1)
}
