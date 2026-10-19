import { createIsomorphicFn } from '@tanstack/react-start'
import { getCookie } from '@tanstack/react-start/server'

const COOKIE = 'studybuddy-open-folders'
const MAX_SAVED = 200

/**
 * The folders the user left open in the library rail, or null before anything is saved.
 * Kept in a cookie so the server renders the rail exactly as it was, without a flash.
 */
export const readExpandedFolders = createIsomorphicFn()
  .server(() => parseExpandedFolders(getCookie(COOKIE)))
  .client(() => parseExpandedFolders(documentCookie(COOKIE)))

export function saveExpandedFolders(folderIds: string[]) {
  const value = serializeExpandedFolders(folderIds)
  document.cookie = `${COOKIE}=${value}; path=/; max-age=31536000; samesite=lax`
}

export function serializeExpandedFolders(folderIds: string[]): string {
  return folderIds.slice(0, MAX_SAVED).join('.')
}

export function parseExpandedFolders(value: string | undefined): Set<string> | null {
  if (value === undefined) return null
  const ids = value.split('.').filter((id) => /^\w+$/.test(id))
  return new Set(ids.slice(0, MAX_SAVED))
}

function documentCookie(name: string): string | undefined {
  const prefix = `${name}=`
  return document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith(prefix))
    ?.slice(prefix.length)
}
