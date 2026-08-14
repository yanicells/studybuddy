import type { Card } from './types'

const DAY_MS = 86_400_000

export function applyAnswer(card: Card, correct: boolean, now = new Date()): Card {
  const next: Card = {
    ...card,
    highlights: card.highlights.map((highlight) => ({ ...highlight })),
    lastReviewedAt: now.toISOString(),
    reps: card.reps + 1,
  }

  if (!correct) {
    return {
      ...next,
      lapses: next.lapses + 1,
      streak: 0,
      learningStep: 0,
      status: 'learning',
      intervalDays: 0,
      dueAt: now.toISOString(),
      ease: Math.max(1.3, round(next.ease - 0.2)),
    }
  }

  next.streak += 1
  if (next.status === 'new' || next.status === 'learning') {
    next.status = 'learning'
    next.learningStep += 1
    if (next.streak >= 2) {
      next.status = 'mastered'
      next.intervalDays = 1
      next.ease = Math.max(2.5, next.ease)
      next.dueAt = addDays(now, 1)
    } else {
      next.dueAt = now.toISOString()
    }
    return next
  }

  if (next.intervalDays < 1) next.intervalDays = 1
  else if (next.intervalDays < 3) next.intervalDays = 3
  else next.intervalDays = round(next.intervalDays * next.ease)
  next.ease = Math.min(3, round(next.ease + 0.1))
  next.dueAt = addDays(now, fuzzedInterval(next.id, next.intervalDays))
  return next
}

function fuzzedInterval(cardId: string, intervalDays: number): number {
  if (intervalDays < 3) return intervalDays
  const offset = ((idSeed(cardId) + Math.round(intervalDays * 7)) % 3) - 1
  return Math.max(1, intervalDays + offset)
}

function idSeed(id: string): number {
  let hash = 0
  for (let index = 0; index < id.length; index += 1) {
    hash = Math.imul(hash, 31) + id.charCodeAt(index)
  }
  return Math.abs(hash)
}

function addDays(date: Date, days: number): string {
  return new Date(date.getTime() + Math.round(days * DAY_MS)).toISOString()
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000
}
