import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Link, useViewTransitionState } from 'react-router'
import { api } from '../api/endpoints'
import { queryKeys } from '../api/queryKeys'
import type { Routine, WeeklyVolume, WorkoutSummary } from '../api/types'
import { BlockLine, GoalsSection, ProgramSheet } from '../components/ProgramGoals'
import { RecoveryNudge } from '../components/RecoveryNudge'
import { WorkoutListSkeleton } from '../components/Skeletons'
import { ErrorState, MessageState } from '../components/StateViews'
import { SwipeToDelete } from '../components/SwipeToDelete'
import { useConfirm, useToast } from '../components/contexts'
import { formatKg, formatLongDate, formatShortDate, weekdayShort } from '../lib/format'
import { t } from '../lib/i18n'
import { todayIso } from '../lib/nutrition'
import { programCycle, type ProgramCycle } from '../lib/programCycle'
import type { RoutineTemplate } from '../lib/routineTemplates'
import { NewWorkoutSheet } from './NewWorkoutSheet'
import { RoutinesSheet } from './RoutinesSheet'
import { TemplateCards } from './RoutineTemplates'
import { useStartRoutine } from './useStartRoutine'
import { DumbbellIcon } from '../components/Icons'

/** Three bars: two weeks back, last week and this one */
const VOLUME_WEEKS = 3
const NEXT_UP_EXERCISES = 3

