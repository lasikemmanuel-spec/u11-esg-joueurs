import type { MatchResult } from '@/lib/match-results'

export type TeamMatchStat = {
  matches: number
  wins: number
  draws: number
  losses: number
  winRate: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
  avgGoalsFor: number
  avgGoalsAgainst: number
  cleanSheets: number
}

export type RecentFormMatch = {
  date: string
  opponent: string
  competition: string
  homeAway: 'Domicile' | 'Extérieur' | 'Neutre'
  goalsFor: number
  goalsAgainst: number
  outcome: 'win' | 'draw' | 'loss'
}

export type TeamDynamics = {
  team: 'E1' | 'E2'
  overall: TeamMatchStat
  home: TeamMatchStat
  away: TeamMatchStat
  recentMatches: RecentFormMatch[] // Derniers matchs (jusqu'à 5)
  streak: {
    type: 'win' | 'unbeaten' | 'loss' | 'none'
    count: number
    label: string
  }
}

function parseHomeAway(value: string | null): 'Domicile' | 'Extérieur' | 'Neutre' {
  if (!value) return 'Neutre'
  const normalized = value.trim().toLocaleLowerCase('fr-FR')
  if (normalized.includes('dom')) return 'Domicile'
  if (normalized.includes('ext')) return 'Extérieur'
  return 'Neutre'
}

function parseDateForSort(dateStr: string): number {
  const dayFirst = dateStr.match(/^(\d{1,2})[/. -](\d{1,2})[/. -](\d{4})$/)
  if (dayFirst) {
    return new Date(Number(dayFirst[3]), Number(dayFirst[2]) - 1, Number(dayFirst[1])).getTime()
  }
  const iso = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (iso) {
    return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])).getTime()
  }
  return 0
}

function buildStat(matches: MatchResult[]): TeamMatchStat {
  const count = matches.length
  if (count === 0) {
    return {
      matches: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      winRate: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      avgGoalsFor: 0,
      avgGoalsAgainst: 0,
      cleanSheets: 0,
    }
  }

  let wins = 0
  let draws = 0
  let losses = 0
  let goalsFor = 0
  let goalsAgainst = 0
  let cleanSheets = 0

  for (const match of matches) {
    goalsFor += match.goalsFor
    goalsAgainst += match.goalsAgainst
    if (match.goalsAgainst === 0) cleanSheets += 1

    if (match.outcome === 'win') wins += 1
    else if (match.outcome === 'draw') draws += 1
    else if (match.outcome === 'loss') losses += 1
  }

  const winRate = Math.round((wins / count) * 100)
  const avgGoalsFor = Number((goalsFor / count).toFixed(1))
  const avgGoalsAgainst = Number((goalsAgainst / count).toFixed(1))

  return {
    matches: count,
    wins,
    draws,
    losses,
    winRate,
    goalsFor,
    goalsAgainst,
    goalDifference: goalsFor - goalsAgainst,
    avgGoalsFor,
    avgGoalsAgainst,
    cleanSheets,
  }
}

function calculateStreak(sortedChronological: MatchResult[]): {
  type: 'win' | 'unbeaten' | 'loss' | 'none'
  count: number
  label: string
} {
  if (sortedChronological.length === 0) {
    return { type: 'none', count: 0, label: 'Aucun match disputé' }
  }

  // Du plus récent au plus ancien
  const reversed = [...sortedChronological].reverse()
  const latestOutcome = reversed[0].outcome

  if (latestOutcome === 'win') {
    let winCount = 0
    for (const match of reversed) {
      if (match.outcome === 'win') winCount += 1
      else break
    }
    if (winCount >= 2) {
      return {
        type: 'win',
        count: winCount,
        label: `${winCount} victoires consécutives`,
      }
    }

    // Vérifier série d'invincibilité si pas que des victoires
    let unbeatenCount = 0
    for (const match of reversed) {
      if (match.outcome === 'win' || match.outcome === 'draw') unbeatenCount += 1
      else break
    }
    if (unbeatenCount >= 2) {
      return {
        type: 'unbeaten',
        count: unbeatenCount,
        label: `${unbeatenCount} matchs sans défaite`,
      }
    }

    return { type: 'win', count: 1, label: '1 victoire' }
  }

  if (latestOutcome === 'draw') {
    let unbeatenCount = 0
    for (const match of reversed) {
      if (match.outcome === 'win' || match.outcome === 'draw') unbeatenCount += 1
      else break
    }
    return {
      type: 'unbeaten',
      count: unbeatenCount,
      label: `${unbeatenCount} match${unbeatenCount > 1 ? 's' : ''} sans défaite`,
    }
  }

  // Dernière = loss
  let lossCount = 0
  for (const match of reversed) {
    if (match.outcome === 'loss') lossCount += 1
    else break
  }
  return {
    type: 'loss',
    count: lossCount,
    label: `${lossCount} défaite${lossCount > 1 ? 's' : ''} consécutive${lossCount > 1 ? 's' : ''}`,
  }
}

export function calculateTeamDynamics(
  team: 'E1' | 'E2',
  results: MatchResult[],
): TeamDynamics {
  // Trier les matchs par date croissante
  const sorted = [...results].sort((a, b) => parseDateForSort(a.date) - parseDateForSort(b.date))

  const overall = buildStat(sorted)

  const homeMatches = sorted.filter((m) => parseHomeAway(m.homeAway) === 'Domicile')
  const awayMatches = sorted.filter((m) => parseHomeAway(m.homeAway) === 'Extérieur')

  const home = buildStat(homeMatches)
  const away = buildStat(awayMatches)

  // Les 5 derniers matchs (les plus récents)
  const last5 = sorted.slice(-5).map((match): RecentFormMatch => ({
    date: match.date,
    opponent: match.opponent || 'Adversaire',
    competition: match.competition || 'Match',
    homeAway: parseHomeAway(match.homeAway),
    goalsFor: match.goalsFor,
    goalsAgainst: match.goalsAgainst,
    outcome: match.outcome,
  }))

  const streak = calculateStreak(sorted)

  return {
    team,
    overall,
    home,
    away,
    recentMatches: last5,
    streak,
  }
}
