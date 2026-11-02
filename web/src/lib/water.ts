import { formatKg } from './format'

/** Glass sizes offered as one-tap choices; any other size can be typed. */
export const GLASS_PRESETS_ML = [200, 250, 330, 500] as const
/** Limits mirror the users CHECK constraints on the server. */
export const GOAL_MIN_ML = 250
export const GOAL_MAX_ML = 10000
export const GLASS_MIN_ML = 50
export const GLASS_MAX_ML = 1000
/** More glasses than this would wrap into a wall of icons; the rest are summed up as "+N". */
export const MAX_GLASS_ICONS = 12

/** 1250 → "1,25" in Turkish, "1.25" in English: litres read easier than millilitres for a day's total. */
export function formatLitres(ml: number, loc?: string): string {
  return formatKg(Math.round(ml / 10) / 100, loc)
}

/**
 * How full each glass icon is, 0 to 1, for a day's total against the goal. Without a goal there is no fixed row,
 * so one icon per glass drunk is shown, always full.
 */
export function glassFills(waterMl: number, goalMl: number | null, glassMl: number): number[] {
  const drunk = waterMl / glassMl
  const count = goalMl == null ? Math.ceil(drunk) : Math.max(1, Math.ceil(goalMl / glassMl))
  // Rounded so 600 ml of 250 ml glasses ends in 0.4, not 0.39999…
  return Array.from({ length: count }, (_, index) => Math.round(Math.min(1, Math.max(0, drunk - index)) * 100) / 100)
}

export type WaterSettingsInput = { goalMl: number | null; glassMl: number }
export type WaterField = 'goal' | 'glass'

/** The goal is typed in litres ("2", "2,5", "2.5"); an empty goal clears it. */
export function validateWaterSettings(goalLitres: string, glassMl: string): { value: WaterSettingsInput | null; errors: Set<WaterField> } {
  const errors = new Set<WaterField>()
  const goalText = goalLitres.trim().replace(',', '.')
  const goalMl = goalText === '' ? null : Math.round(Number(goalText) * 1000)
  if (goalMl != null && (!Number.isFinite(goalMl) || goalMl < GOAL_MIN_ML || goalMl > GOAL_MAX_ML)) errors.add('goal')
  const glass = Number(glassMl)
  if (glassMl.trim() === '' || !Number.isInteger(glass) || glass < GLASS_MIN_ML || glass > GLASS_MAX_ML) errors.add('glass')
  return { value: errors.size > 0 ? null : { goalMl, glassMl: glass }, errors }
}
