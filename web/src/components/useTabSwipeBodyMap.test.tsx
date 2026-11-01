import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
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
})
