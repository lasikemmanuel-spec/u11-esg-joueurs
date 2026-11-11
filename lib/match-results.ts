import 'server-only'
import { ensureAuthenticatedSheetColumnCount, getAuthenticatedSheetRows, updateAuthenticatedSheetValues } from '@/lib/google-sheets'
import type { MatchResultStatus } from '@/lib/match-result-options'

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
  kickoffTime: string
  resultLabel: string
  goalsFor: number | null
  goalsAgainst: number | null
  playedPlayerNumbers?: number[]
  hasParticipationData?: boolean
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

function matchOpponent(row: string[] | undefined, column: number) {
  const value = cell(row, column)
  return normalizeOpponent(value) === 'adversaire' ? '' : value
}

function parseVenue(value: string) {
  const match = value.match(/^(Domicile|Extérieur|Terrain neutre)(?: · (\d{2}:\d{2}))?$/)
  return match
    ? { homeAway: match[1], kickoffTime: match[2] ?? '' }
    : { homeAway: value, kickoffTime: '' }
}

function getPlayerParticipation(rows: string[][], column: number) {
  const playedPlayerNumbers: number[] = []
  let hasParticipationData = false
  for (const row of rows) {
    const number = Number.parseInt(row[0] ?? '', 10)
    if (!Number.isSafeInteger(number) || number <= 0 || !row[1]?.trim()) continue
    const rawMinutes = cell(row, column + 1)
    if (!rawMinutes) continue
    const minutes = Number(rawMinutes.replace(',', '.'))
    if (!Number.isFinite(minutes) || minutes < 0) continue
    hasParticipationData = true
    if (minutes > 0) playedPlayerNumbers.push(number)
  }
  return { playedPlayerNumbers, hasParticipationData }
}

