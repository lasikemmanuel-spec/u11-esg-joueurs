import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/educator-auth', () => ({
  getEducatorSession: vi.fn(),
  hasEducatorAccess: (educator: { role: string }) =>
    educator.role === 'educator' || educator.role === 'admin',
  isSameOriginRequest: (request: Request) =>
    request.headers.get('origin') === new URL(request.url).origin,
}))

vi.mock('@/lib/educator-directory', () => ({
  saveOwnEducatorDirectoryEntry: vi.fn(),
}))
vi.mock('@/lib/educator-phones', () => ({
  migrateEducatorPhones: vi.fn(),
}))
vi.mock('@/lib/convocation-management', () => ({
  writeCallupSchedule: vi.fn(),
}))
vi.mock('@/lib/match-lineups', () => ({
  getMatchLineups: vi.fn(),
  saveMatchLineup: vi.fn(),
  syncMatchLineupsWithCallups: vi.fn(),
}))
vi.mock('@/lib/match-results', () => ({
  getMatchResults: vi.fn(),
  writeMatchResult: vi.fn(),
}))
vi.mock('@/lib/convocations', () => ({
  getConvocations: vi.fn(),
}))
vi.mock('@/lib/players', () => ({
  getRoster: vi.fn(),
}))
vi.mock('@/lib/security-logger', () => ({
  logSecurityEvent: vi.fn(),
  getClientIp: vi.fn(() => '127.0.0.1'),
  getUserAgent: vi.fn(() => 'test'),
}))
vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}))

import { getEducatorSession } from '@/lib/educator-auth'
import { saveOwnEducatorDirectoryEntry } from '@/lib/educator-directory'
import { migrateEducatorPhones } from '@/lib/educator-phones'
import { GET as getLineups } from '@/app/api/educators/match-lineups/route'
import { POST as saveCallups } from '@/app/api/educators/callups/route'
import { POST as saveMatchResult } from '@/app/api/match-results/route'
import { PUT as saveOwnDirectoryEntry } from '@/app/api/educators/directory/me/route'
import { POST as migrateContacts } from '@/app/api/educators/contacts/migrate/route'

type Session = { username: string; displayName: string; role: 'reader' | 'educator' | 'admin' }

const educator: Session = { username: 'coach', displayName: 'Coach', role: 'educator' }
const admin: Session = { username: 'admin', displayName: 'Admin', role: 'admin' }
const reader: Session = { username: 'reader', displayName: 'Reader', role: 'reader' }

function request(path: string, method: string, body?: object, sameOrigin = true) {
  return new Request(`https://club.example${path}`, {
    method,
    headers: {
      ...(sameOrigin ? { origin: 'https://club.example' } : { origin: 'https://attacker.example' }),
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}

describe('write and read access boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.mocked(saveOwnEducatorDirectoryEntry).mockResolvedValue({ id: 'entry' })
    vi.mocked(migrateEducatorPhones).mockResolvedValue(0)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it.each([
    ['public', null, 401],
    ['reader', reader, 403],
  ] as const)('denies %s access to the private match lineups', async (_label, session, status) => {
    vi.mocked(getEducatorSession).mockResolvedValue(session)

    const response = await getLineups(request('/api/educators/match-lineups', 'GET'))

    expect(response.status).toBe(status)
  })

  it.each([
    ['public', null, 401],
    ['reader', reader, 403],
  ] as const)('denies %s access to saving callups', async (_label, session, status) => {
    vi.mocked(getEducatorSession).mockResolvedValue(session)

    const response = await saveCallups(request('/api/educators/callups', 'POST', {}))

    expect(response.status).toBe(status)
  })

  it.each([
    ['public', null, 401],
    ['reader', reader, 403],
  ] as const)('denies %s access to saving match results', async (_label, session, status) => {
    vi.mocked(getEducatorSession).mockResolvedValue(session)

    const response = await saveMatchResult(request('/api/match-results', 'POST', {}))

    expect(response.status).toBe(status)
  })

  it('requires same-origin requests for match-result changes', async () => {
    vi.mocked(getEducatorSession).mockResolvedValue(educator)

    const response = await saveMatchResult(
      request('/api/match-results', 'POST', {}, false),
    )

    expect(response.status).toBe(403)
  })

  it.each([
    ['public', null, 401],
    ['reader', reader, 403],
  ] as const)('denies %s access to editing their educator directory entry', async (_label, session, status) => {
    vi.mocked(getEducatorSession).mockResolvedValue(session)

    const response = await saveOwnDirectoryEntry(request(
      '/api/educators/directory/me',
      'PUT',
      { licenseNumber: '', phone: '' },
    ))

    expect(response.status).toBe(status)
    expect(saveOwnEducatorDirectoryEntry).not.toHaveBeenCalled()
  })

  it('allows educators to update only their own directory entry', async () => {
    vi.mocked(getEducatorSession).mockResolvedValue(educator)

    const response = await saveOwnDirectoryEntry(request(
      '/api/educators/directory/me',
      'PUT',
      { licenseNumber: 'LIC', phone: '0600000000' },
    ))

    expect(response.status).toBe(200)
    expect(saveOwnEducatorDirectoryEntry).toHaveBeenCalledWith({
      name: 'Coach',
      licenseNumber: 'LIC',
      phone: '0600000000',
    })
  })

  it.each([
    ['public', null, 401],
    ['educator', educator, 403],
    ['reader', reader, 403],
  ] as const)('denies %s access to contact migration', async (_label, session, status) => {
    vi.mocked(getEducatorSession).mockResolvedValue(session)

    const response = await migrateContacts(request(
      '/api/educators/contacts/migrate',
      'POST',
      {},
    ))

    expect(response.status).toBe(status)
    expect(migrateEducatorPhones).not.toHaveBeenCalled()
  })

  it('allows only an admin to migrate contacts', async () => {
    vi.mocked(getEducatorSession).mockResolvedValue(admin)

    const response = await migrateContacts(request(
      '/api/educators/contacts/migrate',
      'POST',
      {},
    ))

    expect(response.status).toBe(200)
    expect(migrateEducatorPhones).toHaveBeenCalledOnce()
  })
})
