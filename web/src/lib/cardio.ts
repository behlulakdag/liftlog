import type { SetInput } from '../api/types'
import { formatKg } from './format'

/** Cardio moves are told apart by their equipment, like the server does. */
export const isCardioExercise = (exercise: { equipment?: string | null }) => exercise.equipment === 'CARDIO'

/** A saved set says so itself; a waiting one is cardio when it carries a duration. */
export const isCardioSet = (set: { cardio?: boolean; durationSec?: number | null }) => set.cardio ?? set.durationSec != null

/**
 * Minutes as typed: "30" is 30 minutes, "30:15" is 30 min 15 s, "1:05:00" is an hour and five. Null when it
 * is not a time of 1 second to 24 hours.
 */
export function parseDuration(text: string): number | null {
  const parts = text.trim().split(':')
  if (parts.some((part) => !/^\d+$/.test(part)) || parts.length > 3) return null
  const [h, m, s] = parts.length === 3 ? parts.map(Number) : parts.length === 2 ? [0, ...parts.map(Number)] : [0, Number(parts[0]), 0]
  if (parts.length > 1 && s >= 60) return null
  if (parts.length === 3 && m >= 60) return null
  const seconds = h * 3600 + m * 60 + s
  return seconds >= 1 && seconds <= 86400 ? seconds : null
}

/** 1800 → "30:00", 3900 → "1:05:00": the way a watch shows it. */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

/** Minutes per kilometre, "5:46"; null without a distance. */
export function formatPace(seconds: number, distanceM: number | null | undefined): string | null {
  if (!distanceM) return null
  const perKm = Math.round(seconds / (distanceM / 1000))
  return formatDuration(perKm)
}

/** 5200 m → "5,2" (km in the UI language) */
export const formatKm = (distanceM: number) => formatKg(Math.round(distanceM / 10) / 100)

export type CardioField = 'duration' | 'distance' | 'calories'

export interface CardioForm {
  duration: string
  distance: string
  calories: string
}

/** Distance in km with a comma or a point; both distance and calories may stay empty. */
export function validateCardio(exerciseId: number | null, form: CardioForm): { input: SetInput | null; errors: Set<CardioField> } {
  const errors = new Set<CardioField>()
  const durationSec = parseDuration(form.duration)
  if (durationSec == null) errors.add('duration')
  let distanceM: number | null = null
  if (form.distance.trim() !== '') {
    const km = Number(form.distance.trim().replace(',', '.'))
    if (!Number.isFinite(km) || km < 0 || km > 1000) errors.add('distance')
    else distanceM = Math.round(km * 1000)
  }
  let calories: number | null = null
  if (form.calories.trim() !== '') {
    calories = Number(form.calories)
    if (!Number.isInteger(calories) || calories < 0 || calories > 10000) errors.add('calories')
  }
  const input =
    errors.size === 0 && exerciseId != null && durationSec != null
      ? { exerciseId, reps: 1, weightKg: 0, rpe: null, durationSec, distanceM, calories }
      : null
  return { input, errors }
}
