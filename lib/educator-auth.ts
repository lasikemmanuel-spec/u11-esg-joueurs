import 'server-only'
import crypto from 'node:crypto'
import { getEducatorAccounts, type EducatorAccount } from '@/lib/educator-account-store'

export type { EducatorAccount } from '@/lib/educator-account-store'

const SESSION_COOKIE = 'educator_session'
const SESSION_DURATION_SECONDS = 8 * 60 * 60
const SESSION_REMEMBER_ME_SECONDS = 30 * 24 * 60 * 60

export type EducatorSession = Pick<EducatorAccount, 'username' | 'displayName' | 'role'>

export function hasEducatorAccess(educator: EducatorSession) {
  return educator.role === 'educator' || educator.role === 'admin'
}

export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get('origin')
  if (!origin) return false

  try {
    return new URL(origin).origin === new URL(request.url).origin
  } catch {
    return false
  }
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
  let salt = Buffer.alloc(16, 1)
  let expected = Buffer.alloc(64)
  if (scheme === 'scrypt' && saltText && hashText) {
    const parsedSalt = Buffer.from(saltText, 'base64url')
    const parsedHash = Buffer.from(hashText, 'base64url')
    if (
      parsedSalt.length === 16 &&
      parsedSalt.toString('base64url') === saltText &&
      parsedHash.length === 64 &&
      parsedHash.toString('base64url') === hashText
    ) {
      salt = parsedSalt
      expected = parsedHash
    }
  }
  const actual = crypto.scryptSync(password, salt, expected.length)
  return Boolean(account) && safeEqual(actual, expected)
}

export async function findEducator(username: string) {
  const normalized = username.trim().toLocaleLowerCase('fr-FR')
  return (await getEducatorAccounts()).find((account) => account.username.toLocaleLowerCase('fr-FR') === normalized)
}

export function hashEducatorPassword(password: string) {
  const salt = crypto.randomBytes(16)
  const hash = crypto.scryptSync(password, salt, 64)
  return `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`
}

export function createEducatorSession(account: EducatorAccount, rememberMe = false) {
  const duration = rememberMe ? SESSION_REMEMBER_ME_SECONDS : SESSION_DURATION_SECONDS
  const expiresAt = Math.floor(Date.now() / 1000) + duration
  const credentialVersion = crypto.createHash('sha256').update(account.passwordHash).digest('base64url')
  const payload = Buffer.from(JSON.stringify({
    username: account.username,
    expiresAt,
    credentialVersion,
  })).toString('base64url')
  const signature = crypto.createHmac('sha256', getSessionSecret()).update(payload).digest('base64url')
  return { token: `${payload}.${signature}`, maxAge: duration }
}

export async function getEducatorSession(request: Request): Promise<EducatorSession | null> {
  const cookieHeader = request.headers.get('cookie') ?? ''
  const cookie = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`) || part.startsWith(`__Host-${SESSION_COOKIE}=`))
    ?.replace(/^(__Host-)?educator_session=/, '')
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

  const account = await findEducator(session.username)
  if (!account) return null
  const credentialVersion = crypto.createHash('sha256').update(account.passwordHash).digest('base64url')
  if (session.credentialVersion !== credentialVersion) return null
  return { username: account.username, displayName: account.displayName, role: account.role }
}

export function educatorSessionCookieName() {
  return SESSION_COOKIE
}
