import { describe, expect, it } from 'vitest'

import { parseExpandedFolders, serializeExpandedFolders } from './expandedFolders'

describe('expanded folder cookie', () => {
  it('round-trips the open folders and keeps an empty selection distinct from none', () => {
    expect(parseExpandedFolders(serializeExpandedFolders(['folder1', 'folder2']))).toEqual(
      new Set(['folder1', 'folder2']),
    )
    expect(parseExpandedFolders('')).toEqual(new Set())
    expect(parseExpandedFolders(undefined)).toBeNull()
  })

  it('drops values that are not folder ids', () => {
    expect(parseExpandedFolders('folder1.<script>.%20')).toEqual(new Set(['folder1']))
  })
})
