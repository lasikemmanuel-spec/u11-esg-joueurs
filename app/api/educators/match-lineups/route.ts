import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { getEducatorSession, hasEducatorAccess, isSameOriginRequest } from '@/lib/educator-auth'
import { getMatchResults } from '@/lib/match-results'
import { getConvocations } from '@/lib/convocations'
import { getRoster } from '@/lib/players'
import { getMatchLineups, saveMatchLineup, type MatchLineup } from '@/lib/match-lineups'
import { MATCH_SEASON_END, MATCH_SEASON_START } from '@/lib/match-season'

export const runtime = 'nodejs'

function jsonResponse(body: object, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, private', Vary: 'Cookie' },
  })
}

async function educatorAccess(request: Request) {
  try {
    const educator = await getEducatorSession(request)
    if (!educator) return { response: jsonResponse({ error: 'Connexion éducateur requise.' }, 401) }
    if (!hasEducatorAccess(educator)) {
      return { response: jsonResponse({ error: 'Accès réservé aux éducateurs.' }, 403) }
    }
    return { response: null }
  } catch (error) {
    console.error('Erreur de vérification de session éducateur:', error)
    return { response: jsonResponse({ error: 'La connexion éducateur n’est pas disponible.' }, 503) }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNumberList(value: unknown): value is number[] {
  return Array.isArray(value) &&
    value.length <= 60 &&
    value.every((number) => typeof number === 'number' && Number.isSafeInteger(number))
}

function dateKey(value: string) {
  const iso = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`
  const dayFirst = value.match(/^(\d{1,2})[/. -](\d{1,2})[/. -](\d{4})$/)
  if (dayFirst) return `${dayFirst[3]}-${dayFirst[2].padStart(2, '0')}-${dayFirst[1].padStart(2, '0')}`
  return ''
}

export async function GET(request: Request) {
  const access = await educatorAccess(request)
  if (access.response) return access.response
  if (process.env.VERCEL_ENV !== 'production') return jsonResponse({ lineups: [] })
  try {
    const matches = await getMatchResults()
    return jsonResponse({ lineups: await getMatchLineups(matches.entries) })
  } catch (error) {
    console.error('Erreur de lecture des feuilles de match:', error)
    return jsonResponse({ error: 'Impossible de charger les feuilles de match.' }, 500)
  }
}

export async function POST(request: Request) {
  if (process.env.VERCEL_ENV !== 'production') {
    return jsonResponse({ error: 'La saisie réelle est désactivée dans cette prévisualisation.' }, 403)
  }
  if (!isSameOriginRequest(request)) return jsonResponse({ error: 'Requête non autorisée.' }, 403)
  const access = await educatorAccess(request)
  if (access.response) return access.response
  if (Number(request.headers.get('content-length') ?? 0) > 8192) {
    return jsonResponse({ error: 'Requête trop volumineuse.' }, 413)
  }

  let input: Record<string, unknown>
  try {
    const body: unknown = await request.json()
    if (!isRecord(body)) return jsonResponse({ error: 'Feuille de match invalide.' }, 400)
    input = body
  } catch {
    return jsonResponse({ error: 'Feuille de match invalide.' }, 400)
  }

  const date = input.date
  const team = input.team
  const slotColumn = input.slotColumn
  const starters = input.starters
  const substitutes = input.substitutes
  if (
    typeof date !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(Date.parse(`${date}T00:00:00Z`)) ||
    new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date ||
    date < MATCH_SEASON_START ||
    date > MATCH_SEASON_END ||
    (team !== 'E1' && team !== 'E2') ||
    typeof slotColumn !== 'number' ||
    !Number.isSafeInteger(slotColumn) ||
    slotColumn < 2 ||
    !isNumberList(starters) ||
    !isNumberList(substitutes) ||
    starters.length > 8 ||
    new Set([...starters, ...substitutes]).size !== starters.length + substitutes.length
  ) {
    return jsonResponse({ error: 'Vérifie la date, l’équipe, les joueurs et les 8 titulaires maximum.' }, 400)
  }

  try {
    const [matches, convocations, roster] = await Promise.all([
      getMatchResults(),
      getConvocations(),
      getRoster(),
    ])
    const match = matches.entries.find((entry) =>
      entry.team === team && entry.slotColumn === slotColumn && dateKey(entry.date) === date,
    )
    if (!match || match.resultLabel === 'Annulé') {
      return jsonResponse({ error: 'Ce match n’est plus disponible dans le calendrier.' }, 409)
    }

    const calledPlayerNumbers = new Set(
      convocations.players.flatMap((player) => {
        const callup = player.matches.find((item) => dateKey(item.date) === date)
        return callup &&
          (callup.status === 'called' || callup.status === 'present') &&
          callup.team === team
          ? [player.number]
          : []
      }),
    )

    const lineup: MatchLineup = {
      date,
      team,
      slotColumn,
      starters,
      substitutes,
    }
    const saved = await saveMatchLineup(
      lineup,
      calledPlayerNumbers,
      roster.players.map((player) => player.number),
    )
    revalidateTag('google-sheet', { expire: 0 })
    return jsonResponse({ ok: true, lineup: saved })
  } catch (error) {
    console.error('Erreur d’enregistrement de la feuille de match:', error)
    const message = error instanceof Error ? error.message : ''
    const rateLimited = message.includes('(429)')
    return jsonResponse({
      error: message.startsWith('Choisis uniquement')
        ? message
        : rateLimited
          ? 'Google Sheets est temporairement saturé. Attends une minute puis réessaie.'
          : 'Impossible d’enregistrer la feuille de match.',
    }, message.startsWith('Choisis uniquement') ? 400 : rateLimited ? 429 : 500)
  }
}
