import { describe, expect, it } from 'vitest'
import { getDefaultExpandedMatchDate } from '@/lib/match-day-display'

describe('getDefaultExpandedMatchDate', () => {
  it('opens the nearest upcoming match date', () => {
    expect(getDefaultExpandedMatchDate(
      ['2026-11-28', '2026-11-14', '2026-11-07'],
      '2026-11-08',
    )).toBe('2026-11-14')
  })

  it('includes a match scheduled for today', () => {
    expect(getDefaultExpandedMatchDate(
      ['2026-11-14', '2026-11-07'],
      '2026-11-07',
    )).toBe('2026-11-07')
  })

  it('falls back to the latest past date when no matches are upcoming', () => {
    expect(getDefaultExpandedMatchDate(
      ['2026-11-07', '2026-11-01'],
      '2026-11-08',
    )).toBe('2026-11-07')
  })

  it('returns null when the month has no matches', () => {
    expect(getDefaultExpandedMatchDate([], '2026-11-08')).toBeNull()
  })
})
