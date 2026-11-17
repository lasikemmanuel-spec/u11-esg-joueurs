import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { getEducatorSession, hasEducatorAccess, isSameOriginRequest } from '@/lib/educator-auth'
import { isLiveMatchSettings } from '@/lib/live-match-settings'
import { getSavedLiveMatchSettings, saveLiveMatchSettings } from '@/lib/live-match-settings-store'

export const runtime = 'nodejs'

function jsonResponse(body: object, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, private', Vary: 'Cookie' },
  })
}

async function authorize(request: Request) {
  try {
    const educator = await getEducatorSession(request)
    if (!educator) return jsonResponse({ error: 'Connexion éducateur requise.' }, 401)
    if (!hasEducatorAccess(educator)) return jsonResponse({ error: 'Accès réservé aux éducateurs.' }, 403)
    return null
  } catch (error) {
    console.error('Erreur de vérification de session pour les réglages du match en direct:', error)
    const rateLimited = error instanceof Error && error.message.includes('(429)')
    return jsonResponse({
      error: rateLimited
        ? 'Google Sheets est temporairement saturé. Réessaie dans quelques instants.'
        : 'La connexion éducateur n’est pas disponible.',
    }, rateLimited ? 429 : 503)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function GET(request: Request) {
  if (process.env.VERCEL_ENV !== 'production') {
    return jsonResponse({ error: 'Le mode match en direct est désactivé dans cette prévisualisation.' }, 403)
  }
  const denied = await authorize(request)
  if (denied) return denied
  try {
    return jsonResponse({ settings: await getSavedLiveMatchSettings() })
  } catch (error) {
    console.error('Erreur de lecture des réglages du match en direct:', error)
    const rateLimited = error instanceof Error && error.message.includes('(429)')
    return jsonResponse({
      error: rateLimited
        ? 'Google Sheets est temporairement saturé. Réessaie dans quelques instants.'
        : 'Impossible de charger les réglages du match en direct.',
    }, rateLimited ? 429 : 500)
  }
}

export async function POST(request: Request) {
  if (process.env.VERCEL_ENV !== 'production') {
    return jsonResponse({ error: 'Le mode match en direct est désactivé dans cette prévisualisation.' }, 403)
  }
  if (!isSameOriginRequest(request)) return jsonResponse({ error: 'Requête non autorisée.' }, 403)
  const denied = await authorize(request)
  if (denied) return denied
  if (Number(request.headers.get('content-length') ?? 0) > 8_000) {
    return jsonResponse({ error: 'Les réglages transmis sont trop volumineux.' }, 413)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: 'Requête invalide.' }, 400)
  }
  const settings = isRecord(body) ? body.settings : undefined
  if (!isLiveMatchSettings(settings)) {
    return jsonResponse({ error: 'Les réglages du match en direct sont invalides.' }, 400)
  }

  try {
    await saveLiveMatchSettings(settings)
    revalidateTag('google-sheet', { expire: 0 })
    return jsonResponse({ ok: true, settings })
  } catch (error) {
    console.error('Erreur d’enregistrement des réglages du match en direct:', error)
    const rateLimited = error instanceof Error && error.message.includes('(429)')
    return jsonResponse({
      error: rateLimited
        ? 'Google Sheets est temporairement saturé. Réessaie dans quelques instants.'
        : 'Impossible d’enregistrer les réglages du match en direct.',
    }, rateLimited ? 429 : 500)
  }
}
