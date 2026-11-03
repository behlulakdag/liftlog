import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Program } from '../api/types'
import { formatKg } from '../lib/format'
import { t } from '../lib/i18n'
import { todayIso } from '../lib/nutrition'
import { fakeServer, jsonResponse } from '../test/fakeServer'
import { ConfirmProvider } from './Confirm'
import { BlockLine, GoalsSection, ProgramSheet } from './ProgramGoals'
import { ToastProvider } from './Toast'

const empty: Program = { blockStart: null, blockWeeks: null, currentWeek: null, goals: [], weightGoal: null }
const set: Program = {
  blockStart: '2026-10-18',
  blockWeeks: 12,
  currentWeek: 3,
  goals: [{ exerciseId: 1, exerciseName: 'Bench Press', bodyweight: false, startKg: 70, targetKg: 95, currentKg: 72.5 }],
  weightGoal: { startKg: 77.9, targetKg: 80, currentKg: 78.3 },
}

function renderWith(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <ConfirmProvider>{ui}</ConfirmProvider>
      </ToastProvider>
    </QueryClientProvider>,
  )
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('BlockLine', () => {
  it('shows the week of the block, its end, or a way to set one up', () => {
    renderWith(<BlockLine program={set} onEdit={() => {}} />)
    expect(screen.getByTestId('block-line')).toHaveTextContent(t.blockWeek(3, 12))
    cleanup()
    renderWith(<BlockLine program={{ ...set, currentWeek: 13 }} onEdit={() => {}} />)
    expect(screen.getByTestId('block-line')).toHaveTextContent(t.blockOver(12))
    cleanup()
    renderWith(<BlockLine program={empty} onEdit={() => {}} />)
    expect(screen.getByTestId('block-line')).toHaveTextContent(t.addBlock)
  })
})

describe('GoalsSection', () => {
  it('lists each goal with where it stands, the body weight last', () => {
    renderWith(<GoalsSection program={set} onEdit={() => {}} />)
    const goals = screen.getByRole('region', { name: t.blockGoals(12) })
    const rows = within(goals).getAllByRole('listitem')
    expect(rows[0]).toHaveTextContent('Bench Press')
    expect(rows[0]).toHaveTextContent(t.goalProgressText(formatKg(72.5), formatKg(95)))
    expect(rows[1]).toHaveTextContent(t.bodyWeightGoalShort)
  })

  it('is not there without goals', () => {
    renderWith(<GoalsSection program={empty} onEdit={() => {}} />)
    expect(screen.queryByTestId('goals')).not.toBeInTheDocument()
  })
})

describe('ProgramSheet', () => {
  it('saves the block and adds a goal', async () => {
    const today = todayIso()
    const calls = fakeServer({
      'GET /api/v1/exercises': () => jsonResponse(200, [{ id: 2, name: 'Deadlift', muscleGroup: 'Back', custom: false, bodyweight: false }]),
      'PUT /api/v1/program/block': () => jsonResponse(200, { ...empty, blockStart: '2026-10-18', blockWeeks: 12, currentWeek: 3 }),
      'PUT /api/v1/program/goals/2': () => jsonResponse(200, set),
    })
    const user = userEvent.setup()
    renderWith(<ProgramSheet program={empty} onClose={() => {}} />)

    const weeks = screen.getByLabelText(t.blockWeeksLabel)
    await user.clear(weeks)
    await user.type(weeks, '12')
    await user.click(screen.getByRole('button', { name: t.save }))
    await waitFor(() => expect(calls.find((c) => c.path === '/api/v1/program/block')?.body).toEqual({ startDate: today, weeks: 12 }))

    await user.selectOptions(await screen.findByLabelText(t.goalExercise), 'Deadlift')
    await user.type(screen.getByLabelText(t.goalTarget), '170')
    await user.click(screen.getByRole('button', { name: t.addGoal }))
    await waitFor(() => expect(calls.find((c) => c.path === '/api/v1/program/goals/2')?.body).toEqual({ targetKg: 170 }))
  })

  it('asks before removing a goal', async () => {
    const calls = fakeServer({
      'GET /api/v1/exercises': () => jsonResponse(200, []),
      'DELETE /api/v1/program/goals/1': () => new Response(null, { status: 204 }),
    })
    const user = userEvent.setup()
    renderWith(<ProgramSheet program={set} onClose={() => {}} />)

    await user.click(screen.getByRole('button', { name: t.removeGoal('Bench Press') }))
    const dialog = screen.getByRole('alertdialog')
    expect(dialog).toHaveTextContent('Bench Press')
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false)
    await user.click(within(dialog).getByRole('button', { name: t.delete }))
    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE' && c.path === '/api/v1/program/goals/1')).toBe(true))
  })
})
