import { describe, expect, it } from 'vitest'
import type { Routine, WorkoutSummary } from '../api/types'
import { programCycle } from './programCycle'

const routine = (id: number, name: string): Routine => ({ id, name, exercises: [] })
const days = [routine(1, 'Upper A'), routine(2, 'Lower A'), routine(3, 'Upper B'), routine(4, 'Lower B')]
let nextId = 100
const workout = (workoutDate: string, routineId: number | null): WorkoutSummary => ({
  id: nextId++, workoutDate, notes: null, setCount: 6, exerciseCount: 2, totalVolumeKg: 1000, routineId,
})
const states = (workouts: WorkoutSummary[]) => programCycle(days, workouts)!.steps.map((s) => s.state)

describe('programCycle', () => {
  it('starts at the first routine with nothing done', () => {
    const cycle = programCycle(days, [])!
    expect(cycle.next.name).toBe('Upper A')
    expect(cycle.doneCount).toBe(0)
    expect(states([])).toEqual(['next', 'later', 'later', 'later'])
  })

  it('moves on after each day of the round', () => {
    const workouts = [workout('2026-11-02', 1)]
    const cycle = programCycle(days, workouts)!
    expect(cycle.next.name).toBe('Lower A')
    expect(cycle.steps[0]).toMatchObject({ state: 'done', doneOn: '2026-11-02' })
    expect(states(workouts)).toEqual(['done', 'next', 'later', 'later'])
  })

  it('starts a new round after the last routine, and only counts the current round', () => {
    const fullRound = [workout('2026-10-31', 4), workout('2026-10-29', 3), workout('2026-10-27', 2), workout('2026-10-25', 1)]
    expect(programCycle(days, fullRound)!.next.name).toBe('Upper A')
    expect(states(fullRound)).toEqual(['next', 'later', 'later', 'later'])

    const intoTheNext = [workout('2026-11-02', 1), ...fullRound]
    expect(states(intoTheNext)).toEqual(['done', 'next', 'later', 'later'])
    expect(programCycle(days, intoTheNext)!.doneCount).toBe(1)
  })

  it('goes on from the latest day when one was skipped', () => {
    expect(states([workout('2026-11-02', 3), workout('2026-10-30', 1)])).toEqual(['done', 'later', 'done', 'next'])
  })

  it('ignores free workouts and routines that are no longer in the list', () => {
    const workouts = [workout('2026-11-03', null), workout('2026-11-02', 99), workout('2026-11-01', 2), workout('2026-10-30', 1)]
    expect(programCycle(days, workouts)!.next.name).toBe('Upper B')
  })

  it('treats repeating a day as the start of a new round', () => {
    expect(states([workout('2026-11-02', 1), workout('2026-10-31', 1)])).toEqual(['done', 'next', 'later', 'later'])
  })

  it('has no cycle without routines', () => {
    expect(programCycle([], [workout('2026-11-02', null)])).toBeNull()
  })
})
