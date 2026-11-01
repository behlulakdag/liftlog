import { describe, expect, it } from 'vitest'
import { bandFor, bandsFor, bandThresholds, exercisesForMuscle, foldMuscle, foldMuscleStats, formatSets, MAP_MUSCLES, SIDE_MUSCLES, musclesOfSets, muscleStatsOfSets, suggestedExercises } from './muscles'

describe('bandThresholds', () => {
  it('uses 5 and 10 sets for a week', () => {
    expect(bandThresholds(7)).toEqual([5, 10])
  })

  it('scales 30 days by 30/7 and rounds', () => {
    // 5 × 30/7 = 21.4, 10 × 30/7 = 42.9
    expect(bandThresholds(30)).toEqual([21, 43])
  })

  it('uses 2 and 4 sets for a single workout', () => {
    expect(bandThresholds('workout')).toEqual([2, 4])
  })
})

describe('bandFor', () => {
  it.each([
    [0, 'none'],
    [0.5, 'low'],
    [4.5, 'low'],
    [5, 'mid'],
    [9.5, 'mid'],
    [10, 'high'],
    [24, 'high'],
  ] as const)('7 days: %s sets is %s', (sets, band) => {
    expect(bandFor(sets, 7)).toBe(band)
  })

  it.each([
    [20.5, 'low'],
    [21, 'mid'],
    [42.5, 'mid'],
    [43, 'high'],
  ] as const)('30 days: %s sets is %s', (sets, band) => {
    expect(bandFor(sets, 30)).toBe(band)
  })

  it.each([
    [1.5, 'low'],
    [2, 'mid'],
    [3.5, 'mid'],
    [4, 'high'],
  ] as const)('one workout: %s sets is %s', (sets, band) => {
    expect(bandFor(sets, 'workout')).toBe(band)
  })

  it('treats negative or missing numbers as not trained', () => {
    expect(bandFor(-1, 7)).toBe('none')
    expect(bandFor(Number.NaN, 7)).toBe('none')
  })
})

describe('folding', () => {
  it('maps adductors to quads and abductors to glutes', () => {
    expect(foldMuscle('ADDUCTORS')).toBe('QUADS')
    expect(foldMuscle('ABDUCTORS')).toBe('GLUTES')
    expect(foldMuscle('CHEST')).toBe('CHEST')
    expect(foldMuscle('NECK')).toBeNull()
  })

  it('adds folded sets and merges exercises by name, busiest first', () => {
    const folded = foldMuscleStats([
      { muscle: 'QUADS', sets: 8, exercises: [{ name: 'Squat', sets: 5 }, { name: 'Leg Press', sets: 3 }] },
      { muscle: 'ADDUCTORS', sets: 2.5, exercises: [{ name: 'Squat', sets: 2.5 }] },
      { muscle: 'NECK', sets: 3, exercises: [{ name: 'Neck curl', sets: 3 }] },
    ])
    expect([...folded.keys()]).toEqual(['QUADS'])
    expect(folded.get('QUADS')).toEqual({
      muscle: 'QUADS',
      sets: 10.5,
      exercises: [
        { name: 'Squat', sets: 7.5 },
        { name: 'Leg Press', sets: 3 },
      ],
    })
  })

  it('works without exercises (single workout) and keeps one decimal exact', () => {
    const folded = foldMuscleStats([
      { muscle: 'GLUTES', sets: 0.1 },
      { muscle: 'ABDUCTORS', sets: 0.2 },
    ])
    expect(folded.get('GLUTES')?.sets).toBe(0.3)
    expect(bandsFor(folded, 'workout')).toEqual({ GLUTES: 'low' })
  })
})

describe('sides', () => {
  it('shows every map muscle on at least one side', () => {
    const shown = new Set([...SIDE_MUSCLES.front, ...SIDE_MUSCLES.back])
    expect([...shown].sort()).toEqual([...MAP_MUSCLES].sort())
  })
})

it('formats sets with one decimal at most', () => {
  expect(formatSets(12, 'en')).toBe('12')
  expect(formatSets(2.5, 'tr')).toBe('2,5')
  expect(formatSets(1.25, 'en')).toBe('1.3')
})

