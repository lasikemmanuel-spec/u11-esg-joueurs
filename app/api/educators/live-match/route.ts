import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { getEducatorSession, hasEducatorAccess, isSameOriginRequest } from '@/lib/educator-auth'
import { getMatchResults } from '@/lib/match-results'
import { getRoster } from '@/lib/players'
import { getMatchLineups } from '@/lib/match-lineups'
import {
  calculateLiveMatchSummary,
  getLiveElapsedSeconds,
  getLiveMinute,
  type LiveMatchEvent,
  type LiveMatchSession,
} from '@/lib/live-match-shared'
import {
  finalizeLiveMatch,
  getSavedLiveMatches,
  getSavedLiveMatch,
  resetFinalizedLiveMatch,
  saveLiveMatchSession,
} from '@/lib/live-match-store'
import { MATCH_SEASON_END, MATCH_SEASON_START } from '@/lib/match-season'

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
    if (!educator) return { response: jsonResponse({ error: 'Connexion éducateur requise.' }, 401) }
    if (!hasEducatorAccess(educator)) {
      return { response: jsonResponse({ error: 'Accès réservé aux éducateurs.' }, 403) }
    }
    return { response: null }
  } catch (error) {
    console.error('Erreur de vérification de session pour le match en direct:', error)
    const rateLimited = error instanceof Error && error.message.includes('(429)')
    return {
      response: jsonResponse({
        error: rateLimited
          ? 'Google Sheets est temporairement saturé. Réessaie dans quelques instants.'
          : 'La connexion éducateur n’est pas disponible.',
      }, rateLimited ? 429 : 503),
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isPlayerNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

function isLiveEvent(value: unknown): value is LiveMatchEvent {
  if (!isRecord(value) || typeof value.id !== 'string' || value.id.length > 80) return false
  if (!Number.isSafeInteger(value.minute) || (value.minute as number) < 1 || (value.minute as number) > 50) return false
  if (value.kind === 'goal') {
    return (value.side === 'for' || value.side === 'against') &&
      (value.scorerNumber === undefined || isPlayerNumber(value.scorerNumber)) &&
      (value.assistNumber === undefined || isPlayerNumber(value.assistNumber)) &&
      (value.side !== 'against' || (value.scorerNumber === undefined && value.assistNumber === undefined))
  }
  return value.kind === 'substitution' &&
    isPlayerNumber(value.playerOut) &&
    isPlayerNumber(value.playerIn) &&
    value.playerOut !== value.playerIn
}

function isLiveSession(value: unknown): value is LiveMatchSession {
  if (!isRecord(value)) return false
  const players = [...(Array.isArray(value.starters) ? value.starters : []), ...(Array.isArray(value.substitutes) ? value.substitutes : [])]
  return typeof value.date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value.date) &&
    (value.team === 'E1' || value.team === 'E2') &&
    typeof value.slotColumn === 'number' &&
    Number.isSafeInteger(value.slotColumn) &&
    value.slotColumn >= 2 &&
    (value.slotColumn - 2) % 4 === 0 &&
    ['ready', 'firstHalf', 'halftime', 'secondHalf', 'finished'].includes(String(value.phase)) &&
    typeof value.elapsedSeconds === 'number' &&
    Number.isSafeInteger(value.elapsedSeconds) &&
    value.elapsedSeconds >= 0 &&
    value.elapsedSeconds <= 50 * 60 &&
    (value.runningSince === null || (
      typeof value.runningSince === 'string' && Number.isFinite(Date.parse(value.runningSince))
    )) &&
    Array.isArray(value.starters) &&
    value.starters.length > 0 &&
    value.starters.length <= 8 &&
    value.starters.every(isPlayerNumber) &&
    Array.isArray(value.substitutes) &&
    value.substitutes.length <= 40 &&
    value.substitutes.every(isPlayerNumber) &&
    new Set(players).size === players.length &&
    players.length <= 48 &&
    Array.isArray(value.events) &&
    value.events.length <= 200 &&
    value.events.every(isLiveEvent) &&
    new Set(value.events.map((event) => (event as LiveMatchEvent).id)).size === value.events.length &&
    typeof value.completed === 'boolean' &&
    (!value.completed || value.phase === 'finished')
}

function isValidMatchDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value &&
    value >= MATCH_SEASON_START &&
    value <= MATCH_SEASON_END
}

