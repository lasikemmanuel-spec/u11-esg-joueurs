import 'server-only'
import crypto from 'node:crypto'
import {
  ensureAuthenticatedSheetTab,
  getAuthenticatedSheetRows,
  updateAuthenticatedSheetValues,
} from '@/lib/google-sheets'
import type { SecurityEvent } from '@/lib/security-logger'

const AUDIT_TAB = 'Journal modifications'
const AUDIT_HEADER = 'Journal chiffré v1'
const AUDIT_PREFIX = 'audit:v1:'
const MAX_EVENTS = 500

function getEncryptionKey() {
  const encoded = process.env.EDUCATOR_ACCOUNT_ENCRYPTION_KEY?.trim()
  if (!encoded) throw new Error('EDUCATOR_ACCOUNT_ENCRYPTION_KEY n’est pas configuré.')
  const key = Buffer.from(encoded, 'base64url')
  if (key.length !== 32 || key.toString('base64url') !== encoded) {
    throw new Error('EDUCATOR_ACCOUNT_ENCRYPTION_KEY doit être une clé base64url de 32 octets.')
  }
  return key
}

function encryptEvent(event: SecurityEvent) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv)
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(event), 'utf8'),
    cipher.final(),
  ])
  return `${AUDIT_PREFIX}${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${ciphertext.toString('base64url')}`
}

function decryptEvent(value: string): SecurityEvent | null {
  if (!value.startsWith(AUDIT_PREFIX)) return null
  const parts = value.slice(AUDIT_PREFIX.length).split('.')
  if (parts.length !== 3) return null
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
  ) return null

  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), iv)
    decipher.setAuthTag(tag)
    const parsed = JSON.parse(Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString('utf8')) as Partial<SecurityEvent>
    if (
      typeof parsed.event !== 'string' ||
      typeof parsed.ip !== 'string' ||
      typeof parsed.timestamp !== 'string'
    ) return null
    return parsed as SecurityEvent
  } catch {
    return null
  }
}

async function getAuditRows(create = false) {
  try {
    const sheet = await getAuthenticatedSheetRows(AUDIT_TAB)
    return sheet
  } catch (error) {
    if (
      create &&
      error instanceof Error &&
      error.message === 'Aucun onglet Google Sheets trouvé.'
    ) {
      await ensureAuthenticatedSheetTab(AUDIT_TAB)
      return getAuthenticatedSheetRows(AUDIT_TAB)
    }
    throw error
  }
}

export async function recordModificationEvent(event: SecurityEvent) {
  await ensureAuthenticatedSheetTab(AUDIT_TAB)
  const sheet = await getAuthenticatedSheetRows(AUDIT_TAB)
  const existing = sheet.rows.length > 0 ? sheet.rows.slice(1).flatMap((row) => row[0] ? [row[0]] : []) : []
  const values = [
    [AUDIT_HEADER],
    ...[encryptEvent(event), ...existing].slice(0, MAX_EVENTS).map((value) => [value]),
  ]
  await updateAuthenticatedSheetValues([{
    range: `'${sheet.sheetTitle.replace(/'/g, "''")}'!A1:A501`,
    values,
  }])
}

export async function getModificationEvents(): Promise<SecurityEvent[]> {
  const sheet = await getAuditRows(true)
  if (sheet.rows[0]?.[0] !== AUDIT_HEADER) return []
  return sheet.rows.slice(1).flatMap((row) => {
    const event = decryptEvent(row[0]?.trim() ?? '')
    return event ? [event] : []
  })
}
