import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import type { CardioHistory } from '../api/types'
import { t } from '../lib/i18n'
import { CardioCard } from './CardioCard'

const running: CardioHistory = {
  exerciseId: 9,
  exerciseName: 'Running',
  sessions: [
    { date: '2026-11-01', durationSec: 1500, distanceM: 4000 },
    { date: '2026-11-04', durationSec: 1800, distanceM: 5200 },
  ],
}
const stairs: CardioHistory = { exerciseId: 11, exerciseName: 'Stair Climber', sessions: [{ date: '2026-11-03', durationSec: 900, distanceM: null }] }

afterEach(cleanup)

describe('CardioCard', () => {
  it('shows the latest session with its pace and the best pace', () => {
    render(<CardioCard history={[running]} />)
    const card = screen.getByTestId('cardio-card')
    expect(card).toHaveTextContent('30:00')
    expect(card).toHaveTextContent(t.paceShort('5:46'))
    // 25:00 for 4 km is 6:15 /km, slower than 5:46
    expect(card).toHaveTextContent(`${t.cardioBestPace}${t.paceShort('5:46')}`)
    expect(screen.getByTestId('cardio-chart')).toBeInTheDocument()
  })

  it('switches moves, and a move without distance has no pace', async () => {
    const user = userEvent.setup()
    render(<CardioCard history={[running, stairs]} />)
    await user.click(screen.getByRole('tab', { name: 'Stair Climber' }))
    const card = screen.getByTestId('cardio-card')
    expect(card).toHaveTextContent('15:00')
    expect(card).not.toHaveTextContent(t.cardioBestPace)
    // One session is not a trend yet
    expect(screen.queryByTestId('cardio-chart')).not.toBeInTheDocument()
  })

  it('is not there without cardio', () => {
    render(<CardioCard history={[]} />)
    expect(screen.queryByTestId('cardio-card')).not.toBeInTheDocument()
  })
})
