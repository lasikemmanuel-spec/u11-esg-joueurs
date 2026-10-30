import { NextResponse } from 'next/server'
import {
  createEducatorSession,
  educatorSessionCookieName,
  findEducator,
  getEducatorSession,
  isSameOriginRequest,
  verifyEducatorPassword,
} from '@/lib/educator-auth'

export const runtime = 'nodejs'

const failedAttempts = new Map<string, { count: number; resetAt: number }>()
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 8
const MAX_TRACKED_KEYS = 5000

function jsonResponse(body: object, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, private' },
  })
}

export async function GET(request: Request) {
  const educator = getEducatorSession(request)
  if (!educator) return jsonResponse({ error: 'Connexion requise.' }, 401)
  return jsonResponse({ educator: { displayName: educator.displayName, role: educator.role } })
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return jsonResponse({ error: 'Requête non autorisée.' }, 403)
  if (Number(request.headers.get('content-length') ?? 0) > 2048) {
    return jsonResponse({ error: 'Requête trop volumineuse.' }, 413)
  }

  let credentials: { username?: unknown; password?: unknown }
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
  const key = `${ip}:${username.toLocaleLowerCase('fr-FR')}`
  const now = Date.now()
  const attempts = failedAttempts.get(key)
  if (attempts && attempts.resetAt > now && attempts.count >= MAX_ATTEMPTS) {
    return jsonResponse({ error: 'Trop de tentatives. Réessayez dans quelques minutes.' }, 429)
  }
  if (attempts && attempts.resetAt <= now) failedAttempts.delete(key)

  let account: ReturnType<typeof findEducator>
  let validPassword = false
  try {
    account = findEducator(username)
    validPassword = verifyEducatorPassword(account, credentials.password)
  } catch (error) {
    console.error('Configuration de connexion éducateur invalide:', error)
    return jsonResponse({ error: 'La connexion éducateur n’est pas configurée.' }, 503)
  }
  if (!account || !validPassword) {
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
    return jsonResponse({ error: 'Identifiant ou mot de passe invalide.' }, 401)
  }

  failedAttempts.delete(key)
  let session: ReturnType<typeof createEducatorSession>
  try {
    session = createEducatorSession(account)
  } catch (error) {
    console.error('Configuration de session éducateur invalide:', error)
    return jsonResponse({ error: 'La connexion éducateur n’est pas configurée.' }, 503)
  }
  const response = jsonResponse({
    educator: { displayName: account.displayName, role: account.role },
  })
  response.cookies.set(educatorSessionCookieName(), session.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: session.maxAge,
  })
  return response
}

export async function DELETE(request: Request) {
  if (!isSameOriginRequest(request)) return jsonResponse({ error: 'Requête non autorisée.' }, 403)
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