export function WorkoutsPage() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const confirm = useConfirm()
  const [creating, setCreating] = useState(false)
  const [managingRoutines, setManagingRoutines] = useState(false)
  // A template tapped in the empty strip opens the Routines sheet on its preview
  const [previewTemplate, setPreviewTemplate] = useState<RoutineTemplate | null>(null)
  // An older server has no routines endpoint: the error just hides the program section
  const routines = useQuery({ queryKey: queryKeys.routines, queryFn: api.routines, retry: false })
  // Same for the streak and the weekly volume: no hero line on a server without them
  const streak = useQuery({ queryKey: queryKeys.streak, queryFn: api.streak, retry: false })
  const today = todayIso()
  const program = useQuery({ queryKey: queryKeys.program(today), queryFn: () => api.program(today), retry: false })
  const [editingProgram, setEditingProgram] = useState(false)
  const volume = useQuery({ queryKey: [...queryKeys.stats, 'volume', VOLUME_WEEKS], queryFn: () => api.weeklyVolume(VOLUME_WEEKS), retry: false })
  // Hidden while their undo window is open; the server delete happens when the toast expires
  const [pendingDelete, setPendingDelete] = useState<Set<number>>(new Set())

  const query = useInfiniteQuery({
    queryKey: queryKeys.workouts,
    queryFn: ({ pageParam }) => api.workouts(pageParam),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.last ? undefined : last.page + 1),
  })

  const sentinel = useRef<HTMLDivElement>(null)
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query
  useEffect(() => {
    const element = sentinel.current
    if (!element) return
    // Load the next page when the end of the list scrolls into view
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) void fetchNextPage()
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const removeWorkout = (workout: WorkoutSummary) => {
    setPendingDelete((s) => new Set(s).add(workout.id))
    const restore = () =>
      setPendingDelete((s) => {
        const next = new Set(s)
        next.delete(workout.id)
        return next
      })
    toast({
      message: t.workoutDeleted,
      actionLabel: t.undo,
      durationMs: 5000,
      onAction: restore,
      onTimeout: () =>
        api
          .deleteWorkout(workout.id)
          .catch(restore)
          .finally(() => queryClient.invalidateQueries({ queryKey: queryKeys.workouts }).then(restore)),
    })
  }

  const workouts = query.data?.pages.flatMap((page) => page.content).filter((w) => !pendingDelete.has(w.id)) ?? []

  return (
    <div className="page">
      <header className="home-header">
        {/* The tab already says where we are, so the page title is for screen readers and the date shows instead */}
        <h1 className="visually-hidden">{t.workoutsTitle}</h1>
        <div className="home-date-block">
          <span className="home-date">{formatLongDate(today)}</span>
          {program.data && <BlockLine program={program.data} onEdit={() => setEditingProgram(true)} />}
        </div>
        <div className="home-header-actions">
          {routines.isSuccess && (
            <button className="btn btn-text" onClick={() => setManagingRoutines(true)} data-testid="manage-routines">
              {t.routines}
            </button>
          )}
          <button className="home-new" onClick={() => setCreating(true)} aria-label={t.newWorkout} data-testid="fab-new-workout">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
      </header>

      {volume.data && <WeekHero weeks={volume.data} streakWeeks={streak.data?.weeks ?? 0} />}

      {routines.data &&
        (routines.data.length > 0 ? <ProgramSection routines={routines.data} workouts={workouts} /> : <TemplateStrip onSelect={setPreviewTemplate} />)}

      {program.data && <GoalsSection program={program.data} onEdit={() => setEditingProgram(true)} />}

      {query.isPending ? (
        <WorkoutListSkeleton />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : workouts.length === 0 ? (
        <MessageState icon={<DumbbellIcon size={32} />} title={t.workoutsEmptyTitle} body={t.workoutsEmptyBody} />
      ) : (
        <>
          <RecoveryNudge />
          <h2 className="home-section-title">{t.recentWorkouts}</h2>
          <div className="workout-list">
            {workouts.map((workout, index) => (
              <SwipeToDelete
                key={workout.id}
                label={workout.notes ?? t.untitledWorkout}
                confirm={() => confirm({ item: workout.notes ?? t.untitledWorkout, message: t.deleteWorkoutConsequence })}
                onDelete={() => removeWorkout(workout)}
              >
                <WorkoutCard workout={workout} index={index} />
              </SwipeToDelete>
            ))}
            <div ref={sentinel} />
            {isFetchingNextPage && <div className="spinner small" style={{ margin: '0 auto' }} />}
          </div>
        </>
      )}

      {editingProgram && program.data && <ProgramSheet program={program.data} onClose={() => setEditingProgram(false)} />}
      {creating && <NewWorkoutSheet routines={routines.data ?? []} offerTemplates={routines.isSuccess} onClose={() => setCreating(false)} />}
      {(managingRoutines || previewTemplate) && (
        <RoutinesSheet
          initialTemplate={previewTemplate}
          onClose={() => {
            setManagingRoutines(false)
            setPreviewTemplate(null)
          }}
        />
      )}
    </div>
  )
}

/** This week's volume as the screen's big number, last week and the streak under it, three weeks as bars beside it. */
function WeekHero({ weeks, streakWeeks }: { weeks: WeeklyVolume[]; streakWeeks: number }) {
  const thisWeek = weeks.at(-1)?.volumeKg ?? 0
  const lastWeek = weeks.at(-2)?.volumeKg
  const tallest = Math.max(1, ...weeks.map((week) => week.volumeKg))
  const meta = [lastWeek != null ? t.lastWeekVolume(formatKg(lastWeek)) : null, streakWeeks > 0 ? t.streakWeeks(streakWeeks) : null]
  return (
    <section className="week-hero" data-testid="week-hero">
      <div className="week-hero-text">
        <span className="week-hero-label">{t.weekLifted}</span>
        <span className="week-hero-value">
          <strong className="num">{formatKg(thisWeek)}</strong> kg
        </span>
        <span className="week-hero-meta">{meta.filter(Boolean).join(' · ')}</span>
      </div>
      <div className="week-hero-bars" role="img" aria-label={t.weeksVolumeAria}>
        {weeks.map((week, index) => (
          <span
            key={week.weekStart}
            className={index === weeks.length - 1 ? 'current' : undefined}
            style={{ height: `${Math.max(8, (week.volumeKg / tallest) * 100)}%` }}
          />
        ))}
      </div>
    </section>
  )
}

/** Where the program stands (tap a day to start it) and the next routine with a big Start. */
function ProgramSection({ routines, workouts }: { routines: Routine[]; workouts: WorkoutSummary[] }) {
  const { start, startingId } = useStartRoutine()
  const cycle = programCycle(routines, workouts)
  if (!cycle) return null
  return (
    <>
      {routines.length > 1 && <CycleStrip cycle={cycle} startingId={startingId} onStart={start} />}
      <NextUpCard routine={cycle.next} starting={startingId === cycle.next.id} disabled={startingId !== null} onStart={() => start(cycle.next)} />
    </>
  )
}

function CycleStrip({ cycle, startingId, onStart }: { cycle: ProgramCycle; startingId: number | null; onStart: (routine: Routine) => void }) {
  return (
    <section className="cycle" aria-label={t.startWithRoutine}>
      <div className="home-section-head">
        <h2 className="home-section-title">{t.programCycle}</h2>
        <span className="muted">{t.cycleRound(cycle.doneCount, cycle.steps.length)}</span>
      </div>
      <div className="cycle-steps">
        {cycle.steps.map((step, index) => (
          <button
            key={step.routine.id}
            className={`cycle-step ${step.state}`}
            onClick={() => onStart(step.routine)}
            disabled={startingId !== null}
            aria-label={t.startRoutineNamed(step.routine.name)}
          >
            <span className="cycle-track" aria-hidden />
            <strong>{shortRoutineName(step.routine.name)}</strong>
            <small>{stepCaption(step.state, step.doneOn, index, startingId === step.routine.id)}</small>
          </button>
        ))}
      </div>
    </section>
  )
}

function stepCaption(state: ProgramCycle['steps'][number]['state'], doneOn: string | null, index: number, starting: boolean) {
  if (starting) return t.starting
  if (state === 'done' && doneOn) return t.cycleDone(formatShortDate(doneOn))
  if (state === 'next') return t.cycleNext
  return t.cycleDay(index + 1)
}

/** "Day 2 · Lower A" reads as "Lower A" in a narrow cell; a name without " · " stays whole. */
function shortRoutineName(name: string) {
  const parts = name.split(' · ')
  return parts.length > 1 ? parts.slice(1).join(' · ') : name
}

function NextUpCard({ routine, starting, disabled, onStart }: { routine: Routine; starting: boolean; disabled: boolean; onStart: () => void }) {
  const shown = routine.exercises.slice(0, NEXT_UP_EXERCISES)
  const more = routine.exercises.length - shown.length
  return (
    <section className="next-up" data-testid="next-up">
      <div className="next-up-head">
        <span className="next-up-label">{t.upNext}</span>
        <h2 className="next-up-name">{routine.name}</h2>
      </div>
      {shown.length > 0 && (
        <ul className="next-up-exercises">
          {shown.map((exercise) => (
            <li key={exercise.exerciseId}>
              <span>{exercise.name}</span>
              <span className="num muted">
                {exercise.sets} × {exercise.targetReps}
              </span>
            </li>
          ))}
          {more > 0 && <li className="muted">{t.moreExercises(more)}</li>}
        </ul>
      )}
      <button className="btn btn-primary btn-block" onClick={onStart} disabled={disabled} data-testid="next-up-start">
        {starting ? t.starting : t.startNow}
      </button>
    </section>
  )
}

/** No routines yet: the same spot offers the ready-made templates instead. */
function TemplateStrip({ onSelect }: { onSelect: (template: RoutineTemplate) => void }) {
  return (
    <section className="routine-strip" aria-label={t.readyTemplates}>
      <h2 className="routine-strip-title">{t.startWithRoutine}</h2>
      <p className="template-strip-hint">{t.noRoutinesYet}</p>
      <TemplateCards variant="strip" onSelect={onSelect} />
    </section>
  )
}

function WorkoutCard({ workout, index }: { workout: WorkoutSummary; index: number }) {
  const to = `/workouts/${workout.id}`
  // Only the tapped row gets the shared name, so it morphs into the detail page's summary card
  const opening = useViewTransitionState(to)
  return (
    <Link
      viewTransition
      to={to}
      className="workout-card"
      // Stagger the entrance of the first few rows; later pages appear immediately
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
      draggable={false}
    >
      <div className="workout-card-body" style={{ viewTransitionName: opening ? 'workout-hero' : undefined }}>
        <div className="workout-card-text">
          <h3 className="workout-card-title">{workout.notes ?? t.untitledWorkout}</h3>
          <span className="workout-card-meta">
            {weekdayShort(workout.workoutDate)} {formatShortDate(workout.workoutDate)} · {t.sets(workout.setCount)}
          </span>
        </div>
        <span className="workout-card-volume num">{formatKg(workout.totalVolumeKg)} kg</span>
      </div>
    </Link>
  )
}
