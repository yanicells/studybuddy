import { describe, expect, it } from 'vitest'

import { backBlocks, contentBlocks, stripBullet, withBulletPrefix } from './blocks'

describe('markdown blocks', () => {
  it('groups consecutive bullet lines', () => {
    expect(contentBlocks('Intro\n- first\n* second\nClose')).toEqual([
      { kind: 'p', text: 'Intro' },
      { kind: 'ul', items: ['first', 'second'] },
      { kind: 'p', text: 'Close' },
    ])
  })

  it('treats unmarked back lines as a list', () => {
    expect(backBlocks('first answer\nsecond answer')).toEqual([
      { kind: 'ul', items: ['first answer', 'second answer'] },
    ])
  })

  it('prefixes missing bullets for the editor', () => {
    expect(withBulletPrefix('alpha\n- beta')).toBe('- alpha\n- beta')
    expect(stripBullet('- mitochondria')).toBe('mitochondria')
  })
})
