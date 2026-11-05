import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { getEducatorSession, hasEducatorAccess, isSameOriginRequest } from '@/lib/educator-auth'
import { writeMatchResult } from '@/lib/match-results'
import { MATCH_RESULT_STATUSES } from '@/lib/match-result-options'
import { MATCH_SEASON_END, MATCH_SEASON_START } from '@/lib/match-season'
import { logSecurityEvent, getClientIp, getUserAgent } from '@/lib/security-logger'

export const runtime = 'nodejs'

function jsonResponse(body: object, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, private', Vary: 'Cookie' },
  })
}

export async function GET(request: Request) {
  let educator
  try {
    educator = await getEducatorSession(request)
  } catch (error) {
    console.error('Erreur de vérification de session éducateur:', error)
    return jsonResponse({ error: 'La connexion éducateur n’est pas disponible.' }, 503)
  }
  return jsonResponse({
    enabled: process.env.VERCEL_ENV === 'production',
    role: educator?.role ?? null,
    displayName: educator?.displayName ?? null,
  })
}

async function save(request: Request, editing: boolean) {
  if (process.env.VERCEL_ENV !== 'production') {
    return jsonResponse({ error: 'La saisie réelle est désactivée dans cette prévisualisation.' }, 403)
  }
  if (!isSameOriginRequest(request)) return jsonResponse({ error: 'Requête non autorisée.' }, 403)
  let educator
  try {
    educator = await getEducatorSession(request)
  } catch (error) {
    console.error('Erreur de vérification de session éducateur:', error)
    return jsonResponse({ error: 'La connexion éducateur n’est pas disponible.' }, 503)
  }
  if (!educator) return jsonResponse({ error: 'Connexion éducateur requise.' }, 401)
  if (!hasEducatorAccess(educator)) return jsonResponse({ error: 'Accès réservé aux éducateurs.' }, 403)
  if (Number(request.headers.get('content-length') ?? 0) > 4096) {
    return jsonResponse({ error: 'Requête trop volumineuse.' }, 413)
  }

  let input: Record<string, unknown>
  try {
    input = await request.json()
  } catch {
    return jsonResponse({ error: 'Match invalide.' }, 400)
  }

  const team = input.team
  const date = input.date
  const opponent = typeof input.opponent === 'string' ? input.opponent.trim() : ''
  const competition = input.competition
  const homeAway = input.homeAway
  const resultLabel = input.resultLabel
  const goalsFor = input.goalsFor
  const goalsAgainst = input.goalsAgainst
  const slotColumn = input.slotColumn
  const hasNoScore = goalsFor === null && goalsAgainst === null
  const hasValidScore =
    typeof goalsFor === 'number' &&
    Number.isSafeInteger(goalsFor) &&
    goalsFor >= 0 &&
    goalsFor <= 50 &&
    typeof goalsAgainst === 'number' &&
    Number.isSafeInteger(goalsAgainst) &&
    goalsAgainst >= 0 &&
    goalsAgainst <= 50
  const validResultLabel = resultLabel === '' || MATCH_RESULT_STATUSES.includes(resultLabel as typeof MATCH_RESULT_STATUSES[number])
  const hasResultForScore = typeof resultLabel === 'string' && resultLabel !== ''
  const validResultAndScore =
    validResultLabel &&
    (hasValidScore ? hasResultForScore : (resultLabel === '' || resultLabel === 'Annulé'))

  if (
    typeof date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    (date < MATCH_SEASON_START || date > MATCH_SEASON_END)
  ) {
    return jsonResponse({
      error: 'La date du match doit être comprise entre le 1er septembre 2026 et le 30 juin 2027.',
    }, 400)
  }

  if (
    (team !== 'E1' && team !== 'E2') ||
    typeof date !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(Date.parse(date + 'T00:00:00Z')) ||
    new Date(date + 'T00:00:00Z').toISOString().slice(0, 10) !== date ||
    !opponent ||
    opponent.length > 80 ||
    !['Championnat', 'Amical', 'Tournoi', 'Plateau'].includes(String(competition)) ||
    !['Domicile', 'Extérieur', 'Terrain neutre'].includes(String(homeAway)) ||
    (!hasNoScore && !hasValidScore) ||
    !validResultAndScore ||
    (editing && (typeof slotColumn !== 'number' || !Number.isSafeInteger(slotColumn))) ||
    (!editing && slotColumn !== undefined)
  ) {
    return jsonResponse({ error: 'Vérifie la date, l’équipe, l’adversaire et les scores.' }, 400)
  }

  try {
    const saved = await writeMatchResult({
      team,
      slotColumn: editing ? slotColumn as number : undefined,
      date,
      opponent,
      competition: String(competition),
      homeAway: String(homeAway),
      resultLabel: resultLabel as '' | typeof MATCH_RESULT_STATUSES[number],
      goalsFor: hasNoScore ? null : goalsFor as number,
      goalsAgainst: hasNoScore ? null : goalsAgainst as number,
    })
    revalidateTag('google-sheet', 'max')
    logSecurityEvent({
      event: 'match_modified',
      username: educator.username,
      ip: getClientIp(request),
      userAgent: getUserAgent(request),
      role: educator.role,
      detail: `${editing ? 'update' : 'create'} team=${team} date=${date} opponent=${opponent}`,
    })
    return jsonResponse({ ok: true, ...saved })
  } catch (error) {
    console.error('Erreur lors de l’enregistrement du match:', error)
    const message = error instanceof Error ? error.message : 'Impossible d’enregistrer le match.'
    const status = message.includes('existe déjà') ? 409 : message.includes('n’existe plus') ? 404 : 500
    return jsonResponse({ error: status === 500 ? 'Impossible d’enregistrer le match dans la feuille.' : message }, status)
  }
}

export async function POST(request: Request) {
  return save(request, false)
}

export async function PUT(request: Request) {
  return save(request, true)
}
