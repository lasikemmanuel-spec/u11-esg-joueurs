import { NextResponse } from 'next/server'
import {
  createEducatorSession,
  educatorSessionCookieName,
  findEducator,
  getEducatorSession,
  isSameOriginRequest,
  verifyEducatorPassword,
} from '@/lib/educator-auth'
import { logSecurityEvent, getClientIp, getUserAgent } from '@/lib/security-logger'

export const runtime = 'nodejs'

const failedAttempts = new Map<string, { count: number; resetAt: number }>()
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000
const MAX_USER_ATTEMPTS = 5
const MAX_IP_ATTEMPTS = 15
const MAX_TRACKED_KEYS = 5000

function recordFailure(key: string, now: number) {
  const current = failedAttempts.get(key)
  if (!current && failedAttempts.size >= MAX_TRACKED_KEYS) {
    for (const [trackedKey, value] of failedAttempts) {
      if (value.resetAt <= now) failedAttempts.delete(trackedKey)
    }
    if (failedAttempts.size >= MAX_TRACKED_KEYS) {
      const oldestKey = failedAttempts.keys().next().value
      if (oldestKey) failedAttempts.delete(oldestKey)
    }
  }
  failedAttempts.set(key, {
    count: (current?.count ?? 0) + 1,
    resetAt: current?.resetAt && current.resetAt > now ? current.resetAt : now + ATTEMPT_WINDOW_MS,
  })
}

function jsonResponse(body: object, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, private' },
  })
}

export async function GET(request: Request) {
  try {
    const educator = await getEducatorSession(request)
    if (!educator) return jsonResponse({ error: 'Connexion requise.' }, 401)
    return jsonResponse({ educator: { username: educator.username, displayName: educator.displayName, role: educator.role } })
  } catch (error) {
    console.error('Erreur de vérification de session éducateur:', error)
    return jsonResponse({ error: 'La connexion éducateur n’est pas disponible.' }, 503)
  }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return jsonResponse({ error: 'Requête non autorisée.' }, 403)
  if (Number(request.headers.get('content-length') ?? 0) > 2048) {
    return jsonResponse({ error: 'Requête trop volumineuse.' }, 413)
  }

  let credentials: { username?: unknown; password?: unknown; rememberMe?: unknown }
  try {
    credentials = await request.json()
  } catch {
    return jsonResponse({ error: 'Identifiant ou mot de passe invalide.' }, 400)
  }

  if (
    typeof credentials.username !== 'string' ||
    typeof credentials.password !== 'string' ||
    credentials.username.length > 120 ||
    credentials.password.length > 256
  ) {
    return jsonResponse({ error: 'Identifiant ou mot de passe invalide.' }, 400)
  }

  const username = credentials.username.trim()
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const userKey = `user:${ip}:${username.toLocaleLowerCase('fr-FR')}`
  const ipKey = `ip:${ip}`
  const now = Date.now()

  const attemptsUser = failedAttempts.get(userKey)
  const attemptsIp = failedAttempts.get(ipKey)

  if (attemptsUser && attemptsUser.resetAt <= now) failedAttempts.delete(userKey)
  if (attemptsIp && attemptsIp.resetAt <= now) failedAttempts.delete(ipKey)

  if (
    (attemptsUser && attemptsUser.resetAt > now && attemptsUser.count >= MAX_USER_ATTEMPTS) ||
    (attemptsIp && attemptsIp.resetAt > now && attemptsIp.count >= MAX_IP_ATTEMPTS)
  ) {
    logSecurityEvent({
      event: 'login_blocked',
      username,
      ip: getClientIp(request),
      userAgent: getUserAgent(request),
      detail: `attempts_user=${attemptsUser?.count ?? 0} attempts_ip=${attemptsIp?.count ?? 0}`,
    })
    return jsonResponse({ error: 'Trop de tentatives infructueuses. Veuillez patienter 15 minutes.' }, 429)
  }

  let account: Awaited<ReturnType<typeof findEducator>>
  let validPassword = false
  try {
    account = await findEducator(username)
    validPassword = verifyEducatorPassword(account, credentials.password)
  } catch (error) {
    const rateLimited = error instanceof Error && /\(429\)/.test(error.message)
    console.error(
      rateLimited
        ? 'Google Sheets limite temporairement les connexions éducateur:'
        : 'Impossible de charger ou vérifier le compte éducateur:',
      error,
    )
    return jsonResponse({
      error: rateLimited
        ? 'Le service de connexion est temporairement saturé. Réessayez dans quelques instants.'
        : 'La connexion éducateur n’est pas disponible ou configurée.',
    }, 503)
  }
  if (!account || !validPassword) {
    recordFailure(userKey, now)
    recordFailure(ipKey, now)
    logSecurityEvent({
      event: 'login_failure',
      username,
      ip: getClientIp(request),
      userAgent: getUserAgent(request),
      detail: !account ? 'compte_inconnu' : 'mot_de_passe_incorrect',
    })
    return jsonResponse({ error: 'Identifiant ou mot de passe invalide.' }, 401)
  }

  failedAttempts.delete(userKey)
  let session: ReturnType<typeof createEducatorSession>
  try {
    session = createEducatorSession(account, Boolean(credentials.rememberMe))
  } catch (error) {
    console.error('Configuration de session éducateur invalide:', error)
    return jsonResponse({ error: 'La connexion éducateur n’est pas configurée.' }, 503)
  }
  const response = jsonResponse({
    educator: { username: account.username, displayName: account.displayName, role: account.role },
  })
  response.cookies.set(educatorSessionCookieName(), session.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: session.maxAge,
  })
  logSecurityEvent({
    event: 'login_success',
    username: account.username,
    ip: getClientIp(request),
    userAgent: getUserAgent(request),
    role: account.role,
    detail: credentials.rememberMe ? 'remember_me=true' : 'remember_me=false',
  })
  return response
}

export async function DELETE(request: Request) {
  if (!isSameOriginRequest(request)) return jsonResponse({ error: 'Requête non autorisée.' }, 403)
  let educator: Awaited<ReturnType<typeof getEducatorSession>> = null
  try {
    educator = await getEducatorSession(request)
  } catch {
    // session invalide ou expirée — on déconnecte quand même
  }
  logSecurityEvent({
    event: 'logout',
    username: educator?.username,
    ip: getClientIp(request),
    userAgent: getUserAgent(request),
    role: educator?.role,
  })
  const response = jsonResponse({ ok: true })
  response.cookies.set(educatorSessionCookieName(), '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  })
  return response
}
