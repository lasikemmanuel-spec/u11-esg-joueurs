import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { getRoster } from '@/lib/players'
import { getEducatorSession, hasEducatorAccess, isSameOriginRequest } from '@/lib/educator-auth'
import { writeCallupSchedule, type CallupSelection, type EditableCallupStatus } from '@/lib/convocation-management'
import { MATCH_SEASON_END, MATCH_SEASON_START } from '@/lib/match-season'

export const runtime = 'nodejs'

const statuses = [
  'called:E1',
  'called:E2',
  'called',
  'present:E1',
  'present:E2',
  'calledAbsent',
  'absent',
  'injured',
  'notCalled',
] as const satisfies readonly EditableCallupStatus[]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isCallupStatus(value: unknown): value is EditableCallupStatus {
  return typeof value === 'string' && statuses.some((status) => status === value)
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

    const saved = await writeCallupSchedule(date, selections)
    revalidateTag('google-sheet', 'max')
    return jsonResponse({ ok: true, ...saved })
  } catch (error) {
    console.error('Erreur lors de l’enregistrement des convocations:', error)
    const message = error instanceof Error ? error.message : 'Impossible d’enregistrer les convocations.'
    return jsonResponse({ error: message }, 500)
  }
}
