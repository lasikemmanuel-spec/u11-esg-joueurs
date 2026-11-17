vi.mock('server-only', () => ({}))

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  decryptWhatsAppSettings,
  encryptWhatsAppSettings,
  isEncryptedWhatsAppSettings,
} from '@/lib/whatsapp-crypto'

describe('WhatsApp settings encryption', () => {
  beforeEach(() => {
    vi.stubEnv(
      'EDUCATOR_ACCOUNT_ENCRYPTION_KEY',
      Buffer.alloc(32, 7).toString('base64url'),
    )
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('encrypts and decrypts WhatsApp settings with AES-GCM', () => {
    const settings = {
      groups: [{ id: 'grp-e1', name: 'Équipe 1', teamFilter: 'E1' }],
      templates: [{ id: 'tpl-1', title: 'Convocation', category: 'match', content: 'Bonjour' }],
    }
    const encrypted = encryptWhatsAppSettings(settings)

    expect(isEncryptedWhatsAppSettings(encrypted)).toBe(true)
    expect(encrypted).not.toContain('"groups"')
    expect(decryptWhatsAppSettings(encrypted)).toEqual(settings)
  })

  it('rejects modified ciphertext', () => {
    const encrypted = encryptWhatsAppSettings({ groups: [], templates: [] })
    const modified = `${encrypted.slice(0, -1)}${encrypted.endsWith('A') ? 'B' : 'A'}`

    expect(() => decryptWhatsAppSettings(modified)).toThrow()
  })
})
