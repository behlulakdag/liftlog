import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Exercise } from '../api/types'
import { t } from '../lib/i18n'
import { fakeServer, jsonResponse } from '../test/fakeServer'
import { ExercisePicker } from './SetEditorSheet'

const primary = (muscle: string) => ({ muscle, role: 'PRIMARY' as const })
const secondary = (muscle: string) => ({ muscle, role: 'SECONDARY' as const })

const catalog: Exercise[] = [
  { id: 1, name: 'Squat', muscleGroup: 'Legs', custom: false, bodyweight: false, equipment: 'BARBELL', muscles: [primary('GLUTES'), primary('QUADS')] },
  { id: 2, name: 'Romanian Deadlift', muscleGroup: 'Legs', custom: false, bodyweight: false, equipment: 'BARBELL', muscles: [primary('HAMSTRINGS'), primary('GLUTES'), secondary('LOWER_BACK')] },
  { id: 3, name: 'Back Extension', muscleGroup: 'Back', custom: false, bodyweight: false, equipment: 'MACHINE', muscles: [primary('LOWER_BACK'), secondary('GLUTES')] },
  { id: 4, name: 'Glute Bridge', muscleGroup: 'Legs', custom: false, bodyweight: true, equipment: 'BODYWEIGHT', muscles: [primary('GLUTES'), secondary('HAMSTRINGS')] },
  { id: 5, name: 'Bench Press', muscleGroup: 'Chest', custom: false, bodyweight: false, equipment: 'BARBELL', muscles: [primary('CHEST'), secondary('TRICEPS')] },
  { id: 6, name: 'Cable Pull-Through', muscleGroup: 'Legs', custom: false, bodyweight: false, equipment: 'CABLE', muscles: [primary('GLUTES'), secondary('HAMSTRINGS')] },
  { id: 7, name: 'Lying Leg Curl', muscleGroup: 'Legs', custom: false, bodyweight: false, equipment: 'MACHINE', muscles: [primary('HAMSTRINGS'), secondary('CALVES')] },
]

function renderPicker() {
  fakeServer({ 'GET /api/v1/exercises': () => jsonResponse(200, catalog) })
  const onPick = vi.fn()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <ExercisePicker onPick={onPick} />
    </QueryClientProvider>,
  )
  return { user: userEvent.setup(), onPick }
}

const mapToggle = () => screen.getByRole('button', { name: new RegExp(t.pickerMuscleMap) })
const figure = (side: 'front' | 'back') => screen.getByRole('group', { name: t.muscleMapFigure(side) })
const section = (title: string) => screen.getByRole('heading', { name: new RegExp(title) }).closest('section')!
const names = (element: HTMLElement) => within(element).getAllByRole('button').map((b) => b.querySelector('span')?.textContent)

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('exercise picker body-map mode', () => {
  it('opens the front and back map and lists the exercises of a tapped muscle, main muscle first', async () => {
    const { user, onPick } = renderPicker()
    await screen.findByText('Squat')
    expect(screen.queryByTestId('picker-muscle-map')).not.toBeInTheDocument()

    await user.click(mapToggle())
    expect(mapToggle()).toHaveAttribute('aria-pressed', 'true')
    expect(figure('front')).toBeInTheDocument()
    expect(screen.getByText(t.pickerMapHint)).toBeInTheDocument()

    await user.click(within(figure('back')).getByRole('button', { name: t.muscleNames.GLUTES }))

    expect(within(figure('back')).getByRole('button', { name: t.muscleNames.GLUTES })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(t.pickerFilteredBy(t.muscleNames.GLUTES))).toBeInTheDocument()
    const list = screen.getByTestId('muscle-exercise-list')
    const [first, second] = within(list).getAllByRole('heading')
    expect(first).toHaveTextContent(t.pickerPrimary)
    expect(second).toHaveTextContent(t.pickerSecondary)
    expect(names(section(t.pickerPrimary))).toEqual(['Cable Pull-Through', 'Glute Bridge', 'Romanian Deadlift', 'Squat'])
    expect(names(section(t.pickerSecondary))).toEqual(['Back Extension'])
    expect(within(list).queryByText('Bench Press')).not.toBeInTheDocument()

    // Tapping one adds it as before
    await user.click(within(list).getByText('Glute Bridge'))
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: 4, name: 'Glute Bridge' }))
  })

  it('picks a muscle from the name strip too, and narrows its list with the search and the filters', async () => {
    const { user } = renderPicker()
    await screen.findByText('Squat')
    await user.click(mapToggle())
    await user.click(within(screen.getByRole('group', { name: t.pickerMuscleChips })).getByRole('button', { name: t.muscleNames.HAMSTRINGS }))

    expect(names(section(t.pickerPrimary))).toEqual(['Lying Leg Curl', 'Romanian Deadlift'])
    expect(names(section(t.pickerSecondary))).toEqual(['Cable Pull-Through', 'Glute Bridge'])

    await user.type(screen.getByRole('textbox', { name: t.searchExercises }), 'glute')
    expect(screen.queryByRole('heading', { name: new RegExp(t.pickerPrimary) })).not.toBeInTheDocument()
    expect(names(section(t.pickerSecondary))).toEqual(['Glute Bridge'])

    await user.clear(screen.getByRole('textbox', { name: t.searchExercises }))
    await user.click(screen.getByRole('button', { name: t.machines }))
    expect(names(section(t.pickerPrimary))).toEqual(['Lying Leg Curl'])
    expect(names(section(t.pickerSecondary))).toEqual(['Cable Pull-Through'])

    await user.type(screen.getByRole('textbox', { name: t.searchExercises }), 'zzz')
    expect(screen.getByText(t.pickerNoMuscleMatches(t.muscleNames.HAMSTRINGS))).toBeInTheDocument()
  })

  it('goes back to every exercise with "all exercises", a second tap, or closing the map', async () => {
    const { user } = renderPicker()
    await screen.findByText('Squat')
    await user.click(mapToggle())
    const chest = () => within(figure('front')).getByRole('button', { name: t.muscleNames.CHEST })

    await user.click(chest())
    expect(screen.getByTestId('muscle-exercise-list')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: t.pickerShowAll }))
    expect(screen.queryByTestId('muscle-exercise-list')).not.toBeInTheDocument()
    expect(screen.getByText('Lying Leg Curl')).toBeInTheDocument()
    expect(chest()).toHaveAttribute('aria-pressed', 'false')

    // Tapping the same muscle again clears it
    await user.click(chest())
    await user.click(chest())
    expect(screen.queryByTestId('muscle-exercise-list')).not.toBeInTheDocument()

    await user.click(chest())
    await user.click(mapToggle())
    expect(screen.queryByTestId('picker-muscle-map')).not.toBeInTheDocument()
    expect(screen.queryByTestId('muscle-exercise-list')).not.toBeInTheDocument()
    expect(screen.getByText('Squat')).toBeInTheDocument()
  })
})
