import { parseCsv } from '@/lib/players'

const SHEET_ID = '1zDC6a-hTSKFV2E5JHvj382q6eW9-xURii-5r5O_L4n4'
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

export type TeamMatchResults = {
  E1: MatchResult[]
  E2: MatchResult[]
}

function cell(row: string[] | undefined, index: number) {
  return row?.[index]?.trim() ?? ''
}

function toScore(value: string): number | null {
  if (!value) return null
  const score = Number(value.replace(',', '.'))
  return Number.isInteger(score) && score >= 0 ? score : null
}

async function getTeamResults(tab: string): Promise<MatchResult[]> {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`
  const response = await fetch(url, { next: { revalidate: 300, tags: ['google-sheet'] } })
  if (!response.ok) throw new Error(`Impossible de lire l'onglet ${tab} (${response.status})`)

  const rows = parseCsv(await response.text())
  const [headers, dates, competitions, homeAway, , goalsForRow, goalsAgainstRow] = rows
  const matches: MatchResult[] = []

  for (let column = 2; column < Math.max(dates?.length ?? 0, goalsForRow?.length ?? 0); column += 4) {
    const date = cell(dates, column)
    const competition = cell(competitions, column)
    const resultLabel = cell(rows[4], column).toLocaleLowerCase('fr-FR')
    const goalsFor = toScore(cell(goalsForRow, column))
    const goalsAgainst = toScore(cell(goalsAgainstRow, column))

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

  return matches.sort((a, b) => {
    const [dayA, monthA, yearA] = a.date.split('/').map(Number)
    const [dayB, monthB, yearB] = b.date.split('/').map(Number)
    return new Date(yearA, monthA - 1, dayA).getTime() - new Date(yearB, monthB - 1, dayB).getTime()
  })
}

export async function getMatchResults(): Promise<TeamMatchResults> {
  const [E1, E2] = await Promise.all([
    getTeamResults(MATCH_TABS.E1),
    getTeamResults(MATCH_TABS.E2),
  ])
  return { E1, E2 }
}
