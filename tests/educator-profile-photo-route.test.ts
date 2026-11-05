import { beforeEach, describe, expect, it, vi } from 'vitest'
import { hasEducatorAccess } from '@/lib/educator-permissions'

vi.mock('@/lib/educator-auth', () => ({
  findEducator: vi.fn(),
  getEducatorSession: vi.fn(),
  hasEducatorAccess,
  isSameOriginRequest: (request: Request) =>
    request.headers.get('origin') === new URL(request.url).origin,
}))

vi.mock('@/lib/educator-profile-photo', () => ({
  getEducatorProfilePhoto: vi.fn(),
  saveEducatorProfilePhoto: vi.fn(),
}))

import { findEducator, getEducatorSession } from '@/lib/educator-auth'
import { getEducatorProfilePhoto } from '@/lib/educator-profile-photo'
import { GET } from '@/app/api/educators/profile-photo/route'

const image = Buffer.from([0xff, 0xd8, 0xff, 0xd9])

function request(username: string) {
  return new Request(
    `http://localhost/api/educators/profile-photo?username=${encodeURIComponent(username)}`,
  )
}

describe('GET /api/educators/profile-photo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(findEducator).mockResolvedValue({
      username: 'other@example.com',
      displayName: 'Other Educator',
      firstName: 'Other',
      lastName: 'Educator',
      passwordHash: 'secret-hash',
      role: 'educator',
    })
    vi.mocked(getEducatorProfilePhoto).mockResolvedValue(image)
  })

  it('rejects unauthenticated requests before looking up an account', async () => {
    vi.mocked(getEducatorSession).mockResolvedValue(null)

    const response = await GET(request('other@example.com'))

    expect(response.status).toBe(401)
    expect(findEducator).not.toHaveBeenCalled()
    expect(getEducatorProfilePhoto).not.toHaveBeenCalled()
  })

  it.each([
    ['reader', { username: 'reader@example.com', displayName: 'Reader', role: 'reader' }],
    ['another educator', { username: 'coach@example.com', displayName: 'Coach', role: 'educator' }],
  ] as const)('prevents %s from reading another educator’s photo', async (_label, session) => {
    vi.mocked(getEducatorSession).mockResolvedValue(session)

    const response = await GET(request('other@example.com'))

    expect(response.status).toBe(403)
    expect(findEducator).not.toHaveBeenCalled()
    expect(getEducatorProfilePhoto).not.toHaveBeenCalled()
  })

  it('allows an educator to read their own photo', async () => {
    vi.mocked(getEducatorSession).mockResolvedValue({
      username: 'coach@example.com',
      displayName: 'Coach',
      role: 'educator',
    })
    vi.mocked(findEducator).mockResolvedValue({
      username: 'coach@example.com',
      displayName: 'Coach',
      firstName: 'Coach',
      lastName: 'Example',
      passwordHash: 'secret-hash',
      role: 'educator',
    })

    const response = await GET(request('COACH@example.com'))

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/jpeg')
    expect(getEducatorProfilePhoto).toHaveBeenCalledWith('coach@example.com')
  })

  it('allows an admin to read another educator’s photo', async () => {
    vi.mocked(getEducatorSession).mockResolvedValue({
      username: 'admin@example.com',
      displayName: 'Admin',
      role: 'admin',
    })

    const response = await GET(request('other@example.com'))

    expect(response.status).toBe(200)
    expect(getEducatorProfilePhoto).toHaveBeenCalledWith('other@example.com')
  })
})
