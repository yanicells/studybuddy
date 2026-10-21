import { EMPTY_STATS, type Deck, type DeckStats, type Folder, type LibrarySnapshot } from './types'

/** A local calendar day as ISO timestamps, `start` inclusive and `end` exclusive. */
export interface DayRange {
  start: string
  end: string
}

/** The local day containing `date`, shaped for an indexed range read on review times. */
export function localDay(date: Date): DayRange {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
  return { start: start.toISOString(), end: end.toISOString() }
}

/**
 * Counts consecutive days with at least one review, ending today, or yesterday if today
 * has none yet. It asks `studiedOn` about one day at a time, so the caller only reads
 * as many days as the streak is long.
 */
export async function studyStreak(
  now: Date,
  studiedOn: (day: DayRange) => Promise<boolean>,
): Promise<number> {
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let streak = (await studiedOn(localDay(cursor))) ? 1 : 0
  cursor.setDate(cursor.getDate() - 1)
  while (await studiedOn(localDay(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

export function sumStats(statsByDeck: Record<string, DeckStats>): DeckStats {
  const total = { ...EMPTY_STATS }
  for (const stats of Object.values(statsByDeck)) {
    total.new += stats.new
    total.learning += stats.learning
    total.mastered += stats.mastered
    total.due += stats.due
  }
  return total
}

export function folderPath(folders: Folder[], startId: string | null): string[] {
  const parents = new Map(folders.map((folder) => [folder.id, folder.parentId]))
  const ids: string[] = []
  let current = startId
  while (current !== null) {
    ids.push(current)
    current = parents.get(current) ?? null
  }
  return ids
}

export function descendantDeckIds(library: LibrarySnapshot, folderId: string): string[] {
  const children = new Map<string | null, string[]>()
  for (const folder of library.folders) {
    const siblings = children.get(folder.parentId) ?? []
    siblings.push(folder.id)
    children.set(folder.parentId, siblings)
  }
  const folderIds = new Set<string>([folderId])
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

export function rollupStats(library: LibrarySnapshot, deckIds: string[]): DeckStats {
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
