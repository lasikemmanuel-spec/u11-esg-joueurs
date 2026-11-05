import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/educator-auth', () => ({
  getEducatorSession: vi.fn(),
  isSameOriginRequest: (request: Request) =>
    request.headers.get('origin') === new URL(request.url).origin,
  createEducatorSession: vi.fn(),
  educatorSessionCookieName: () => 'educator_session',
  hashEducatorPassword: vi.fn(() => 'hashed-password'),
}))

vi.mock('@/lib/educator-account-store', () => ({
  getEducatorAccounts: vi.fn(),
  saveEducatorAccounts: vi.fn(),
}))

vi.mock('@/lib/educator-profile-photo', () => ({
  renameEducatorProfilePhoto: vi.fn(),
}))

vi.mock('@/lib/security-logger', () => ({
  logSecurityEvent: vi.fn(),
  getClientIp: vi.fn(() => '127.0.0.1'),
  getUserAgent: vi.fn(() => 'test'),
}))

import { getEducatorSession } from '@/lib/educator-auth'
import { getEducatorAccounts, saveEducatorAccounts } from '@/lib/educator-account-store'
import { DELETE, GET, PATCH, POST } from '@/app/api/educators/accounts/route'

const previousVercelEnv = process.env.VERCEL_ENV
const accounts = [{
  username: 'coach@example.com',
  displayName: 'Coach Example',
  firstName: 'Coach',
  lastName: 'Example',
  passwordHash: 'secret-hash',
  role: 'educator' as const,
}]

function request() {
  return new Request('http://localhost/api/educators/accounts')
}

function mutationRequest(method: string, body: object) {
  return new Request('http://localhost/api/educators/accounts', {
    method,
    headers: {
      origin: 'http://localhost',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

describe('GET /api/educators/accounts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.VERCEL_ENV = 'production'
    vi.mocked(getEducatorAccounts).mockResolvedValue(accounts)
  })

  afterEach(() => {
    if (previousVercelEnv === undefined) delete process.env.VERCEL_ENV
    else process.env.VERCEL_ENV = previousVercelEnv
  })

  it.each([
    ['no session', null, 401],
    ['reader', { username: 'reader', displayName: 'Lecteur', role: 'reader' }, 403],
    ['educator', { username: 'coach', displayName: 'Coach', role: 'educator' }, 403],
  ] as const)('does not disclose account records to %s', async (_label, session, status) => {
    vi.mocked(getEducatorSession).mockResolvedValue(session)

    const response = await GET(request())

    expect(response).toBeDefined()
    if (!response) throw new Error('Expected the accounts route to return a response.')
    expect(response.status).toBe(status)
    expect(getEducatorAccounts).not.toHaveBeenCalled()
  })

  it('allows admins to read account profiles without password hashes', async () => {
    vi.mocked(getEducatorSession).mockResolvedValue({
      username: 'admin',
      displayName: 'Admin',
      role: 'admin',
    })

    const response = await GET(request())
    expect(response).toBeDefined()
    if (!response) throw new Error('Expected the accounts route to return a response.')
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.accounts).toEqual([{
      username: 'coach@example.com',
      displayName: 'Coach Example',
      firstName: 'Coach',
      lastName: 'Example',
      role: 'educator',
    }])
    expect(JSON.stringify(body)).not.toContain('secret-hash')
  })

  it.each([
    ['public', null],
    ['educator', { username: 'coach', displayName: 'Coach', role: 'educator' }],
    ['reader', { username: 'reader', displayName: 'Reader', role: 'reader' }],
  ] as const)('prevents %s from creating, editing, or deleting accounts', async (_label, session) => {
    vi.mocked(getEducatorSession).mockResolvedValue(session)
    const createBody = {
      username: 'new@example.com',
      firstName: 'New',
      lastName: 'Coach',
      password: 'a-secure-password-123',
    }

    const created = await POST(mutationRequest('POST', createBody))
    const edited = await PATCH(mutationRequest('PATCH', { username: 'coach@example.com', role: 'admin' }))
    const deleted = await DELETE(mutationRequest('DELETE', { username: 'coach@example.com' }))

    expect(created).toBeDefined()
    expect(edited).toBeDefined()
    expect(deleted).toBeDefined()
    if (!created || !edited || !deleted) throw new Error('Expected all account routes to return responses.')
    expect(created.status).toBe(session ? 403 : 401)
    expect(edited.status).toBe(session ? 403 : 401)
    expect(deleted.status).toBe(session ? 403 : 401)
    expect(getEducatorAccounts).not.toHaveBeenCalled()
    expect(saveEducatorAccounts).not.toHaveBeenCalled()
  })
})
