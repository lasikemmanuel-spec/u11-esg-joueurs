import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/educator-auth', () => ({
  getEducatorSession: vi.fn(),
}))

vi.mock('@/lib/educator-phones', () => ({
  diagnoseEducatorPhoneEncryption: vi.fn(),
}))

import { getEducatorSession } from '@/lib/educator-auth'
import { diagnoseEducatorPhoneEncryption } from '@/lib/educator-phones'
import { GET } from '@/app/api/educators/contacts/diagnostics/route'

function request() {
  return new Request('http://localhost/api/educators/contacts/diagnostics')
}

describe('GET /api/educators/contacts/diagnostics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(diagnoseEducatorPhoneEncryption).mockResolvedValue({
      keyFormatValid: true,
      encryptedValues: 3,
      unreadableValues: 0,
      plaintextValues: 0,
      missingTabs: [],
    })
  })

  it.each([
    ['no session', null, 401],
    ['reader', { username: 'reader', displayName: 'Reader', role: 'reader' }, 403],
  ] as const)('does not disclose diagnostics to %s', async (_label, session, status) => {
    vi.mocked(getEducatorSession).mockResolvedValue(session)

    const response = await GET(request())

    expect(response.status).toBe(status)
    expect(diagnoseEducatorPhoneEncryption).not.toHaveBeenCalled()
  })

  it('allows an admin to inspect encryption without returning phone values', async () => {
    vi.mocked(getEducatorSession).mockResolvedValue({
      username: 'admin',
      displayName: 'Admin',
      role: 'admin',
    })

    const response = await GET(request())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({
      keyFormatValid: true,
      encryptedValues: 3,
      unreadableValues: 0,
      plaintextValues: 0,
      missingTabs: [],
    })
    expect(JSON.stringify(body)).not.toContain('0600000000')
  })

  it('allows an educator to inspect encryption without returning phone values', async () => {
    vi.mocked(getEducatorSession).mockResolvedValue({
      username: 'coach',
      displayName: 'Coach',
      role: 'educator',
    })

    const response = await GET(request())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({
      keyFormatValid: true,
      encryptedValues: 3,
      unreadableValues: 0,
      plaintextValues: 0,
      missingTabs: [],
    })
    expect(JSON.stringify(body)).not.toContain('0600000000')
  })
})
