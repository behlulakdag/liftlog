import { describe, expect, it } from 'vitest'
import { shouldKeepQuery } from './queryCache'

const query = (queryKey: unknown[], status: 'success' | 'error' | 'pending' = 'success', data: unknown = { ok: true }) =>
  ({ queryKey, state: { status, data } }) as unknown as Parameters<typeof shouldKeepQuery>[0]

describe('shouldKeepQuery', () => {
  it('keeps the app’s own screens', () => {
    expect(shouldKeepQuery(query(['workouts']))).toBe(true)
    expect(shouldKeepQuery(query(['workout', 7, 'plan']))).toBe(true)
    expect(shouldKeepQuery(query(['nutrition', 'day', '2026-11-06']))).toBe(true)
    expect(shouldKeepQuery(query(['stats', 'program', '2026-11-06']))).toBe(true)
  })

  it('leaves out League data, failures, unfinished queries and blobs', () => {
    expect(shouldKeepQuery(query(['lol', 'player', 'p1']))).toBe(false)
    expect(shouldKeepQuery(query(['ddragon', 'version']))).toBe(false)
    expect(shouldKeepQuery(query(['workouts'], 'error'))).toBe(false)
    expect(shouldKeepQuery(query(['workouts'], 'pending'))).toBe(false)
    expect(shouldKeepQuery(query(['profile'], 'success', new Blob(['x'])))).toBe(false)
  })
})
