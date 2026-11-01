import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Exercise, WorkoutDetail, WorkoutRecap } from '../api/types'
import { ConfirmProvider } from '../components/Confirm'
import { RestTimerContext, ToastContext, type ToastOptions } from '../components/contexts'
import { formatKg } from '../lib/format'
import { t } from '../lib/i18n'
import { fakeServer, jsonResponse } from '../test/fakeServer'
import { WorkoutDetailPage } from './WorkoutDetailPage'

const workout: WorkoutDetail = {
  id: 7,
  workoutDate: '2026-10-19',
  notes: 'Leg day',
  totalVolumeKg: 5240,
  sets: [
    { id: 1, exerciseId: 1, exerciseName: 'Squat', setOrder: 1, reps: 3, weightKg: 140, rpe: null, newPersonalRecord: false, bodyweight: false },
    { id: 2, exerciseId: 2, exerciseName: 'Bench Press', setOrder: 2, reps: 8, weightKg: 100, rpe: null, newPersonalRecord: false, bodyweight: false },
  ],
}

const recap: WorkoutRecap = {
  workoutId: 7,
  workoutDate: '2026-10-19',
  totalVolumeKg: 5240,
  sets: 18,
  exercises: 4,
  personalRecords: [
    { exerciseName: 'Squat', weightKg: 140, reps: 3, kind: 'WEIGHT' },
    { exerciseName: 'Bench Press', weightKg: 100, reps: 8, kind: 'ESTIMATED_1RM' },
  ],
  previousVolumeKg: 4920,
  previousWorkoutId: 3,
  previousWorkoutDate: '2026-10-12',
  weekStreak: 4,
}

function server({ detail = workout, summary = recap, catalog = [] }: { detail?: WorkoutDetail; summary?: WorkoutRecap; catalog?: Exercise[] } = {}) {
  return fakeServer({
    'GET /api/v1/workouts/7': () => jsonResponse(200, detail),
    'GET /api/v1/workouts/7/summary': () => jsonResponse(200, summary),
    'GET /api/v1/profile': () => jsonResponse(200, { id: 1, displayName: null, heightCm: null, bodyWeightKg: 80, avatarVersion: null }),
    'GET /api/v1/exercises': () => jsonResponse(200, catalog),
  })
}

function renderDetail(toast: (o: ToastOptions) => void = () => {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(
    [
      { path: '/workouts/:id', element: <WorkoutDetailPage /> },
      { path: '/', element: <p>workout list</p> },
    ],
    { initialEntries: ['/workouts/7'] },
  )
  render(
    <QueryClientProvider client={client}>
      <ToastContext.Provider value={toast}>
        <RestTimerContext.Provider value={{ start: () => {} }}>
          <ConfirmProvider>
            <RouterProvider router={router} />
          </ConfirmProvider>
        </RestTimerContext.Provider>
      </ToastContext.Provider>
    </QueryClientProvider>,
  )
  return userEvent.setup()
}

async function openRecap(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByTestId('finish-workout'))
  return within(await screen.findByRole('dialog', { name: t.recapTitle }))
}

beforeEach(() => {
  // Count-up animations jump straight to their final value
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce'), addEventListener() {}, removeEventListener() {} }))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  Reflect.deleteProperty(navigator, 'share')
})

