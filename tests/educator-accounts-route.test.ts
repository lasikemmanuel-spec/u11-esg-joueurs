import { beforeEach, describe, expect, it, vi } from 'vitest'

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
import { getEducatorAccounts } from '@/lib/educator-account-store'
import { GET } from '@/app/api/educators/accounts/route'

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

describe('GET /api/educators/accounts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getEducatorAccounts).mockResolvedValue(accounts)
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
})
