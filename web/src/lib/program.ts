/**
 * How much of the way from start to target a goal is, 0 to 1. Works both ways, so a weight goal below the
 * starting weight fills as the weight comes down. A goal already met when it was set counts as done.
 */
export function goalProgress(startKg: number | null, currentKg: number | null, targetKg: number): number {
  if (currentKg == null) return 0
  const start = startKg ?? currentKg
  if (start === targetKg) return 1
  const fraction = (currentKg - start) / (targetKg - start)
  return Math.min(1, Math.max(0, fraction))
}

export type BlockField = 'start' | 'weeks'

/** Weeks of a block: 1 to 52, as the server allows. */
export function validateBlock(startDate: string, weeks: string): { value: { startDate: string; weeks: number } | null; errors: Set<BlockField> } {
  const errors = new Set<BlockField>()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) errors.add('start')
  const count = Number(weeks)
  if (!Number.isInteger(count) || count < 1 || count > 52) errors.add('weeks')
  return { value: errors.size > 0 ? null : { startDate, weeks: count }, errors }
}

/** "95", "97,5" or "97.5" → 97.5; null when it is not a weight the server takes. */
export function parseTargetKg(text: string, min: number, max: number): number | null {
  const value = Number(text.trim().replace(',', '.'))
  if (text.trim() === '' || !Number.isFinite(value) || value < min || value > max) return null
  return Math.round(value * 100) / 100
}
