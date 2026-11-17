import 'server-only'
import crypto from 'node:crypto'

const ENCRYPTED_WHATSAPP_PREFIX = 'whatsapp:v1:'

function getEncryptionKey() {
  const encoded = process.env.EDUCATOR_ACCOUNT_ENCRYPTION_KEY?.trim()
  if (!encoded) throw new Error('EDUCATOR_ACCOUNT_ENCRYPTION_KEY n’est pas configuré.')
  const key = Buffer.from(encoded, 'base64url')
  if (key.length !== 32 || key.toString('base64url') !== encoded) {
    throw new Error('EDUCATOR_ACCOUNT_ENCRYPTION_KEY doit être une clé base64url de 32 octets.')
  }
  return key
}

export function isEncryptedWhatsAppSettings(value: string) {
  return value.startsWith(ENCRYPTED_WHATSAPP_PREFIX)
}

export function encryptWhatsAppSettings(settings: unknown) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv)
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(settings), 'utf8'),
    cipher.final(),
  ])
  return `${ENCRYPTED_WHATSAPP_PREFIX}${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${ciphertext.toString('base64url')}`
}

export function decryptWhatsAppSettings(value: string): unknown {
  if (!isEncryptedWhatsAppSettings(value)) return null

  const parts = value.slice(ENCRYPTED_WHATSAPP_PREFIX.length).split('.')
  if (parts.length !== 3) throw new Error('Format WhatsApp chiffré invalide.')
  const [encodedIv, encodedTag, encodedCiphertext] = parts
  const iv = Buffer.from(encodedIv, 'base64url')
  const tag = Buffer.from(encodedTag, 'base64url')
  const ciphertext = Buffer.from(encodedCiphertext, 'base64url')
  if (
    iv.length !== 12 ||
    tag.length !== 16 ||
    ciphertext.length === 0 ||
    iv.toString('base64url') !== encodedIv ||
    tag.toString('base64url') !== encodedTag ||
    ciphertext.toString('base64url') !== encodedCiphertext
  ) {
    throw new Error('Format WhatsApp chiffré invalide.')
  }

  const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), iv)
  decipher.setAuthTag(tag)
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString('utf8')
  try {
    return JSON.parse(plaintext)
  } catch {
    throw new Error('Configuration WhatsApp chiffrée invalide.')
  }
}
