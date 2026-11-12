import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { getRoster } from '@/lib/players'
import { getEducatorSession, hasEducatorAccess, isSameOriginRequest } from '@/lib/educator-auth'
import { writeCallupSchedule, type CallupSelection, type EditableCallupStatus } from '@/lib/convocation-management'
import { getMatchResults } from '@/lib/match-results'
import { syncMatchLineupsWithCallups } from '@/lib/match-lineups'
import { MATCH_SEASON_END, MATCH_SEASON_START } from '@/lib/match-season'
import { logSecurityEvent, getClientIp, getUserAgent } from '@/lib/security-logger'

export const runtime = 'nodejs'

const statuses = [
  '✅ Convoqué E1',
  '✅ Convoqué E1 + E2',
  '✅ Confirmé E1',
  '✅ Confirmé E1 + E2',
  '❌ Non convoqué',
  '⚠️ Convoqué absent',
  '🗓️ Absent',
  '✅ Convoqué E2',
  '✅ Confirmé E2',
  '🩺 Blessé',
  'Pas de licence',
] as const satisfies readonly EditableCallupStatus[]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isCallupStatus(value: unknown): value is CallupSelection['status'] {
  return value === '' || (typeof value === 'string' && statuses.some((status) => status === value))
}

function dateKey(value: string) {
  const trimmed = value.trim()
  const iso = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`
  const dayFirst = trimmed.match(/^(\d{1,2})[/. -](\d{1,2})[/. -](\d{4})$/)
  if (dayFirst) return `${dayFirst[3]}-${dayFirst[2].padStart(2, '0')}-${dayFirst[1].padStart(2, '0')}`
  return ''
}

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
  })
}

export async function POST(request: Request) {
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
  if (Number(request.headers.get('content-length') ?? 0) > 16_384) {
    return jsonResponse({ error: 'Requête trop volumineuse.' }, 413)
  }

  let input: { date?: unknown; selections?: unknown }
  try {
    input = await request.json()
  } catch {
    return jsonResponse({ error: 'Données de convocation invalides.' }, 400)
  }

  const date = input.date
  if (
    typeof date !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(Date.parse(date + 'T00:00:00Z')) ||
    new Date(date + 'T00:00:00Z').toISOString().slice(0, 10) !== date
  ) {
    return jsonResponse({ error: 'Choisis une date valide.' }, 400)
  }
  if (date < MATCH_SEASON_START || date > MATCH_SEASON_END) {
    return jsonResponse({ error: 'La date doit être comprise entre le 1er septembre 2026 et le 30 juin 2027.' }, 400)
  }
  if (new Date(date + 'T00:00:00Z').getUTCDay() !== 6) {
    return jsonResponse({ error: 'Choisis un samedi pour enregistrer les convocations.' }, 400)
  }
  if (!Array.isArray(input.selections) || input.selections.length === 0 || input.selections.length > 60) {
    return jsonResponse({ error: 'La liste des joueurs est invalide.' }, 400)
  }

  const selections: CallupSelection[] = []
  for (const item of input.selections) {
    if (
      !isRecord(item) ||
      typeof item.number !== 'number' ||
      !Number.isSafeInteger(item.number) ||
      !isCallupStatus(item.status)
    ) {
      return jsonResponse({ error: 'Un joueur ou un statut de convocation est invalide.' }, 400)
    }
    selections.push({ number: item.number, status: item.status })
  }
  try {
    const roster = await getRoster()
    const rosterNumbers = roster.players.map((player) => player.number).sort((a, b) => a - b)
    const selectionNumbers = selections.map(({ number }) => number).sort((a, b) => a - b)
    if (
      rosterNumbers.length !== selectionNumbers.length ||
      rosterNumbers.some((number, index) => number !== selectionNumbers[index])
    ) {
      return jsonResponse({ error: 'La liste des joueurs a changé. Actualise la page avant d’enregistrer.' }, 409)
    }

    const matches = await getMatchResults()
    if (selections.some(({ status }) => status === '✅ Convoqué E1 + E2' || status === '✅ Confirmé E1 + E2')) {
      const teamsOnDate = new Set(matches.entries
        .filter((entry) => dateKey(entry.date) === date && entry.resultLabel !== 'Annulé')
        .map((entry) => entry.team))
      if (!teamsOnDate.has('E1') || !teamsOnDate.has('E2')) {
        return jsonResponse({ error: 'La double convocation est possible uniquement si les équipes 1 et 2 jouent ce jour-là.' }, 400)
      }
    }

    const saved = await writeCallupSchedule(date, selections)
    revalidateTag('google-sheet', { expire: 0 })
    try {
      await syncMatchLineupsWithCallups(date, matches.entries, selections)
    } catch (syncError) {
      console.error('Erreur lors de la synchronisation des feuilles de match avec les convocations:', syncError)
      return jsonResponse({
        error: 'Les convocations sont enregistrées, mais les feuilles de match n’ont pas pu être actualisées. Réessaie d’enregistrer les convocations.',
        callupsSaved: true,
      }, 500)
    }
    revalidateTag('google-sheet', { expire: 0 })
    logSecurityEvent({
      event: 'callup_saved',
      username: educator.username,
      ip: getClientIp(request),
      userAgent: getUserAgent(request),
      role: educator.role,
      detail: `date=${date} players_count=${selections.length}`,
    })
    return jsonResponse({ ok: true, ...saved })
  } catch (error) {
    console.error('Erreur lors de l’enregistrement des convocations:', error)
    const message = error instanceof Error ? error.message : 'Impossible d’enregistrer les convocations.'
    return jsonResponse({ error: message }, 500)
  }
}
