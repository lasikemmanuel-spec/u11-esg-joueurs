import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { getEducatorSession, hasEducatorAccess, isSameOriginRequest } from '@/lib/educator-auth'
import { getRoster } from '@/lib/players'
import { saveTrainingAttendance } from '@/lib/training-attendance'
import { TRAINING_ATTENDANCE_STATUSES, type TrainingAttendanceEntry } from '@/lib/training-attendance-shared'
import { MATCH_SEASON_END, MATCH_SEASON_START } from '@/lib/match-season'
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

function isTrainingAttendanceStatus(value: unknown): value is TrainingAttendanceEntry['status'] {
  return TRAINING_ATTENDANCE_STATUSES.some((status) => status.value === value)
}

export async function POST(request: Request) {
  if (process.env.VERCEL_ENV !== 'production') {
    return response({ error: 'La saisie des présences est désactivée dans cet aperçu.' }, 403)
  }
  if (!isSameOriginRequest(request)) return response({ error: 'Requête non autorisée.' }, 403)

  let educator
  try {
    educator = await getEducatorSession(request)
  } catch (error) {
    console.error('Erreur de vérification de session pour les présences:', error)
    return response({ error: 'La connexion éducateur n’est pas disponible.' }, 503)
  }
  if (!educator) return response({ error: 'Connexion éducateur requise.' }, 401)
  if (!hasEducatorAccess(educator)) return response({ error: 'Accès réservé aux éducateurs.' }, 403)

  let rawBody: string
  try {
    rawBody = await request.text()
  } catch {
    return response({ error: 'Données de présence invalides.' }, 400)
  }
  if (Buffer.byteLength(rawBody, 'utf8') > 16_384) {
    return response({ error: 'Requête trop volumineuse.' }, 413)
  }

  let input: unknown
  try {
    input = JSON.parse(rawBody)
  } catch {
    return response({ error: 'Données de présence invalides.' }, 400)
  }
  if (!isRecord(input) || typeof input.date !== 'string' || !Array.isArray(input.entries)) {
    return response({ error: 'Données de présence invalides.' }, 400)
  }

  const date = input.date
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(Date.parse(`${date}T00:00:00Z`)) ||
    new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date ||
    date < MATCH_SEASON_START ||
    date > MATCH_SEASON_END
  ) {
    return response({ error: 'Choisis une date valide de la saison en cours.' }, 400)
  }
  if (input.entries.length === 0 || input.entries.length > 60) {
    return response({ error: 'La liste des joueurs est invalide.' }, 400)
  }

  const entries: TrainingAttendanceEntry[] = []
  const submittedNumbers = new Set<number>()
  for (const entry of input.entries) {
    if (
      !isRecord(entry) ||
      typeof entry.number !== 'number' ||
      !Number.isSafeInteger(entry.number) ||
      !isTrainingAttendanceStatus(entry.status) ||
      submittedNumbers.has(entry.number)
    ) {
      return response({ error: 'Un joueur ou un statut de présence est invalide.' }, 400)
    }
    submittedNumbers.add(entry.number)
    entries.push({ number: entry.number, status: entry.status })
  }

  try {
    const roster = await getRoster()
    const rosterNumbers = new Set(roster.players.map((player) => player.number))
    if (
      rosterNumbers.size !== roster.players.length ||
      rosterNumbers.size !== submittedNumbers.size ||
      [...rosterNumbers].some((number) => !submittedNumbers.has(number))
    ) {
      return response({ error: 'L’effectif a changé. Actualise la page avant d’enregistrer.' }, 409)
    }

    const saved = await saveTrainingAttendance(date, entries)
    revalidateTag('google-sheet', { expire: 0 })
    logSecurityEvent({
      event: 'training_attendance_saved',
      username: educator.username,
      ip: getClientIp(request),
      userAgent: getUserAgent(request),
      role: educator.role,
      detail: `date=${date} players_count=${saved.playersSaved} created=${saved.created}`,
    })
    return response({ ok: true, ...saved })
  } catch (error) {
    console.error('Erreur lors de l’enregistrement des présences:', error)
    return response({ error: 'Impossible d’enregistrer les présences dans le classeur.' }, 503)
  }
}
