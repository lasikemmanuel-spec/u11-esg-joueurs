import { describe, expect, it } from 'vitest'
import { getDefaultExpandedMatchDate } from '@/lib/match-day-display'

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
