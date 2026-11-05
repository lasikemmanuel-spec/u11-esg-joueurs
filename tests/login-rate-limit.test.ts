import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearLoginAccountAttempts,
  getLoginAttemptCounts,
  isLoginAttemptLimitReached,
  recordLoginFailure,
} from '@/lib/login-rate-limit'

function request(ip = '203.0.113.8') {
  return new Request('https://example.test/login', {
    headers: { 'x-forwarded-for': `${ip}, 10.0.0.1` },
  })
}

describe('shared login rate limiter', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '')
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('uses the bounded local counter in non-production when Upstash is not configured', async () => {
    const requestForIp = request()

    expect(await getLoginAttemptCounts(requestForIp, 'coach@example.com')).toEqual({ account: 0, ip: 0 })
    expect(await recordLoginFailure(requestForIp, 'coach@example.com')).toEqual({ account: 1, ip: 1 })
    expect(await getLoginAttemptCounts(requestForIp, 'COACH@example.com')).toEqual({ account: 1, ip: 1 })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('requires Upstash configuration in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')

    await expect(getLoginAttemptCounts(request(), 'coach@example.com')).rejects.toThrow(
      'UPSTASH_REDIS_REST_URL et UPSTASH_REDIS_REST_TOKEN sont requis en production.',
    )
  })

  it('uses an atomic Upstash script with opaque account and IP keys', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example.com'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token'
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify([{ result: [2, 4] }]), { status: 200 }))

    const counts = await recordLoginFailure(request(), 'coach@example.com')

    expect(counts).toEqual({ account: 2, ip: 4 })
    const [url, options] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe('https://redis.example.com/pipeline')
    expect(options?.headers).toMatchObject({ Authorization: 'Bearer test-token' })
    const command = JSON.parse(String(options?.body))[0]
    expect(command[0]).toBe('EVAL')
    expect(command[3]).toMatch(/^u11:login:account:[a-f0-9]{64}$/)
    expect(command[4]).toMatch(/^u11:login:ip:[a-f0-9]{64}$/)
    expect(JSON.stringify(command)).not.toContain('coach@example.com')
    expect(JSON.stringify(command)).not.toContain('203.0.113.8')
  })

  it('fails closed when the shared limiter is unavailable', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example.com'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token'
    vi.mocked(fetch).mockResolvedValue(new Response('', { status: 503 }))

    await expect(getLoginAttemptCounts(request(), 'coach@example.com')).rejects.toThrow(
      'Upstash rate-limit request failed (503).',
    )
  })

  it('enforces account and IP thresholds', () => {
    expect(isLoginAttemptLimitReached({ account: 4, ip: 14 })).toBe(false)
    expect(isLoginAttemptLimitReached({ account: 5, ip: 0 })).toBe(true)
    expect(isLoginAttemptLimitReached({ account: 0, ip: 15 })).toBe(true)
  })

  it('clears only the account bucket after successful login', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example.com'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token'
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify([{ result: [0, 0] }]), { status: 200 }))

    await clearLoginAccountAttempts('coach@example.com')

    const command = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body))[0]
    expect(command[0]).toBe('EVAL')
    expect(command[3]).toMatch(/^u11:login:account:[a-f0-9]{64}$/)
    expect(command).toHaveLength(4)
  })
})
