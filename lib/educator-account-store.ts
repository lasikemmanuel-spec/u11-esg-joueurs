import 'server-only'
import crypto from 'node:crypto'
import {
  ensureAuthenticatedSheetTab,
  getAuthenticatedSheetRows,
  updateAuthenticatedSheetValues,
} from '@/lib/google-sheets'

const ACCOUNT_TAB = 'Comptes éducateurs'
const ACCOUNT_HEADER = 'Comptes chiffrés v1'

export type EducatorAccount = {
  username: string
  displayName: string
  firstName?: string
  lastName?: string
  passwordHash: string
  role: 'educator' | 'admin'
}

function isAccountRole(role: unknown): role is EducatorAccount['role'] {
  return role === 'educator' || role === 'admin'
}

function getEncryptionKey() {
  const encoded = process.env.EDUCATOR_ACCOUNT_ENCRYPTION_KEY?.trim()
  if (!encoded) throw new Error('EDUCATOR_ACCOUNT_ENCRYPTION_KEY n’est pas configuré.')
  const key = Buffer.from(encoded, 'base64url')
  if (key.length !== 32 || key.toString('base64url') !== encoded) {
    throw new Error('EDUCATOR_ACCOUNT_ENCRYPTION_KEY doit être une clé base64url de 32 octets.')
  }
  return key
}

function encryptAccounts(accounts: EducatorAccount[]) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv)
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(accounts), 'utf8'),
    cipher.final(),
  ])
  return `accounts:v1:${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${ciphertext.toString('base64url')}`
}

function decryptAccounts(value: string) {
  const [encodedIv, encodedTag, encodedCiphertext, extra] = value.slice('accounts:v1:'.length).split('.')
  if (!encodedIv || !encodedTag || !encodedCiphertext || extra) {
    throw new Error('Format des comptes éducateurs chiffrés invalide.')
  }
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
    throw new Error('Format des comptes éducateurs chiffrés invalide.')
  }

  const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), iv)
  decipher.setAuthTag(tag)
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
  let parsed: unknown
  try {
    parsed = JSON.parse(plaintext)
  } catch {
    throw new Error('Les comptes éducateurs enregistrés sont invalides.')
  }
  if (!Array.isArray(parsed)) throw new Error('Les comptes éducateurs enregistrés sont invalides.')
  return validateAccounts(parsed)
}

function validateAccounts(value: unknown[]): EducatorAccount[] {
  const usernames = new Set<string>()
  const accounts = value.map((entry) => {
    if (
      typeof entry !== 'object' ||
      entry === null ||
      !('username' in entry) ||
      !('displayName' in entry) ||
      !('passwordHash' in entry) ||
      !('role' in entry)
    ) {
      throw new Error('Un compte éducateur enregistré est invalide.')
    }
    const account = entry as Record<string, unknown>
    if (
      typeof account.username !== 'string' ||
      typeof account.displayName !== 'string' ||
      (account.firstName !== undefined && typeof account.firstName !== 'string') ||
      (account.lastName !== undefined && typeof account.lastName !== 'string') ||
      typeof account.passwordHash !== 'string' ||
      !isAccountRole(account.role) ||
      !/^scrypt\$[A-Za-z0-9_-]{22}\$[A-Za-z0-9_-]{86}$/.test(account.passwordHash)
    ) {
      throw new Error('Un compte éducateur enregistré est invalide.')
    }

    const username = account.username.trim().toLocaleLowerCase('fr-FR')
    if (!username || usernames.has(username)) {
      throw new Error('Les identifiants éducateurs doivent être renseignés et uniques.')
    }
    usernames.add(username)
    return {
      username: account.username.trim(),
      displayName: account.displayName.trim(),
      ...(typeof account.firstName === 'string' ? { firstName: account.firstName.trim() } : {}),
      ...(typeof account.lastName === 'string' ? { lastName: account.lastName.trim() } : {}),
      passwordHash: account.passwordHash,
      role: account.role,
    }
  })

  if (accounts.length > 200) throw new Error('Le nombre maximal de comptes éducateurs est dépassé.')
  if (!accounts.some((account) => account.role === 'admin')) {
    throw new Error('Au moins un compte administrateur doit être configuré.')
  }
  return accounts
}

function readBootstrapAccounts(): EducatorAccount[] {
  const raw = process.env.EDUCATOR_ACCOUNTS
  if (!raw) throw new Error('EDUCATOR_ACCOUNTS n’est pas configuré pour initialiser les comptes.')
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('EDUCATOR_ACCOUNTS doit contenir un tableau JSON valide.')
  }
  if (!Array.isArray(parsed)) throw new Error('EDUCATOR_ACCOUNTS doit être un tableau.')
  return validateAccounts(parsed)
}

async function getAccountSheetRows() {
  let sheet: Awaited<ReturnType<typeof getAuthenticatedSheetRows>>
  try {
    sheet = await getAuthenticatedSheetRows(ACCOUNT_TAB)
    if (sheet.sheetTitle === ACCOUNT_TAB) return sheet
  } catch (error) {
    if (!(error instanceof Error) || error.message !== 'Aucun onglet Google Sheets trouvé.') throw error
  }

  await ensureAuthenticatedSheetTab(ACCOUNT_TAB)
  sheet = await getAuthenticatedSheetRows(ACCOUNT_TAB)
  if (sheet.sheetTitle !== ACCOUNT_TAB) {
    throw new Error(`Impossible de sélectionner l’onglet « ${ACCOUNT_TAB} » exact.`)
  }
  return sheet
}

export async function getEducatorAccounts(): Promise<EducatorAccount[]> {
  getEncryptionKey()
  const sheet = await getAccountSheetRows()

  if (sheet.rows.length === 0) {
    const accounts = readBootstrapAccounts()
    await updateAuthenticatedSheetValues([
      { range: `'${sheet.sheetTitle}'!A1:A2`, values: [[ACCOUNT_HEADER], [encryptAccounts(accounts)]] },
    ])
    return accounts
  }

  if (sheet.rows[0]?.[0] !== ACCOUNT_HEADER) {
    throw new Error(`Les en-têtes de l’onglet « ${ACCOUNT_TAB} » sont inattendus.`)
  }
  const encrypted = sheet.rows[1]?.[0]?.trim()
  if (!encrypted) {
    const accounts = readBootstrapAccounts()
    await updateAuthenticatedSheetValues([
      { range: `'${sheet.sheetTitle}'!A2`, values: [[encryptAccounts(accounts)]] },
    ])
    return accounts
  }
  if (!encrypted.startsWith('accounts:v1:')) {
    throw new Error('Les comptes éducateurs ne sont pas chiffrés avec le format attendu.')
  }
  return decryptAccounts(encrypted)
}

export async function saveEducatorAccounts(accounts: EducatorAccount[]) {
  const validatedAccounts = validateAccounts(accounts)
  const sheet = await getAccountSheetRows()
  if (sheet.rows[0]?.[0] !== ACCOUNT_HEADER) {
    throw new Error(`Les en-têtes de l’onglet « ${ACCOUNT_TAB} » sont inattendus.`)
  }
  await updateAuthenticatedSheetValues([
    { range: `'${sheet.sheetTitle.replace(/'/g, "''")}'!A2`, values: [[encryptAccounts(validatedAccounts)]] },
  ])
}
