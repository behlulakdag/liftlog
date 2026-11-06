import { describe, expect, it } from 'vitest'
import { formatDuration, formatKm, formatPace, isCardioSet, parseDuration, validateCardio } from './cardio'

describe('parseDuration', () => {
  it('reads minutes, min:sec and h:min:sec', () => {
    expect(parseDuration('30')).toBe(1800)
    expect(parseDuration('30:15')).toBe(1815)
    expect(parseDuration('1:05:00')).toBe(3900)
    expect(parseDuration(' 45 ')).toBe(2700)
  })

  it('refuses what is not a time', () => {
    expect(parseDuration('')).toBeNull()
    expect(parseDuration('0')).toBeNull()
    expect(parseDuration('10:75')).toBeNull()
    expect(parseDuration('1:75:00')).toBeNull()
    expect(parseDuration('abc')).toBeNull()
    expect(parseDuration('1500')).toBeNull()
  })
})

describe('formatting', () => {
  it('writes time like a watch and pace per km', () => {
    expect(formatDuration(1800)).toBe('30:00')
    expect(formatDuration(3905)).toBe('1:05:05')
    expect(formatPace(1800, 5200)).toBe('5:46')
    expect(formatPace(1800, null)).toBeNull()
    expect(formatKm(5200)).toMatch(/^5[.,]2$/)
  })

  it('knows a waiting cardio set by its duration', () => {
    expect(isCardioSet({ durationSec: 600 })).toBe(true)
    expect(isCardioSet({ durationSec: null })).toBe(false)
    expect(isCardioSet({ cardio: true, durationSec: null })).toBe(true)
  })
})

describe('validateCardio', () => {
  it('builds a cardio set with distance in metres', () => {
    expect(validateCardio(7, { duration: '30', distance: '5,2', calories: '380' }).input).toEqual({
      exerciseId: 7, reps: 1, weightKg: 0, rpe: null, durationSec: 1800, distanceM: 5200, calories: 380,
    })
    expect(validateCardio(7, { duration: '20:00', distance: '', calories: '' }).input).toMatchObject({ durationSec: 1200, distanceM: null, calories: null })
  })

  it('needs a duration and sane extras', () => {
    expect([...validateCardio(7, { duration: '', distance: '', calories: '' }).errors]).toEqual(['duration'])
    expect([...validateCardio(7, { duration: '30', distance: 'x', calories: '-1' }).errors]).toEqual(['distance', 'calories'])
  })
})
