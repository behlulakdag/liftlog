import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Exercise, PlanItem, WorkoutDetail, WorkoutSet } from '../api/types'
import { ConfirmProvider } from '../components/Confirm'
import { RestTimerContext, ToastContext, type ToastOptions } from '../components/contexts'
import { formatKg } from '../lib/format'
import { t } from '../lib/i18n'
import { formatSets } from '../lib/muscles'
import { fakeServer, jsonResponse, type Handler } from '../test/fakeServer'
import { swipeRowLeft } from '../test/swipe'
import { WorkoutDetailPage } from './WorkoutDetailPage'

const bench: PlanItem = {
  exerciseId: 1,
  name: 'Bench Press',
  bodyweight: false,
  plannedSets: 3,
  loggedSets: 0,
  targetReps: 8,
  suggestedWeightKg: 82.5,
  lastWeightKg: 80,
  lastReps: [8, 8, 8],
  suggestion: 'INCREASE',
  increaseKg: 2.5,
}

const deadlift: PlanItem = {
  ...bench,
  exerciseId: 2,
  name: 'Deadlift',
  plannedSets: 1,
  targetReps: 5,
  suggestedWeightKg: null,
  lastWeightKg: null,
  lastReps: [],
  suggestion: 'FIRST',
  increaseKg: null,
}

/** A workout started from routine 3, with a server that stores posted sets and derives the plan from them. */
function workoutServer({ routineId = 3 as number | null, plan = [bench, deadlift], notes = 'Push day', postSet }: { routineId?: number | null; plan?: PlanItem[]; notes?: string | null; postSet?: Handler } = {}) {
  const sets: WorkoutSet[] = []
  const detail = (): WorkoutDetail => ({ id: 7, workoutDate: '2026-10-19', notes, totalVolumeKg: 0, sets, ...(routineId === null ? {} : { routineId }) })
  const storeSet = (body: unknown) => {
    const input = body as { exerciseId: number; reps: number; weightKg: number }
    const item = plan.find((p) => p.exerciseId === input.exerciseId)!
    const saved: WorkoutSet = { id: 100 + sets.length, exerciseName: item.name, setOrder: sets.length + 1, rpe: null, newPersonalRecord: false, bodyweight: item.bodyweight, ...input }
    sets.push(saved)
    return jsonResponse(201, saved)
  }
  const calls = fakeServer({
    'GET /api/v1/workouts/7': () => jsonResponse(200, detail()),
    'GET /api/v1/workouts/7/plan': () =>
      jsonResponse(200, plan.map((p) => ({ ...p, loggedSets: sets.filter((s) => s.exerciseId === p.exerciseId).length }))),
    'GET /api/v1/profile': () => jsonResponse(200, { id: 1, displayName: null, heightCm: null, bodyWeightKg: 80, avatarVersion: null }),
    'GET /api/v1/exercises': () => jsonResponse(200, []),
    'POST /api/v1/workouts/7/sets': (body) => (postSet ? postSet(body) : storeSet(body)),
    'POST /api/v1/routines/from-workout/7': (body) => jsonResponse(201, { id: 9, name: (body as { name: string }).name, exercises: [] }),
  })
  return { calls, storeSet }
}

function renderDetail({ toast = () => {}, startRest = () => {} }: { toast?: (o: ToastOptions) => void; startRest?: () => void } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter([{ path: '/workouts/:id', element: <WorkoutDetailPage /> }], { initialEntries: ['/workouts/7'] })
  render(
    <QueryClientProvider client={client}>
      <ToastContext.Provider value={toast}>
        <RestTimerContext.Provider value={{ start: startRest }}>
          <ConfirmProvider>
            <RouterProvider router={router} />
          </ConfirmProvider>
        </RestTimerContext.Provider>
      </ToastContext.Provider>
    </QueryClientProvider>,
  )
  return userEvent.setup()
}

const startsWith = (prefix: string) => (name: string) => name.startsWith(prefix)
const posts = (calls: { method: string; path: string; body: unknown }[]) => calls.filter((c) => c.method === 'POST' && c.path === '/api/v1/workouts/7/sets')
const benchCard = () => screen.findByTestId('plan-card-1')

