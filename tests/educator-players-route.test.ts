import { beforeEach, describe, expect, it, vi } from 'vitest'
import { hasEducatorAccess } from '@/lib/educator-permissions'

vi.mock('@/lib/educator-auth', () => ({
  getEducatorSession: vi.fn(),
  hasEducatorAccess,
}))

vi.mock('@/lib/players', () => ({
  getRoster: vi.fn(),
}))

import { getEducatorSession } from '@/lib/educator-auth'
import { getRoster } from '@/lib/players'
import { GET } from '@/app/api/educators/players/route'

const player = {
  number: 7,
  firstName: 'Camille',
  lastName: 'Test',
  position: 'Milieu',
  transferStatus: null,
  licenseNumber: 'LICENCE-PRIVEE',
  birthDate: '01/01/2015',
  birthYear: 2015,
}

function request() {
  return new Request('http://localhost/api/educators/players')
}

describe('GET /api/educators/players', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getRoster).mockResolvedValue({
      club: 'ES Genech',
      title: 'Effectif',
      players: [player],
      fetchedAt: new Date(0).toISOString(),
    })
  })

  it.each([
    ['no session', null, 401],
    ['reader', { username: 'reader', displayName: 'Lecteur', role: 'reader' }, 403],
  ] as const)('does not disclose roster to %s', async (_label, session, status) => {
    vi.mocked(getEducatorSession).mockResolvedValue(session)

    const response = await GET(request())

    expect(response.status).toBe(status)
    expect(getRoster).not.toHaveBeenCalled()
  })

  it.each([
    ['educator', { username: 'coach', displayName: 'Coach', role: 'educator' }],
    ['admin', { username: 'admin', displayName: 'Admin', role: 'admin' }],
  ] as const)('allows %s to read only the educator roster fields', async (_label, session) => {
    vi.mocked(getEducatorSession).mockResolvedValue(session)

    const response = await GET(request())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.players).toEqual([{
      number: 7,
      firstName: 'Camille',
      lastName: 'Test',
      position: 'Milieu',
      transferStatus: null,
      licenseNumber: 'LICENCE-PRIVEE',
    }])
    expect(JSON.stringify(body)).not.toContain('birthDate')
  })
})
