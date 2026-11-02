import { describe, expect, it } from 'vitest'
import { formatLitres, glassFills, validateWaterSettings } from './water'

describe('formatLitres', () => {
  it('writes the total in litres with the locale decimal mark', () => {
    expect(formatLitres(1250, 'tr')).toBe('1,25')
    expect(formatLitres(1250, 'en')).toBe('1.25')
    expect(formatLitres(2000, 'en')).toBe('2')
    expect(formatLitres(0, 'en')).toBe('0')
  })
})

describe('glassFills', () => {
  it('fills a goal-sized row of glasses, the last one partly', () => {
    expect(glassFills(625, 1000, 250)).toEqual([1, 1, 0.5, 0])
  })

  it('rounds the row up when the goal is not a whole number of glasses', () => {
    expect(glassFills(0, 2000, 300)).toHaveLength(7)
  })

  it('keeps every glass full once the goal is passed', () => {
    expect(glassFills(1500, 1000, 250)).toEqual([1, 1, 1, 1])
  })

  it('shows one glass per glass drunk without a goal', () => {
    expect(glassFills(0, null, 250)).toEqual([])
    expect(glassFills(600, null, 250)).toEqual([1, 1, 0.4])
  })
})

describe('validateWaterSettings', () => {
  it('reads the goal in litres with a comma or a point', () => {
    expect(validateWaterSettings('2,5', '250').value).toEqual({ goalMl: 2500, glassMl: 250 })
    expect(validateWaterSettings('2.5', '330').value).toEqual({ goalMl: 2500, glassMl: 330 })
  })

  it('clears the goal when it is left empty', () => {
    expect(validateWaterSettings(' ', '250').value).toEqual({ goalMl: null, glassMl: 250 })
  })

  it('rejects a goal or glass outside the limits', () => {
    expect([...validateWaterSettings('0,1', '250').errors]).toEqual(['goal'])
    expect([...validateWaterSettings('11', '250').errors]).toEqual(['goal'])
    expect([...validateWaterSettings('abc', '250').errors]).toEqual(['goal'])
    expect([...validateWaterSettings('2', '20').errors]).toEqual(['glass'])
    expect([...validateWaterSettings('2', '').errors]).toEqual(['glass'])
    expect(validateWaterSettings('2', '1500').value).toBeNull()
  })
})
