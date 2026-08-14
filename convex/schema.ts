import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

const highlight = v.object({
  side: v.union(v.literal('front'), v.literal('back')),
  text: v.string(),
})

export default defineSchema({
  folders: defineTable({
    parentId: v.union(v.id('folders'), v.null()),
    name: v.string(),
    position: v.number(),
    createdAt: v.string(),
  }).index('by_parent', ['parentId']),
  decks: defineTable({
    folderId: v.union(v.id('folders'), v.null()),
    name: v.string(),
    position: v.number(),
    createdAt: v.string(),
  }).index('by_folder', ['folderId']),
  cards: defineTable({
    deckId: v.id('decks'),
    front: v.string(),
    back: v.string(),
    highlights: v.array(highlight),
    position: v.number(),
    createdAt: v.string(),
    status: v.union(v.literal('new'), v.literal('learning'), v.literal('mastered')),
    ease: v.number(),
    intervalDays: v.number(),
    dueAt: v.union(v.string(), v.null()),
    reps: v.number(),
    lapses: v.number(),
    streak: v.number(),
    learningStep: v.number(),
    lastReviewedAt: v.union(v.string(), v.null()),
  }).index('by_deck', ['deckId']),
  reviews: defineTable({
    cardId: v.id('cards'),
    correct: v.boolean(),
    reviewedAt: v.string(),
  }).index('by_card', ['cardId']),
})