describe('workout recap sheet', () => {
  it('shows volume, the comparison, records and the streak from the server', async () => {
    const calls = server()
    const sheet = await openRecap(renderDetail())

    expect(await sheet.findByText(t.recapLifted(formatKg(5240)))).toBeInTheDocument()
    expect(sheet.getByTestId('recap-delta')).toHaveTextContent(t.recapVsLast('+320'))
    expect(sheet.getByText('18')).toBeInTheDocument()
    expect(sheet.getByRole('img', { name: t.streakAria(4, 0) })).toHaveTextContent('4')

    const records = sheet.getByRole('region', { name: t.recapRecords(2) })
    const rows = within(records).getAllByRole('listitem')
    expect(rows[0]).toHaveTextContent('Squat')
    expect(rows[0]).toHaveTextContent(t.weightTimesReps(formatKg(140), 3))
    expect(rows[0]).toHaveTextContent(t.recordWeight)
    expect(rows[1]).toHaveTextContent(t.recordE1rm)
    expect(calls.filter((c) => c.path === '/api/v1/workouts/7/summary')).toHaveLength(1)
  })

  it('opens from the menu too, even before the first set', async () => {
    server({ detail: { ...workout, sets: [], totalVolumeKg: 0 } })
    const user = renderDetail()
    await user.click(await screen.findByRole('button', { name: 'Menu' }))
    await user.click(screen.getByRole('button', { name: t.finishWorkout }))
    expect(await screen.findByRole('dialog', { name: t.recapTitle })).toBeInTheDocument()
  })

  it('says so when there is nothing to compare with and no record', async () => {
    server({ summary: { ...recap, previousVolumeKg: null, previousWorkoutId: null, previousWorkoutDate: null, personalRecords: [], weekStreak: 0 } })
    const sheet = await openRecap(renderDetail())

    expect(await sheet.findByTestId('recap-delta')).toHaveTextContent(t.recapFirstTime)
    expect(sheet.queryByRole('region', { name: t.recapRecords(0) })).not.toBeInTheDocument()
    expect(sheet.queryByRole('img', { name: /./ })).not.toBeInTheDocument()
  })

  it("draws this workout's muscles front and back with single-workout bands", async () => {
    server({
      summary: {
        ...recap,
        muscles: [
          { muscle: 'QUADS', sets: 5 },
          { muscle: 'ADDUCTORS', sets: 1 },
          { muscle: 'CHEST', sets: 3 },
          { muscle: 'GLUTES', sets: 1.5 },
        ],
      },
    })
    const sheet = await openRecap(renderDetail())

    const map = within(await sheet.findByTestId('recap-muscles'))
    expect(map.getByRole('group', { name: t.muscleMapFigure('front') })).toBeInTheDocument()
    expect(map.getByRole('group', { name: t.muscleMapFigure('back') })).toBeInTheDocument()
    expect(map.getByRole('button', { name: t.muscleAria(t.muscleNames.QUADS, t.muscleSets('6')) })).toHaveAttribute('data-band', 'high')
    expect(map.getByRole('button', { name: new RegExp(t.muscleNames.CHEST) })).toHaveAttribute('data-band', 'mid')
    expect(map.getByRole('button', { name: new RegExp(t.muscleNames.GLUTES) })).toHaveAttribute('data-band', 'low')
  })

  it("lists this workout's exercises and the staples for a tapped muscle, without adding", async () => {
    server({
      summary: { ...recap, muscles: [{ muscle: 'QUADS', sets: 1 }, { muscle: 'CHEST', sets: 1 }] },
      catalog: [
        { id: 1, name: 'Squat', muscleGroup: 'Legs', custom: false, bodyweight: false, equipment: 'BARBELL', muscles: [{ muscle: 'QUADS', role: 'PRIMARY' }] },
        { id: 2, name: 'Bench Press', muscleGroup: 'Chest', custom: false, bodyweight: false, equipment: 'BARBELL', muscles: [{ muscle: 'CHEST', role: 'PRIMARY' }] },
        { id: 3, name: 'Crunch', muscleGroup: 'Core', custom: false, bodyweight: true, equipment: 'BODYWEIGHT', muscles: [{ muscle: 'ABS', role: 'PRIMARY' }] },
      ],
    })
    const user = renderDetail()
    const sheet = await openRecap(user)
    const map = within(await sheet.findByTestId('recap-muscles'))

    await user.click(map.getByRole('button', { name: new RegExp(t.muscleNames.QUADS) }))
    const panel = within(map.getByRole('region', { name: t.muscleNames.QUADS }))
    const inWorkout = within(panel.getByTestId('muscle-in-workout'))
    expect(await inWorkout.findByText('Squat')).toBeInTheDocument()
    expect(inWorkout.getByText(t.muscleSets('1'))).toBeInTheDocument()
    expect(within(await panel.findByTestId('muscle-suggestions')).getByText('Squat')).toBeInTheDocument()
    // Informational only: the suggestions are plain tags, not "add a set" buttons
    expect(panel.queryByRole('button', { name: t.muscleLogExercise('Squat') })).not.toBeInTheDocument()

    // An untrained muscle opens too, with the note and its exercises
    await user.click(map.getByRole('button', { name: new RegExp(t.muscleNames.ABS) }))
    const abs = within(map.getByRole('region', { name: t.muscleNames.ABS }))
    expect(abs.getByText(t.muscleNotInWorkout)).toBeInTheDocument()
    expect(within(await abs.findByTestId('muscle-suggestions')).getByText('Crunch')).toBeInTheDocument()

    await user.click(abs.getByRole('button', { name: t.close }))
    expect(map.queryByTestId('muscle-detail')).not.toBeInTheDocument()
  })

  it('leaves the map out when the server sends no muscles', async () => {
    server({ summary: { ...recap, muscles: [] } })
    const sheet = await openRecap(renderDetail())
    expect(await sheet.findByTestId('recap-delta')).toBeInTheDocument()
    expect(sheet.queryByTestId('recap-muscles')).not.toBeInTheDocument()
  })

  it('hides the finish button while the workout has no sets', async () => {
    server({ detail: { ...workout, sets: [], totalVolumeKg: 0 } })
    renderDetail()
    expect(await screen.findByText(t.detailEmptyTitle)).toBeInTheDocument()
    expect(screen.queryByTestId('finish-workout')).not.toBeInTheDocument()
  })

  it('shares a short text with the system share sheet', async () => {
    server()
    const share = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'share', { value: share, configurable: true })
    const user = renderDetail()
    const sheet = await openRecap(user)

    await user.click(await sheet.findByTestId('recap-share'))

    expect(share).toHaveBeenCalledWith({ text: expect.stringContaining(formatKg(5240)) })
    expect(share.mock.calls[0][0].text).toContain('Squat, Bench Press')
  })

  it('copies the text when the browser cannot share', async () => {
    server()
    const toast = vi.fn()
    const user = renderDetail(toast)
    const sheet = await openRecap(user)

    await user.click(await sheet.findByTestId('recap-share'))

    expect(await navigator.clipboard.readText()).toContain(formatKg(5240))
    expect(toast).toHaveBeenCalledWith({ message: t.recapCopied })
  })

  it('goes back to the workout list when done', async () => {
    server()
    const user = renderDetail()
    const sheet = await openRecap(user)
    await user.click(await sheet.findByRole('button', { name: t.recapDone }))
    expect(await screen.findByText('workout list')).toBeInTheDocument()
  })
})
