import 'server-only'
import crypto from 'node:crypto'

const SESSION_COOKIE = 'educator_session'
const SESSION_DURATION_SECONDS = 8 * 60 * 60

export type EducatorAccount = {
  username: string
  displayName: string
  passwordHash: string
  role: 'educator' | 'admin'
}

export type EducatorSession = Pick<EducatorAccount, 'username' | 'displayName' | 'role'>

export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get('origin')
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  if (!origin || !host) return false

  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

function getAccounts(): EducatorAccount[] {
  const raw = process.env.EDUCATOR_ACCOUNTS
  if (!raw) throw new Error('EDUCATOR_ACCOUNTS n’est pas configuré.')

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('EDUCATOR_ACCOUNTS doit contenir un tableau JSON valide.')
  }

  if (!Array.isArray(parsed)) throw new Error('EDUCATOR_ACCOUNTS doit être un tableau.')

  const accounts = parsed as EducatorAccount[]
  const usernames = new Set<string>()
  for (const account of accounts) {
    if (
      typeof account.username !== 'string' ||
      typeof account.displayName !== 'string' ||
      typeof account.passwordHash !== 'string' ||
      !['educator', 'admin'].includes(account.role) ||
      !/^scrypt\$[A-Za-z0-9_-]{16,}\$[A-Za-z0-9_-]{32,}$/.test(account.passwordHash)
    ) {
      throw new Error('Un compte dans EDUCATOR_ACCOUNTS est invalide.')
    }

    const username = account.username.trim().toLocaleLowerCase('fr-FR')
    if (!username || usernames.has(username)) {
      throw new Error('Les identifiants dans EDUCATOR_ACCOUNTS doivent être uniques.')
    }
    usernames.add(username)
  }

  return accounts
}

function getSessionSecret() {
  const secret = process.env.EDUCATOR_SESSION_SECRET?.trim()
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new Error('EDUCATOR_SESSION_SECRET doit contenir au moins 32 octets.')
  }
  return secret
}

function safeEqual(a: Buffer, b: Buffer) {
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

export function verifyEducatorPassword(account: EducatorAccount | undefined, password: string) {
  const [scheme, saltText, hashText] = account?.passwordHash.split('$') ?? []
  const salt = scheme === 'scrypt' ? Buffer.from(saltText, 'base64url') : Buffer.alloc(16, 1)
  const expected = scheme === 'scrypt' ? Buffer.from(hashText, 'base64url') : Buffer.alloc(64)
  const actual = crypto.scryptSync(password, salt, expected.length)
  return Boolean(account) && safeEqual(actual, expected)
}

export function findEducator(username: string) {
  const normalized = username.trim().toLocaleLowerCase('fr-FR')
  return getAccounts().find((account) => account.username.toLocaleLowerCase('fr-FR') === normalized)
}

export function createEducatorSession(account: EducatorAccount) {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS
  const credentialVersion = crypto.createHash('sha256').update(account.passwordHash).digest('base64url')
  const payload = Buffer.from(JSON.stringify({
    username: account.username,
    expiresAt,
    credentialVersion,
  })).toString('base64url')
  const signature = crypto.createHmac('sha256', getSessionSecret()).update(payload).digest('base64url')
  return { token: `${payload}.${signature}`, maxAge: SESSION_DURATION_SECONDS }
}

export function getEducatorSession(request: Request): EducatorSession | null {
  const cookieName = educatorSessionCookieName()
  const cookie = request.headers.get('cookie')
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1)
  if (!cookie) return null

  const [payload, signature, extra] = cookie.split('.')
  if (!payload || !signature || extra) return null

  let submittedSignature: Buffer
  try {
    submittedSignature = Buffer.from(signature, 'base64url')
  } catch {
    return null
  }
  const expectedSignature = crypto.createHmac('sha256', getSessionSecret()).update(payload).digest()
  if (!safeEqual(submittedSignature, expectedSignature)) return null

  let session: { username?: unknown; expiresAt?: unknown; credentialVersion?: unknown }
  try {
    session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  } catch {
    return null
  }
  if (
    typeof session.username !== 'string' ||
    typeof session.expiresAt !== 'number' ||
    session.expiresAt <= Math.floor(Date.now() / 1000)
  ) {
    return null
  }

  const account = findEducator(session.username)
  if (!account) return null
  const credentialVersion = crypto.createHash('sha256').update(account.passwordHash).digest('base64url')
  if (session.credentialVersion !== credentialVersion) return null
  return { username: account.username, displayName: account.displayName, role: account.role }
}

export function educatorSessionCookieName() {
  return process.env.NODE_ENV === 'production' ? `__Host-${SESSION_COOKIE}` : SESSION_COOKIE
}
