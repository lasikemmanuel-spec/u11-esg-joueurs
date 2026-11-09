import { NextResponse } from 'next/server'
import { getEducatorSession, isSameOriginRequest } from '@/lib/educator-auth'
import { getEducatorAccounts } from '@/lib/educator-account-store'
import { clearLoginAccountAttempts } from '@/lib/login-rate-limit'
import { getClientIp, getUserAgent, logSecurityEvent } from '@/lib/security-logger'

export const runtime = 'nodejs'

function response(body: object, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, private', Vary: 'Cookie' },
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function POST(request: Request) {
  if (process.env.VERCEL_ENV !== 'production') {
    return response({ error: 'Le déblocage des comptes est désactivé dans cet aperçu.' }, 403)
  }
  if (!isSameOriginRequest(request)) return response({ error: 'Requête non autorisée.' }, 403)

  let educator
  try {
    educator = await getEducatorSession(request)
  } catch (error) {
    console.error('Erreur de vérification de session pour le déblocage du compte:', error)
    return response({ error: 'La gestion des comptes éducateurs n’est pas disponible.' }, 503)
  }
  if (!educator) return response({ error: 'Connexion requise.' }, 401)
  if (educator.role !== 'admin') return response({ error: 'Droits administrateur requis.' }, 403)

  if (Number(request.headers.get('content-length') ?? 0) > 2048) {
    return response({ error: 'Requête trop volumineuse.' }, 413)
  }

  let input: unknown
  try {
    input = await request.json()
  } catch {
    return response({ error: 'Identifiant de compte invalide.' }, 400)
  }
  if (
    !isRecord(input) ||
    typeof input.username !== 'string' ||
    !input.username.trim() ||
    input.username.length > 120
  ) {
    return response({ error: 'Identifiant de compte invalide.' }, 400)
  }
  const username = input.username.trim()

  try {
    const accounts = await getEducatorAccounts()
    const target = accounts.find(
      (account) => account.username.toLocaleLowerCase('fr-FR') === username.toLocaleLowerCase('fr-FR'),
    )
    if (!target) return response({ error: 'Ce compte éducateur n’existe plus.' }, 404)

    await clearLoginAccountAttempts(target.username)
    logSecurityEvent({
      event: 'login_unlocked',
      username: educator.username,
      ip: getClientIp(request),
      userAgent: getUserAgent(request),
      role: educator.role,
      detail: `target=${target.username} scope=account_only`,
    })
    return response({ ok: true })
  } catch (error) {
    console.error('Erreur lors du déblocage du compte éducateur:', error)
    return response({ error: 'Impossible de réinitialiser les tentatives de ce compte.' }, 503)
  }
}
