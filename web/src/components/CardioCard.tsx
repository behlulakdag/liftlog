import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { CardioHistory } from '../api/types'
import { formatDuration, formatKm, formatPace } from '../lib/cardio'
import { formatShortDate } from '../lib/format'
import { t } from '../lib/i18n'

const axisStyle = { fill: 'var(--text-muted)', fontSize: 12 }
/** The last sessions are enough for a trend; older ones would squeeze the bars */
const CHART_SESSIONS = 12

/**
 * Cardio on the Progress page: a chip per move, its latest session and best pace, and a bar per session. The bars
 * show distance when the move has any, time otherwise (a stair climber has no kilometres).
 */
export function CardioCard({ history }: { history: CardioHistory[] }) {
  const [pickedId, setPickedId] = useState<number | null>(null)
  if (history.length === 0) return null
  const picked = history.find((h) => h.exerciseId === pickedId) ?? history[0]
  const sessions = picked.sessions
  const latest = sessions.at(-1)!
  const byDistance = sessions.some((s) => s.distanceM)
  const paces = sessions.filter((s) => s.distanceM).map((s) => s.durationSec / (s.distanceM! / 1000))
  const bestPace = paces.length > 0 ? formatDuration(Math.round(Math.min(...paces))) : null
  const data = sessions.slice(-CHART_SESSIONS).map((s) => ({
    label: formatShortDate(s.date),
    value: byDistance ? (s.distanceM ?? 0) / 1000 : Math.round(s.durationSec / 60),
  }))
  const latestText = [
    formatDuration(latest.durationSec),
    latest.distanceM ? t.kmShort(formatKm(latest.distanceM)) : null,
    formatPace(latest.durationSec, latest.distanceM) ? t.paceShort(formatPace(latest.durationSec, latest.distanceM)!) : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <section className="chart-card cardio-card" data-testid="cardio-card">
      <h2>{t.cardio}</h2>
      {history.length > 1 && (
        <div className="chip-row" role="tablist">
          {history.map((h) => (
            <button
              key={h.exerciseId}
              role="tab"
              aria-selected={h.exerciseId === picked.exerciseId}
              className={h.exerciseId === picked.exerciseId ? 'filter-chip selected' : 'filter-chip'}
              onClick={() => setPickedId(h.exerciseId)}
            >
              {h.exerciseName}
            </button>
          ))}
        </div>
      )}
      <div className="record-highlight">
        <div className="stat-tile">
          <small>{t.cardioLatest(history.length > 1 ? '' : picked.exerciseName)}</small>
          <strong className="num">{latestText}</strong>
          <span>{formatShortDate(latest.date)}</span>
        </div>
        {bestPace && (
          <div className="stat-tile emphasized">
            <small>{t.cardioBestPace}</small>
            <strong className="num">{t.paceShort(bestPace)}</strong>
          </div>
        )}
      </div>
      {data.length >= 2 ? (
        <div style={{ height: 180 }} data-testid="cardio-chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid stroke="var(--outline-variant)" strokeDasharray="4 4" vertical={false} />
              <XAxis dataKey="label" tick={axisStyle} tickLine={false} axisLine={false} minTickGap={12} />
              <YAxis tick={axisStyle} tickLine={false} axisLine={false} />
              <Tooltip
                formatter={(value) => [byDistance ? t.kmShort(String(value)) : t.minutesShort(String(value)), byDistance ? t.cardioDistance : t.cardioTime]}
                contentStyle={{ background: 'var(--surface-highest)', border: 'none', borderRadius: 12 }}
                cursor={{ fill: 'var(--surface-high)' }}
              />
              <Bar dataKey="value" fill="var(--tertiary)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="muted">{t.needMoreData}</p>
      )}
    </section>
  )
}
