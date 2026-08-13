import { type AnySQLiteColumn, index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const folders = sqliteTable(
  'folders',
  {
    id: integer('id').primaryKey(),
    parentId: integer('parent_id').references((): AnySQLiteColumn => folders.id, {
      onDelete: 'cascade',
    }),
    name: text('name').notNull(),
    position: integer('position').notNull().default(0),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('idx_folders_parent').on(table.parentId)],
)

export const decks = sqliteTable(
  'decks',
  {
    id: integer('id').primaryKey(),
    folderId: integer('folder_id').references(() => folders.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    position: integer('position').notNull().default(0),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('idx_decks_folder').on(table.folderId)],
)

export const cards = sqliteTable(
  'cards',
  {
    id: integer('id').primaryKey(),
    deckId: integer('deck_id')
      .notNull()
      .references(() => decks.id, { onDelete: 'cascade' }),
    front: text('front').notNull(),
    back: text('back').notNull(),
    highlights: text('highlights').notNull().default('[]'),
    position: integer('position').notNull().default(0),
    createdAt: text('created_at').notNull(),
    status: text('status').notNull().default('new'),
    ease: real('ease').notNull().default(2.5),
    intervalDays: real('interval_days').notNull().default(0),
    dueAt: text('due_at'),
    reps: integer('reps').notNull().default(0),
    lapses: integer('lapses').notNull().default(0),
    streak: integer('streak').notNull().default(0),
    learningStep: integer('learning_step').notNull().default(0),
    lastReviewedAt: text('last_reviewed_at'),
  },
  (table) => [index('idx_cards_deck').on(table.deckId)],
)

export const reviews = sqliteTable('reviews', {
  id: integer('id').primaryKey(),
  cardId: integer('card_id')
    .notNull()
    .references(() => cards.id, { onDelete: 'cascade' }),
  correct: integer('correct').notNull(),
  reviewedAt: text('reviewed_at').notNull(),
})

export const schema = { folders, decks, cards, reviews }
