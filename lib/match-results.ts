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

export type TeamMatchResults = {
  E1: MatchResult[]
  E2: MatchResult[]
  matchTypes: {
    E1: MatchType[]
    E2: MatchType[]
  }
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

async function getTeamResults(tab: string): Promise<{ results: MatchResult[]; matchTypes: MatchType[] }> {
  const { rows } = await getAuthenticatedSheetRows(tab)
  const dateRowIndex = rows.findIndex((row) =>
    row.some((value, column) => column >= 2 && isMatchDate(value.trim())),
  )
  if (dateRowIndex < 1) {
    throw new Error(`Ligne des dates introuvable dans l’onglet « ${tab} ».`)
  }

  const headers = rows[dateRowIndex - 1]
  const dates = rows[dateRowIndex]
  const competitions = rows[dateRowIndex + 1]
  const homeAway = rows[dateRowIndex + 2]
  const resultLabels = rows[dateRowIndex + 3]
  const goalsForRow = rows[dateRowIndex + 4]
  const goalsAgainstRow = rows[dateRowIndex + 5]
  const matches: MatchResult[] = []
  const matchTypes: MatchType[] = []

  for (
    let column = 2;
    column < Math.max(dates?.length ?? 0, competitions?.length ?? 0, goalsForRow?.length ?? 0);
    column += 4
  ) {
    const date = cell(dates, column)
    const competition = cell(competitions, column)
    const resultLabel = cell(resultLabels, column).toLocaleLowerCase('fr-FR')
    const goalsFor = toScore(cell(goalsForRow, column))
    const goalsAgainst = toScore(cell(goalsAgainstRow, column))

    if (date && competition) matchTypes.push({ date, type: competition })

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
      opponent: cell(headers, column) || null,
      competition: competition || null,
      homeAway: cell(homeAway, column) || null,
      goalsFor,
      goalsAgainst,
      outcome: goalsFor > goalsAgainst ? 'win' : goalsFor < goalsAgainst ? 'loss' : 'draw',
    })
  }

  const sortedMatches = matches.sort((a, b) => {
    const [dayA, monthA, yearA] = a.date.split('/').map(Number)
    const [dayB, monthB, yearB] = b.date.split('/').map(Number)
    return new Date(yearA, monthA - 1, dayA).getTime() - new Date(yearB, monthB - 1, dayB).getTime()
  })
  return { results: sortedMatches, matchTypes }
}


export type MatchResultInput = {
  team: 'E1' | 'E2'
  date: string
  opponent: string
  competition: string
  homeAway: string
  goalsFor: number
  goalsAgainst: number
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

function matchDateKey(value: string) {
  const trimmed = value.trim()
  const iso = trimmed.match(/^(\\d{4})-(\\d{1,2})-(\\d{1,2})$/)
  if (iso) return iso[1] + '-' + iso[2].padStart(2, '0') + '-' + iso[3].padStart(2, '0')
  const dayFirst = trimmed.match(/^(\\d{1,2})[/. -](\\d{1,2})[/. -](\\d{4})$/)
  if (dayFirst) return dayFirst[3] + '-' + dayFirst[2].padStart(2, '0') + '-' + dayFirst[1].padStart(2, '0')
  return ''
}

function normalizeOpponent(value: string) {
  return value.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').trim().toLocaleLowerCase('fr-FR')
}

/**
 * Enregistre le résultat dans l'onglet existant, en mettant à jour un match
 * déjà planifié (même date et adversaire) ou en utilisant le prochain bloc vide.
 */
export async function writeMatchResult(input: MatchResultInput) {
  const tabName = MATCH_TABS[input.team]
  const { sheetTitle, rows } = await getAuthenticatedSheetRows(tabName)
  const dateRowIndex = rows.findIndex((row) =>
    row.some((value, column) => column >= 2 && isMatchDate(value.trim())),
  )
  if (dateRowIndex < 1) throw new Error(`Ligne des dates introuvable dans l’onglet « ${tabName} ».`)

  const headerRowIndex = dateRowIndex - 1
  const competitionRowIndex = dateRowIndex + 1
  const homeAwayRowIndex = dateRowIndex + 2
  const resultRowIndex = dateRowIndex + 3
  const goalsForRowIndex = dateRowIndex + 4
  const goalsAgainstRowIndex = dateRowIndex + 5
  const dateKey = matchDateKey(input.date)
  const opponentKey = normalizeOpponent(input.opponent)
  const width = Math.max(...rows.map((row) => row.length), 40)
  let matchingColumn: number | null = null
  let emptyColumn: number | null = null

  for (let column = 2; column < width; column += 4) {
    const opponent = cell(rows[headerRowIndex], column)
    const date = cell(rows[dateRowIndex], column)
    if (
      matchDateKey(date) === dateKey &&
      (!opponent || normalizeOpponent(opponent) === opponentKey)
    ) {
      matchingColumn = column
      break
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

  const targetColumn = matchingColumn ?? emptyColumn ?? (2 + Math.ceil(Math.max(0, width - 2) / 4) * 4)
  await ensureAuthenticatedSheetColumnCount(sheetTitle, targetColumn + 1)

  const escapedTitle = sheetTitle.replace(/'/g, "''")
  const cellRange = (rowIndex: number) =>
    "'" + escapedTitle + "'!" + columnName(targetColumn) + (rowIndex + 1)
  const [year, month, day] = input.date.split('-')
  const displayDate = day + '/' + month + '/' + year

  await updateAuthenticatedSheetValues([
    { range: cellRange(headerRowIndex), values: [[input.opponent]] },
    { range: cellRange(dateRowIndex), values: [[displayDate]] },
    { range: cellRange(competitionRowIndex), values: [[input.competition]] },
    { range: cellRange(homeAwayRowIndex), values: [[input.homeAway]] },
    { range: cellRange(resultRowIndex), values: [['Terminé']] },
    { range: cellRange(goalsForRowIndex), values: [[String(input.goalsFor)]] },
    { range: cellRange(goalsAgainstRowIndex), values: [[String(input.goalsAgainst)]] },
  ])

  return { sheetTitle, updatedExistingMatch: matchingColumn !== null }
}

export async function getMatchResults(): Promise<TeamMatchResults> {
  const [E1, E2] = await Promise.all([
    getTeamResults(MATCH_TABS.E1),
    getTeamResults(MATCH_TABS.E2),
  ])
  return {
    E1: E1.results,
    E2: E2.results,
    matchTypes: {
      E1: E1.matchTypes,
      E2: E2.matchTypes,
    },
  }
}