describe('musclesOfSets', () => {
  const exercises = [
    { id: 1, muscles: [{ muscle: 'CHEST', role: 'PRIMARY' as const }, { muscle: 'TRICEPS', role: 'SECONDARY' as const }] },
    // QUADS primary and ADDUCTORS secondary land on one region: the primary role wins, nothing counts twice
    { id: 2, muscles: [{ muscle: 'QUADS', role: 'PRIMARY' as const }, { muscle: 'ADDUCTORS', role: 'SECONDARY' as const }] },
  ]

  it('counts 1 per primary and 0.5 per secondary muscle for every set', () => {
    const sets = [{ exerciseId: 1 }, { exerciseId: 1 }, { exerciseId: 1 }, { exerciseId: 2 }, { exerciseId: 99 }]
    expect(musclesOfSets(sets, exercises)).toEqual([
      { muscle: 'CHEST', sets: 3 },
      { muscle: 'TRICEPS', sets: 1.5 },
      { muscle: 'QUADS', sets: 1 },
    ])
  })

  it('lists the exercises behind each muscle, most sets first, with the same weights', () => {
    const named = [
      { exerciseId: 2, exerciseName: 'Squat' },
      { exerciseId: 1, exerciseName: 'Bench Press' },
      { exerciseId: 1, exerciseName: 'Bench Press' },
      { exerciseId: 3 },
    ]
    const catalog = [...exercises, { id: 3, name: 'Dips', muscles: [{ muscle: 'CHEST', role: 'SECONDARY' as const }] }]
    expect(muscleStatsOfSets(named, catalog)).toEqual([
      { muscle: 'QUADS', sets: 1, exercises: [{ name: 'Squat', sets: 1 }] },
      { muscle: 'CHEST', sets: 2.5, exercises: [{ name: 'Bench Press', sets: 2 }, { name: 'Dips', sets: 0.5 }] },
      { muscle: 'TRICEPS', sets: 1, exercises: [{ name: 'Bench Press', sets: 1 }] },
    ])
  })

  it('uses the single-workout bands for one day', () => {
    expect(bandFor(1, 1)).toBe('low')
    expect(bandFor(2, 1)).toBe('mid')
    expect(bandFor(4, 1)).toBe('high')
  })
})

describe('exercisesForMuscle', () => {
  const p = (muscle: string) => ({ muscle, role: 'PRIMARY' as const })
  const s = (muscle: string) => ({ muscle, role: 'SECONDARY' as const })
  const exercises = [
    { name: 'Squat', equipment: 'BARBELL', muscles: [p('QUADS'), p('GLUTES'), s('LOWER_BACK')] },
    { name: 'Romanian Deadlift', equipment: 'BARBELL', muscles: [p('HAMSTRINGS'), p('GLUTES'), s('LOWER_BACK')] },
    { name: 'Back Extension', equipment: 'MACHINE', muscles: [p('LOWER_BACK'), s('GLUTES')] },
    { name: 'Cable Hip Adduction', equipment: 'CABLE', muscles: [p('ADDUCTORS')] },
    { name: 'Hack Squat', equipment: 'MACHINE', muscles: [p('QUADS'), s('ADDUCTORS')] },
    { name: 'Old custom', equipment: null },
  ]

  it('splits primary from secondary and sorts each by name', () => {
    const glutes = exercisesForMuscle(exercises, 'GLUTES')
    expect(glutes.primary.map((e) => e.name)).toEqual(['Romanian Deadlift', 'Squat'])
    expect(glutes.secondary.map((e) => e.name)).toEqual(['Back Extension'])
  })

  it('counts folded muscles for their region, primary winning', () => {
    const quads = exercisesForMuscle(exercises, 'QUADS')
    expect(quads.primary.map((e) => e.name)).toEqual(['Cable Hip Adduction', 'Hack Squat', 'Squat'])
    expect(quads.secondary).toEqual([])
  })

  it('finds nothing for a muscle no exercise works', () => {
    expect(exercisesForMuscle(exercises, 'CALVES')).toEqual({ primary: [], secondary: [] })
  })

  it('suggests a few primaries, one per equipment in turn', () => {
    const many = [
      { id: 300, name: 'Decline Bench Press', equipment: 'BARBELL', muscles: [p('CHEST')] },
      { id: 1, name: 'Bench Press', equipment: 'BARBELL', muscles: [p('CHEST')] },
      { id: 2, name: 'Incline Bench Press', equipment: 'BARBELL', muscles: [p('CHEST')] },
      { id: 60, name: 'Dumbbell Fly', equipment: 'DUMBBELL', muscles: [p('CHEST')] },
      { id: 50, name: 'Pec Deck', equipment: 'MACHINE', muscles: [p('CHEST')] },
      { id: 70, name: 'Cable Fly', equipment: 'CABLE', muscles: [p('CHEST')] },
      { id: 20, name: 'Push-up', equipment: 'BODYWEIGHT', muscles: [p('CHEST')] },
      { id: 3, name: 'Overhead Press', equipment: 'BARBELL', muscles: [s('CHEST')] },
    ]
    // Barbell, machine, dumbbell, bodyweight, cable; the oldest (lowest id) of each first
    const { shown, more } = suggestedExercises(many, 'CHEST', 6)
    expect(shown.map((e) => e.name)).toEqual(['Bench Press', 'Pec Deck', 'Dumbbell Fly', 'Push-up', 'Cable Fly', 'Incline Bench Press'])
    expect(more).toBe(1)
  })
})

