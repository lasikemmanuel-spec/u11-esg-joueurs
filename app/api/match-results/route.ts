import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { getEducatorSession, isSameOriginRequest } from '@/lib/educator-auth'
import { writeMatchResult } from '@/lib/match-results'
import { MATCH_RESULT_STATUSES } from '@/lib/match-result-options'

export const runtime = 'nodejs'

function jsonResponse(body: object, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, private', Vary: 'Cookie' },
  })
}

function getSession(request: Request) {
  try {
    return getEducatorSession(request)
  } catch {
    return null
  }
}

export async function GET(request: Request) {
  const educator = getSession(request)
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
  const educator = getSession(request)
  if (!educator) return jsonResponse({ error: 'Connexion éducateur requise.' }, 401)
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
