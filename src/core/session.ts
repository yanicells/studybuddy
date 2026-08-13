import type { Card } from './types'

const FIRST_WAVE = 8
const NEXT_WAVE = 12
const MISS_GAP = 2
const FIRST_HIT_GAP = 3
const SECOND_HIT_GAP = 8

interface Progress {
  correct: number
  wrong: number
  masteredAtStart: boolean
}

export class Session {
  readonly total: number
  private queue: number[] = []
  private pool: number[]
  private progress = new Map<number, Progress>()
  private shown = 0
  private waves = 0

  constructor(cards: Card[]) {
    const priority = { learning: 0, new: 1, mastered: 2 } as const
    const sorted = [...cards].sort(
      (left, right) =>
        priority[left.status] - priority[right.status] || left.position - right.position,
    )
    this.total = sorted.length
    this.pool = sorted.map((card) => card.id)
    for (const card of sorted) {
      this.progress.set(card.id, {
        correct: 0,
        wrong: 0,
        masteredAtStart: card.status === 'mastered',
      })
    }
    this.introduceWave()
  }

  nextCard(): number | null {
    if (this.queue.length === 0) this.introduceWave()
    return this.queue.shift() ?? null
  }

  answer(cardId: number, correct: boolean): void {
    const progress = this.progress.get(cardId) ?? {
      correct: 0,
      wrong: 0,
      masteredAtStart: false,
    }
    if (correct) progress.correct += 1
    else progress.wrong += 1
    this.progress.set(cardId, progress)

    const done = progress.masteredAtStart ? correct : progress.correct >= 2
    if (!done) {
      const gap = correct
        ? progress.correct <= 1
          ? FIRST_HIT_GAP
          : SECOND_HIT_GAP
        : MISS_GAP
      this.queue.splice(Math.min(gap, this.queue.length), 0, cardId)
    }
    this.shown += 1
  }

  get answeredCount(): number {
    return this.shown
  }

  get remaining(): number {
    return this.queue.length + this.pool.length
  }

  get wave(): number {
    return Math.max(this.waves, 1)
  }

  get completed(): number {
    let count = 0
    for (const progress of this.progress.values()) {
      if (
        (progress.masteredAtStart && progress.correct >= 1) ||
        (!progress.masteredAtStart && progress.correct >= 2)
      ) {
        count += 1
      }
    }
    return count
  }

  cardHits(cardId: number): [number, number] {
    const progress = this.progress.get(cardId) ?? {
      correct: 0,
      wrong: 0,
      masteredAtStart: false,
    }
    const needed = progress.masteredAtStart ? 1 : 2
    return [Math.min(progress.correct, needed), needed]
  }

  private introduceWave(): boolean {
    if (this.pool.length === 0) return false
    const size = this.waves === 0 ? FIRST_WAVE : NEXT_WAVE
    this.queue.push(...this.pool.splice(0, size))
    this.waves += 1
    return true
  }
}
