import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider, useParams } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Exercise, Routine } from '../api/types'
import { ConfirmProvider } from '../components/Confirm'
import { ToastContext, type ToastOptions } from '../components/contexts'
import { formatKg, formatShortDate } from '../lib/format'
import { t } from '../lib/i18n'
import { todayIso } from '../lib/nutrition'
import { fakeServer, jsonResponse } from '../test/fakeServer'
import { swipeRowLeft } from '../test/swipe'
import { WorkoutsPage } from './WorkoutsPage'

const push: Routine = {
  id: 5,
  name: 'Push A',
  exercises: [
    { exerciseId: 1, name: 'Bench', bodyweight: false, sets: 3, targetReps: 8 },
    { exerciseId: 2, name: 'Dips', bodyweight: true, sets: 3, targetReps: 10 },
  ],
}

const emptyPage = { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0, last: true }

function OpenedWorkout() {
  return <p>opened workout {useParams().id}</p>
}

function renderWorkouts(toast: (o: ToastOptions) => void = () => {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(
    [
      { path: '/', element: <WorkoutsPage /> },
      { path: '/workouts/:id', element: <OpenedWorkout /> },
    ],
    { initialEntries: ['/'] },
  )
  render(
    <QueryClientProvider client={client}>
      <ToastContext.Provider value={toast}>
        <ConfirmProvider>
          <RouterProvider router={router} />
        </ConfirmProvider>
      </ToastContext.Provider>
    </QueryClientProvider>,
  )
  return userEvent.setup()
}

beforeEach(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('routine strip', () => {
  it('starts a routine with one tap and opens the new workout', async () => {
    const calls = fakeServer({
      'GET /api/v1/workouts': () => jsonResponse(200, emptyPage),
      'GET /api/v1/routines': () => jsonResponse(200, [push]),
      'POST /api/v1/routines/5/start': () => jsonResponse(201, { id: 42, workoutDate: '2026-10-19', notes: 'Push A', totalVolumeKg: 0, sets: [], routineId: 5 }),
    })
    const user = renderWorkouts()

    // One routine is its own cycle: no track, just the next-up card with its Start
    const nextUp = await screen.findByTestId('next-up')
    expect(nextUp).toHaveTextContent('Push A')
    await user.click(within(nextUp).getByRole('button', { name: t.startNow }))

    expect(await screen.findByText('opened workout 42')).toBeInTheDocument()
    expect(calls.filter((c) => c.path === '/api/v1/routines/5/start')).toEqual([{ method: 'POST', path: '/api/v1/routines/5/start', body: { workoutDate: todayIso() } }])
  })

  it('says a workout has to be started online when there is no signal', async () => {
    fakeServer({
      'GET /api/v1/workouts': () => jsonResponse(200, emptyPage),
      'GET /api/v1/routines': () => jsonResponse(200, [push]),
      'POST /api/v1/routines/5/start': () => {
        throw new TypeError('Failed to fetch')
      },
    })
    const toast = vi.fn()
    const user = renderWorkouts(toast)

    await user.click(within(await screen.findByTestId('next-up')).getByRole('button', { name: t.startNow }))

    await waitFor(() => expect(toast).toHaveBeenCalledWith({ message: t.startWorkoutOnline }))
    expect(screen.queryByText(/opened workout/)).not.toBeInTheDocument()
  })

  it('stays hidden without routines, and on servers that have no routines yet', async () => {
    fakeServer({ 'GET /api/v1/workouts': () => jsonResponse(200, emptyPage) })
    renderWorkouts()
    expect(await screen.findByText(t.workoutsEmptyTitle)).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByTestId('next-up')).not.toBeInTheDocument())
    expect(screen.queryByTestId('manage-routines')).not.toBeInTheDocument()
  })

  it('opens the routines sheet from the header', async () => {
    fakeServer({
      'GET /api/v1/workouts': () => jsonResponse(200, emptyPage),
      'GET /api/v1/routines': () => jsonResponse(200, []),
    })
    const user = renderWorkouts()
    await user.click(await screen.findByTestId('manage-routines'))
    expect(screen.getByRole('dialog', { name: t.routines })).toBeInTheDocument()
    expect(screen.getByText(t.routinesEmpty)).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: t.startWithRoutine })).not.toBeInTheDocument()
  })

  it('lists routines first in the new workout sheet and starts them on the chosen date', async () => {
    const calls = fakeServer({
      'GET /api/v1/workouts': () => jsonResponse(200, emptyPage),
      'GET /api/v1/routines': () => jsonResponse(200, [push]),
      'POST /api/v1/routines/5/start': () => jsonResponse(201, { id: 43, workoutDate: '2026-10-18', notes: 'Push A', totalVolumeKg: 0, sets: [], routineId: 5 }),
    })
    const user = renderWorkouts()
    await screen.findByTestId('next-up')
    await user.click(screen.getByTestId('fab-new-workout'))

    const sheet = screen.getByRole('dialog', { name: t.newWorkout })
    const buttons = within(sheet).getAllByRole('button')
    expect(buttons[0]).toHaveTextContent('Bench 3×8 · Dips 3×10')

    fireEvent.change(within(sheet).getByLabelText(t.date), { target: { value: '2026-10-18' } })
    await user.click(buttons[0])
    expect(await screen.findByText('opened workout 43')).toBeInTheDocument()
    expect(calls.find((c) => c.path === '/api/v1/routines/5/start')?.body).toEqual({ workoutDate: '2026-10-18' })
  })
})

