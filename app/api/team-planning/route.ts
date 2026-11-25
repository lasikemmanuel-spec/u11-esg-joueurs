import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { getEducatorSession, hasEducatorAccess, isSameOriginRequest, type EducatorSession } from '@/lib/educator-auth'
import {
  getTeamPlanningEvents,
  saveTeamPlanningEvent,
  saveTeamPlanningEvents,
  updateTeamPlanningSeries,
} from '@/lib/team-planning'
import {
  getWeeklyRecurrenceDates,
  isValidPlanningDate,
  parsePlanningEventFields,
  type PlanningEvent,
} from '@/lib/team-planning-shared'
import { getClientIp, getUserAgent, logSecurityEvent } from '@/lib/security-logger'

export const runtime = 'nodejs'

type AuthorizationResult =
  | { authorized: true; educator: EducatorSession }
  | { authorized: false; response: NextResponse }

type InputResult =
  | { valid: true; input: unknown }
  | { valid: false; response: NextResponse }

function response(body: object, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, private', Vary: 'Cookie' },
  })
}

async function authorizeWrite(request: Request): Promise<AuthorizationResult> {
  if (process.env.VERCEL_ENV !== 'production') {
    return { authorized: false, response: response({ error: 'La modification du planning est désactivée dans cet aperçu.' }, 403) }
  }
  if (!isSameOriginRequest(request)) {
    return { authorized: false, response: response({ error: 'Requête non autorisée.' }, 403) }
  }

  try {
    const educator = await getEducatorSession(request)
    if (!educator) return { authorized: false, response: response({ error: 'Connexion éducateur requise.' }, 401) }
    if (!hasEducatorAccess(educator)) {
      return { authorized: false, response: response({ error: 'Accès réservé aux éducateurs.' }, 403) }
    }
    return { authorized: true, educator }
  } catch (error) {
    console.error('Erreur de vérification de session pour le planning:', error)
    return { authorized: false, response: response({ error: 'La connexion éducateur n’est pas disponible.' }, 503) }
  }
}

