import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { AppError } from '../api/client'
import { api } from '../api/endpoints'
import { queryKeys } from '../api/queryKeys'
import type { Exercise, MuscleSets, MuscleStat } from '../api/types'
import { todayIso } from '../lib/nutrition'
import { t } from '../lib/i18n'
import {
  bandFor,
  bandThresholds,
  foldMuscleStats,
  formatSets,
  muscleName,
  suggestedExercises,
  type BandScope,
  type BodySide,
  type MapMuscle,
} from '../lib/muscles'
import { BodyMap } from './BodyMap'
import { CloseIcon } from './Icons'

type Days = 1 | 7 | 30

/** Progress page: which muscles the last 7 or 30 days trained, on a front or back figure. */
export function MuscleMapCard() {
  const [side, setSide] = useState<BodySide>('front')
  const [days, setDays] = useState<Days>(7)
  const [selected, setSelected] = useState<MapMuscle | null>(null)
  // The phone's date, so "last 7 days" ends on the user's today even when the server's clock is already tomorrow
  const [today] = useState(todayIso)
  const query = useQuery({
    queryKey: [...queryKeys.stats, 'muscles', days, today],
    queryFn: () => api.muscleStats(days, today),
  })
  // Same cache as the exercise picker; only read once a muscle is tapped, for "the exercises that work it"
  const exercises = useQuery({ queryKey: queryKeys.exercises, queryFn: api.exercises, staleTime: 5 * 60_000, enabled: selected !== null })

  // A server from before the muscle map has no such endpoint: leave the card out
  if (query.error instanceof AppError && query.error.kind === 'notFound') return null

  const muscles = foldMuscleStats(query.data?.muscles ?? [])
  const empty = query.isSuccess && muscles.size === 0
  const toggleMuscle = (muscle: MapMuscle) => setSelected((current) => (current === muscle ? null : muscle))

  return (
    <section className="muscle-card" aria-labelledby="muscle-card-title" data-testid="muscle-map-card">
      <div className="muscle-card-front">
        <small className="muscle-card-kicker">{t.muscleMapDays(days)}</small>
        <h2 id="muscle-card-title">{t.muscleMapTitle}</h2>
        <p className="muscle-card-caption">{t.muscleMapCaption}</p>

        <div className="muscle-toggles">
          <Toggle
            label={t.muscleMapSide}
            options={[
              ['front', t.muscleMapFront],
              ['back', t.muscleMapBack],
            ]}
            value={side}
            onChange={setSide}
          />
          <Toggle
            label={t.muscleMapPeriod}
            options={[
              [1, t.muscleMapDays(1)],
              [7, t.muscleMapDays(7)],
              [30, t.muscleMapDays(30)],
            ]}
            value={days}
            onChange={setDays}
          />
        </div>

        <div className={empty ? 'muscle-stage empty' : 'muscle-stage'} aria-busy={query.isPending}>
          {/* Tappable even with no sets: the panel then still lists the exercises that would work the muscle */}
          <BodyMap side={side} muscles={muscles} scope={days} selected={selected} onSelect={query.isSuccess ? toggleMuscle : undefined} />
        </div>

        {query.isError ? (
          <div className="muscle-empty" role="alert">
            <strong>{t.errorUnknown}</strong>
            <button className="btn btn-tonal" style={{ marginTop: 8 }} onClick={() => query.refetch()}>
              {t.retry}
            </button>
          </div>
        ) : empty ? (
          <div className="muscle-empty">
            <strong>{t.muscleMapEmptyTitle(days)}</strong>
            <p>{t.muscleMapEmptyBody}</p>
          </div>
        ) : (
          <MuscleLegend scope={days} />
        )}

        {selected && query.isSuccess && (
          <MuscleDetail
            muscle={selected}
            stat={muscles.get(selected) ?? { muscle: selected, sets: 0, exercises: [] }}
            scope={days}
            catalog={exercises.data ?? []}
            onClose={() => setSelected(null)}
          />
        )}
      </div>
    </section>
  )
}

function Toggle<T extends string | number>({ label, options, value, onChange }: {
  label: string
  options: [T, string][]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div className="muscle-seg" role="group" aria-label={label}>
      {options.map(([option, text]) => (
        <button key={option} type="button" aria-pressed={option === value} onClick={() => onChange(option)}>
          {text}
        </button>
      ))}
    </div>
  )
}

/** Az / Orta / Çok with the set counts where each band starts. */
export function MuscleLegend({ scope }: { scope: BandScope }) {
  const [mid, high] = bandThresholds(scope)
  return (
    <ul className="muscle-legend">
      <li>
        <span className="muscle-swatch low" />
        {t.muscleBandLow} <small>&lt;{mid}</small>
      </li>
      <li>
        <span className="muscle-swatch mid" />
        {t.muscleBandMid} <small>{mid}+</small>
      </li>
      <li>
        <span className="muscle-swatch high" />
        {t.muscleBandHigh} <small>{high}+</small>
      </li>
    </ul>
  )
}

const SUGGESTED_EXERCISES = 6

