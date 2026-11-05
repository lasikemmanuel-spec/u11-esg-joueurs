import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { hasEducatorAccess } from '@/lib/educator-permissions'

vi.mock('@/lib/educator-auth', () => ({
  getEducatorSession: vi.fn(),
  hasEducatorAccess,
  isSameOriginRequest: (request: Request) =>
    request.headers.get('origin') === new URL(request.url).origin,
}))

vi.mock('@/lib/educator-directory', () => ({
  getEducatorDirectory: vi.fn(),
  saveEducatorDirectoryEntry: vi.fn(),
  deleteEducatorDirectoryEntry: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}))

import { getEducatorSession } from '@/lib/educator-auth'
import {
  deleteEducatorDirectoryEntry,
  getEducatorDirectory,
  saveEducatorDirectoryEntry,
} from '@/lib/educator-directory'
import { DELETE, GET, POST, PUT } from '@/app/api/educators/directory/route'

const previousVercelEnv = process.env.VERCEL_ENV
const educatorCard = { id: 'educator-id', name: 'Coach', licenseNumber: 'LICENCE', phone: '0600000000' }

function request(method = 'GET', body?: object) {
  return new Request('http://localhost/api/educators/directory', {
    method,
    headers: {
      origin: 'http://localhost',
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}

describe('/api/educators/directory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.VERCEL_ENV = 'production'
    vi.mocked(getEducatorDirectory).mockResolvedValue([educatorCard])
    vi.mocked(saveEducatorDirectoryEntry).mockResolvedValue({ id: 'educator-id' })
  })

  afterEach(() => {
    if (previousVercelEnv === undefined) delete process.env.VERCEL_ENV
    else process.env.VERCEL_ENV = previousVercelEnv
  })

  it.each([
    ['no session', null, 401],
    ['reader', { username: 'reader', displayName: 'Lecteur', role: 'reader' }, 403],
  ] as const)('does not disclose educator directory to %s', async (_label, session, status) => {
    vi.mocked(getEducatorSession).mockResolvedValue(session)

    const response = await GET(request())

    expect(response.status).toBe(status)
    expect(getEducatorDirectory).not.toHaveBeenCalled()
  })

  it.each([
    ['educator', { username: 'coach', displayName: 'Coach', role: 'educator' }],
    ['admin', { username: 'admin', displayName: 'Admin', role: 'admin' }],
  ] as const)('allows %s to read the educator directory', async (_label, session) => {
    vi.mocked(getEducatorSession).mockResolvedValue(session)

    const response = await GET(request())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.educators).toEqual([educatorCard])
  })

  it.each([
    ['no session', null],
    ['reader', { username: 'reader', displayName: 'Lecteur', role: 'reader' }],
    ['educator', { username: 'coach', displayName: 'Coach', role: 'educator' }],
  ] as const)('prevents %s from editing the educator directory', async (_label, session) => {
    vi.mocked(getEducatorSession).mockResolvedValue(session)

    const response = await POST(request('POST', {
      name: 'New Coach',
      licenseNumber: '',
      phone: '',
    }))

    expect(response.status).toBe(session ? 403 : 401)
    expect(saveEducatorDirectoryEntry).not.toHaveBeenCalled()
  })

  it('allows an admin to edit the educator directory', async () => {
    vi.mocked(getEducatorSession).mockResolvedValue({
      username: 'admin',
      displayName: 'Admin',
      role: 'admin',
    })

    const response = await POST(request('POST', {
      name: 'New Coach',
      licenseNumber: '',
      phone: '',
    }))

    expect(response.status).toBe(200)
    expect(saveEducatorDirectoryEntry).toHaveBeenCalledWith({
      name: 'New Coach',
      licenseNumber: '',
      phone: '',
    })
  })

  it.each([
    ['public', null],
    ['educator', { username: 'coach', displayName: 'Coach', role: 'educator' }],
    ['reader', { username: 'reader', displayName: 'Reader', role: 'reader' }],
  ] as const)('prevents %s from updating or deleting educator directory entries', async (_label, session) => {
    vi.mocked(getEducatorSession).mockResolvedValue(session)
    const body = { id: '00000000-0000-0000-0000-000000000001', name: 'Coach', licenseNumber: '', phone: '' }

    const updated = await PUT(request('PUT', body))
    const deleted = await DELETE(request('DELETE', { id: body.id }))

    expect(updated.status).toBe(session ? 403 : 401)
    expect(deleted.status).toBe(session ? 403 : 401)
    expect(saveEducatorDirectoryEntry).not.toHaveBeenCalled()
    expect(deleteEducatorDirectoryEntry).not.toHaveBeenCalled()
  })
})
