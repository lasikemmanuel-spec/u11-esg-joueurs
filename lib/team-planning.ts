import 'server-only'
import {
  ensureAuthenticatedSheetTab,
  getAuthenticatedSheetRows,
  updateAuthenticatedSheetValues,
} from '@/lib/google-sheets'
import {
  addPlanningDateDays,
  getPlanningDateDurationDays,
  isPlanningEvent,
  type PlanningEvent,
  type PlanningEventFields,
} from '@/lib/team-planning-shared'

const PLANNING_TAB = '📅 Planning'
const BASE_PLANNING_HEADERS = [
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
const SERIES_HEADERS = ['Identifiant de série', 'Fin de récurrence']
const END_DATE_HEADER = 'Date de fin'
const TOURNAMENT_FORMAT_HEADER = 'Format du tournoi'
const PLANNING_HEADERS = [...BASE_PLANNING_HEADERS, ...SERIES_HEADERS, END_DATE_HEADER, TOURNAMENT_FORMAT_HEADER]

async function getPlanningRows() {
  await ensureAuthenticatedSheetTab(PLANNING_TAB)
  const { sheetTitle, rows } = await getAuthenticatedSheetRows(PLANNING_TAB)

  if (rows.length === 0 || !rows[0].some(Boolean)) {
    await updateAuthenticatedSheetValues([{
      range: `'${sheetTitle.replace(/'/g, "''")}'!A1:N1`,
      values: [PLANNING_HEADERS],
    }])
    return { sheetTitle, rows: [PLANNING_HEADERS] }
  }

  if (BASE_PLANNING_HEADERS.some((header, index) => rows[0][index] !== header)) {
    throw new Error('Les en-têtes de l’onglet « Planning » ne correspondent pas au format attendu.')
  }
  const seriesHeadersAreMissing = !rows[0][BASE_PLANNING_HEADERS.length] &&
    !rows[0][BASE_PLANNING_HEADERS.length + 1]
  if (seriesHeadersAreMissing) {
    await updateAuthenticatedSheetValues([{
      range: `'${sheetTitle.replace(/'/g, "''")}'!L1:M1`,
      values: [SERIES_HEADERS],
    }])
    rows[0][BASE_PLANNING_HEADERS.length] = SERIES_HEADERS[0]
    rows[0][BASE_PLANNING_HEADERS.length + 1] = SERIES_HEADERS[1]
  } else if (SERIES_HEADERS.some((header, index) => rows[0][BASE_PLANNING_HEADERS.length + index] !== header)) {
    throw new Error('Les en-têtes des séries récurrentes dans l’onglet « Planning » ne correspondent pas au format attendu.')
  }
  const endDateColumn = BASE_PLANNING_HEADERS.length + SERIES_HEADERS.length
  if (!rows[0][endDateColumn]) {
    await updateAuthenticatedSheetValues([{
      range: `'${sheetTitle.replace(/'/g, "''")}'!N1`,
      values: [[END_DATE_HEADER]],
    }])
    rows[0][endDateColumn] = END_DATE_HEADER
  } else if (rows[0][endDateColumn] !== END_DATE_HEADER) {
    throw new Error('L’en-tête de la date de fin dans l’onglet « Planning » ne correspond pas au format attendu.')
  }
  const tournamentFormatColumn = endDateColumn + 1
  if (!rows[0][tournamentFormatColumn]) {
    await updateAuthenticatedSheetValues([{
      range: `'${sheetTitle.replace(/'/g, "''")}'!O1`,
      values: [[TOURNAMENT_FORMAT_HEADER]],
    }])
    rows[0][tournamentFormatColumn] = TOURNAMENT_FORMAT_HEADER
  } else if (rows[0][tournamentFormatColumn] !== TOURNAMENT_FORMAT_HEADER) {
    throw new Error('L’en-tête du format de tournoi dans l’onglet « Planning » ne correspond pas au format attendu.')
  }

  return { sheetTitle, rows }
}

function rowToEvent(row: string[]): PlanningEvent | null {
  if (!row.some(Boolean)) return null
  const [
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
    recurrenceGroupId,
    recurrenceEndDate,
    endDate,
    tournamentFormat,
  ] = row
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
    endDate: endDate || date,
    tournamentFormat: type === 'tournament' ? tournamentFormat || '' : '',
    ...(recurrenceGroupId || recurrenceEndDate ? { recurrenceGroupId, recurrenceEndDate } : {}),
  }
  if (!isPlanningEvent(event)) {
    throw new Error('Une ligne de l’onglet « Planning » contient des données invalides.')
  }
  return event
}

function eventToRow(event: PlanningEvent) {
  return [
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
    event.recurrenceGroupId ?? '',
    event.recurrenceEndDate ?? '',
    event.endDate,
    event.tournamentFormat ?? '',
  ]
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
  const quotedTitle = sheetTitle.replace(/'/g, "''")
  await updateAuthenticatedSheetValues([{
    range: `'${quotedTitle}'!A${rowIndex + 1}:O${rowIndex + 1}`,
    values: [eventToRow(event)],
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
      range: `'${quotedTitle}'!A${rowIndex}:O${rowIndex}`,
      values: [eventToRow(event)],
    }
  }))
}

export async function updateTeamPlanningSeries(
  recurrenceGroupId: string,
  fields: PlanningEventFields,
): Promise<PlanningEvent[]> {
  const { sheetTitle, rows } = await getPlanningRows()
  const updates: Array<{ range: string; values: string[][] }> = []
  const events: PlanningEvent[] = []
  const quotedTitle = sheetTitle.replace(/'/g, "''")
  const durationDays = getPlanningDateDurationDays(fields.date, fields.endDate)

  rows.forEach((row, rowIndex) => {
    if (rowIndex === 0 || row[11] !== recurrenceGroupId) return
    const date = row[1]
    const event: PlanningEvent = {
      ...fields,
      id: row[0],
      date,
      endDate: addPlanningDateDays(date, durationDays),
      recurrenceGroupId,
      recurrenceEndDate: row[12],
    }
    if (!isPlanningEvent(event)) {
      throw new Error('Une occurrence de la série récurrente contient des données invalides.')
    }
    events.push(event)
    updates.push({
      range: `'${quotedTitle}'!A${rowIndex + 1}:O${rowIndex + 1}`,
      values: [eventToRow(event)],
    })
  })

  if (updates.length > 0) await updateAuthenticatedSheetValues(updates)
  return events
}
