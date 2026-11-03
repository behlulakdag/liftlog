import type { Routine, WorkoutSummary } from '../api/types'

export type CycleStepState = 'done' | 'next' | 'later'

export interface CycleStep {
  routine: Routine
  state: CycleStepState
  /** Date of the workout that completed this step in the current round; only for done steps */
  doneOn: string | null
}

export interface ProgramCycle {
  steps: CycleStep[]
  next: Routine
  /** Steps done in the current round, for "1 / 4" */
  doneCount: number
}

/**
 * Where the user stands in their routines, trained in list order and then from the top again (Upper A → Lower A →
 * Upper B → Lower B → Upper A …). The current round is the latest run of workouts whose routines go forward in that
 * order; a step back (or a repeat) means a new round started there. A round that reached the last routine is over,
 * so the first routine is next with nothing done yet. Workouts not started from one of these routines are ignored.
 *
 * @param workouts newest first, as the workout list comes from the server
 */
export function programCycle(routines: Routine[], workouts: WorkoutSummary[]): ProgramCycle | null {
  if (routines.length === 0) return null
  const position = new Map(routines.map((routine, index) => [routine.id, index]))

  const doneOn = new Map<number, string>()
  let previous = Number.POSITIVE_INFINITY
  for (const workout of workouts) {
    const index = workout.routineId == null ? undefined : position.get(workout.routineId)
    if (index === undefined) continue
    // Going back in time the positions must keep falling; anything else belongs to an earlier round
    if (index >= previous) break
    doneOn.set(index, workout.workoutDate)
    previous = index
  }

  const latest = doneOn.size === 0 ? -1 : Math.max(...doneOn.keys())
  const roundFinished = latest === routines.length - 1
  const nextIndex = roundFinished ? 0 : latest + 1
  const steps = routines.map((routine, index): CycleStep => {
    const done = !roundFinished && doneOn.has(index)
    return {
      routine,
      state: done ? 'done' : index === nextIndex ? 'next' : 'later',
      doneOn: done ? (doneOn.get(index) ?? null) : null,
    }
  })
  return { steps, next: routines[nextIndex], doneCount: steps.filter((step) => step.state === 'done').length }
}
