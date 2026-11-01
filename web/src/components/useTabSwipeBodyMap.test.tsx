import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { t } from '../lib/i18n'
import { RecapMuscles } from './MuscleMapCard'
import { useTabSwipe } from './useTabSwipe'

const navigate = vi.fn()
vi.mock('react-router', () => ({ useNavigate: () => navigate }))

function SwipePage() {
  useTabSwipe()
  return (
    <main>
      <p data-testid="plain">text</p>
      <svg className="body-map">
        <g data-testid="muscle" />
      </svg>
    </main>
  )
}

/** A quick 120 px drag to the left, like a finger sliding while tapping a muscle. */
function dragLeft(target: Element) {
  const touch = (x: number) => ({ clientX: x, clientY: 300, target }) as unknown as Touch
  target.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [touch(250)] }))
  target.dispatchEvent(new TouchEvent('touchend', { bubbles: true, changedTouches: [touch(130)] }))
}

afterEach(() => {
  cleanup()
  navigate.mockClear()
})

describe('tab swipe and the body map', () => {
  it('switches tabs from a plain part of the page', () => {
    const { getByTestId } = render(<SwipePage />)
    dragLeft(getByTestId('plain'))
    expect(navigate).toHaveBeenCalledWith('/nutrition', { viewTransition: true })
  })

  it('leaves a drag that starts on the body map alone', () => {
    const { getByTestId } = render(<SwipePage />)
    dragLeft(getByTestId('muscle'))
    expect(navigate).not.toHaveBeenCalled()
  })

  it("leaves a drag on a workout's tappable map alone, and the tap still opens the muscle", () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } })
    const { getByRole, getByTestId } = render(
      <QueryClientProvider client={client}>
        <WorkoutMapPage />
      </QueryClientProvider>,
    )
    const quads = getByRole('button', { name: new RegExp(`^${t.muscleNames.QUADS}:`) })
    dragLeft(quads)
    fireEvent.click(quads)
    expect(navigate).not.toHaveBeenCalled()
    expect(getByTestId('muscle-detail')).toHaveAccessibleName(t.muscleNames.QUADS)
  })
})

function WorkoutMapPage() {
  useTabSwipe()
  return <RecapMuscles muscles={[{ muscle: 'QUADS', sets: 3, exercises: [{ name: 'Squat', sets: 3 }] }]} />
}
