import crypto from 'node:crypto'

const STATE_COOKIE = 'google_oauth_state'
export const GOOGLE_OAUTH_STATE_MAX_AGE = 10 * 60

export function googleOAuthStateCookieName() {
  return process.env.NODE_ENV === 'production' ? `__Host-${STATE_COOKIE}` : STATE_COOKIE
}

export function createGoogleOAuthState() {
  return crypto.randomBytes(32).toString('base64url')
}

export function hasValidGoogleOAuthState(request: Request, submittedState: string | null) {
  if (!submittedState || !/^[A-Za-z0-9_-]{43}$/.test(submittedState)) return false

  const cookieName = googleOAuthStateCookieName()
  const cookie = request.headers.get('cookie')
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1)
  if (!cookie) return false

  const submitted = Buffer.from(submittedState)
  const expected = Buffer.from(cookie)
  return submitted.length === expected.length && crypto.timingSafeEqual(submitted, expected)
}

export function getGoogleOAuthRedirectUri(request: Request) {
  const requestUrl = new URL(request.url)
  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto')
  const host = forwardedHost ?? requestUrl.host
  const protocol = forwardedProto ?? requestUrl.protocol.slice(0, -1)

  if (!host || /[,\s/\\]/.test(host) || !['http', 'https'].includes(protocol)) {
    throw new Error('Origine OAuth Google invalide.')
  }
  if (process.env.NODE_ENV === 'production' && protocol !== 'https') {
    throw new Error('OAuth Google doit utiliser HTTPS en production.')
  }

  const origin = new URL(`${protocol}://${host}`)
  if (origin.username || origin.password) throw new Error('Origine OAuth Google invalide.')
  return `${origin.origin}/api/auth/google/callback`
}
