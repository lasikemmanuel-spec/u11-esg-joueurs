import { describe, expect, it } from 'vitest'
import { calculateTeamDynamics, filterMatchesByCompetition } from '@/lib/team-dynamics'
import type { MatchResult } from '@/lib/match-results'

describe('calculateTeamDynamics', () => {
  it('handles empty results without error', () => {
    const dynamics = calculateTeamDynamics('E1', [])
    expect(dynamics.team).toBe('E1')
    expect(dynamics.overall.matches).toBe(0)
    expect(dynamics.overall.winRate).toBe(0)
    expect(dynamics.overall.avgGoalsFor).toBe(0)
    expect(dynamics.overall.avgGoalsAgainst).toBe(0)
    expect(dynamics.recentMatches).toHaveLength(0)
    expect(dynamics.streak.label).toBe('Aucun match disputé')
  })

  describe('filterMatchesByCompetition', () => {
    const results: MatchResult[] = [
      {
        date: '2026-09-12',
        opponent: 'Club A',
        competition: 'Championnat U11',
        homeAway: 'Domicile',
        goalsFor: 2,
        goalsAgainst: 0,
        outcome: 'win',
      },
      {
        date: '2026-09-19',
        opponent: 'Club B',
        competition: 'Match amical',
        homeAway: 'Extérieur',
        goalsFor: 1,
        goalsAgainst: 1,
        outcome: 'draw',
      },
      {
        date: '2026-09-26',
        opponent: 'Club C',
        competition: 'Plateau',
        homeAway: 'Domicile',
        goalsFor: 3,
        goalsAgainst: 2,
        outcome: 'win',
      },
      {
        date: '2026-10-03',
        opponent: 'Club D',
        competition: 'AMICAL',
        homeAway: 'Extérieur',
        goalsFor: 0,
        goalsAgainst: 2,
        outcome: 'loss',
      },
    ]

    it('filters championship and friendly matches without excluding other competitions from all', () => {
      expect(filterMatchesByCompetition(results, 'championship').map((match) => match.opponent)).toEqual(['Club A'])
      expect(filterMatchesByCompetition(results, 'friendly').map((match) => match.opponent)).toEqual(['Club B', 'Club D'])
      expect(filterMatchesByCompetition(results, 'all')).toHaveLength(4)
    })

    it('feeds separate match sets into otherwise unchanged team summaries', () => {
      const championship = calculateTeamDynamics('E1', filterMatchesByCompetition(results, 'championship'))
      const friendlies = calculateTeamDynamics('E1', filterMatchesByCompetition(results, 'friendly'))

      expect(championship.overall).toMatchObject({ matches: 1, wins: 1, goalsFor: 2, goalsAgainst: 0 })
      expect(friendlies.overall).toMatchObject({ matches: 2, wins: 0, draws: 1, losses: 1, goalsFor: 1, goalsAgainst: 3 })
    })
  })

  it('calculates correct statistics, averages and home/away splits', () => {
    const results: MatchResult[] = [
      {
        date: '2026-09-12',
        opponent: 'Villeneuve d’Ascq',
        competition: 'Championnat',
        homeAway: 'Domicile',
        goalsFor: 4,
        goalsAgainst: 1,
        outcome: 'win',
      },
      {
        date: '2026-09-19',
        opponent: 'Wasquehal',
        competition: 'Championnat',
        homeAway: 'Extérieur',
        goalsFor: 2,
        goalsAgainst: 2,
        outcome: 'draw',
      },
      {
        date: '2026-09-26',
        opponent: 'Marcq en Baroeul',
        competition: 'Championnat',
        homeAway: 'Domicile',
        goalsFor: 3,
        goalsAgainst: 0,
        outcome: 'win',
      },
      {
        date: '2026-10-03',
        opponent: 'Croix',
        competition: 'Amical',
        homeAway: 'Extérieur',
        goalsFor: 1,
        goalsAgainst: 3,
        outcome: 'loss',
      },
      {
        date: '2026-10-10',
        opponent: 'Mérignies',
        competition: 'Plateau',
        homeAway: 'Domicile',
        goalsFor: 5,
        goalsAgainst: 1,
        outcome: 'win',
      },
      {
        date: '2026-10-17',
        opponent: 'Cysoing',
        competition: 'Plateau',
        homeAway: 'Extérieur',
        goalsFor: 2,
        goalsAgainst: 0,
        outcome: 'win',
      },
    ]

    const dynamics = calculateTeamDynamics('E1', results)

    // Total: 6 matches, 4 wins, 1 draw, 1 loss.
    // Goals: For = 4+2+3+1+5+2 = 17, Against = 1+2+0+3+1+0 = 7. Clean sheets = 2 (Marcq, Cysoing)
    expect(dynamics.overall.matches).toBe(6)
    expect(dynamics.overall.wins).toBe(4)
    expect(dynamics.overall.draws).toBe(1)
    expect(dynamics.overall.losses).toBe(1)
    expect(dynamics.overall.winRate).toBe(67) // 4/6 = 66.67% -> 67%
    expect(dynamics.overall.goalsFor).toBe(17)
    expect(dynamics.overall.goalsAgainst).toBe(7)
    expect(dynamics.overall.goalDifference).toBe(10)
    expect(dynamics.overall.avgGoalsFor).toBe(2.8)
    expect(dynamics.overall.avgGoalsAgainst).toBe(1.2)
    expect(dynamics.overall.cleanSheets).toBe(2)

    // Domicile: 3 matches (Villeneuve, Marcq, Mérignies) -> 3 wins
    expect(dynamics.home.matches).toBe(3)
    expect(dynamics.home.wins).toBe(3)
    expect(dynamics.home.losses).toBe(0)
    expect(dynamics.home.winRate).toBe(100)
    expect(dynamics.home.goalsFor).toBe(12)
    expect(dynamics.home.goalsAgainst).toBe(2)

    // Extérieur: 3 matches (Wasquehal, Croix, Cysoing) -> 1 win, 1 draw, 1 loss
    expect(dynamics.away.matches).toBe(3)
    expect(dynamics.away.wins).toBe(1)
    expect(dynamics.away.draws).toBe(1)
    expect(dynamics.away.losses).toBe(1)
    expect(dynamics.away.goalsFor).toBe(5)
    expect(dynamics.away.goalsAgainst).toBe(5)

    // Recent matches: last 5 matches (Wasquehal, Marcq, Croix, Mérignies, Cysoing)
    expect(dynamics.recentMatches).toHaveLength(5)
    expect(dynamics.recentMatches[0].opponent).toBe('Wasquehal')
    expect(dynamics.recentMatches[4].opponent).toBe('Cysoing')

    // Streak: last 2 matches are wins (Mérignies, Cysoing)
    expect(dynamics.streak.type).toBe('win')
    expect(dynamics.streak.count).toBe(2)
    expect(dynamics.streak.label).toBe('2 victoires consécutives')
  })
})
