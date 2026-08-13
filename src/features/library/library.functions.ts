import { createServerFn } from '@tanstack/react-start'

import { heuristicHighlights, parseCards, stripMarks } from '../../core/import'
import { applyAnswer } from '../../core/srs'
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
  const [{ getDatabase }, { getLibrarySnapshot }, { seedSampleIfMissing }] =
    await Promise.all([
      import('../../server/database.server'),
      import('../../server/library.server'),
      import('../../server/seed.server'),
    ])
  const db = getDatabase()
  seedSampleIfMissing(db)
  return getLibrarySnapshot(db)
})

export const createFolderFn = createServerFn({ method: 'POST' })
  .validator(nameSchema)
  .handler(async ({ data }) => {
    const [{ getDatabase }, { createFolder }] = await Promise.all([
      import('../../server/database.server'),
      import('../../server/library.server'),
    ])
    const folder = createFolder(getDatabase(), data.parentId, data.name)
    return { ok: true as const, id: folder.id }
  })

export const renameFolderFn = createServerFn({ method: 'POST' })
  .validator(nameSchema)
  .handler(async ({ data }) => {
    if (data.id === null) throw new Error('Folder id is required')
    const [{ getDatabase }, { renameFolder }] = await Promise.all([
      import('../../server/database.server'),
      import('../../server/library.server'),
    ])
    renameFolder(getDatabase(), data.id, data.name)
    return { ok: true as const }
  })

export const moveFolderFn = createServerFn({ method: 'POST' })
  .validator(moveSchema)
  .handler(async ({ data }) => {
    const [{ getDatabase }, { moveFolder }] = await Promise.all([
      import('../../server/database.server'),
      import('../../server/library.server'),
    ])
    moveFolder(getDatabase(), data.id, data.parentId)
    return { ok: true as const }
  })

export const deleteFolderFn = createServerFn({ method: 'POST' })
  .validator(idSchema)
  .handler(async ({ data }) => {
    const [{ getDatabase }, { deleteFolder }] = await Promise.all([
      import('../../server/database.server'),
      import('../../server/library.server'),
    ])
    deleteFolder(getDatabase(), data.id)
    return { ok: true as const }
  })

export const createDeckFn = createServerFn({ method: 'POST' })
  .validator(nameSchema)
  .handler(async ({ data }) => {
    const [{ getDatabase }, { createDeck }] = await Promise.all([
      import('../../server/database.server'),
      import('../../server/library.server'),
    ])
    const deck = createDeck(getDatabase(), data.parentId, data.name)
    return { ok: true as const, id: deck.id }
  })

export const renameDeckFn = createServerFn({ method: 'POST' })
  .validator(nameSchema)
  .handler(async ({ data }) => {
    if (data.id === null) throw new Error('Deck id is required')
    const [{ getDatabase }, { renameDeck }] = await Promise.all([
      import('../../server/database.server'),
      import('../../server/library.server'),
    ])
    renameDeck(getDatabase(), data.id, data.name)
    return { ok: true as const }
  })

export const moveDeckFn = createServerFn({ method: 'POST' })
  .validator(moveSchema)
  .handler(async ({ data }) => {
    const [{ getDatabase }, { moveDeck }] = await Promise.all([
      import('../../server/database.server'),
      import('../../server/library.server'),
    ])
    moveDeck(getDatabase(), data.id, data.parentId)
    return { ok: true as const }
  })

export const deleteDeckFn = createServerFn({ method: 'POST' })
  .validator(idSchema)
  .handler(async ({ data }) => {
    const [{ getDatabase }, { deleteDeck }] = await Promise.all([
      import('../../server/database.server'),
      import('../../server/library.server'),
    ])
    deleteDeck(getDatabase(), data.id)
    return { ok: true as const }
  })

export const saveCardFn = createServerFn({ method: 'POST' })
  .validator(cardSchema)
  .handler(async ({ data }) => {
    const [{ getDatabase }, repository] = await Promise.all([
      import('../../server/database.server'),
      import('../../server/library.server'),
    ])
    const card = cardFromEditor(data.front, data.back)
    if (data.id === null) {
      const created = repository.createCard(getDatabase(), data.deckId, card)
      return { ok: true as const, id: created.id }
    }
    repository.updateCard(getDatabase(), data.id, card)
    return { ok: true as const, id: data.id }
  })

export const deleteCardFn = createServerFn({ method: 'POST' })
  .validator(idSchema)
  .handler(async ({ data }) => {
    const [{ getDatabase }, { deleteCard }] = await Promise.all([
      import('../../server/database.server'),
      import('../../server/library.server'),
    ])
    deleteCard(getDatabase(), data.id)
    return { ok: true as const }
  })

export const importCardsFn = createServerFn({ method: 'POST' })
  .validator(importSchema)
  .handler(async ({ data }) => {
    const [{ getDatabase }, repository, { fillMissingKeywords }] = await Promise.all([
      import('../../server/database.server'),
      import('../../server/library.server'),
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

    const db = getDatabase()
    const deckId =
      data.deckId ?? repository.createDeck(db, data.folderId, 'Imported').id
    const count = repository.importCards(db, deckId, cards)
    return { ok: true as const, count, deckId, notice }
  })

export const startStudyFn = createServerFn({ method: 'POST' })
  .validator(startStudySchema)
  .handler(async ({ data }) => {
    const [{ getDatabase }, { dueCards, listCards }] = await Promise.all([
      import('../../server/database.server'),
      import('../../server/library.server'),
    ])
    const db = getDatabase()
    return {
      dueCards: dueCards(db, data.deckId),
      deckCards: listCards(db, data.deckId),
    }
  })

export const recordAnswerFn = createServerFn({ method: 'POST' })
  .validator(recordAnswerSchema)
  .handler(async ({ data }) => {
    const [{ getDatabase }, repository] = await Promise.all([
      import('../../server/database.server'),
      import('../../server/library.server'),
    ])
    const db = getDatabase()
    return db.transaction(() => {
      const updated = applyAnswer(repository.getCard(db, data.cardId), data.correct)
      repository.saveCardSrs(db, updated)
      repository.recordReview(db, data.cardId, data.correct)
      return updated
    })()
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
