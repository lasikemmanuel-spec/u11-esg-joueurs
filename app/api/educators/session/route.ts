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
import {
  clearLoginAccountAttempts,
  getLoginAttemptCounts,
  isLoginAttemptLimitReached,
  recordLoginFailure,
} from '@/lib/login-rate-limit'

export const runtime = 'nodejs'

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
  const ip = getClientIp(request)
  let attempts: Awaited<ReturnType<typeof getLoginAttemptCounts>>
  try {
    attempts = await getLoginAttemptCounts(request, username)
  } catch (error) {
    console.error('Service de limitation des connexions indisponible:', error)
    return jsonResponse({ error: 'Le service de connexion est temporairement indisponible.' }, 503)
  }
  if (isLoginAttemptLimitReached(attempts)) {
    logSecurityEvent({
      event: 'login_blocked',
      username,
      ip,
      userAgent: getUserAgent(request),
      detail: `attempts_user=${attempts.account} attempts_ip=${attempts.ip}`,
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
    try {
      await recordLoginFailure(request, username)
    } catch (error) {
      console.error('Impossible d’enregistrer l’échec de connexion:', error)
      return jsonResponse({ error: 'Le service de connexion est temporairement indisponible.' }, 503)
    }
    logSecurityEvent({
      event: 'login_failure',
      username,
      ip,
      userAgent: getUserAgent(request),
      detail: !account ? 'compte_inconnu' : 'mot_de_passe_incorrect',
    })
    return jsonResponse({ error: 'Identifiant ou mot de passe invalide.' }, 401)
  }

  try {
    await clearLoginAccountAttempts(username)
  } catch (error) {
    console.error('Impossible de réinitialiser les tentatives de connexion:', error)
    return jsonResponse({ error: 'Le service de connexion est temporairement indisponible.' }, 503)
  }
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
    sameSite: 'lax',
    path: '/',
    maxAge: session.maxAge,
    expires: new Date(Date.now() + session.maxAge * 1000),
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
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  })
  // Supprime aussi l'ancien cookie __Host- si présent
  response.cookies.set(`__Host-${educatorSessionCookieName()}`, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  })
  return response
}