async function readInput(request: Request): Promise<InputResult> {
  let rawBody: string
  try {
    rawBody = await request.text()
  } catch {
    return { valid: false, response: response({ error: 'Données du planning invalides.' }, 400) }
  }
  if (Buffer.byteLength(rawBody, 'utf8') > 16_384) {
    return { valid: false, response: response({ error: 'Requête trop volumineuse.' }, 413) }
  }

  try {
    return { valid: true, input: JSON.parse(rawBody) as unknown }
  } catch {
    return { valid: false, response: response({ error: 'Données du planning invalides.' }, 400) }
  }
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export async function GET() {
  try {
    return response({ events: await getTeamPlanningEvents() })
  } catch (error) {
    console.error('Erreur lors du chargement du planning:', error)
    return response({ error: 'Impossible de charger le planning.' }, 503)
  }
}

export async function POST(request: Request) {
  const authorization = await authorizeWrite(request)
  if (!authorization.authorized) return authorization.response

  const body = await readInput(request)
  if (!body.valid) return body.response
  if (typeof body.input !== 'object' || body.input === null || Array.isArray(body.input)) {
    return response({ error: 'Données du planning invalides.' }, 400)
  }
  const input = body.input as Record<string, unknown>
  const fields = parsePlanningEventFields(body.input)
  if (!fields) return response({ error: 'Vérifie les informations de l’événement.' }, 400)

  let dates = [fields.date]
  let recurrenceEndDate: string | undefined
  const recurrenceValue = input.recurrence
  if (recurrenceValue !== undefined && recurrenceValue !== null) {
    if (
      typeof recurrenceValue !== 'object' ||
      Array.isArray(recurrenceValue)
    ) {
      return response({ error: 'La récurrence hebdomadaire est invalide.' }, 400)
    }

    const recurrence = recurrenceValue as Record<string, unknown>
    if (recurrence.frequency !== 'weekly' || typeof recurrence.endDate !== 'string') {
      return response({ error: 'La récurrence hebdomadaire est invalide.' }, 400)
    }

    const recurrenceDates = getWeeklyRecurrenceDates(fields.date, recurrence.endDate)
    if (!recurrenceDates) {
      return response({ error: 'La date de fin doit permettre entre 2 et 52 événements hebdomadaires.' }, 400)
    }
    dates = recurrenceDates
    recurrenceEndDate = recurrence.endDate
  }

  const recurrenceGroupId = recurrenceEndDate ? crypto.randomUUID() : undefined
  const events: PlanningEvent[] = dates.map((date) => ({
    id: crypto.randomUUID(),
    ...fields,
    date,
    ...(recurrenceGroupId && recurrenceEndDate ? { recurrenceGroupId, recurrenceEndDate } : {}),
  }))
  try {
    await saveTeamPlanningEvents(events)
    revalidateTag('google-sheet', { expire: 0 })
    logSecurityEvent({
      event: 'team_planning_event_created',
      username: authorization.educator.username,
      ip: getClientIp(request),
      userAgent: getUserAgent(request),
      role: authorization.educator.role,
      detail: `event_id=${events[0].id} date=${fields.date} occurrences=${events.length}${recurrenceGroupId ? ` series_id=${recurrenceGroupId}` : ''}`,
    })
    return response({ ok: true, event: events[0], events }, 201)
  } catch (error) {
    console.error('Erreur lors de la création d’un événement du planning:', error)
    return response({ error: 'Impossible d’enregistrer l’événement dans le planning.' }, 503)
  }
}

export async function PUT(request: Request) {
  const authorization = await authorizeWrite(request)
  if (!authorization.authorized) return authorization.response

  const body = await readInput(request)
  if (!body.valid) return body.response
  if (typeof body.input !== 'object' || body.input === null || Array.isArray(body.input)) {
    return response({ error: 'Données du planning invalides.' }, 400)
  }
  const input = body.input as Record<string, unknown>
  const fields = parsePlanningEventFields(input)
  if (!fields) return response({ error: 'Vérifie les informations de l’événement.' }, 400)

  if (input.scope === 'series') {
    if (!isUuid(input.seriesId)) return response({ error: 'Identifiant de série invalide.' }, 400)
    try {
      const events = await updateTeamPlanningSeries(input.seriesId, fields)
      if (events.length === 0) return response({ error: 'Cette série n’existe plus. Actualise le planning.' }, 404)
      revalidateTag('google-sheet', { expire: 0 })
      logSecurityEvent({
        event: 'team_planning_event_updated',
        username: authorization.educator.username,
        ip: getClientIp(request),
        userAgent: getUserAgent(request),
        role: authorization.educator.role,
        detail: `series_id=${input.seriesId} occurrences=${events.length}`,
      })
      return response({ ok: true, event: events[0], events })
    } catch (error) {
      console.error('Erreur lors de la modification d’une série du planning:', error)
      return response({ error: 'Impossible de modifier la série dans le planning.' }, 503)
    }
  }

  if (!isUuid(input.id)) return response({ error: 'Identifiant d’événement invalide.' }, 400)
  let recurrenceMetadata: Pick<PlanningEvent, 'recurrenceGroupId' | 'recurrenceEndDate'> = {}
  if (input.recurrenceGroupId != null || input.recurrenceEndDate != null) {
    if (
      !isUuid(input.recurrenceGroupId) ||
      typeof input.recurrenceEndDate !== 'string' ||
      !isValidPlanningDate(input.recurrenceEndDate) ||
      fields.date > input.recurrenceEndDate
    ) {
      return response({ error: 'Identifiants de série invalides.' }, 400)
    }
    recurrenceMetadata = {
      recurrenceGroupId: input.recurrenceGroupId,
      recurrenceEndDate: input.recurrenceEndDate,
    }
  }

  const event: PlanningEvent = { id: input.id, ...fields, ...recurrenceMetadata }
  try {
    const updated = await saveTeamPlanningEvent(event, 'update')
    if (!updated) return response({ error: 'Cet événement n’existe plus. Actualise le planning.' }, 404)
    revalidateTag('google-sheet', { expire: 0 })
    logSecurityEvent({
      event: 'team_planning_event_updated',
      username: authorization.educator.username,
      ip: getClientIp(request),
      userAgent: getUserAgent(request),
      role: authorization.educator.role,
      detail: `event_id=${event.id} date=${event.date}`,
    })
    return response({ ok: true, event })
  } catch (error) {
    console.error('Erreur lors de la modification d’un événement du planning:', error)
    return response({ error: 'Impossible de modifier l’événement dans le planning.' }, 503)
  }
}
