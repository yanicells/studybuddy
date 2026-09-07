import type { DeckStats } from '../core/types'

export function StackedProgress({ stats }: Readonly<{ stats: DeckStats }>) {
  const total = stats.new + stats.learning + stats.mastered
  const remaining = total === 0 ? 0 : Math.min(100, (stats.due / total) * 100)
  return (
    <div
      className="stacked-progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={stats.due}
      aria-label={`${stats.due} of ${total} cards due, ${stats.mastered} mastered`}
    >
      <span className="stacked-progress__remaining" style={{ width: `${remaining}%` }} />
    </div>
  )
}

export function Progress({ value, label }: Readonly<{ value: number; label: string }>) {
  const percentage = Math.round(Math.min(1, Math.max(0, value)) * 100)
  return (
    <div className="progress" aria-label={label}>
      <span style={{ width: `${percentage}%` }} />
    </div>
  )
}
