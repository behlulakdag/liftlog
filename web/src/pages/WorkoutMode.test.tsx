import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PlanItem, WorkoutSet } from '../api/types'
import { t } from '../lib/i18n'
import { WorkoutMode } from './WorkoutMode'

const run: PlanItem = {
  exerciseId: 9, name: 'Running', bodyweight: false, plannedSets: 3, loggedSets: 0, targetReps: 10,
  suggestedWeightKg: null, lastWeightKg: null, lastReps: [], suggestion: 'FIRST', increaseKg: null,
}

function renderMode(sets: WorkoutSet[] = []) {
  const onLog = vi.fn()
  const onLogCardio = vi.fn()
  render(
    <WorkoutMode
      plan={[run]}
      sets={sets}
      muscleOf={() => 'Cardio'}
      renderSet={(set) => <div key={set.id}>logged {set.durationSec}</div>}
      renderExtra={() => null}
      onLog={onLog}
      isCardio={(id) => id === 9}
      onLogCardio={onLogCardio}
    />,
  )
  return { user: userEvent.setup(), onLog, onLogCardio }
}

afterEach(cleanup)

describe('a cardio move in workout mode', () => {
  it('offers one button for a time instead of weight × reps rows', async () => {
    const { user, onLog, onLogCardio } = renderMode()
    const card = screen.getByTestId('plan-card-9')
    expect(within(card).queryByRole('button', { name: t.logPlannedSet(1) })).not.toBeInTheDocument()
    await user.click(within(card).getByRole('button', { name: `+ ${t.logCardio}` }))
    expect(onLogCardio).toHaveBeenCalledWith(9)
    expect(onLog).not.toHaveBeenCalled()
  })

  it('is done once one run is logged, whatever the routine planned', () => {
    renderMode([
      { id: 1, exerciseId: 9, exerciseName: 'Running', setOrder: 1, reps: 1, weightKg: 0, rpe: null, newPersonalRecord: false, bodyweight: false, cardio: true, durationSec: 1800, distanceM: 5000, calories: null },
    ])
    const card = screen.getByTestId('plan-card-9')
    expect(card).toHaveTextContent(t.exerciseDone)
    expect(within(card).queryByRole('button', { name: `+ ${t.logCardio}` })).not.toBeInTheDocument()
  })
})