function dateKey(value: string) {
  const iso = value.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`
  const dayFirst = value.trim().match(/^(\d{1,2})[/. -](\d{1,2})[/. -](\d{4})$/)
  if (dayFirst) return `${dayFirst[3]}-${dayFirst[2].padStart(2, '0')}-${dayFirst[1].padStart(2, '0')}`
  return ''
}

function sameNumberSet(left: number[], right: number[]) {
  const sortedLeft = [...left].sort((a, b) => a - b)
  const sortedRight = [...right].sort((a, b) => a - b)
  return sortedLeft.length === sortedRight.length &&
    sortedLeft.every((number, index) => number === sortedRight[index])
}

async function findMatch(session: Pick<LiveMatchSession, 'date' | 'team' | 'slotColumn'>) {
  if (!isValidMatchDate(session.date)) throw new Error('La date du match est invalide.')
  const results = await getMatchResults()
  const match = results.entries.find((entry) =>
    dateKey(entry.date) === session.date &&
    entry.team === session.team &&
    entry.slotColumn === session.slotColumn,
  )
  if (!match || match.resultLabel === 'Annulé') {
    throw new Error('Ce match n’est plus disponible dans le calendrier.')
  }
  return { results, match }
}

function validateEventTimeline(session: LiveMatchSession) {
  const currentMinute = getLiveMinute(session)
  let previousMinute = 0
  for (const event of session.events) {
    if (event.minute < previousMinute || event.minute > currentMinute) {
      throw new Error('Les actions doivent être saisies dans l’ordre et ne pas dépasser le chronomètre.')
    }
    previousMinute = event.minute
  }
  calculateLiveMatchSummary(session)
}

export async function GET(request: Request) {
  const access = await authorize(request)
  if (access.response) return access.response
  const params = new URL(request.url).searchParams
  if (process.env.VERCEL_ENV !== 'production') {
    if (params.get('active') === '1') return jsonResponse({ matches: [] })
    return jsonResponse({ error: 'Le mode match en direct est désactivé dans cette prévisualisation.' }, 403)
  }

  if (params.get('active') === '1') {
    try {
      const results = await getMatchResults()
      const sessions = await getSavedLiveMatches({ cacheForSeconds: 5 })
      const today = new Date().toISOString().slice(0, 10)
      const matches = sessions.flatMap((session) => {
        if (!isLiveSession(session)) throw new Error('Les données sauvegardées d’un match en direct sont invalides.')
        if (session.completed || session.phase === 'ready' || session.date < today) return []
        validateEventTimeline(session)
        const match = results.entries.find((entry) =>
          entry.team === session.team &&
          entry.slotColumn === session.slotColumn &&
          dateKey(entry.date) === session.date &&
          entry.resultLabel !== 'Annulé',
        )
        return match ? [{ match: { ...match, date: session.date }, phase: session.phase }] : []
      })
      return jsonResponse({ matches })
    } catch (error) {
      console.error('Erreur de lecture des matchs en direct en cours:', error)
      return jsonResponse({ error: 'Impossible de charger les matchs en direct en cours.' }, 500)
    }
  }

  const date = params.get('date') ?? ''
  const team = params.get('team')
  const slotColumn = Number(params.get('slotColumn'))
  if (!isValidMatchDate(date) || (team !== 'E1' && team !== 'E2') ||
    !Number.isSafeInteger(slotColumn) || slotColumn < 2 || (slotColumn - 2) % 4 !== 0) {
    return jsonResponse({ error: 'Match invalide.' }, 400)
  }

  try {
    // The caller already has the scheduled match. Loading a saved live session
    // only needs its stable key; the first write still validates the match and
    // lineup against Google Sheets before accepting any changes.
    const session = await getSavedLiveMatch({ date, team, slotColumn }, { cacheForSeconds: 5 })
    if (session && (!isLiveSession(session) || session.date !== date || session.team !== team || session.slotColumn !== slotColumn)) {
      throw new Error('Les données sauvegardées du match sont invalides.')
    }
    if (session) validateEventTimeline(session)
    return jsonResponse({ session })
  } catch (error) {
    console.error('Erreur de lecture du match en direct:', error)
    const message = error instanceof Error ? error.message : ''
    const rateLimited = message.includes('(429)')
    return jsonResponse({
      error: rateLimited
        ? 'Google Sheets est temporairement saturé. Patiente quelques instants, puis rouvre le direct.'
        : message || 'Impossible de charger le match en direct.',
    }, rateLimited ? 429 : 500)
  }
}

export async function POST(request: Request) {
  if (process.env.VERCEL_ENV !== 'production') {
    return jsonResponse({ error: 'Le mode match en direct est désactivé dans cette prévisualisation.' }, 403)
  }
  if (!isSameOriginRequest(request)) return jsonResponse({ error: 'Requête non autorisée.' }, 403)
  const access = await authorize(request)
  if (access.response) return access.response
  if (Number(request.headers.get('content-length') ?? 0) > 32_000) {
    return jsonResponse({ error: 'Les données du match sont trop volumineuses.' }, 413)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: 'Requête invalide.' }, 400)
  }
  if (!isRecord(body) || !isLiveSession(body.session) || !['save', 'finalize', 'reset'].includes(String(body.action))) {
    return jsonResponse({ error: 'Les données du match en direct sont invalides.' }, 400)
  }
  const session = body.session

  try {
    const { match, results } = await findMatch(session)
    const existing = await getSavedLiveMatch(match)
    if (existing && (!isLiveSession(existing) || existing.date !== session.date || existing.team !== session.team || existing.slotColumn !== session.slotColumn)) {
      throw new Error('Les données sauvegardées du match sont invalides.')
    }
    if (body.action === 'reset') {
      if (!existing) return jsonResponse({ error: 'Aucun direct sauvegardé à réinitialiser.' }, 409)
      if (
        session.phase !== 'ready' || session.elapsedSeconds !== 0 || session.runningSince !== null ||
        session.events.length !== 0 || session.completed ||
        !sameNumberSet(existing.starters, session.starters) ||
        !sameNumberSet(existing.substitutes, session.substitutes)
      ) {
        return jsonResponse({ error: 'La demande de réinitialisation est invalide.' }, 400)
      }
      if (existing.completed) {
        await resetFinalizedLiveMatch(session)
      } else {
        await saveLiveMatchSession(session)
      }
      revalidateTag('google-sheet', { expire: 0 })
      return jsonResponse({ ok: true, session })
    }
    if (existing && existing.completed) {
      return jsonResponse({ error: 'Ce match a déjà été validé dans la feuille.' }, 409)
    }
    if (!existing && (match.resultLabel || match.goalsFor !== null || match.goalsAgainst !== null)) {
      return jsonResponse({ error: 'Un résultat existe déjà pour ce match. Le direct ne peut démarrer que sur un match à jouer.' }, 409)
    }

    const roster = await getRoster()
    const rosterNumbers = new Set(roster.players.map((player) => player.number))
    if ([...session.starters, ...session.substitutes].some((number) => !rosterNumbers.has(number))) {
      return jsonResponse({ error: 'La composition contient un joueur absent de l’effectif.' }, 400)
    }

    if (existing) {
      if (
        !sameNumberSet(existing.starters, session.starters) ||
        !sameNumberSet(existing.substitutes, session.substitutes)
      ) {
        return jsonResponse({ error: 'La composition du match a changé. Recharge le match avant de continuer.' }, 409)
      }
      if (getLiveElapsedSeconds(session) + 2 < getLiveElapsedSeconds(existing)) {
        return jsonResponse({ error: 'Le chronomètre ne peut pas reculer.' }, 409)
      }
    } else {
      const lineups = await getMatchLineups(results.entries)
      const lineup = lineups.find((item) =>
        item.date === session.date && item.team === session.team && item.slotColumn === session.slotColumn,
      )
      if (
        !lineup ||
        !sameNumberSet(lineup.starters, session.starters) ||
        !sameNumberSet(lineup.substitutes, session.substitutes)
      ) {
        return jsonResponse({ error: 'Enregistre d’abord la feuille de match avec les titulaires et remplaçants.' }, 409)
      }
    }

    validateEventTimeline(session)

    if (body.action === 'save') {
      if (session.completed || session.phase === 'finished' && session.runningSince) {
        return jsonResponse({ error: 'Termine le chronomètre avant de valider le match.' }, 400)
      }
      await saveLiveMatchSession(session)
      revalidateTag('google-sheet', { expire: 0 })
      return jsonResponse({ ok: true, session })
    }

    if (session.phase !== 'finished' || session.runningSince) {
      return jsonResponse({ error: 'Arrête le chronomètre avant de valider le match.' }, 400)
    }
    const summary = calculateLiveMatchSummary(session)
    await finalizeLiveMatch(session, summary)
    const completedSession = { ...session, completed: true }
    await saveLiveMatchSession(completedSession)
    revalidateTag('google-sheet', { expire: 0 })
    return jsonResponse({ ok: true, session: completedSession, summary })
  } catch (error) {
    console.error('Erreur d’enregistrement du match en direct:', error)
    return jsonResponse({ error: error instanceof Error ? error.message : 'Impossible d’enregistrer le match en direct.' }, 500)
  }
}
