import { describe, expect, it } from 'vitest'

import { markSpans, parseCards, stripMarks, wrapMarks } from './import'

describe('card import', () => {
  it('parses blank-line-separated cards with bullet backs', () => {
    const cards = parseCards(
      'Front side\n- first answer\n- second answer\n\nSecond card\n- answer\n',
    )

    expect(cards).toHaveLength(2)
    expect(cards[0]).toMatchObject({
      front: 'Front side',
      back: 'first answer\nsecond answer',
    })
    expect(cards[1]?.highlights).toContainEqual({ side: 'back', text: 'answer' })
  })

  it('uses the first line as front when there are no bullets', () => {
    expect(parseCards('What is 2+2?\n4\n')[0]).toMatchObject({
      front: 'What is 2+2?',
      back: '4',
    })
  })

  it('extracts explicit cloze marks without changing visible text', () => {
    const [card] = parseCards(
      'The ==mitochondria== is the powerhouse of the cell\n- mitochondria',
    )

    expect(card?.front).toBe('The mitochondria is the powerhouse of the cell')
    expect(card?.highlights).toContainEqual({ side: 'front', text: 'mitochondria' })
  })

  it('round-trips known editor marks', () => {
    expect(stripMarks('The ==mitochondria== works')).toEqual({
      text: 'The mitochondria works',
      highlights: ['mitochondria'],
    })
    expect(wrapMarks('The mitochondria works', ['mitochondria'])).toBe(
      'The ==mitochondria== works',
    )
  })

  it('marks every non-overlapping phrase for display', () => {
    expect(markSpans('Attributes visible to a programmer', ['visible to a programmer'])).toEqual([
      { text: 'Attributes ', highlighted: false },
      { text: 'visible to a programmer', highlighted: true },
    ])
  })
})
