import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Exercise, MuscleStats } from '../api/types'
import { t } from '../lib/i18n'
import { formatSets } from '../lib/muscles'
import { todayIso } from '../lib/nutrition'
import { ProgressPage } from '../pages/ProgressPage'
import { jsonResponse } from '../test/fakeServer'
import { MuscleMapCard } from './MuscleMapCard'

const week: MuscleStats = {
  days: 7,
  from: '2026-10-13',
  to: '2026-10-19',
  muscles: [
    { muscle: 'CHEST', sets: 12, exercises: [{ name: 'Bench Press', sets: 8 }, { name: 'Dips', sets: 4 }] },
    { muscle: 'LATS', sets: 3, exercises: [{ name: 'Row', sets: 3 }] },
    { muscle: 'QUADS', sets: 4, exercises: [{ name: 'Squat', sets: 4 }] },
    { muscle: 'ADDUCTORS', sets: 1.5, exercises: [{ name: 'Squat', sets: 1.5 }] },
  ],
}

const primary = (muscle: string) => ({ muscle, role: 'PRIMARY' as const })
const secondary = (muscle: string) => ({ muscle, role: 'SECONDARY' as const })
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
  exercise(1, 'Bench Press', 'BARBELL', [primary('CHEST'), secondary('TRICEPS')]),
  exercise(2, 'Incline Bench Press', 'BARBELL', [primary('CHEST')]),
  exercise(3, 'Decline Bench Press', 'BARBELL', [primary('CHEST')]),
  exercise(4, 'Dumbbell Fly', 'DUMBBELL', [primary('CHEST')]),
  exercise(5, 'Pec Deck', 'MACHINE', [primary('CHEST')]),
  exercise(6, 'Cable Crossover', 'CABLE', [primary('CHEST')]),
  exercise(7, 'Push-up', 'BODYWEIGHT', [primary('CHEST')]),
  exercise(8, 'Overhead Press', 'BARBELL', [primary('FRONT_DELTS'), secondary('CHEST')]),
  exercise(9, 'Squat', 'BARBELL', [primary('QUADS')]),
]

const empty: MuscleStats = { days: 30, from: '2026-09-20', to: '2026-10-19', muscles: [] }

/** Answers by path like fakeServer, but keeps the full URL so the query string can be checked. */
function stubServer(routes: Record<string, (url: URL) => Response>): URL[] {
  const urls: URL[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string) => {
      const url = new URL(input)
      urls.push(url)
      return routes[url.pathname]?.(url) ?? jsonResponse(404, { status: 404 })
    }),
  )
  return urls
}

function muscleRoute(url: URL) {
  return jsonResponse(200, url.searchParams.get('days') === '30' ? empty : week)
}

function renderWithClient(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
  return userEvent.setup()
}