beforeEach(() => {
  // jsdom has no Web Audio; the page unlocks it on every tap so the rest timer can beep later
  vi.stubGlobal('AudioContext', class {
    state = 'running'
    resume() {
      return Promise.resolve()
    }
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('workout mode', () => {
  it('shows the planned rows prefilled with the suggestion and the progression tag', async () => {
    workoutServer()
    renderDetail()
    const card = await benchCard()
    expect(within(card).getByText(t.suggestIncreaseKg(formatKg(2.5)))).toBeInTheDocument()
    expect(within(card).getAllByRole('button', { name: startsWith(t.weightKg) })).toHaveLength(3)
    expect(within(card).getAllByText(t.kg(formatKg(82.5)))).toHaveLength(3)
    expect(within(await screen.findByTestId('plan-card-2')).getByText(t.suggestFirst)).toBeInTheDocument()
  })

  it('logs a planned row in one request and starts the rest timer', async () => {
    const { calls } = workoutServer()
    const startRest = vi.fn()
    const user = renderDetail({ startRest })
    const card = await benchCard()

    await user.click(within(card).getByRole('button', { name: t.logPlannedSet(1) }))

    await waitFor(() => expect(within(card).queryByRole('button', { name: t.logPlannedSet(1) })).not.toBeInTheDocument())
    expect(posts(calls).map((c) => c.body)).toEqual([{ exerciseId: 1, reps: 8, weightKg: 82.5, rpe: null }])
    expect(startRest).toHaveBeenCalledTimes(1)
    // The row became a normal logged set and two planned rows are left
    expect(within(card).getByText(t.setsLeft(2))).toBeInTheDocument()
    expect(within(card).getByRole('button', { name: t.logPlannedSet(2) })).toBeInTheDocument()
    // The plan was refetched after the set was saved
    expect(calls.filter((c) => c.path === '/api/v1/workouts/7/plan').length).toBeGreaterThan(1)
  })

  it('steps weight and reps without the keyboard and carries the change to later rows', async () => {
    const { calls } = workoutServer()
    const user = renderDetail()
    const card = await benchCard()

    await user.click(within(card).getAllByRole('button', { name: startsWith(t.weightKg) })[0])
    await user.click(within(card).getByRole('button', { name: t.heavier(formatKg(2.5)) }))
    await user.click(within(card).getByRole('button', { name: t.moreReps }))
    // Reps never go below 1
    for (let i = 0; i < 12; i++) await user.click(within(card).getByRole('button', { name: t.fewerReps }))
    await user.click(within(card).getByRole('button', { name: t.moreReps }))

    expect(within(card).getAllByText(t.kg(formatKg(85)))).toHaveLength(3)
    await user.click(within(card).getByRole('button', { name: t.logPlannedSet(1) }))
    await waitFor(() => expect(posts(calls)).toHaveLength(1))
    expect(posts(calls)[0].body).toEqual({ exerciseId: 1, reps: 2, weightKg: 85, rpe: null })
  })

  it('opens the steppers instead of logging when a first-time lift has no weight', async () => {
    const { calls } = workoutServer()
    const user = renderDetail()
    const card = await screen.findByTestId('plan-card-2')

    await user.click(within(card).getByRole('button', { name: t.logPlannedSet(1) }))
    expect(within(card).getByText(t.enterWeightFirst)).toBeInTheDocument()
    expect(posts(calls)).toHaveLength(0)

    await user.type(within(card).getByRole('textbox', { name: t.weightKg }), '120')
    await user.click(within(card).getByRole('button', { name: t.logPlannedSet(1) }))
    await waitFor(() => expect(posts(calls).map((c) => c.body)).toEqual([{ exerciseId: 2, reps: 5, weightKg: 120, rpe: null }]))
    expect(await within(card).findByText(`✓ ${t.exerciseDone}`)).toBeInTheDocument()
  })

  it('never posts the same row twice on a double tap', async () => {
    let release: () => void = () => {}
    const { calls, storeSet } = workoutServer({ postSet: (body) => new Promise((resolve) => (release = () => resolve(storeSet(body)))) })
    const user = renderDetail()
    const card = await benchCard()
    const tick = within(card).getByRole('button', { name: t.logPlannedSet(1) })

    await user.dblClick(tick)
    await user.click(tick)
    expect(posts(calls)).toHaveLength(1)
    expect(tick).toBeDisabled()

    release()
    await waitFor(() => expect(within(card).getByText(t.setsLeft(2))).toBeInTheDocument())
    expect(posts(calls)).toHaveLength(1)
  })

  it('starts bodyweight exercises at no added load and suggests one more rep', async () => {
    const pullUps: PlanItem = { ...bench, exerciseId: 5, name: 'Pull-up', bodyweight: true, suggestedWeightKg: 0, lastWeightKg: 0, increaseKg: null, suggestedReps: 9 }
    const { calls } = workoutServer({ plan: [pullUps] })
    const user = renderDetail()
    const card = await screen.findByTestId('plan-card-5')

    expect(within(card).getByText(t.suggestMoreReps(1))).toBeInTheDocument()
    expect(within(card).getAllByText(t.bodyweightOnly)).toHaveLength(3)
    await user.click(within(card).getAllByRole('button', { name: startsWith(t.addedWeightKg) })[0])
    await user.click(within(card).getByRole('button', { name: t.heavier(formatKg(2.5)) }))
    expect(within(card).getAllByText(t.bodyweightPlus(formatKg(2.5)))).toHaveLength(3)

    await user.click(within(card).getByRole('button', { name: t.logPlannedSet(1) }))
    await waitFor(() => expect(posts(calls).map((c) => c.body)).toEqual([{ exerciseId: 5, reps: 9, weightKg: 2.5, rpe: null }]))
  })

  it('keeps the normal list for workouts without a routine (and older servers)', async () => {
    const { calls } = workoutServer({ routineId: null })
    renderDetail()
    expect(await screen.findByText(t.detailEmptyTitle)).toBeInTheDocument()
    expect(calls.some((c) => c.path.endsWith('/plan'))).toBe(false)
  })
})

describe('deleting asks first', () => {
  /** A plain workout (no routine) with one saved Bench Press set of 80 kg × 8. */
  function oneSetWorkout() {
    const server = workoutServer({ routineId: null, plan: [bench] })
    server.storeSet({ exerciseId: 1, reps: 8, weightKg: 80 })
    return server
  }
  const deletes = (calls: { method: string }[]) => calls.filter((c) => c.method === 'DELETE')

  it('a swiped set slides back on Cancel and is not deleted', async () => {
    const { calls } = oneSetWorkout()
    const toast = vi.fn()
    const user = renderDetail({ toast })

    await swipeRowLeft('Bench Press #1')
    const dialog = await screen.findByRole('alertdialog', { name: t.confirmDeleteTitle })
    expect(dialog).toHaveTextContent('Bench Press #1')
    expect(dialog).toHaveTextContent('80 kg × 8')
    await user.click(within(dialog).getByRole('button', { name: t.cancel }))

    expect(screen.getByLabelText('Bench Press #1')).toBeInTheDocument()
    expect(toast).not.toHaveBeenCalled()
    expect(deletes(calls)).toEqual([])
  })

  it('a swiped set is deleted after the confirm, behind the undo toast', async () => {
    const { calls } = oneSetWorkout()
    const toast = vi.fn()
    const user = renderDetail({ toast })

    await swipeRowLeft('Bench Press #1')
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: t.delete }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ message: t.setDeleted, actionLabel: t.undo })))
    await act(async () => {
      await (toast.mock.calls[0][0] as ToastOptions).onTimeout?.()
    })
    await waitFor(() => expect(deletes(calls)).toEqual([{ method: 'DELETE', path: '/api/v1/sets/100', body: undefined }]))
  })

  it('the set editor asks too, and Cancel keeps the editor open', async () => {
    const { calls } = oneSetWorkout()
    const toast = vi.fn()
    const user = renderDetail({ toast })

    await user.click(await screen.findByTestId('saved-set'))
    const editor = screen.getByRole('dialog', { name: t.editSet })
    await user.click(within(editor).getByRole('button', { name: t.delete }))
    const dialog = screen.getByRole('alertdialog')
    expect(dialog).toHaveTextContent('Bench Press #1')
    await user.click(within(dialog).getByRole('button', { name: t.cancel }))

    expect(screen.getByRole('dialog', { name: t.editSet })).toBeInTheDocument()
    expect(toast).not.toHaveBeenCalled()

    await user.click(within(editor).getByRole('button', { name: t.delete }))
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: t.delete }))
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ message: t.setDeleted }))
    expect(screen.queryByRole('dialog', { name: t.editSet })).toBeNull()
    expect(deletes(calls)).toEqual([])
  })

  it('deleting the workout from the menu needs the confirm', async () => {
    const { calls } = oneSetWorkout()
    const user = renderDetail()
    await screen.findByTestId('saved-set')

    await user.click(screen.getByRole('button', { name: 'Menu' }))
    await user.click(screen.getByRole('button', { name: t.deleteWorkout }))
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Push day')
    await user.click(screen.getByRole('button', { name: t.cancel }))
    expect(deletes(calls)).toEqual([])

    await user.click(screen.getByRole('button', { name: 'Menu' }))
    await user.click(screen.getByRole('button', { name: t.deleteWorkout }))
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: t.delete }))
    await waitFor(() => expect(deletes(calls)).toEqual([{ method: 'DELETE', path: '/api/v1/workouts/7', body: undefined }]))
  })
})

