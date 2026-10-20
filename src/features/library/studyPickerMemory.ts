import type { StudySource } from '../../core/studyScope'

const KEY = 'studybuddy-study-picker'
const MAX_SOURCES = 50

/** Deck ids left unchecked per study source key, oldest first so the cap drops stale sources. */
export type SkippedDecks = Record<string, string[]>

/**
 * The decks the user unchecked the last time they studied this source.
 * Only unchecked decks are kept, so decks added later start checked.
 */
export function readSkippedDecks(source: StudySource): string[] {
  return parseSkippedDecks(storageGet())[sourceKey(source)] ?? []
}

export function saveSkippedDecks(source: StudySource, skippedIds: string[]) {
  const saved = parseSkippedDecks(storageGet())
  storageSet(JSON.stringify(rememberSkippedDecks(saved, sourceKey(source), skippedIds)))
}

/** Starts every deck checked except the remembered ones, unless that would leave nothing to study. */
export function initialPickerSelection(sourceDeckIds: string[], skippedIds: string[]): Set<string> {
  const skipped = new Set(skippedIds)
  const selected = sourceDeckIds.filter((id) => !skipped.has(id))
  return new Set(selected.length > 0 ? selected : sourceDeckIds)
}

/** Moves the source to the most recent slot and keeps only the newest `MAX_SOURCES`. */
export function rememberSkippedDecks(
  saved: SkippedDecks,
  key: string,
  skippedIds: string[],
): SkippedDecks {
  const entries = Object.entries(saved).filter(([savedKey]) => savedKey !== key)
  if (skippedIds.length > 0) entries.push([key, skippedIds])
  return Object.fromEntries(entries.slice(-MAX_SOURCES))
}

export function parseSkippedDecks(value: string | null): SkippedDecks {
  if (!value) return {}
  try {
    const parsed: unknown = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const result: SkippedDecks = {}
    for (const [key, ids] of Object.entries(parsed).slice(-MAX_SOURCES)) {
      if (!Array.isArray(ids)) continue
      result[key] = ids.filter((id): id is string => typeof id === 'string' && /^\w+$/.test(id))
    }
    return result
  } catch {
    return {}
  }
}

function sourceKey(source: StudySource): string {
  return source.kind === 'library' ? 'library' : `${source.kind}:${source.id}`
}

// Storage can be missing or throw (private mode, quota); the picker just falls back to all checked.
function storageGet(): string | null {
  try {
    return window.localStorage.getItem(KEY)
  } catch {
    return null
  }
}

function storageSet(value: string) {
  try {
    window.localStorage.setItem(KEY, value)
  } catch {
    // Remembering the choice is a convenience; ignore storage failures.
  }
}
