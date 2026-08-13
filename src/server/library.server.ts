import type Database from 'better-sqlite3'

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
import { getDatabase } from './database.server'

interface FolderRow {
  id: number
  parent_id: number | null
  name: string
  position: number
}

interface DeckRow {
  id: number
  folder_id: number | null
  name: string
  position: number
}

interface CardRow {
  id: number
  deck_id: number
  front: string
  back: string
  highlights: string
  position: number
  status: string
  ease: number
  interval_days: number
  due_at: string | null
  reps: number
  lapses: number
  streak: number
  learning_step: number
  last_reviewed_at: string | null
}

export interface Review {
  id: number
  cardId: number
  correct: boolean
  reviewedAt: string
}

export function createFolder(
  db: Database.Database = getDatabase(),
  parentId: number | null,
  rawName: string,
): Folder {
  const name = requireName(rawName, 'folder')
  const position = nextPosition(db, 'folders', 'parent_id', parentId)
  const result = db
    .prepare(
      'INSERT INTO folders (parent_id, name, position, created_at) VALUES (?, ?, ?, ?)',
    )
    .run(parentId, name, position, nowIso())
  return getFolder(db, Number(result.lastInsertRowid))
}

export function renameFolder(
  db: Database.Database = getDatabase(),
  id: number,
  rawName: string,
): void {
  const name = requireName(rawName, 'folder')
  const result = db.prepare('UPDATE folders SET name = ? WHERE id = ?').run(name, id)
  if (result.changes === 0) throw new Error('Folder not found')
}

export function moveFolder(
  db: Database.Database = getDatabase(),
  id: number,
  parentId: number | null,
): void {
  if (parentId === id) throw new Error('A folder cannot be moved into itself')
  if (parentId !== null && folderDescendants(db, id).includes(parentId)) {
    throw new Error('A folder cannot be moved into its own child')
  }
  const result = db.prepare('UPDATE folders SET parent_id = ? WHERE id = ?').run(parentId, id)
  if (result.changes === 0) throw new Error('Folder not found')
}

export function deleteFolder(db: Database.Database = getDatabase(), id: number): void {
  const result = db.prepare('DELETE FROM folders WHERE id = ?').run(id)
  if (result.changes === 0) throw new Error('Folder not found')
}

export function listFolders(db: Database.Database = getDatabase()): Folder[] {
  const rows = db
    .prepare('SELECT id, parent_id, name, position FROM folders ORDER BY position, name')
    .all() as FolderRow[]
  return rows.map(mapFolder)
}