describe('save as routine', () => {
  it('is not offered on a workout without sets', async () => {
    workoutServer({ routineId: null })
    const user = renderDetail()
    await screen.findByText(t.detailEmptyTitle)
    await user.click(screen.getByRole('button', { name: 'Menu' }))
    expect(screen.getByRole('button', { name: t.editWorkout })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: t.saveAsRoutine })).not.toBeInTheDocument()
  })

  it('prefills the workout note, requires a name, posts it and confirms with a toast', async () => {
    const { calls } = workoutServer()
    const toast = vi.fn()
    const user = renderDetail({ toast })
    const card = await benchCard()
    await user.click(within(card).getByRole('button', { name: t.logPlannedSet(1) }))
    await waitFor(() => expect(within(card).getByText(t.setsLeft(2))).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Menu' }))
    await user.click(screen.getByRole('button', { name: t.saveAsRoutine }))
    const name = screen.getByLabelText(t.routineName)
    expect(name).toHaveValue('Push day')

    await user.clear(name)
    await user.click(screen.getByTestId('save-routine'))
    expect(screen.getByText(t.errorRoutineName)).toBeInTheDocument()

    await user.type(name, 'Push A')
    await user.click(screen.getByTestId('save-routine'))
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ message: t.routineSaved('Push A') }))
    expect(calls.find((c) => c.path === '/api/v1/routines/from-workout/7')?.body).toEqual({ name: 'Push A' })
  })
})

