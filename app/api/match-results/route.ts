import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { getEducatorSession, isSameOriginRequest } from '@/lib/educator-auth'
import { writeMatchResult } from '@/lib/match-results'

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

export async function POST(request: Request) {
  if (process.env.VERCEL_ENV !== 'production') {
    return jsonResponse({ error: 'La saisie réelle est désactivée dans cette prévisualisation.' }, 403)
  }
  if (!isSameOriginRequest(request)) return jsonResponse({ error: 'Requête non autorisée.' }, 403)
  const educator = getSession(request)
  if (!educator) return jsonResponse({ error: 'Connexion administrateur requise.' }, 401)
  if (educator.role !== 'admin') return jsonResponse({ error: 'Droits insuffisants.' }, 403)
  if (Number(request.headers.get('content-length') ?? 0) > 4096) {
    return jsonResponse({ error: 'Requête trop volumineuse.' }, 413)
  }

  let input: Record<string, unknown>
  try {
    input = await request.json()
  } catch {
    return jsonResponse({ error: 'Résultat invalide.' }, 400)
  }

  const team = input.team
  const date = input.date
  const opponent = typeof input.opponent === 'string' ? input.opponent.trim() : ''
  const competition = input.competition
  const homeAway = input.homeAway
  const goalsFor = input.goalsFor
  const goalsAgainst = input.goalsAgainst
  const validDate = typeof date === 'string' &&
    /^\\d{4}-\\d{2}-\\d{2}$/.test(date) &&
    !Number.isNaN(Date.parse(date + 'T00:00:00Z'))

  if (
    (team !== 'E1' && team !== 'E2') ||
    !validDate ||
    !opponent ||
    opponent.length > 80 ||
    !['Championnat', 'Amical', 'Tournoi', 'Plateau'].includes(String(competition)) ||
    !['Domicile', 'Extérieur', 'Terrain neutre'].includes(String(homeAway)) ||
    typeof goalsFor !== 'number' ||
    !Number.isSafeInteger(goalsFor) ||
    goalsFor < 0 ||
    goalsFor > 50 ||
    typeof goalsAgainst !== 'number' ||
    !Number.isSafeInteger(goalsAgainst) ||
    goalsAgainst < 0 ||
    goalsAgainst > 50
  ) {
    return jsonResponse({ error: 'Vérifie la date, l’équipe, l’adversaire et les scores.' }, 400)
  }

  try {
    const saved = await writeMatchResult({
      team,
      date,
      opponent,
      competition: String(competition),
      homeAway: String(homeAway),
      goalsFor,
      goalsAgainst,
    })
    revalidateTag('google-sheet', 'max')
    return jsonResponse({ ok: true, ...saved })
  } catch (error) {
    console.error('Erreur lors de l’enregistrement du résultat de match:', error)
    return jsonResponse({ error: 'Impossible d’enregistrer le résultat dans la feuille de match.' }, 500)
  }
}