export function folderDescendants(
  db: Database.Database = getDatabase(),
  id: number,
): number[] {
  const children = new Map<number | null, number[]>()
  for (const folder of listFolders(db)) {
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

export function createDeck(
  db: Database.Database = getDatabase(),
  folderId: number | null,
  rawName: string,
): Deck {
  const name = requireName(rawName, 'deck')
  const position = nextPosition(db, 'decks', 'folder_id', folderId)
  const result = db
    .prepare(
      'INSERT INTO decks (folder_id, name, position, created_at) VALUES (?, ?, ?, ?)',
    )
    .run(folderId, name, position, nowIso())
  return getDeck(db, Number(result.lastInsertRowid))
}

export function renameDeck(
  db: Database.Database = getDatabase(),
  id: number,
  rawName: string,
): void {
  const name = requireName(rawName, 'deck')
  const result = db.prepare('UPDATE decks SET name = ? WHERE id = ?').run(name, id)
  if (result.changes === 0) throw new Error('Deck not found')
}

export function moveDeck(
  db: Database.Database = getDatabase(),
  id: number,
  folderId: number | null,
): void {
  const result = db.prepare('UPDATE decks SET folder_id = ? WHERE id = ?').run(folderId, id)
  if (result.changes === 0) throw new Error('Deck not found')
}

export function deleteDeck(db: Database.Database = getDatabase(), id: number): void {
  const result = db.prepare('DELETE FROM decks WHERE id = ?').run(id)
  if (result.changes === 0) throw new Error('Deck not found')
}

export function getDeck(db: Database.Database = getDatabase(), id: number): Deck {
  const row = db
    .prepare('SELECT id, folder_id, name, position FROM decks WHERE id = ?')
    .get(id) as DeckRow | undefined
  if (!row) throw new Error('Deck not found')
  return mapDeck(row)
}

export function listDecks(db: Database.Database = getDatabase()): Deck[] {
  const rows = db
    .prepare('SELECT id, folder_id, name, position FROM decks ORDER BY position, name')
    .all() as DeckRow[]
  return rows.map(mapDeck)
}

export function createCard(
  db: Database.Database = getDatabase(),
  deckId: number,
  card: NewCard,
): Card {
  const front = requireFront(card.front)
  const position = nextPosition(db, 'cards', 'deck_id', deckId)
  const result = db
    .prepare(
      `INSERT INTO cards
       (deck_id, front, back, highlights, position, created_at, status, ease,
        interval_days, due_at, reps, lapses, streak, learning_step)
       VALUES (?, ?, ?, ?, ?, ?, 'new', 2.5, 0, NULL, 0, 0, 0, 0)`,
    )
    .run(deckId, front, card.back, JSON.stringify(card.highlights), position, nowIso())
  return getCard(db, Number(result.lastInsertRowid))
}

export function updateCard(
  db: Database.Database = getDatabase(),
  id: number,
  card: NewCard,
): void {
  const front = requireFront(card.front)
  const result = db
    .prepare('UPDATE cards SET front = ?, back = ?, highlights = ? WHERE id = ?')
    .run(front, card.back, JSON.stringify(card.highlights), id)
  if (result.changes === 0) throw new Error('Card not found')
}

export function deleteCard(db: Database.Database = getDatabase(), id: number): void {
  const result = db.prepare('DELETE FROM cards WHERE id = ?').run(id)
  if (result.changes === 0) throw new Error('Card not found')
}

export function getCard(db: Database.Database = getDatabase(), id: number): Card {
  const row = db.prepare(`${CARD_SELECT} WHERE id = ?`).get(id) as CardRow | undefined
  if (!row) throw new Error('Card not found')
  return mapCard(row)
}

export function listCards(db: Database.Database = getDatabase(), deckId: number): Card[] {
  const rows = db
    .prepare(`${CARD_SELECT} WHERE deck_id = ? ORDER BY position, id`)
    .all(deckId) as CardRow[]
  return rows.map(mapCard)
}

export function saveCardSrs(db: Database.Database = getDatabase(), card: Card): void {
  const result = db
    .prepare(
      `UPDATE cards SET status = ?, ease = ?, interval_days = ?, due_at = ?, reps = ?,
       lapses = ?, streak = ?, learning_step = ?, last_reviewed_at = ? WHERE id = ?`,
    )
    .run(
      card.status,
      card.ease,
      card.intervalDays,
      card.dueAt,
      card.reps,
      card.lapses,
      card.streak,
      card.learningStep,
      card.lastReviewedAt,
      card.id,
    )
  if (result.changes === 0) throw new Error('Card not found')
}

export function recordReview(
  db: Database.Database = getDatabase(),
  cardId: number,
  correct: boolean,
  reviewedAt = new Date(),
): void {
  db.prepare('INSERT INTO reviews (card_id, correct, reviewed_at) VALUES (?, ?, ?)').run(
    cardId,
    correct ? 1 : 0,
    reviewedAt.toISOString(),
  )
}

export function listReviews(db: Database.Database = getDatabase()): Review[] {
  const rows = db
    .prepare('SELECT id, card_id, correct, reviewed_at FROM reviews ORDER BY id')
    .all() as Array<{ id: number; card_id: number; correct: number; reviewed_at: string }>
  return rows.map((row) => ({
    id: row.id,
    cardId: row.card_id,
    correct: row.correct === 1,
    reviewedAt: row.reviewed_at,
  }))
}

export function importCards(
  db: Database.Database = getDatabase(),
  deckId: number,
  cards: NewCard[],
): number {
  return db.transaction(() => {
    let count = 0
    for (const card of cards) {
      if (!card.front.trim()) continue
      createCard(db, deckId, card)
      count += 1
    }
    return count
  })()
}

export function dueCards(
  db: Database.Database = getDatabase(),
  deckId: number,
  now = new Date(),
): Card[] {
  return listCards(db, deckId).filter((card) => isDue(card, now))
}

export function getLibrarySnapshot(db: Database.Database = getDatabase()): LibrarySnapshot {
  const folders = listFolders(db)
  const decks = listDecks(db)
  const rows = db.prepare(`${CARD_SELECT} ORDER BY deck_id, position, id`).all() as CardRow[]
  const cardsByDeck: Record<number, Card[]> = {}
  const statsByDeck: Record<number, DeckStats> = {}
  const now = new Date()

  for (const deck of decks) {
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
  return { folders, decks, cardsByDeck, statsByDeck }
}

function getFolder(db: Database.Database, id: number): Folder {
  const row = db
    .prepare('SELECT id, parent_id, name, position FROM folders WHERE id = ?')
    .get(id) as FolderRow | undefined
  if (!row) throw new Error('Folder not found')
  return mapFolder(row)
}

function mapFolder(row: FolderRow): Folder {
  return { id: row.id, parentId: row.parent_id, name: row.name, position: row.position }
}

function mapDeck(row: DeckRow): Deck {
  return { id: row.id, folderId: row.folder_id, name: row.name, position: row.position }
}

function mapCard(row: CardRow): Card {
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
    deckId: row.deck_id,
    front: row.front,
    back: row.back,
    highlights,
    position: row.position,
    status: validStatus,
    ease: row.ease,
    intervalDays: row.interval_days,
    dueAt: row.due_at,
    reps: row.reps,
    lapses: row.lapses,
    streak: row.streak,
    learningStep: row.learning_step,
    lastReviewedAt: row.last_reviewed_at,
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

function nextPosition(
  db: Database.Database,
  table: 'folders' | 'decks' | 'cards',
  parentColumn: 'parent_id' | 'folder_id' | 'deck_id',
  parentId: number | null,
): number {
  const row = db
    .prepare(
      `SELECT COALESCE(MAX(position), -1) + 1 AS position FROM ${table} WHERE ${parentColumn} IS ?`,
    )
    .get(parentId) as { position: number }
  return row.position
}

function nowIso(): string {
  return new Date().toISOString()
}

function capitalize(value: string): string {
  return value[0]!.toUpperCase() + value.slice(1)
}

const CARD_SELECT = `SELECT id, deck_id, front, back, highlights, position, status, ease,
  interval_days, due_at, reps, lapses, streak, learning_step, last_reviewed_at FROM cards`