async function getTeamResults(tab: string, team: 'E1' | 'E2'): Promise<{
  results: MatchResult[]
  matchTypes: MatchType[]
  entries: MatchSheetEntry[]
}> {
  const { rows } = await getAuthenticatedSheetRows(tab, { cacheForSeconds: 5 })
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
    const opponent = matchOpponent(headers, column)
    const competition = cell(competitions, column)
    const venue = parseVenue(cell(homeAway, column))
    const resultLabelValue = cell(resultLabels, column)
    const resultLabel = resultLabelValue.toLocaleLowerCase('fr-FR')
    const goalsFor = toScore(cell(goalsForRow, column))
    const goalsAgainst = toScore(cell(goalsAgainstRow, column))
    const hasEntry = Boolean(date || opponent || competition || venue || goalsFor !== null || goalsAgainst !== null)

    if (date && competition) matchTypes.push({ date, type: competition })
    if (hasEntry) {
      const participation = getPlayerParticipation(rows, column)
      entries.push({
        team,
        slotColumn: column,
        date,
        opponent,
        competition,
        homeAway: venue.homeAway,
        kickoffTime: venue.kickoffTime,
        resultLabel: resultLabelValue,
        goalsFor,
        goalsAgainst,
        ...participation,
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
      homeAway: venue.homeAway || null,
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
  kickoffTime: string
  resultLabel: MatchResultStatus | ''
  goalsFor: number | null
  goalsAgainst: number | null
}

export type MatchResultDeletion = Pick<MatchSheetEntry, 'team' | 'date' | 'slotColumn'>

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

function getMatchDateRowIndex(rows: string[][], tabName: string) {
  const dateRowIndex = rows.findIndex((row) =>
    row.some((value, column) => column >= 2 && isMatchDate(value.trim())),
  )
  if (dateRowIndex < 1) throw new Error('Ligne des dates introuvable dans l’onglet « ' + tabName + ' ».')
  return dateRowIndex
}

function getMatchDeletionUpdates(
  sheetTitle: string,
  rows: string[][],
  team: 'E1' | 'E2',
  matches: MatchResultDeletion[],
) {
  const dateRowIndex = getMatchDateRowIndex(rows, MATCH_TABS[team])
  const headerRowIndex = dateRowIndex - 1
  const matchSlots = new Set<number>()

  for (const match of matches) {
    if (
      match.team !== team ||
      !Number.isSafeInteger(match.slotColumn) ||
      match.slotColumn < 2 ||
      (match.slotColumn - 2) % 4 !== 0 ||
      matchDateKey(cell(rows[dateRowIndex], match.slotColumn)) !== matchDateKey(match.date)
    ) {
      throw new Error('Le match a changé dans la feuille. Actualise la page.')
    }
    if (!matchOpponent(rows[headerRowIndex], match.slotColumn) &&
      !cell(rows[dateRowIndex + 1], match.slotColumn) &&
      !cell(rows[dateRowIndex + 2], match.slotColumn) &&
      !cell(rows[dateRowIndex + 3], match.slotColumn) &&
      !cell(rows[dateRowIndex + 4], match.slotColumn) &&
      !cell(rows[dateRowIndex + 5], match.slotColumn)
    ) {
      throw new Error('Ce match n’existe plus dans la feuille. Actualise la page.')
    }
    if (
      cell(rows[dateRowIndex + 3], match.slotColumn) ||
      cell(rows[dateRowIndex + 4], match.slotColumn) ||
      cell(rows[dateRowIndex + 5], match.slotColumn)
    ) {
      throw new Error('Ce match n’est plus en planification et ne peut pas être supprimé.')
    }
    matchSlots.add(match.slotColumn)
  }

  const escapedTitle = sheetTitle.replace(/'/g, "''")
  const updates: Array<{ range: string; values: string[][] }> = []
  const cellRange = (column: number, rowIndex: number) =>
    `'${escapedTitle}'!${columnName(column)}${rowIndex + 1}`

  for (const slotColumn of matchSlots) {
    updates.push(
      { range: cellRange(slotColumn, headerRowIndex), values: [['Adversaire']] },
      { range: cellRange(slotColumn, dateRowIndex), values: [['']] },
      { range: cellRange(slotColumn, dateRowIndex + 1), values: [['']] },
      { range: cellRange(slotColumn, dateRowIndex + 2), values: [['']] },
      { range: cellRange(slotColumn, dateRowIndex + 3), values: [['']] },
      { range: cellRange(slotColumn, dateRowIndex + 4), values: [['']] },
      { range: cellRange(slotColumn, dateRowIndex + 5), values: [['']] },
    )
    for (let rowIndex = dateRowIndex + 6; rowIndex < rows.length; rowIndex += 1) {
      if (!Number.isSafeInteger(Number.parseInt(rows[rowIndex][0] ?? '', 10)) || !cell(rows[rowIndex], 1)) continue
      updates.push({ range: cellRange(slotColumn, rowIndex), values: [['']] })
    }
  }
  return updates
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
      matchOpponent(rows[headerRowIndex], targetColumn),
      cell(rows[dateRowIndex], targetColumn),
      cell(rows[competitionRowIndex], targetColumn),
      cell(rows[homeAwayRowIndex], targetColumn),
      cell(rows[goalsForRowIndex], targetColumn),
      cell(rows[goalsAgainstRowIndex], targetColumn),
    ].some(Boolean)
    if (!existing) throw new Error('Ce match n’existe plus dans la feuille. Actualise la page.')
  }

  for (let column = 2; column < width; column += 4) {
    const opponent = matchOpponent(rows[headerRowIndex], column)
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

  let relocatedFromColumn: number | null = null
  if (targetColumn !== null && emptyColumn !== null && emptyColumn < targetColumn) {
    relocatedFromColumn = targetColumn
    targetColumn = emptyColumn
  } else if (targetColumn === null) {
    targetColumn = emptyColumn ?? (2 + Math.ceil(Math.max(0, width - 2) / 4) * 4)
  }
  await ensureAuthenticatedSheetColumnCount(sheetTitle, targetColumn + 1)

  const escapedTitle = sheetTitle.replace(/'/g, "''")
  const cellRange = (column: number, rowIndex: number) =>
    "'" + escapedTitle + "'!" + columnName(column) + (rowIndex + 1)
  const [year, month, day] = input.date.split('-')
  const displayDate = day + '/' + month + '/' + year
  const hasScore = input.goalsFor !== null && input.goalsAgainst !== null

  const updates = [
    { range: cellRange(targetColumn, headerRowIndex), values: [[input.opponent]] },
    { range: cellRange(targetColumn, dateRowIndex), values: [[displayDate]] },
    { range: cellRange(targetColumn, competitionRowIndex), values: [[input.competition]] },
    {
      range: cellRange(targetColumn, homeAwayRowIndex),
      values: [[input.kickoffTime ? `${input.homeAway} · ${input.kickoffTime}` : input.homeAway]],
    },
    { range: cellRange(targetColumn, resultRowIndex), values: [[input.resultLabel]] },
    { range: cellRange(targetColumn, goalsForRowIndex), values: [[hasScore ? String(input.goalsFor) : '']] },
    { range: cellRange(targetColumn, goalsAgainstRowIndex), values: [[hasScore ? String(input.goalsAgainst) : '']] },
  ]
  if (relocatedFromColumn !== null) {
    updates.push(
      { range: cellRange(relocatedFromColumn, headerRowIndex), values: [['Adversaire']] },
      { range: cellRange(relocatedFromColumn, dateRowIndex), values: [['']] },
      { range: cellRange(relocatedFromColumn, competitionRowIndex), values: [['']] },
      { range: cellRange(relocatedFromColumn, homeAwayRowIndex), values: [['']] },
      { range: cellRange(relocatedFromColumn, resultRowIndex), values: [['']] },
      { range: cellRange(relocatedFromColumn, goalsForRowIndex), values: [['']] },
      { range: cellRange(relocatedFromColumn, goalsAgainstRowIndex), values: [['']] },
    )
  }
  await updateAuthenticatedSheetValues(updates)

  return { sheetTitle, slotColumn: targetColumn, updatedExistingMatch: input.slotColumn !== undefined }
}

export async function deleteMatchResult(match: MatchResultDeletion) {
  const { sheetTitle, rows } = await getAuthenticatedSheetRows(MATCH_TABS[match.team])
  const updates = getMatchDeletionUpdates(sheetTitle, rows, match.team, [match])
  await updateAuthenticatedSheetValues(updates)
  return { sheetTitle, deletedMatches: 1 }
}

export async function deleteMatchDay(date: string) {
  const teamSheets = await Promise.all(
    (['E1', 'E2'] as const).map(async (team) => ({
      team,
      ...await getAuthenticatedSheetRows(MATCH_TABS[team]),
    })),
  )
  const matches: MatchResultDeletion[] = []
  for (const { team, rows } of teamSheets) {
    const dateRowIndex = getMatchDateRowIndex(rows, MATCH_TABS[team])
    for (let slotColumn = 2; slotColumn < rows[dateRowIndex].length; slotColumn += 4) {
      if (matchDateKey(cell(rows[dateRowIndex], slotColumn)) === date) {
        matches.push({ team, date, slotColumn })
      }
    }
  }
  if (matches.length === 0) throw new Error('Aucun match n’existe à cette date.')

  const updates = teamSheets.flatMap(({ team, sheetTitle, rows }) =>
    getMatchDeletionUpdates(
      sheetTitle,
      rows,
      team,
      matches.filter((match) => match.team === team),
    ),
  )
  await updateAuthenticatedSheetValues(updates)
  return { deletedMatches: matches.length }
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
