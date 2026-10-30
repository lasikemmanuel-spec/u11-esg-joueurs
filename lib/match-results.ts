import { getSheetRows } from '@/lib/google-sheets'

const MATCH_TABS = {
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
  const rows = await getSheetRows(tab)
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
