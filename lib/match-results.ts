import 'server-only'
import { ensureAuthenticatedSheetColumnCount, getAuthenticatedSheetRows, updateAuthenticatedSheetValues } from '@/lib/google-sheets'

export const MATCH_TABS = {
  E1: '⚽ Feuille de Match Equipe 1',
  E2: '⚽ Feuille de Match Equipe 2',
} as const

export type MatchResult = {
  date: string
  opponent: string | null
  competition: string | null
  homeAway: string | null
  goalsFor: number
  goalsAgainst: number
  outcome: 'win' | 'draw' | 'loss'
}

export type MatchType = {
  date: string
  type: string
}

export type MatchSheetEntry = {
  team: 'E1' | 'E2'
  slotColumn: number
  date: string
  opponent: string
  competition: string
  homeAway: string
  goalsFor: number | null
  goalsAgainst: number | null
}

export type TeamMatchResults = {
  E1: MatchResult[]
  E2: MatchResult[]
  matchTypes: {
    E1: MatchType[]
    E2: MatchType[]
  }
  entries: MatchSheetEntry[]
}

function cell(row: string[] | undefined, index: number) {
  return row?.[index]?.trim() ?? ''
}

function toScore(value: string): number | null {
  if (!value) return null
  const score = Number(value.replace(',', '.'))
  return Number.isInteger(score) && score >= 0 ? score : null
}

function isMatchDate(value: string) {
  return /^\d{1,2}[/. -]\d{1,2}[/. -]\d{4}$/.test(value) || /^\d{4}-\d{1,2}-\d{1,2}$/.test(value)
}

function matchDateKey(value: string) {
  const trimmed = value.trim()
  const iso = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (iso) return iso[1] + '-' + iso[2].padStart(2, '0') + '-' + iso[3].padStart(2, '0')
  const dayFirst = trimmed.match(/^(\d{1,2})[/. -](\d{1,2})[/. -](\d{4})$/)
  if (dayFirst) return dayFirst[3] + '-' + dayFirst[2].padStart(2, '0') + '-' + dayFirst[1].padStart(2, '0')
  return ''
}

function normalizeOpponent(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('fr-FR')
}

async function getTeamResults(tab: string, team: 'E1' | 'E2'): Promise<{
  results: MatchResult[]
  matchTypes: MatchType[]
  entries: MatchSheetEntry[]
}> {
  const { rows } = await getAuthenticatedSheetRows(tab)
  const dateRowIndex = rows.findIndex((row) =>
    row.some((value, column) => column >= 2 && isMatchDate(value.trim())),
  )
  if (dateRowIndex < 1) {
    throw new Error('Ligne des dates introuvable dans l’onglet « ' + tab + ' ».')
  }

  const headerRowIndex = dateRowIndex - 1
  const headers = rows[headerRowIndex]
  const dates = rows[dateRowIndex]
  const competitions = rows[dateRowIndex + 1]
  const homeAway = rows[dateRowIndex + 2]
  const resultLabels = rows[dateRowIndex + 3]
  const goalsForRow = rows[dateRowIndex + 4]
  const goalsAgainstRow = rows[dateRowIndex + 5]
  const matches: MatchResult[] = []
  const matchTypes: MatchType[] = []
  const entries: MatchSheetEntry[] = []
  const width = Math.max(dates?.length ?? 0, competitions?.length ?? 0, headers?.length ?? 0)

  for (let column = 2; column < width; column += 4) {
    const date = cell(dates, column)
    const opponent = cell(headers, column)
    const competition = cell(competitions, column)
    const venue = cell(homeAway, column)
    const resultLabel = cell(resultLabels, column).toLocaleLowerCase('fr-FR')
    const goalsFor = toScore(cell(goalsForRow, column))
    const goalsAgainst = toScore(cell(goalsAgainstRow, column))
    const hasEntry = Boolean(date || opponent || competition || venue || goalsFor !== null || goalsAgainst !== null)

    if (date && competition) matchTypes.push({ date, type: competition })
    if (hasEntry && !resultLabel.includes('annul')) {
      entries.push({
        team,
        slotColumn: column,
        date,
        opponent,
        competition,
        homeAway: venue,
        goalsFor,
        goalsAgainst,
      })
    }

    if (
      !date ||
      resultLabel.includes('annul') ||
      competition.toLocaleLowerCase('fr-FR').includes('entrainement') ||
      goalsFor === null ||
      goalsAgainst === null
    ) {
      continue
    }

    matches.push({
      date,
      opponent: opponent || null,
      competition: competition || null,
      homeAway: venue || null,
      goalsFor,
      goalsAgainst,
      outcome: goalsFor > goalsAgainst ? 'win' : goalsFor < goalsAgainst ? 'loss' : 'draw',
    })
  }

  const sortedMatches = matches.sort((a, b) => matchDateKey(a.date).localeCompare(matchDateKey(b.date)))
  entries.sort((a, b) => matchDateKey(a.date).localeCompare(matchDateKey(b.date)))
  return { results: sortedMatches, matchTypes, entries }
}

export type MatchResultInput = {
  team: 'E1' | 'E2'
  slotColumn?: number
  date: string
  opponent: string
  competition: string
  homeAway: string
  goalsFor: number | null
  goalsAgainst: number | null
}

