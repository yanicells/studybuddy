import { describe, expect, it } from 'vitest'

import {
  initialPickerSelection,
  parseSkippedDecks,
  rememberSkippedDecks,
} from './studyPickerMemory'

describe('study picker memory', () => {
  it('starts with remembered decks unchecked, ignoring ids that no longer exist', () => {
    expect(initialPickerSelection(['a', 'b', 'c'], ['b', 'gone'])).toEqual(new Set(['a', 'c']))
  })

  it('checks every deck when the remembered choice would leave nothing selected', () => {
    expect(initialPickerSelection(['a', 'b'], ['a', 'b'])).toEqual(new Set(['a', 'b']))
  })

  it('moves the latest source to the end, forgets fully checked sources, and caps the list', () => {
    const saved = { library: ['a'], 'folder:1': ['b'] }
    expect(Object.keys(rememberSkippedDecks(saved, 'library', ['c']))).toEqual(['folder:1', 'library'])
    expect(rememberSkippedDecks(saved, 'library', [])).toEqual({ 'folder:1': ['b'] })

    const many = Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`folder:${i}`, ['x']]))
    const capped = rememberSkippedDecks(many, 'library', ['a'])
    expect(Object.keys(capped)).toHaveLength(50)
    expect(capped['folder:0']).toBeUndefined()
    expect(capped.library).toEqual(['a'])
  })

  it('reads malformed or tampered storage as nothing remembered', () => {
    expect(parseSkippedDecks(null)).toEqual({})
    expect(parseSkippedDecks('not json')).toEqual({})
    expect(parseSkippedDecks('["a"]')).toEqual({})
    expect(parseSkippedDecks('{"library":["a",1,"<b>"],"folder:1":"x"}')).toEqual({ library: ['a'] })
  })
})
