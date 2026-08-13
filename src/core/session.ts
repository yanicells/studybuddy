import type { Card } from './types'

interface Track {
  correct: number
  wrong: number
  masteredAtStart: boolean
  retired: boolean
}

export class Session {
  readonly total: number
  private readonly startedWithNew: boolean
  private roundIndex = 1
  private pool: number[]
  private queue: number[] = []
  private waiting = new Map<number, number>()
  private track = new Map<number, Track>()
  private answeredThisRound = 0
  private sizeThisRound = 0

  constructor(cards: Card[]) {
    this.total = cards.length
    this.startedWithNew = cards.some((card) => card.status === 'new')
    this.pool = cards.map((card) => card.id)
    for (const card of cards) {
      this.track.set(card.id, {
        correct: 0,
        wrong: 0,
        masteredAtStart: card.status === 'mastered',
        retired: false,
      })
    }
    this.fillRound()
  }

  nextCard(): number | null {
    while (this.queue.length === 0) {
      if (this.pool.length > 0) {
        this.roundIndex += 1
        this.fillRound()
        continue
      }
      if (this.waiting.size === 0) return null
      const soonest = Math.min(...this.waiting.values())
      this.roundIndex = Math.max(this.roundIndex + 1, soonest)
      this.fillRound()
      if (this.queue.length === 0) return null
    }
    return this.queue.shift() ?? null
  }

  answer(cardId: number, correct: boolean): void {
    const item = this.track.get(cardId) ?? {
      correct: 0,
      wrong: 0,
      masteredAtStart: false,
      retired: false,
    }
    this.answeredThisRound += 1
    if (correct) {
      item.correct += 1
      if (shouldRetire(item)) item.retired = true
      else this.waiting.set(cardId, this.roundIndex + 2)
    } else {
      item.wrong += 1
      item.correct = 0
      this.waiting.set(cardId, this.roundIndex + 1)
    }
    this.track.set(cardId, item)
  }

  get round(): number {
    return this.roundIndex
  }

  get roundLength(): number {
    return this.sizeThisRound
  }

  get roundAnswered(): number {
    return this.answeredThisRound
  }

  get remaining(): number {
    return this.queue.length + this.pool.length + this.waiting.size
  }

  get completed(): number {
    let count = 0
    for (const item of this.track.values()) {
      if (item.retired) count += 1
    }
    return count
  }

  isWaiting(cardId: number): boolean {
    return this.waiting.has(cardId)
  }

  cardHits(cardId: number): [number, number] {
    const item = this.track.get(cardId) ?? {
      correct: 0,
      wrong: 0,
      masteredAtStart: false,
      retired: false,
    }
    const needed = hitsNeeded(item)
    return [Math.min(item.correct, needed), needed]
  }

  private fillRound(): void {
    const size = roundSize(this.roundIndex, this.startedWithNew)
    const next: number[] = []
    const due = [...this.waiting.entries()]
      .filter(([, dueRound]) => dueRound <= this.roundIndex)
      .sort((left, right) => left[1] - right[1] || left[0] - right[0])
    for (const [id] of due) {
      if (next.length >= size) break
      this.waiting.delete(id)
      next.push(id)
    }
    while (next.length < size && this.pool.length > 0) {
      next.push(this.pool.shift()!)
    }
    this.queue = next
    this.sizeThisRound = next.length
    this.answeredThisRound = 0
  }
}

function roundSize(round: number, startedWithNew: boolean): number {
  if (round === 1) return startedWithNew ? 8 : 12
  if (round === 2) return 12
  if (round === 3) return 15
  return 20
}

function hitsNeeded(item: Track): number {
  if (item.masteredAtStart && item.wrong === 0) return 1
  return 2
}

function shouldRetire(item: Track): boolean {
  return item.correct >= hitsNeeded(item)
}
