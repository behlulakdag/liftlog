import { t } from '../lib/i18n'
import { StreakIcon } from './Icons'

/** The week streak as one line: flame, "4 week streak" and, when given, "2× this week" after a divider. */
export function StreakChip({ weeks, thisWeekWorkouts, className }: { weeks: number; thisWeekWorkouts?: number; className?: string }) {
  return (
    <div className={className ? `week-streak ${className}` : 'week-streak'} role="img" aria-label={t.streakAria(weeks, thisWeekWorkouts ?? 0)}>
      <span className="week-streak-front">
        <span className="week-streak-icon">
          <StreakIcon />
        </span>
        <strong className="num">{weeks}</strong>
        <small>{t.streakLabel}</small>
      </span>
      {thisWeekWorkouts != null && thisWeekWorkouts > 0 && <span className="week-streak-tag">{t.streakThisWeek(thisWeekWorkouts)}</span>}
    </div>
  )
}
