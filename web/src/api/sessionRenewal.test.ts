import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.parse('2026-11-06T20:00:00Z')

/** A JWT whose payload says it expires {@code days} after NOW; the signature does not matter to the client */
function jwtExpiringIn(days: number) {
  const payload = btoa(JSON.stringify({ sub: '1', exp: Math.floor((NOW + days * DAY) / 1000) })).replace(/=+$/, '')
  return `header.${payload}.signature`
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('session renewal', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules() // session.ts reads the token from localStorage when it is imported
  })
  afterEach(() => vi.unstubAllGlobals())

  it('knows a token close to its end from its own payload', async () => {
    const { tokenExpiresSoon } = await import('./session')
    expect(tokenExpiresSoon(jwtExpiringIn(3), NOW)).toBe(true)
    expect(tokenExpiresSoon(jwtExpiringIn(-1), NOW)).toBe(true)
    expect(tokenExpiresSoon(jwtExpiringIn(20), NOW)).toBe(false)
    expect(tokenExpiresSoon('not-a-jwt', NOW)).toBe(false)
  })

  it('signs in again in the background when the token is about to run out, keeping it meanwhile', async () => {
    const old = jwtExpiringIn(2)
    localStorage.setItem('liftlog.token', old)
    localStorage.setItem('liftlog.device', JSON.stringify({ email: 'device-a@liftlog.device', password: 'p' }))
    const fetchMock = vi.fn(async () => jsonResponse(200, { token: 'fresh-token', expiresAt: '2026-12-06T00:00:00Z', user: { id: 1, email: 'x', displayName: null } }))
    vi.stubGlobal('fetch', fetchMock)
    const { renewSessionIfExpiring, session } = await import('./session')

    renewSessionIfExpiring(NOW)
    expect(session.getToken()).toBe(old)
    await vi.waitFor(() => expect(session.getToken()).toBe('fresh-token'))
    expect(String((fetchMock.mock.calls[0] as unknown as [string])[0])).toMatch(/\/api\/v1\/auth\/login$/)
  })

  it('leaves a token with weeks left alone', async () => {
    localStorage.setItem('liftlog.token', jwtExpiringIn(25))
    localStorage.setItem('liftlog.device', JSON.stringify({ email: 'device-a@liftlog.device', password: 'p' }))
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { renewSessionIfExpiring } = await import('./session')
    renewSessionIfExpiring(NOW)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
