import { createServerFn } from '@tanstack/react-start'

import { heuristicHighlights, parseCards, stripMarks } from '../../core/import'
import type { Highlight, NewCard } from '../../core/types'
import {
  cardSchema,
  idSchema,
  importSchema,
  moveSchema,
  nameSchema,
  recordAnswerSchema,
  startStudySchema,
} from './library.schemas'

export const getLibraryFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { api, getConvex } = await import('../../server/convex.server')
  const convex = getConvex()
  await convex.mutation(api.seed.seedSampleIfMissing, {})
  return convex.query(api.library.getSnapshot, {})
})

export const createFolderFn = createServerFn({ method: 'POST' })
  .validator(nameSchema)
  .handler(async ({ data }) => {
    const { api, asId, getConvex } = await import('../../server/convex.server')
    const folder = await getConvex().mutation(api.library.createFolder, {
      parentId: data.parentId === null ? null : asId<'folders'>(data.parentId),
      name: data.name,
    })
    return { ok: true as const, id: folder.id }
  })

export const renameFolderFn = createServerFn({ method: 'POST' })
  .validator(nameSchema)
  .handler(async ({ data }) => {
    if (data.id === null) throw new Error('Folder id is required')
    const { api, asId, getConvex } = await import('../../server/convex.server')
    await getConvex().mutation(api.library.renameFolder, {
      id: asId<'folders'>(data.id),
      name: data.name,
    })
    return { ok: true as const }
  })

export const moveFolderFn = createServerFn({ method: 'POST' })
  .validator(moveSchema)
  .handler(async ({ data }) => {
    const { api, asId, getConvex } = await import('../../server/convex.server')
    await getConvex().mutation(api.library.moveFolder, {
      id: asId<'folders'>(data.id),
      parentId: data.parentId === null ? null : asId<'folders'>(data.parentId),
    })
    return { ok: true as const }
  })

export const deleteFolderFn = createServerFn({ method: 'POST' })
  .validator(idSchema)
  .handler(async ({ data }) => {
    const { api, asId, getConvex } = await import('../../server/convex.server')
    await getConvex().mutation(api.library.deleteFolder, { id: asId<'folders'>(data.id) })
    return { ok: true as const }
  })

export const createDeckFn = createServerFn({ method: 'POST' })
  .validator(nameSchema)
  .handler(async ({ data }) => {
    const { api, asId, getConvex } = await import('../../server/convex.server')
    const deck = await getConvex().mutation(api.library.createDeck, {
      folderId: data.parentId === null ? null : asId<'folders'>(data.parentId),
      name: data.name,
    })
    return { ok: true as const, id: deck.id }
  })

export const renameDeckFn = createServerFn({ method: 'POST' })
  .validator(nameSchema)
  .handler(async ({ data }) => {
    if (data.id === null) throw new Error('Deck id is required')
    const { api, asId, getConvex } = await import('../../server/convex.server')
    await getConvex().mutation(api.library.renameDeck, {
      id: asId<'decks'>(data.id),
      name: data.name,
    })
    return { ok: true as const }
  })

export const moveDeckFn = createServerFn({ method: 'POST' })
  .validator(moveSchema)
  .handler(async ({ data }) => {
    const { api, asId, getConvex } = await import('../../server/convex.server')
    await getConvex().mutation(api.library.moveDeck, {
      id: asId<'decks'>(data.id),
      folderId: data.parentId === null ? null : asId<'folders'>(data.parentId),
    })
    return { ok: true as const }
  })

export const deleteDeckFn = createServerFn({ method: 'POST' })
  .validator(idSchema)
  .handler(async ({ data }) => {
    const { api, asId, getConvex } = await import('../../server/convex.server')
    await getConvex().mutation(api.library.deleteDeck, { id: asId<'decks'>(data.id) })
    return { ok: true as const }
  })

export const saveCardFn = createServerFn({ method: 'POST' })
  .validator(cardSchema)
  .handler(async ({ data }) => {
    const { api, asId, getConvex } = await import('../../server/convex.server')
    const convex = getConvex()
    const card = cardFromEditor(data.front, data.back)
    if (data.id === null) {
      const created = await convex.mutation(api.library.createCard, {
        deckId: asId<'decks'>(data.deckId),
        card,
      })
      return { ok: true as const, id: created.id }
    }
    await convex.mutation(api.library.updateCard, { id: asId<'cards'>(data.id), card })
    return { ok: true as const, id: data.id }
  })

export const deleteCardFn = createServerFn({ method: 'POST' })
  .validator(idSchema)
  .handler(async ({ data }) => {
    const { api, asId, getConvex } = await import('../../server/convex.server')
    await getConvex().mutation(api.library.deleteCard, { id: asId<'cards'>(data.id) })
    return { ok: true as const }
  })

export const importCardsFn = createServerFn({ method: 'POST' })
  .validator(importSchema)
  .handler(async ({ data }) => {
    const [{ api, asId, getConvex }, { fillMissingKeywords }] = await Promise.all([
      import('../../server/convex.server'),
      import('../../server/openai.server'),
    ])
    const cards = parseCards(data.text)
    if (cards.length === 0) {
      throw new Error('No cards found. Use a front line, then - back lines.')
    }

    let notice: string | undefined
    try {
      await fillMissingKeywords(cards)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'request failed'
      notice = `Imported without AI keywords (${message})`
    }

    const convex = getConvex()
    const deckId =
      data.deckId ??
      (
        await convex.mutation(api.library.createDeck, {
          folderId: data.folderId === null ? null : asId<'folders'>(data.folderId),
          name: 'Imported',
        })
      ).id
    const count = await convex.mutation(api.library.importCards, {
      deckId: asId<'decks'>(deckId),
      cards,
    })
    return { ok: true as const, count, deckId, notice }
  })

export const startStudyFn = createServerFn({ method: 'POST' })
  .validator(startStudySchema)
  .handler(async ({ data }) => {
    const { api, asId, getConvex } = await import('../../server/convex.server')
    return getConvex().query(api.library.startStudy, { deckId: asId<'decks'>(data.deckId) })
  })

export const recordAnswerFn = createServerFn({ method: 'POST' })
  .validator(recordAnswerSchema)
  .handler(async ({ data }) => {
    const { api, asId, getConvex } = await import('../../server/convex.server')
    return getConvex().mutation(api.library.recordAnswer, {
      cardId: asId<'cards'>(data.cardId),
      correct: data.correct,
    })
  })

function cardFromEditor(frontInput: string, backInput: string): NewCard {
  const front = stripMarks(frontInput)
  const back = stripMarks(backInput)
  const highlights: Highlight[] = [
    ...front.highlights.map((text) => ({ side: 'front' as const, text })),
    ...back.highlights.map((text) => ({ side: 'back' as const, text })),
  ]
  return {
    front: front.text,
    back: back.text,
    highlights:
      highlights.length > 0 ? highlights : heuristicHighlights(front.text, back.text),
  }
}
