import { beforeEach, describe, expect, it, vi } from 'vitest'
import { hasEducatorAccess } from '@/lib/educator-permissions'

vi.mock('@/lib/educator-auth', () => ({
  getEducatorSession: vi.fn(),
  hasEducatorAccess,
  isSameOriginRequest: (request: Request) =>
    request.headers.get('origin') === new URL(request.url).origin,
}))

vi.mock('@/lib/educator-phones', () => ({
  getEducatorPhones: vi.fn(),
  updateEducatorParentPhone: vi.fn(),
  PhoneMigrationRequiredError: class PhoneMigrationRequiredError extends Error {},
}))

vi.mock('@/lib/security-logger', () => ({
  logSecurityEvent: vi.fn(),
  getClientIp: vi.fn(() => '127.0.0.1'),
  getUserAgent: vi.fn(() => 'test'),
}))

import { getEducatorSession } from '@/lib/educator-auth'
import { getEducatorPhones, updateEducatorParentPhone } from '@/lib/educator-phones'
import { GET, PUT } from '@/app/api/educators/contacts/route'

const phone = { number: 7, fatherPhone: '0600000000', motherPhone: '', legacyPhone: '' }

function request(method = 'GET', body?: object) {
  return new Request('http://localhost/api/educators/contacts', {
    method,
    headers: {
      origin: 'http://localhost',
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}

describe('/api/educators/contacts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getEducatorPhones).mockResolvedValue([phone])
    vi.mocked(updateEducatorParentPhone).mockResolvedValue(undefined)
  })

  it.each([
    ['no session', null, 401],
    ['reader', { username: 'reader', displayName: 'Lecteur', role: 'reader' }, 403],
  ] as const)('does not disclose parent contacts to %s', async (_label, session, status) => {
    vi.mocked(getEducatorSession).mockResolvedValue(session)

    const response = await GET(request())

    expect(response.status).toBe(status)
    expect(getEducatorPhones).not.toHaveBeenCalled()
  })

  it.each([
    ['educator', { username: 'coach', displayName: 'Coach', role: 'educator' }],
    ['admin', { username: 'admin', displayName: 'Admin', role: 'admin' }],
  ] as const)('allows %s to read parent contacts', async (_label, session) => {
    vi.mocked(getEducatorSession).mockResolvedValue(session)

    const response = await GET(request())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.phones).toEqual([phone])
  })

  it.each([
    ['no session', null],
    ['reader', { username: 'reader', displayName: 'Lecteur', role: 'reader' }],
    ['educator', { username: 'coach', displayName: 'Coach', role: 'educator' }],
  ] as const)('prevents %s from changing parent contacts', async (_label, session) => {
    vi.mocked(getEducatorSession).mockResolvedValue(session)

    const response = await PUT(request('PUT', { number: 7, parent: 'father', phone: '0612345678' }))

    expect(response.status).toBe(session ? 403 : 401)
    expect(updateEducatorParentPhone).not.toHaveBeenCalled()
  })

  it('allows an admin to change parent contacts', async () => {
    vi.mocked(getEducatorSession).mockResolvedValue({
      username: 'admin',
      displayName: 'Admin',
      role: 'admin',
    })

    const response = await PUT(request('PUT', { number: 7, parent: 'father', phone: '0612345678' }))

    expect(response.status).toBe(200)
    expect(updateEducatorParentPhone).toHaveBeenCalledWith(7, 'father', '0612345678')
  })
})
