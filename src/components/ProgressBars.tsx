import type { DeckStats } from '../core/types'

export function StackedProgress({ stats }: Readonly<{ stats: DeckStats }>) {
  const total = stats.new + stats.learning + stats.mastered
  const value = (count: number) => (total === 0 ? 0 : (count / total) * 100)
  return (
    <div className="stacked-progress" aria-label={`${stats.mastered} of ${total} cards mastered`}>
      <span className="stacked-progress__new" style={{ width: `${value(stats.new)}%` }} />
      <span
        className="stacked-progress__learning"
        style={{ width: `${value(stats.learning)}%` }}
      />
      <span
        className="stacked-progress__mastered"
        style={{ width: `${value(stats.mastered)}%` }}
      />
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
