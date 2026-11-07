import { describe, expect, it } from 'vitest'
import {
  getLatestPlayedMatches,
  getNextPlannedMatchDate,
  normalizeMatchDate,
} from '@/lib/match-day-display'

describe('normalizeMatchDate', () => {
  it('normalizes ISO and French date formats', () => {
    expect(normalizeMatchDate('2026-11-7')).toBe('2026-11-07')
    expect(normalizeMatchDate('07/11/2026')).toBe('2026-11-07')
  })

  it('returns an empty string for unsupported formats', () => {
    expect(normalizeMatchDate('date inconnue')).toBe('')
  })
})

describe('getNextPlannedMatchDate', () => {
  it('returns the nearest upcoming fixture that has no score or result', () => {
    expect(getNextPlannedMatchDate([
      { date: '21/11/2026', resultLabel: '', goalsFor: null, goalsAgainst: null },
      { date: '14/11/2026', resultLabel: '', goalsFor: null, goalsAgainst: null },
      { date: '2026-11-08', resultLabel: 'Gagné', goalsFor: 2, goalsAgainst: 1 },
    ], '2026-11-07')).toBe('2026-11-14')
  })

  it('skips cancelled and already-played fixtures', () => {
    expect(getNextPlannedMatchDate([
      { date: '14/11/2026', resultLabel: 'Annulé', goalsFor: null, goalsAgainst: null },
      { date: '21/11/2026', resultLabel: '', goalsFor: 1, goalsAgainst: 0 },
    ], '2026-11-07')).toBeNull()
  })
})

describe('getLatestPlayedMatches', () => {
  it('selects each team’s latest completed result and excludes future, cancelled, and unscored matches', () => {
    const latest = getLatestPlayedMatches([
      { team: 'E1', date: '01/11/2026', opponent: 'Club A', resultLabel: 'Gagné', goalsFor: 3, goalsAgainst: 1 },
      { team: 'E1', date: '2026-11-06', opponent: 'Club B', resultLabel: 'Perdu', goalsFor: 0, goalsAgainst: 2 },
      { team: 'E1', date: '2026-11-07', opponent: 'Club C', resultLabel: 'Annulé', goalsFor: null, goalsAgainst: null },
      { team: 'E2', date: '07/11/2026', opponent: 'Club D', resultLabel: '', goalsFor: null, goalsAgainst: null },
      { team: 'E2', date: '14/11/2026', opponent: 'Club E', resultLabel: 'Gagné', goalsFor: 2, goalsAgainst: 0 },
      { team: 'E2', date: '2026-11-05', opponent: 'Club F', resultLabel: 'Nul', goalsFor: 1, goalsAgainst: 1 },
    ], '2026-11-07')

    expect(latest.E1).toMatchObject({
      opponent: 'Club B',
      normalizedDate: '2026-11-06',
      goalsFor: 0,
      goalsAgainst: 2,
    })
    expect(latest.E2).toMatchObject({
      opponent: 'Club F',
      normalizedDate: '2026-11-05',
      goalsFor: 1,
      goalsAgainst: 1,
    })
  })
})
