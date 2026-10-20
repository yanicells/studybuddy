import { stripBullet } from './blocks'
import { folderPath } from './stats'
import type { Folder, LibrarySnapshot } from './types'

export type SearchResult =
  | { kind: 'folder' | 'deck'; id: string; name: string; path: string }
  | { kind: 'card'; id: string; deckId: string; deckName: string; snippet: string }

const SNIPPET_LENGTH = 90
const SNIPPET_LEAD = 30
// Folder and deck name ranks use 0-7, so card matches always sort after them.
const CARD_FRONT_RANK = 8
const CARD_BACK_RANK = 9

/**
 * Case-insensitive search over folder and deck names and card text.
 * Folders and decks come first, ranked exact, prefix, word start, then substring.
 * Cards follow, front-side matches before back-side ones.
 */
export function searchLibrary(library: LibrarySnapshot, query: string, limit = 20): SearchResult[] {
  const needle = normalize(query).toLocaleLowerCase()
  if (!needle) return []

  const ranked: Array<{ rank: number; result: SearchResult }> = []
  for (const folder of library.folders) {
    const rank = nameRank(folder.name, needle)
    if (rank === null) continue
    const path = parentPath(library.folders, folder.parentId)
    // Folders win ties with decks of the same match quality.
    ranked.push({ rank: rank * 2, result: { kind: 'folder', id: folder.id, name: folder.name, path } })
  }
  for (const deck of library.decks) {
    const rank = nameRank(deck.name, needle)
    if (rank === null) continue
    const path = parentPath(library.folders, deck.folderId)
    ranked.push({ rank: rank * 2 + 1, result: { kind: 'deck', id: deck.id, name: deck.name, path } })
  }
  for (const deck of library.decks) {
    for (const card of library.cardsByDeck[deck.id] ?? []) {
      const match = findMatch(card.front, needle, CARD_FRONT_RANK) ?? findMatch(card.back, needle, CARD_BACK_RANK)
      if (!match) continue
      ranked.push({
        rank: match.rank,
        result: { kind: 'card', id: card.id, deckId: deck.id, deckName: deck.name, snippet: match.snippet },
      })
    }
  }
  // Array sort is stable, so equal ranks keep library order.
  return ranked
    .sort((left, right) => left.rank - right.rank)
    .slice(0, limit)
    .map(({ result }) => result)
}

/** Card text as one line: bullet markers dropped, lines joined with a middle dot. */
function plainText(text: string): string {
  return text
    .split(/\r?\n/)
    .map(stripBullet)
    .filter(Boolean)
    .map(normalize)
    .join(' · ')
}

function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/** Lower is better; null when the name doesn't match. */
function nameRank(name: string, needle: string): number | null {
  const lower = normalize(name).toLocaleLowerCase()
  const index = lower.indexOf(needle)
  if (index < 0) return null
  if (lower === needle) return 0
  if (index === 0) return 1
  if (` ${lower}`.includes(` ${needle}`)) return 2
  return 3
}

/** Parent folder names from the top, e.g. "Biology / Cells"; "Library" at the root. */
function parentPath(folders: Folder[], parentId: string | null): string {
  if (parentId === null) return 'Library'
  const names = new Map(folders.map((folder) => [folder.id, folder.name]))
  return folderPath(folders, parentId)
    .reverse()
    .map((id) => names.get(id) ?? '')
    .join(' / ')
}

function findMatch(raw: string, needle: string, rank: number): { rank: number; snippet: string } | null {
  const text = plainText(raw)
  const index = text.toLocaleLowerCase().indexOf(needle)
  return index < 0 ? null : { rank, snippet: snippet(text, index) }
}

/** A short window of text that starts a little before the match. */
function snippet(text: string, index: number): string {
  if (text.length <= SNIPPET_LENGTH) return text
  const start = Math.max(0, Math.min(index - SNIPPET_LEAD, text.length - SNIPPET_LENGTH))
  const end = start + SNIPPET_LENGTH
  return `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`
}
