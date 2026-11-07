import { describe, expect, it } from 'vitest'
import {
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
