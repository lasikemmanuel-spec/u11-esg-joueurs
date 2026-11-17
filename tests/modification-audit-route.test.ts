import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/educator-auth', () => ({
  getEducatorSession: vi.fn(),
}))

vi.mock('@/lib/modification-audit', () => ({
  getModificationEvents: vi.fn(),
}))

import { getEducatorSession } from '@/lib/educator-auth'
import { getModificationEvents } from '@/lib/modification-audit'
import { GET } from '@/app/api/educators/audit/route'

function request() {
  return new Request('http://localhost/api/educators/audit', {
    headers: { origin: 'http://localhost' },
  })
}

describe('GET /api/educators/audit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.each([
    ['public', null, 401],
    ['reader', { username: 'reader', displayName: 'Lecteur', role: 'reader' as const }, 403],
    ['educator', { username: 'coach', displayName: 'Coach', role: 'educator' as const }, 403],
  ])('denies %s access to the modification audit', async (_label, session, status) => {
    vi.mocked(getEducatorSession).mockResolvedValue(session)
    const response = await GET(request())
    expect(response.status).toBe(status)
    expect(getModificationEvents).not.toHaveBeenCalled()
  })

  it('allows admins to read the modification audit', async () => {
    vi.mocked(getEducatorSession).mockResolvedValue({
      username: 'admin',
      displayName: 'Admin',
      role: 'admin',
    })
    vi.mocked(getModificationEvents).mockResolvedValue([{
      event: 'match_modified',
      username: 'coach',
      ip: '127.0.0.1',
      role: 'educator',
      detail: 'update team=E1 date=2026-11-20',
      timestamp: '2026-11-17T22:00:00.000Z',
    }])

    const response = await GET(request())
    expect(response.status).toBe(200)
    expect((await response.json()).events).toHaveLength(1)
  })
})