describe('templates when there are no routines yet', () => {
  const catalog: Exercise[] = [
    { id: 21, name: 'Smith Machine Squat', muscleGroup: 'Legs', custom: false, bodyweight: false },
    { id: 22, name: 'Romanian Deadlift', muscleGroup: 'Legs', custom: false, bodyweight: false },
    { id: 23, name: 'Leg Press', muscleGroup: 'Legs', custom: false, bodyweight: false },
    { id: 24, name: 'Lying Leg Curl', muscleGroup: 'Legs', custom: false, bodyweight: false },
    { id: 25, name: 'Standing Calf Raise Machine', muscleGroup: 'Legs', custom: false, bodyweight: false },
    { id: 26, name: 'Cable Crunch', muscleGroup: 'Core', custom: false, bodyweight: false },
  ]
  const lowerABody = {
    name: t.templateNames.lowerA,
    exercises: [
      { exerciseId: 21, sets: 3, targetReps: 8 },
      { exerciseId: 22, sets: 3, targetReps: 10 },
      { exerciseId: 23, sets: 3, targetReps: 12 },
      { exerciseId: 24, sets: 3, targetReps: 12 },
      { exerciseId: 25, sets: 4, targetReps: 15 },
      { exerciseId: 26, sets: 3, targetReps: 15 },
    ],
  }

  function serverWithoutRoutines() {
    let routines: Routine[] = []
    return fakeServer({
      'GET /api/v1/workouts': () => jsonResponse(200, emptyPage),
      'GET /api/v1/routines': () => jsonResponse(200, routines),
      'GET /api/v1/exercises': () => jsonResponse(200, catalog),
      'POST /api/v1/routines': (body) => {
        const input = body as typeof lowerABody
        const created: Routine = {
          id: 9,
          name: input.name,
          exercises: input.exercises.map((e) => ({ ...e, name: catalog.find((c) => c.id === e.exerciseId)!.name, bodyweight: false })),
        }
        routines = [created]
        return jsonResponse(201, created)
      },
      'POST /api/v1/routines/9/start': () => jsonResponse(201, { id: 77, workoutDate: '2026-10-18', notes: 'x', totalVolumeKg: 0, sets: [], routineId: 9 }),
    })
  }

  it('offers templates in place of the routine strip; adding one puts it in the strip', async () => {
    const calls = serverWithoutRoutines()
    const user = renderWorkouts()

    const templates = await screen.findByRole('region', { name: t.readyTemplates })
    await user.click(within(templates).getByRole('button', { name: new RegExp(t.templateNames.lowerA) }))
    const sheet = screen.getByRole('dialog', { name: t.readyTemplates })
    await user.click(await within(sheet).findByTestId('template-add'))

    await waitFor(() => expect(calls.find((c) => c.method === 'POST')?.body).toEqual(lowerABody))
    expect(await screen.findByTestId('next-up')).toHaveTextContent(t.templateNames.lowerA)
    expect(screen.queryByRole('region', { name: t.readyTemplates })).not.toBeInTheDocument()
  })

  it('offers templates in the new workout sheet and starts one on the chosen date', async () => {
    const calls = serverWithoutRoutines()
    const user = renderWorkouts()
    await screen.findByRole('region', { name: t.readyTemplates })
    await user.click(screen.getByTestId('fab-new-workout'))

    const sheet = screen.getByRole('dialog', { name: t.newWorkout })
    fireEvent.change(within(sheet).getByLabelText(t.date), { target: { value: '2026-10-18' } })
    const offered = within(sheet).getByRole('region', { name: t.readyTemplates })
    await user.click(within(offered).getByRole('button', { name: new RegExp(t.templateNames.lowerA) }))
    await user.click(await within(sheet).findByTestId('template-add-start'))

    expect(await screen.findByText('opened workout 77')).toBeInTheDocument()
    expect(calls.find((c) => c.method === 'POST' && c.path === '/api/v1/routines')?.body).toEqual(lowerABody)
    expect(calls.find((c) => c.path === '/api/v1/routines/9/start')?.body).toEqual({ workoutDate: '2026-10-18' })
  })

  it('does not offer templates on a server without routines', async () => {
    fakeServer({ 'GET /api/v1/workouts': () => jsonResponse(200, emptyPage) })
    const user = renderWorkouts()
    expect(await screen.findByText(t.workoutsEmptyTitle)).toBeInTheDocument()
    await user.click(screen.getByTestId('fab-new-workout'))
    expect(screen.queryByRole('region', { name: t.readyTemplates })).not.toBeInTheDocument()
  })
})

