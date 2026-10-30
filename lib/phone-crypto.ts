import 'server-only'
import crypto from 'node:crypto'

const ENCRYPTED_PHONE_PREFIX = 'enc:v1:'

function getEncryptionKey() {
  const encoded = process.env.EDUCATOR_PHONE_ENCRYPTION_KEY?.trim()
  if (!encoded) {
    throw new Error('EDUCATOR_PHONE_ENCRYPTION_KEY n’est pas configuré.')
  }

  const key = Buffer.from(encoded, 'base64url')
  if (key.length !== 32 || key.toString('base64url') !== encoded) {
    throw new Error('EDUCATOR_PHONE_ENCRYPTION_KEY doit être une clé base64url de 32 octets.')
  }
  return key
}

export function isEncryptedPhone(value: string) {
  return value.startsWith(ENCRYPTED_PHONE_PREFIX)
}

export function encryptPhone(value: string) {
  if (!value) return ''
  if (isEncryptedPhone(value)) {
    // Validate an existing ciphertext before preserving it.
    decryptPhone(value)
    return value
  }

  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return `${ENCRYPTED_PHONE_PREFIX}${iv.toString('base64url')}.${tag.toString('base64url')}.${ciphertext.toString('base64url')}`
}

export function decryptPhone(value: string) {
  if (!value || !isEncryptedPhone(value)) return value

  const parts = value.slice(ENCRYPTED_PHONE_PREFIX.length).split('.')
  if (parts.length !== 3) throw new Error('Format de téléphone chiffré invalide.')

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
    throw new Error('Format de téléphone chiffré invalide.')
  }

  const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}
