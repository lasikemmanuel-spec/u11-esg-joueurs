import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { getEducatorSession, hasEducatorAccess, isSameOriginRequest } from '@/lib/educator-auth'
import { getTrainingCancellations, removeTrainingCancellation, saveTrainingCancellation } from '@/lib/training-cancellations'
import { isTrainingCancellationDate, isTrainingCancellationReason } from '@/lib/training-cancellations-shared'
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

async function educatorAccess(request: Request) {
  try {
    const educator = await getEducatorSession(request)
    if (!educator) return { response: response({ error: 'Connexion éducateur requise.' }, 401) }
    if (!hasEducatorAccess(educator)) return { response: response({ error: 'Accès réservé aux éducateurs.' }, 403) }
    return { response: null, educator }
  } catch (error) {
    console.error('Erreur de vérification de session pour les annulations:', error)
    return { response: response({ error: 'La connexion éducateur n’est pas disponible.' }, 503) }
  }
}

export async function GET(request: Request) {
  const access = await educatorAccess(request)
  if (access.response) return access.response

  try {
    return response({ cancellations: await getTrainingCancellations() })
  } catch (error) {
    console.error('Erreur lors du chargement des annulations d’entraînement:', error)
    return response({ error: 'Impossible de charger les annulations d’entraînement.' }, 503)
  }
}

export async function POST(request: Request) {
  if (process.env.VERCEL_ENV !== 'production') {
    return response({ error: 'L’enregistrement des annulations est désactivé dans cet aperçu.' }, 403)
  }
  if (!isSameOriginRequest(request)) return response({ error: 'Requête non autorisée.' }, 403)

  const access = await educatorAccess(request)
  if (access.response) return access.response

  let rawBody: string
  try {
    rawBody = await request.text()
  } catch {
    return response({ error: 'Données d’annulation invalides.' }, 400)
  }
  if (Buffer.byteLength(rawBody, 'utf8') > 4_096) return response({ error: 'Requête trop volumineuse.' }, 413)

  let input: unknown
  try {
    input = JSON.parse(rawBody)
  } catch {
    return response({ error: 'Données d’annulation invalides.' }, 400)
  }
  if (
    !isRecord(input) ||
    !isTrainingCancellationDate(input.date) ||
    !isTrainingCancellationReason(input.reason)
  ) {
    return response({ error: 'Choisis une date valide et indique un motif de 240 caractères maximum.' }, 400)
  }

  try {
    const cancelledAt = new Date().toISOString()
    await saveTrainingCancellation(input.date, input.reason, access.educator.username, cancelledAt)
    revalidateTag('google-sheet', { expire: 0 })
    logSecurityEvent({
      event: 'training_session_cancelled',
      username: access.educator.username,
      ip: getClientIp(request),
      userAgent: getUserAgent(request),
      role: access.educator.role,
      detail: `date=${input.date} reason=${input.reason.trim()}`,
    })
    return response({ ok: true })
  } catch (error) {
    console.error('Erreur lors de l’enregistrement de l’annulation:', error)
    return response({ error: 'Impossible d’enregistrer l’annulation.' }, 503)
  }
}

export async function DELETE(request: Request) {
  if (process.env.VERCEL_ENV !== 'production') {
    return response({ error: 'La restauration des séances est désactivée dans cet aperçu.' }, 403)
  }
  if (!isSameOriginRequest(request)) return response({ error: 'Requête non autorisée.' }, 403)

  const access = await educatorAccess(request)
  if (access.response) return access.response
  const date = new URL(request.url).searchParams.get('date')
  if (!isTrainingCancellationDate(date)) return response({ error: 'La date d’annulation est invalide.' }, 400)

  try {
    if (!await removeTrainingCancellation(date)) {
      return response({ error: 'Aucune annulation enregistrée à cette date.' }, 404)
    }
    revalidateTag('google-sheet', { expire: 0 })
    logSecurityEvent({
      event: 'training_session_reinstated',
      username: access.educator.username,
      ip: getClientIp(request),
      userAgent: getUserAgent(request),
      role: access.educator.role,
      detail: `date=${date}`,
    })
    return response({ ok: true })
  } catch (error) {
    console.error('Erreur lors de la restauration de la séance:', error)
    return response({ error: 'Impossible de rétablir la séance.' }, 503)
  }
}