describe('week hero', () => {
  const weeks = [
    { weekStart: '2026-10-19', volumeKg: 2144, setCount: 9 },
    { weekStart: '2026-10-26', volumeKg: 11270.9, setCount: 18 },
    { weekStart: '2026-11-02', volumeKg: 1743, setCount: 6 },
  ]

  it('shows this week as the big number, with last week and the streak under it', async () => {
    fakeServer({
      'GET /api/v1/workouts': () => jsonResponse(200, emptyPage),
      'GET /api/v1/stats/volume': () => jsonResponse(200, weeks),
      'GET /api/v1/stats/streak': () => jsonResponse(200, { weeks: 3, thisWeekWorkouts: 1, longestWeeks: 3 }),
    })
    renderWorkouts()

    const hero = await screen.findByTestId('week-hero')
    expect(hero).toHaveTextContent(formatKg(1743))
    await waitFor(() => expect(hero).toHaveTextContent(`${t.lastWeekVolume(formatKg(11270.9))} · ${t.streakWeeks(3)}`))
    expect(within(hero).getByRole('img', { name: t.weeksVolumeAria })).toBeInTheDocument()
  })

  it('leaves the streak out without one, and the hero out on servers without weekly volume', async () => {
    fakeServer({
      'GET /api/v1/workouts': () => jsonResponse(200, emptyPage),
      'GET /api/v1/stats/volume': () => jsonResponse(200, weeks),
      'GET /api/v1/stats/streak': () => jsonResponse(200, { weeks: 0, thisWeekWorkouts: 0, longestWeeks: 2 }),
    })
    renderWorkouts()
    const hero = await screen.findByTestId('week-hero')
    await waitFor(() => expect(hero).toHaveTextContent(t.lastWeekVolume(formatKg(11270.9))))
    expect(hero).not.toHaveTextContent(t.streakWeeks(0))
    cleanup()

    fakeServer({ 'GET /api/v1/workouts': () => jsonResponse(200, emptyPage) })
    renderWorkouts()
    expect(await screen.findByText(t.workoutsEmptyTitle)).toBeInTheDocument()
    expect(screen.queryByTestId('week-hero')).not.toBeInTheDocument()
  })
})