interface MuscleDetailProps {
  muscle: MapMuscle
  stat: MuscleStat
  scope: BandScope
  catalog: readonly Exercise[]
  onClose: () => void
  /** One workout's map: the exercises sit under an "In this workout" heading, with a note when there are none */
  workout?: boolean
  /** Makes each suggested exercise a button (the workout page: log a set of it) */
  onPickExercise?: (exercise: Exercise) => void
}

function MuscleDetail({ muscle, stat, scope, catalog, onClose, workout = false, onPickExercise }: MuscleDetailProps) {
  const name = muscleName(muscle)
  const suggested = suggestedExercises(catalog, muscle, SUGGESTED_EXERCISES)
  const exerciseList = stat.exercises.length > 0 && (
    <ul>
      {stat.exercises.map((exercise) => (
        <li key={exercise.name}>
          <span>{exercise.name}</span>
          <span className="num">{t.muscleSets(formatSets(exercise.sets))}</span>
        </li>
      ))}
    </ul>
  )
  return (
    <div className="muscle-detail" data-band={bandFor(stat.sets, scope)} role="region" aria-label={name} data-testid="muscle-detail">
      <div className="muscle-detail-head">
        <strong>{name}</strong>
        <span className="num">{stat.sets > 0 ? t.muscleSets(formatSets(stat.sets)) : t.muscleNotTrained}</span>
      </div>
      {workout ? (
        <section className="muscle-detail-workout" aria-label={t.muscleInWorkoutTitle} data-testid="muscle-in-workout">
          <h3>{t.muscleInWorkoutTitle}</h3>
          {/* No list but sets > 0: the server counted them, the exercise catalog to split them is not here yet */}
          {exerciseList || (stat.sets === 0 && <p className="muscle-detail-note">{t.muscleNotInWorkout}</p>)}
        </section>
      ) : (
        exerciseList
      )}
      {suggested.shown.length > 0 && (
        <section className="muscle-detail-suggest" aria-label={t.muscleExercisesTitle} data-testid="muscle-suggestions">
          <h3>{t.muscleExercisesTitle}</h3>
          <ul className="muscle-suggest-list">
            {suggested.shown.map((exercise) =>
              onPickExercise ? (
                <li key={exercise.id} className="pickable">
                  <button type="button" onClick={() => onPickExercise(exercise)} aria-label={t.muscleLogExercise(exercise.name)}>
                    <span className="muscle-suggest-plus" aria-hidden>
                      +
                    </span>
                    {exercise.name}
                  </button>
                </li>
              ) : (
                <li key={exercise.id}>{exercise.name}</li>
              ),
            )}
          </ul>
          {suggested.more > 0 && <p className="muscle-suggest-more">{t.muscleExercisesMore(suggested.more)}</p>}
        </section>
      )}
      <button className="muscle-detail-close" onClick={onClose} aria-label={t.close}>
        <CloseIcon size={18} />
      </button>
    </div>
  )
}

interface RecapMusclesProps {
  /** Sets per muscle of the workout; with `exercises` (MuscleStat) the panel lists them too */
  muscles: readonly (MuscleSets | MuscleStat)[] | undefined
  /** Per-exercise split when `muscles` has none (the summary sheet colours by the server's totals) */
  breakdown?: readonly MuscleStat[]
  onPickExercise?: (exercise: Exercise) => void
}

/**
 * One workout's muscles, front and back side by side; nothing when there are none. Tapping any muscle, trained
 * or not, opens the same panel as the Progress card: this workout's exercises for it and the staples that work it.
 */
export function RecapMuscles({ muscles, breakdown, onPickExercise }: RecapMusclesProps) {
  const [selected, setSelected] = useState<MapMuscle | null>(null)
  const exercises = useQuery({ queryKey: queryKeys.exercises, queryFn: api.exercises, staleTime: 5 * 60_000, enabled: selected !== null })
  const folded = foldMuscleStats(muscles ?? [])
  if (folded.size === 0) return null
  const split = breakdown ? foldMuscleStats(breakdown) : folded
  const toggleMuscle = (muscle: MapMuscle) => setSelected((current) => (current === muscle ? null : muscle))

  return (
    <section className="recap-muscles" aria-label={t.muscleRecapTitle} data-testid="recap-muscles">
      <h3 className="recap-muscles-title">{t.muscleRecapTitle}</h3>
      <div className="recap-muscles-figures">
        <BodyMap side="front" muscles={folded} scope="workout" selected={selected} onSelect={toggleMuscle} />
        <BodyMap side="back" muscles={folded} scope="workout" selected={selected} onSelect={toggleMuscle} />
      </div>
      <MuscleLegend scope="workout" />
      {selected ? (
        <MuscleDetail
          muscle={selected}
          stat={{ muscle: selected, sets: folded.get(selected)?.sets ?? 0, exercises: split.get(selected)?.exercises ?? [] }}
          scope="workout"
          catalog={exercises.data ?? []}
          onClose={() => setSelected(null)}
          workout
          onPickExercise={onPickExercise}
        />
      ) : (
        <p className="recap-muscles-hint">{t.muscleMapTapHint}</p>
      )}
    </section>
  )
}
