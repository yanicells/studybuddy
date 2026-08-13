import { EMPTY_STATS, type Deck, type DeckStats, type LibrarySnapshot } from './types'

export function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function reviewedToday(reviewTimes: string[], now = new Date()): number {
  const today = localDayKey(now)
  return reviewTimes.filter((time) => localDayKey(new Date(time)) === today).length
}

export function studyStreak(reviewTimes: string[], now = new Date()): number {
  const days = new Set(reviewTimes.map((time) => localDayKey(new Date(time))))
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (!days.has(localDayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1)
  }
  let streak = 0
  while (days.has(localDayKey(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

export function sumStats(statsByDeck: Record<number, DeckStats>): DeckStats {
  const total = { ...EMPTY_STATS }
  for (const stats of Object.values(statsByDeck)) {
    total.new += stats.new
    total.learning += stats.learning
    total.mastered += stats.mastered
    total.due += stats.due
  }
  return total
}

export function descendantDeckIds(library: LibrarySnapshot, folderId: number): number[] {
  const children = new Map<number | null, number[]>()
  for (const folder of library.folders) {
    const siblings = children.get(folder.parentId) ?? []
    siblings.push(folder.id)
    children.set(folder.parentId, siblings)
  }
  const folderIds = new Set<number>([folderId])
  const stack = [...(children.get(folderId) ?? [])]
  while (stack.length > 0) {
    const next = stack.pop()!
    folderIds.add(next)
    stack.push(...(children.get(next) ?? []))
  }
  return library.decks
    .filter((deck) => deck.folderId !== null && folderIds.has(deck.folderId))
    .map((deck) => deck.id)
}

export function rollupStats(library: LibrarySnapshot, deckIds: number[]): DeckStats {
  const total = { ...EMPTY_STATS }
  for (const id of deckIds) {
    const stats = library.statsByDeck[id]
    if (!stats) continue
    total.new += stats.new
    total.learning += stats.learning
    total.mastered += stats.mastered
    total.due += stats.due
  }
  return total
}

export function highestDueDeck(library: LibrarySnapshot): Deck | undefined {
  return library.decks
    .filter((deck) => (library.statsByDeck[deck.id]?.due ?? 0) > 0)
    .sort((left, right) => {
      const dueDelta = (library.statsByDeck[right.id]?.due ?? 0) - (library.statsByDeck[left.id]?.due ?? 0)
      return dueDelta || left.name.localeCompare(right.name)
    })[0]
}