function columnName(columnIndex: number) {
  let value = columnIndex + 1
  let column = ''
  while (value > 0) {
    const remainder = (value - 1) % 26
    column = String.fromCharCode(65 + remainder) + column
    value = Math.floor((value - 1) / 26)
  }
  return column
}

/**
 * Creates a fixture in the next empty block or updates an existing fixture
 * by its stable column so changing its date or opponent cannot create a duplicate.
 */
export async function writeMatchResult(input: MatchResultInput) {
  const tabName = MATCH_TABS[input.team]
  const { sheetTitle, rows } = await getAuthenticatedSheetRows(tabName)
  const dateRowIndex = rows.findIndex((row) =>
    row.some((value, column) => column >= 2 && isMatchDate(value.trim())),
  )
  if (dateRowIndex < 1) throw new Error('Ligne des dates introuvable dans l’onglet « ' + tabName + ' ».')
  const headerRowIndex = dateRowIndex - 1
  const competitionRowIndex = dateRowIndex + 1
  const homeAwayRowIndex = dateRowIndex + 2
  const resultRowIndex = dateRowIndex + 3
  const goalsForRowIndex = dateRowIndex + 4
  const goalsAgainstRowIndex = dateRowIndex + 5
  const dateKey = matchDateKey(input.date)
  const opponentKey = normalizeOpponent(input.opponent)
  const width = Math.max(...rows.map((row) => row.length), 40)
  let targetColumn: number | null = input.slotColumn ?? null
  let emptyColumn: number | null = null

  if (targetColumn !== null) {
    if (!Number.isSafeInteger(targetColumn) || targetColumn < 2 || (targetColumn - 2) % 4 !== 0) {
      throw new Error('Emplacement de match invalide.')
    }
    const existing = [
      cell(rows[headerRowIndex], targetColumn),
      cell(rows[dateRowIndex], targetColumn),
      cell(rows[competitionRowIndex], targetColumn),
      cell(rows[homeAwayRowIndex], targetColumn),
      cell(rows[goalsForRowIndex], targetColumn),
      cell(rows[goalsAgainstRowIndex], targetColumn),
    ].some(Boolean)
    if (!existing) throw new Error('Ce match n’existe plus dans la feuille. Actualise la page.')
  }

  for (let column = 2; column < width; column += 4) {
    const opponent = cell(rows[headerRowIndex], column)
    const date = cell(rows[dateRowIndex], column)
    const isSameMatch = matchDateKey(date) === dateKey && normalizeOpponent(opponent) === opponentKey

    if (targetColumn === null && isSameMatch) {
      throw new Error('Ce match existe déjà. Utilise « Modifier » dans le calendrier.')
    }
    if (targetColumn !== null && column !== targetColumn && isSameMatch) {
      throw new Error('Un match avec cette date et cet adversaire existe déjà dans cette feuille.')
    }

    const blockHasData = [
      opponent,
      date,
      cell(rows[competitionRowIndex], column),
      cell(rows[homeAwayRowIndex], column),
      cell(rows[resultRowIndex], column),
      cell(rows[goalsForRowIndex], column),
      cell(rows[goalsAgainstRowIndex], column),
    ].some(Boolean)
    if (!blockHasData && emptyColumn === null) emptyColumn = column
  }

  if (targetColumn === null) {
    targetColumn = emptyColumn ?? (2 + Math.ceil(Math.max(0, width - 2) / 4) * 4)
  }
  await ensureAuthenticatedSheetColumnCount(sheetTitle, targetColumn + 1)

  const escapedTitle = sheetTitle.replace(/'/g, "''")
  const cellRange = (rowIndex: number) =>
    "'" + escapedTitle + "'!" + columnName(targetColumn) + (rowIndex + 1)
  const [year, month, day] = input.date.split('-')
  const displayDate = day + '/' + month + '/' + year
  const hasScore = input.goalsFor !== null && input.goalsAgainst !== null

  await updateAuthenticatedSheetValues([
    { range: cellRange(headerRowIndex), values: [[input.opponent]] },
    { range: cellRange(dateRowIndex), values: [[displayDate]] },
    { range: cellRange(competitionRowIndex), values: [[input.competition]] },
    { range: cellRange(homeAwayRowIndex), values: [[input.homeAway]] },
    { range: cellRange(resultRowIndex), values: [[hasScore ? 'Terminé' : '']] },
    { range: cellRange(goalsForRowIndex), values: [[hasScore ? String(input.goalsFor) : '']] },
    { range: cellRange(goalsAgainstRowIndex), values: [[hasScore ? String(input.goalsAgainst) : '']] },
  ])

  return { sheetTitle, slotColumn: targetColumn, updatedExistingMatch: input.slotColumn !== undefined }
}

export async function getMatchResults(): Promise<TeamMatchResults> {
  const [E1, E2] = await Promise.all([
    getTeamResults(MATCH_TABS.E1, 'E1'),
    getTeamResults(MATCH_TABS.E2, 'E2'),
  ])
  return {
    E1: E1.results,
    E2: E2.results,
    matchTypes: {
      E1: E1.matchTypes,
      E2: E2.matchTypes,
    },
    entries: [...E1.entries, ...E2.entries].sort((a, b) => matchDateKey(a.date).localeCompare(matchDateKey(b.date))),
  }
}