describe("the workout's muscle map", () => {
  const exercise = (id: number, name: string, equipment: Exercise['equipment'], muscles: Exercise['muscles']): Exercise => ({
    id,
    name,
    muscleGroup: null,
    custom: false,
    bodyweight: equipment === 'BODYWEIGHT',
    equipment,
    muscles,
  })
  const catalog: Exercise[] = [
    exercise(1, 'Squat', 'BARBELL', [{ muscle: 'QUADS', role: 'PRIMARY' }, { muscle: 'GLUTES', role: 'SECONDARY' }]),
    exercise(2, 'Leg Press', 'MACHINE', [{ muscle: 'QUADS', role: 'PRIMARY' }]),
    exercise(3, 'Crunch', 'BODYWEIGHT', [{ muscle: 'ABS', role: 'PRIMARY' }]),
    exercise(4, 'Cable Crunch', 'CABLE', [{ muscle: 'ABS', role: 'PRIMARY' }]),
  ]
  const squat = (id: number): WorkoutSet => ({
    id,
    exerciseId: 1,
    exerciseName: 'Squat',
    setOrder: id,
    reps: 5,
    weightKg: 120,
    rpe: null,
    newPersonalRecord: false,
    bodyweight: false,
  })

  function mapServer() {
    const sets = [squat(1), squat(2), squat(3)]
    return fakeServer({
      'GET /api/v1/workouts/7': () => jsonResponse(200, { id: 7, workoutDate: '2026-10-19', notes: 'Legs', totalVolumeKg: 1800, sets }),
      'GET /api/v1/profile': () => jsonResponse(200, { id: 1, displayName: null, heightCm: null, bodyWeightKg: 80, avatarVersion: null }),
      'GET /api/v1/exercises': () => jsonResponse(200, catalog),
      'POST /api/v1/workouts/7/sets': (body) => {
        const input = body as { exerciseId: number; reps: number; weightKg: number }
        const saved = { ...squat(10 + sets.length), ...input, exerciseName: 'Crunch', bodyweight: true }
        sets.push(saved)
        return jsonResponse(201, saved)
      },
    })
  }

  const map = async () => within(await screen.findByTestId('recap-muscles'))
  const muscle = async (name: string) => (await map()).findByRole('button', { name: new RegExp(`^${name}:`) })

  it("lists this workout's exercises with their sets for a trained muscle, and closes on a second tap", async () => {
    mapServer()
    const user = renderDetail()

    // The same wide hit areas as the Progress map, so a thin forearm is easy to tap
    await muscle(t.muscleNames.QUADS)
    expect(screen.getByTestId('recap-muscles').querySelector('[data-hit="FOREARMS"]')).not.toBeNull()
    await user.click(await muscle(t.muscleNames.QUADS))
    const panel = within((await map()).getByRole('region', { name: t.muscleNames.QUADS }))
    const inWorkout = within(panel.getByTestId('muscle-in-workout'))
    expect(inWorkout.getByText('Squat')).toBeInTheDocument()
    expect(inWorkout.getByText(t.muscleSets('3'))).toBeInTheDocument()
    expect(within(await panel.findByTestId('muscle-suggestions')).getByText('Leg Press')).toBeInTheDocument()

    // A secondary muscle counts half: three squat sets are 1.5 for the glutes
    await user.click(await muscle(t.muscleNames.GLUTES))
    const glutes = within((await map()).getByRole('region', { name: t.muscleNames.GLUTES }))
    expect(within(glutes.getByTestId('muscle-in-workout')).getByText(t.muscleSets(formatSets(1.5)))).toBeInTheDocument()

    await user.click(await muscle(t.muscleNames.GLUTES))
    expect((await map()).queryByTestId('muscle-detail')).not.toBeInTheDocument()
  })

  it('says an untrained muscle was not worked and suggests its exercises', async () => {
    mapServer()
    const user = renderDetail()

    await user.click(await muscle(t.muscleNames.ABS))
    const panel = within((await map()).getByRole('region', { name: t.muscleNames.ABS }))
    expect(panel.getByText(t.muscleNotInWorkout)).toBeInTheDocument()
    const suggestions = within(await panel.findByTestId('muscle-suggestions'))
    expect(suggestions.getByRole('button', { name: t.muscleLogExercise('Crunch') })).toBeInTheDocument()
    expect(suggestions.getByRole('button', { name: t.muscleLogExercise('Cable Crunch') })).toBeInTheDocument()
  })

  it('opens the set editor on a suggested exercise and logs a set of it', async () => {
    const calls = mapServer()
    const user = renderDetail()

    await user.click(await muscle(t.muscleNames.ABS))
    await user.click(await screen.findByRole('button', { name: t.muscleLogExercise('Crunch') }))

    const editor = within(await screen.findByRole('dialog', { name: t.addSet }))
    expect(editor.getByText('Crunch')).toBeInTheDocument()
    // Picked like in the exercise picker: reps stay, a bodyweight exercise starts at 0 kg added
    expect(editor.getByLabelText(t.reps)).toHaveValue('5')
    await user.click(editor.getByTestId('save-set'))

    await waitFor(() => expect(posts(calls)).toHaveLength(1))
    expect(posts(calls)[0].body).toMatchObject({ exerciseId: 3, reps: 5, weightKg: 0 })
  })
})