const figure = (side: 'front' | 'back') => screen.getByRole('group', { name: t.muscleMapFigure(side) })

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('muscle map card', () => {
  it("asks for the last 7 days ending on the phone's date and colours the front", async () => {
    const urls = stubServer({ '/api/v1/stats/muscles': muscleRoute })
    renderWithClient(<MuscleMapCard />)

    const chest = await screen.findByRole('button', { name: t.muscleAria(t.muscleNames.CHEST, t.muscleSets('12')) })
    expect(chest).toHaveAttribute('data-band', 'high')
    // 4 + 1.5 folded adductor sets
    expect(screen.getByRole('button', { name: t.muscleAria(t.muscleNames.QUADS, t.muscleSets(formatSets(5.5))) })).toHaveAttribute('data-band', 'mid')
    expect(urls[0].searchParams.get('days')).toBe('7')
    expect(urls[0].searchParams.get('today')).toBe(todayIso())
    expect(screen.getByText(t.muscleBandLow)).toBeInTheDocument()
  })

  it('switches between the front and back figures', async () => {
    stubServer({ '/api/v1/stats/muscles': muscleRoute })
    const user = renderWithClient(<MuscleMapCard />)
    await screen.findByRole('button', { name: new RegExp(t.muscleNames.CHEST) })
    expect(figure('front')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: t.muscleMapBack }))

    expect(figure('back')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: t.muscleMapBack })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('button', { name: new RegExp(t.muscleNames.CHEST) })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: new RegExp(t.muscleNames.LATS) })).toHaveAttribute('data-band', 'low')
  })

  it('shows the muscle, its sets and the exercises when tapped, and hides them again', async () => {
    stubServer({ '/api/v1/stats/muscles': muscleRoute })
    const user = renderWithClient(<MuscleMapCard />)

    await user.click(await screen.findByRole('button', { name: new RegExp(t.muscleNames.CHEST) }))

    const panel = within(screen.getByTestId('muscle-detail'))
    expect(panel.getByText(t.muscleNames.CHEST)).toBeInTheDocument()
    expect(panel.getByText(t.muscleSets('12'))).toBeInTheDocument()
    const rows = panel.getAllByRole('listitem')
    expect(rows[0]).toHaveTextContent('Bench Press')
    expect(rows[0]).toHaveTextContent(t.muscleSets('8'))
    expect(rows[1]).toHaveTextContent('Dips')

    await user.click(panel.getByRole('button', { name: t.close }))
    expect(screen.queryByTestId('muscle-detail')).not.toBeInTheDocument()
  })

  it('says a muscle was not trained when it has no sets', async () => {
    stubServer({ '/api/v1/stats/muscles': muscleRoute })
    const user = renderWithClient(<MuscleMapCard />)
    await user.click(await screen.findByRole('button', { name: new RegExp(t.muscleNames.ABS) }))
    expect(within(screen.getByTestId('muscle-detail')).getByText(t.muscleNotTrained)).toBeInTheDocument()
  })

  it('shows the empty state for a window without sets', async () => {
    const urls = stubServer({ '/api/v1/stats/muscles': muscleRoute })
    const user = renderWithClient(<MuscleMapCard />)
    await screen.findByRole('button', { name: new RegExp(t.muscleNames.CHEST) })

    await user.click(screen.getByRole('button', { name: t.muscleMapDays(30) }))

    expect(await screen.findByText(t.muscleMapEmptyTitle(30))).toBeInTheDocument()
    expect(urls.at(-1)!.searchParams.get('days')).toBe('30')
    expect(screen.queryByText(t.muscleBandLow)).not.toBeInTheDocument()
    // Still tappable: the panel says "not trained" and which exercises would work it
    await user.click(screen.getByRole('button', { name: new RegExp(t.muscleNames.CHEST) }))
    expect(within(screen.getByTestId('muscle-detail')).getByText(t.muscleNotTrained)).toBeInTheDocument()
  })

  it('lists the exercises that work the tapped muscle, primary ones only, staples first and varied by equipment', async () => {
    const urls = stubServer({ '/api/v1/stats/muscles': muscleRoute, '/api/v1/exercises': () => jsonResponse(200, catalog) })
    const user = renderWithClient(<MuscleMapCard />)
    await screen.findByRole('button', { name: new RegExp(t.muscleNames.CHEST) })
    // The catalog is only asked for once a muscle is tapped
    expect(urls.some((url) => url.pathname === '/api/v1/exercises')).toBe(false)

    await user.click(screen.getByRole('button', { name: new RegExp(t.muscleNames.CHEST) }))

    const suggestions = within(await screen.findByTestId('muscle-suggestions'))
    expect(suggestions.getByText(t.muscleExercisesTitle)).toBeInTheDocument()
    expect(suggestions.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Bench Press',
      'Pec Deck',
      'Dumbbell Fly',
      'Push-up',
      'Cable Crossover',
      'Incline Bench Press',
    ])
    // 7 primaries, 6 shown; Overhead Press only helps the chest and Squat does not touch it
    expect(suggestions.getByText(t.muscleExercisesMore(1))).toBeInTheDocument()
    expect(suggestions.queryByText('Overhead Press')).not.toBeInTheDocument()
  })

  it('leaves the card out on a server without the endpoint', async () => {
    const urls = stubServer({})
    renderWithClient(<MuscleMapCard />)
    await vi.waitFor(() => expect(urls).toHaveLength(1))
    await vi.waitFor(() => expect(screen.queryByTestId('muscle-map-card')).not.toBeInTheDocument())
  })
})

describe('progress page', () => {
  it('shows the muscle map card with the records', async () => {
    stubServer({
      '/api/v1/stats/prs': () =>
        jsonResponse(200, [
          {
            exerciseId: 1,
            exerciseName: 'Bench Press',
            heaviestWeightKg: 100,
            heaviestAddedKg: 100,
            heaviestReps: 5,
            heaviestDate: '2026-10-18',
            bestEstimated1RmKg: 116.7,
            bestEstimated1RmDate: '2026-10-18',
            totalSets: 6,
            bodyweight: false,
          },
        ]),
      '/api/v1/stats/volume': () => jsonResponse(200, []),
      '/api/v1/stats/progress': () => jsonResponse(200, []),
      '/api/v1/stats/muscles': muscleRoute,
    })
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce'), addEventListener() {}, removeEventListener() {} }))
    renderWithClient(<ProgressPage />)

    const card = await screen.findByTestId('muscle-map-card')
    expect(within(card).getByRole('heading', { name: t.muscleMapTitle })).toBeInTheDocument()
    expect(await within(card).findByRole('button', { name: new RegExp(t.muscleNames.CHEST) })).toHaveAttribute('data-band', 'high')
  })
})
