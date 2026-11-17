import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/educator-auth', () => ({
  getEducatorSession: vi.fn(),
  hasEducatorAccess: (educator: { role: string }) =>
    educator.role === 'educator' || educator.role === 'admin',
  isSameOriginRequest: (request: Request) =>
    request.headers.get('origin') === new URL(request.url).origin,
}))

vi.mock('@/lib/whatsapp-settings-store', () => ({
  getSavedWhatsAppSettings: vi.fn(),
  isWhatsAppSettings: vi.fn(),
  saveWhatsAppSettings: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}))

vi.mock('@/lib/security-logger', () => ({
  logSecurityEvent: vi.fn(),
  getClientIp: vi.fn(() => '127.0.0.1'),
  getUserAgent: vi.fn(() => 'test'),
}))

import { getEducatorSession } from '@/lib/educator-auth'
import {
  getSavedWhatsAppSettings,
  isWhatsAppSettings,
  saveWhatsAppSettings,
} from '@/lib/whatsapp-settings-store'
import { GET, POST } from '@/app/api/educators/whatsapp/settings/route'

const educator = { username: 'coach', displayName: 'Coach', role: 'educator' as const }
const settings = {
  groups: [{ id: 'grp-e1', name: 'Équipe 1', teamFilter: 'E1' as const }],
  templates: [{ id: 'tpl-custom', title: 'Message', category: 'custom' as const, content: 'Bonjour' }],
}

function request(method: 'GET' | 'POST', body?: object, sameOrigin = true) {
  return new Request('https://club.example/api/educators/whatsapp/settings', {
    method,
    headers: {
      origin: sameOrigin ? 'https://club.example' : 'https://attacker.example',
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}

describe('/api/educators/whatsapp/settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('denies unauthenticated and reader access', async () => {
    vi.mocked(getEducatorSession).mockResolvedValueOnce(null)
    expect((await GET(request('GET'))).status).toBe(401)

    vi.mocked(getEducatorSession).mockResolvedValueOnce({
      username: 'reader',
      displayName: 'Lecteur',
      role: 'reader',
    })
    expect((await GET(request('GET'))).status).toBe(403)
  })

  it('loads shared settings for an educator', async () => {
    vi.mocked(getEducatorSession).mockResolvedValue(educator)
    vi.mocked(getSavedWhatsAppSettings).mockResolvedValue(settings)

    const response = await GET(request('GET'))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(settings)
  })

  it('rejects cross-origin writes', async () => {
    vi.mocked(getEducatorSession).mockResolvedValue(educator)
    const response = await POST(request('POST', settings, false))
    expect(response.status).toBe(403)
    expect(saveWhatsAppSettings).not.toHaveBeenCalled()
  })

  it('rejects invalid settings', async () => {
    vi.mocked(getEducatorSession).mockResolvedValue(educator)
    vi.mocked(isWhatsAppSettings).mockReturnValue(false)
    const response = await POST(request('POST', { groups: 'invalid' }))
    expect(response.status).toBe(400)
    expect(saveWhatsAppSettings).not.toHaveBeenCalled()
  })

  it('saves valid settings for an educator', async () => {
    vi.mocked(getEducatorSession).mockResolvedValue(educator)
    vi.mocked(isWhatsAppSettings).mockReturnValue(true)
    vi.mocked(saveWhatsAppSettings).mockResolvedValue(undefined)
    const response = await POST(request('POST', settings))
    expect(response.status).toBe(200)
    expect(saveWhatsAppSettings).toHaveBeenCalledWith(settings)
  })
})
