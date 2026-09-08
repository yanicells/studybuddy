import { z } from 'zod'

const id = z.string().min(1)
const nullableId = id.nullable()
const name = z.string().trim().min(1).max(120)

export const nameSchema = z.object({
  id: nullableId,
  parentId: nullableId,
  name,
})

export const idSchema = z.object({ id })

export const moveSchema = z.object({
  id,
  parentId: nullableId,
})

export const reorderSchema = z.object({
  parentId: nullableId,
  orderedIds: z.array(id).max(1000),
})

export const cardSchema = z.object({
  id: nullableId,
  deckId: id,
  front: z.string().trim().min(1).max(50_000),
  back: z.string().max(50_000),
})

export const importSchema = z.object({
  deckId: nullableId,
  folderId: nullableId,
  text: z.string().trim().min(1).max(500_000),
})

export const startStudySchema = z.object({
  deckIds: z
    .array(id)
    .min(1)
    .max(1000)
    .refine((ids) => new Set(ids).size === ids.length, 'Deck ids must be unique'),
  mode: z.enum(['due', 'all']),
})

export const recordAnswerSchema = z.object({
  cardId: id,
  correct: z.boolean(),
})
