import { describe, expect, it } from 'vitest'
import { goalProgress, parseTargetKg, validateBlock } from './program'

describe('goalProgress', () => {
  it('measures the way from start to target', () => {
    expect(goalProgress(70, 72.5, 95)).toBeCloseTo(0.1)
    expect(goalProgress(70, 70, 95)).toBe(0)
    expect(goalProgress(70, 100, 95)).toBe(1)
  })

  it('fills a goal below the start as the weight comes down', () => {
    expect(goalProgress(80, 78, 76)).toBeCloseTo(0.5)
    expect(goalProgress(80, 82, 76)).toBe(0)
  })

  it('treats an unknown current value as no progress and a goal met when set as done', () => {
    expect(goalProgress(null, null, 80)).toBe(0)
    expect(goalProgress(80, 80, 80)).toBe(1)
  })
})

describe('validateBlock', () => {
  it('takes a date and 1 to 52 weeks', () => {
    expect(validateBlock('2026-10-18', '12').value).toEqual({ startDate: '2026-10-18', weeks: 12 })
    expect([...validateBlock('', '12').errors]).toEqual(['start'])
    expect([...validateBlock('2026-10-18', '0').errors]).toEqual(['weeks'])
    expect([...validateBlock('2026-10-18', '53').errors]).toEqual(['weeks'])
  })
})

describe('parseTargetKg', () => {
  it('reads a comma or a point and keeps the limits', () => {
    expect(parseTargetKg('97,5', 0.5, 1000)).toBe(97.5)
    expect(parseTargetKg(' 95 ', 0.5, 1000)).toBe(95)
    expect(parseTargetKg('', 0.5, 1000)).toBeNull()
    expect(parseTargetKg('abc', 0.5, 1000)).toBeNull()
    expect(parseTargetKg('1200', 0.5, 1000)).toBeNull()
  })
})
