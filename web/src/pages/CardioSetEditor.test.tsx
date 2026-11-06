import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Exercise } from '../api/types'
import { t } from '../lib/i18n'
import { fakeServer, jsonResponse } from '../test/fakeServer'
import { SetEditorSheet, type SetEditorProps } from './SetEditorSheet'

const catalog: Exercise[] = [
  { id: 1, name: 'Bench Press', muscleGroup: 'Chest', custom: false, bodyweight: false, equipment: 'BARBELL' },
  { id: 9, name: 'Running', muscleGroup: 'Cardio', custom: false, bodyweight: false, equipment: 'CARDIO' },
]

function renderEditor(initial: SetEditorProps['initial'], isEditing = false) {
  fakeServer({ 'GET /api/v1/exercises': () => jsonResponse(200, catalog) })
  const onSave = vi.fn()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <SetEditorSheet initial={initial} isEditing={isEditing} isSaving={false} onSave={onSave} onClose={() => {}} />
    </QueryClientProvider>,
  )
  return { user: userEvent.setup(), onSave }
}

const blank = { exerciseId: null, exerciseName: null, bodyweight: false, reps: '', weight: '', rpe: '' }

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('cardio in the set sheet', () => {
  it('asks for time, distance and calories instead of weight and reps, and saves them', async () => {
    const { user, onSave } = renderEditor(blank)
    await user.click(await screen.findByRole('button', { name: t.cardio }))
    await user.click(await screen.findByRole('button', { name: /Running/ }))

    expect(screen.queryByLabelText(t.weightKg)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(t.reps)).not.toBeInTheDocument()
    await user.type(screen.getByLabelText(t.cardioDurationLabel), '30:15')
    await user.type(screen.getByLabelText(t.distanceKmOptional), '5,2')
    await user.click(screen.getByTestId('save-set'))

    expect(onSave).toHaveBeenCalledWith({ exerciseId: 9, reps: 1, weightKg: 0, rpe: null, durationSec: 1815, distanceM: 5200, calories: null }, 1)
  })

  it('will not save a cardio set without a time', async () => {
    const { user, onSave } = renderEditor({ ...blank, exerciseId: 9, exerciseName: 'Running', cardio: true })
    await user.click(screen.getByTestId('save-set'))
    expect(screen.getByText(t.errorDuration)).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('opens an existing cardio set with its values', () => {
    renderEditor({ ...blank, exerciseId: 9, exerciseName: 'Running', cardio: true, cardioForm: { duration: '30:00', distance: '5.2', calories: '380' } }, true)
    expect(screen.getByLabelText(t.cardioDurationLabel)).toHaveValue('30:00')
    expect(screen.getByLabelText(t.caloriesOptional)).toHaveValue('380')
  })
})
