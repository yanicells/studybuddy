import { describe, expect, it } from 'vitest'

import { dropSibling, moveSibling } from './reorder'

describe('sibling reorder', () => {
  it('moves a sibling up or down one step', () => {
    expect(moveSibling(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c'])
    expect(moveSibling(['a', 'b', 'c'], 'b', 1)).toEqual(['a', 'c', 'b'])
  })

  it('refuses to move past either edge', () => {
    expect(moveSibling(['a', 'b'], 'a', -1)).toBeNull()
    expect(moveSibling(['a', 'b'], 'b', 1)).toBeNull()
    expect(moveSibling(['a', 'b'], 'missing', 1)).toBeNull()
  })

  it('drops the dragged sibling before or after the target', () => {
    expect(dropSibling(['a', 'b', 'c'], 'a', 'c', false)).toEqual(['b', 'a', 'c'])
    expect(dropSibling(['a', 'b', 'c'], 'a', 'c', true)).toEqual(['b', 'c', 'a'])
    expect(dropSibling(['a', 'b', 'c'], 'c', 'a', false)).toEqual(['c', 'a', 'b'])
  })

  it('ignores drops onto itself or unknown ids', () => {
    expect(dropSibling(['a', 'b'], 'a', 'a', true)).toBeNull()
    expect(dropSibling(['a', 'b'], 'a', 'missing', false)).toBeNull()
    expect(dropSibling(['a', 'b'], 'missing', 'a', false)).toBeNull()
  })
})