describe('program cycle', () => {
  const day = (id: number, name: string): Routine => ({ id, name, exercises: [{ exerciseId: id, name: `Move ${id}`, bodyweight: false, sets: 3, targetReps: 8 }] })
  const days = [day(1, 'Gün 1 · Üst A'), day(2, 'Gün 2 · Alt A'), day(3, 'Gün 3 · Üst B'), day(4, 'Gün 4 · Alt B')]
  const done = { id: 50, workoutDate: '2026-11-02', notes: 'Gün 1 · Üst A', setCount: 6, exerciseCount: 2, totalVolumeKg: 1743, routineId: 1 }

  it('marks the days done this round, offers the next one and starts any day from the track', async () => {
    const calls = fakeServer({
      'GET /api/v1/workouts': () => jsonResponse(200, { ...emptyPage, content: [done], totalElements: 1, totalPages: 1 }),
      'GET /api/v1/routines': () => jsonResponse(200, days),
      'POST /api/v1/routines/3/start': () => jsonResponse(201, { id: 61, workoutDate: '2026-11-03', notes: 'Gün 3 · Üst B', totalVolumeKg: 0, sets: [], routineId: 3 }),
    })
    const user = renderWorkouts()

    const cycle = await screen.findByRole('region', { name: t.startWithRoutine })
    expect(cycle).toHaveTextContent(t.cycleRound(1, 4))
    expect(within(cycle).getByRole('button', { name: t.startRoutineNamed('Gün 1 · Üst A') })).toHaveTextContent(t.cycleDone(formatShortDate('2026-11-02')))
    expect(within(cycle).getByRole('button', { name: t.startRoutineNamed('Gün 2 · Alt A') })).toHaveTextContent(t.cycleNext)
    expect(screen.getByTestId('next-up')).toHaveTextContent('Gün 2 · Alt A')

    // Any day can be started out of order straight from the track
    await user.click(within(cycle).getByRole('button', { name: t.startRoutineNamed('Gün 3 · Üst B') }))
    expect(await screen.findByText('opened workout 61')).toBeInTheDocument()
    expect(calls.find((c) => c.path === '/api/v1/routines/3/start')?.body).toEqual({ workoutDate: todayIso() })
  })
})

describe('swipe to delete a workout', () => {
  const legDay = { id: 7, workoutDate: '2026-10-18', notes: 'Leg day', setCount: 4, exerciseCount: 2, totalVolumeKg: 1200 }
  const onePage = { ...emptyPage, content: [legDay], totalElements: 1, totalPages: 1 }

  it('asks first; Cancel keeps the workout and never calls the server', async () => {
    const toast = vi.fn()
    const calls = fakeServer({
      'GET /api/v1/workouts': () => jsonResponse(200, onePage),
      'GET /api/v1/routines': () => jsonResponse(200, []),
    })
    const user = renderWorkouts(toast)

    await swipeRowLeft('Leg day')
    expect(await screen.findByRole('alertdialog', { name: t.confirmDeleteTitle })).toHaveTextContent('Leg day')
    await user.click(screen.getByRole('button', { name: t.cancel }))

    expect(screen.getByLabelText('Leg day')).toBeInTheDocument()
    expect(toast).not.toHaveBeenCalled()
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false)
  })

  it('deletes after the confirm, still behind the undo toast', async () => {
    const toast = vi.fn()
    const calls = fakeServer({
      'GET /api/v1/workouts': () => jsonResponse(200, onePage),
      'GET /api/v1/routines': () => jsonResponse(200, []),
      'DELETE /api/v1/workouts/7': () => new Response(null, { status: 204 }),
    })
    const user = renderWorkouts(toast)

    await swipeRowLeft('Leg day')
    await user.click(await screen.findByRole('button', { name: t.delete }))

    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ message: t.workoutDeleted, actionLabel: t.undo })))
    expect(screen.queryByLabelText('Leg day')).toBeNull()
    toast.mock.calls[0][0].onTimeout()
    await waitFor(() => expect(calls).toContainEqual({ method: 'DELETE', path: '/api/v1/workouts/7', body: undefined }))
  })
})
