import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/educator-auth', () => ({
  createEducatorSession: vi.fn(() => ({ token: 'signed-session', maxAge: 3600 })),
  educatorSessionCookieName: () => 'educator_session',
  findEducator: vi.fn(),
  getEducatorSession: vi.fn(),
  isSameOriginRequest: (request: Request) =>
    request.headers.get('origin') === new URL(request.url).origin,
  verifyEducatorPassword: vi.fn(),
}))

vi.mock('@/lib/security-logger', () => ({
  logSecurityEvent: vi.fn(),
  getClientIp: vi.fn(() => '203.0.113.8'),
  getUserAgent: vi.fn(() => 'test'),
}))

vi.mock('@/lib/login-rate-limit', () => ({
  clearLoginAccountAttempts: vi.fn(),
  getLoginAttemptCounts: vi.fn(),
  isLoginAttemptLimitReached: (counts: { account: number; ip: number }) =>
    counts.account >= 5 || counts.ip >= 15,
  recordLoginFailure: vi.fn(),
}))

import {
  createEducatorSession,
  findEducator,
  verifyEducatorPassword,
} from '@/lib/educator-auth'
import {
  clearLoginAccountAttempts,
  getLoginAttemptCounts,
  recordLoginFailure,
} from '@/lib/login-rate-limit'
import { POST } from '@/app/api/educators/session/route'

const account = {
  username: 'coach@example.com',
  displayName: 'Coach Example',
  firstName: 'Coach',
  lastName: 'Example',
  passwordHash: 'secret-hash',
  role: 'educator' as const,
}

function request(body: object, origin = 'http://localhost') {
  return new Request('http://localhost/api/educators/session', {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/educators/session', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getLoginAttemptCounts).mockResolvedValue({ account: 0, ip: 0 })
    vi.mocked(recordLoginFailure).mockResolvedValue({ account: 1, ip: 1 })
    vi.mocked(findEducator).mockResolvedValue(account)
    vi.mocked(verifyEducatorPassword).mockReturnValue(false)
  })

  it('rejects cross-origin login attempts before checking credentials', async () => {
    const response = await POST(request(
      { username: 'coach@example.com', password: 'bad-password' },
      'https://attacker.example',
    ))

    expect(response.status).toBe(403)
    expect(getLoginAttemptCounts).not.toHaveBeenCalled()
    expect(findEducator).not.toHaveBeenCalled()
  })

  it('blocks login when the account bucket reaches its threshold', async () => {
    vi.mocked(getLoginAttemptCounts).mockResolvedValue({ account: 5, ip: 0 })

    const response = await POST(request({ username: 'coach@example.com', password: 'bad-password' }))

    expect(response.status).toBe(429)
    expect(findEducator).not.toHaveBeenCalled()
  })

  it('fails closed if the shared limiter is unavailable', async () => {
    vi.mocked(getLoginAttemptCounts).mockRejectedValue(new Error('Upstash unavailable'))

    const response = await POST(request({ username: 'coach@example.com', password: 'bad-password' }))

    expect(response.status).toBe(503)
    expect(findEducator).not.toHaveBeenCalled()
  })

  it('records failed credentials in the shared limiter', async () => {
    const response = await POST(request({ username: 'coach@example.com', password: 'bad-password' }))

    expect(response.status).toBe(401)
    expect(recordLoginFailure).toHaveBeenCalledOnce()
    expect(createEducatorSession).not.toHaveBeenCalled()
  })

  it('clears the account bucket after successful authentication', async () => {
    vi.mocked(verifyEducatorPassword).mockReturnValue(true)

    const response = await POST(request({
      username: 'coach@example.com',
      password: 'correct-password',
      rememberMe: false,
    }))

    expect(response.status).toBe(200)
    expect(clearLoginAccountAttempts).toHaveBeenCalledWith('coach@example.com')
    expect(recordLoginFailure).not.toHaveBeenCalled()
    expect(response.headers.get('set-cookie')).toContain('HttpOnly')
  })

  it('fails closed if it cannot record failed credentials', async () => {
    vi.mocked(recordLoginFailure).mockRejectedValue(new Error('Upstash unavailable'))

    const response = await POST(request({ username: 'coach@example.com', password: 'bad-password' }))

    expect(response.status).toBe(503)
    expect(createEducatorSession).not.toHaveBeenCalled()
  })
})
