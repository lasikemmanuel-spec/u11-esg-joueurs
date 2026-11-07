import { describe, expect, it } from 'vitest'
import {
  getDefaultExpandedMatchDate,
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

describe('getDefaultExpandedMatchDate', () => {
  it('opens the nearest upcoming planned date', () => {
    expect(getDefaultExpandedMatchDate(
      ['2026-11-28', '2026-11-14', '2026-11-07'],
      '2026-11-08',
      ['2026-11-28', '2026-11-14'],
    )).toBe('2026-11-14')
  })

  it('chooses the nearest planned date even if a closer date has no planning', () => {
    expect(getDefaultExpandedMatchDate(
      ['2026-11-28', '2026-11-14', '2026-11-10'],
      '2026-11-08',
      ['2026-11-28', '2026-11-14'],
    )).toBe('2026-11-14')
  })

  it('includes a planned match scheduled for today', () => {
    expect(getDefaultExpandedMatchDate(
      ['2026-11-14', '2026-11-07'],
      '2026-11-07',
      ['2026-11-07'],
    )).toBe('2026-11-07')
  })

  it('falls back to the latest past date when no future day is planned', () => {
    expect(getDefaultExpandedMatchDate(
      ['2026-11-28', '2026-11-07', '2026-11-01'],
      '2026-11-08',
      [],
    )).toBe('2026-11-07')
  })

  it('leaves old months collapsed', () => {
    expect(getDefaultExpandedMatchDate(
      ['2026-10-24', '2026-10-10'],
      '2026-11-07',
      [],
      '2026-10',
    )).toBeNull()
  })

  it('returns null when the month has no matches', () => {
    expect(getDefaultExpandedMatchDate([], '2026-11-08')).toBeNull()
  })
})
