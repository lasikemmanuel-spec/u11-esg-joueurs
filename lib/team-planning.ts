import 'server-only'
import {
  ensureAuthenticatedSheetTab,
  getAuthenticatedSheetRows,
  updateAuthenticatedSheetValues,
} from '@/lib/google-sheets'
import { isPlanningEvent, type PlanningEvent } from '@/lib/team-planning-shared'

const PLANNING_TAB = '📅 Planning'
const PLANNING_HEADERS = [
  'ID',
  'Date',
  'Type',
  'Équipe',
  'Titre',
  'Heure de rendez-vous',
  'Début',
  'Fin',
  'Lieu',
  'Consignes',
  'Statut',
]

async function getPlanningRows() {
  await ensureAuthenticatedSheetTab(PLANNING_TAB)
  const { sheetTitle, rows } = await getAuthenticatedSheetRows(PLANNING_TAB)

  if (rows.length === 0 || !rows[0].some(Boolean)) {
    await updateAuthenticatedSheetValues([{
      range: `'${sheetTitle.replace(/'/g, "''")}'!A1:K1`,
      values: [PLANNING_HEADERS],
    }])
    return { sheetTitle, rows: [PLANNING_HEADERS] }
  }

  if (PLANNING_HEADERS.some((header, index) => rows[0][index] !== header)) {
    throw new Error('Les en-têtes de l’onglet « Planning » ne correspondent pas au format attendu.')
  }

  return { sheetTitle, rows }
}

function rowToEvent(row: string[]): PlanningEvent | null {
  if (!row.some(Boolean)) return null
  const [id, date, type, team, title, meetingTime, startTime, endTime, location, notes, status] = row
  const event: unknown = {
    id,
    date,
    type,
    team,
    title,
    meetingTime,
    startTime,
    endTime,
    location,
    notes,
    status,
  }
  if (!isPlanningEvent(event)) {
    throw new Error('Une ligne de l’onglet « Planning » contient des données invalides.')
  }
  return event
}

export async function getTeamPlanningEvents() {
  const { rows } = await getPlanningRows()
  return rows.slice(1)
    .map(rowToEvent)
    .filter((event): event is PlanningEvent => event !== null)
    .sort((a, b) => `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`))
}

export async function saveTeamPlanningEvent(event: PlanningEvent, mode: 'create' | 'update') {
  const { sheetTitle, rows } = await getPlanningRows()
  const existingRow = rows.findIndex((row, index) => index > 0 && row[0] === event.id)

  if (mode === 'create' && existingRow >= 0) {
    throw new Error('Un événement avec cet identifiant existe déjà.')
  }
  if (mode === 'update' && existingRow < 0) return false

  const rowIndex = mode === 'update' ? existingRow : rows.length
  const values = [
    event.id,
    event.date,
    event.type,
    event.team,
    event.title,
    event.meetingTime,
    event.startTime,
    event.endTime,
    event.location,
    event.notes,
    event.status,
  ]
  const quotedTitle = sheetTitle.replace(/'/g, "''")
  await updateAuthenticatedSheetValues([{
    range: `'${quotedTitle}'!A${rowIndex + 1}:K${rowIndex + 1}`,
    values: [values],
  }])
  return true
}

export async function saveTeamPlanningEvents(events: PlanningEvent[]) {
  if (events.length === 0) throw new Error('Aucun événement à enregistrer.')

  const { sheetTitle, rows } = await getPlanningRows()
  const existingIds = new Set(rows.slice(1).map((row) => row[0]).filter(Boolean))
  const newIds = new Set<string>()
  for (const event of events) {
    if (existingIds.has(event.id) || newIds.has(event.id)) {
      throw new Error('Un événement avec cet identifiant existe déjà.')
    }
    newIds.add(event.id)
  }

  const quotedTitle = sheetTitle.replace(/'/g, "''")
  await updateAuthenticatedSheetValues(events.map((event, index) => {
    const rowIndex = rows.length + index + 1
    return {
      range: `'${quotedTitle}'!A${rowIndex}:K${rowIndex}`,
      values: [[
        event.id,
        event.date,
        event.type,
        event.team,
        event.title,
        event.meetingTime,
        event.startTime,
        event.endTime,
        event.location,
        event.notes,
        event.status,
      ]],
    }
  }))
}
