import { describe, expect, it } from 'vitest'
import { DEFAULT_LIVE_MATCH_SETTINGS, isLiveMatchSettings } from '@/lib/live-match-settings'

describe('live match settings', () => {
  it('provides the three requested default formats', () => {
    expect(DEFAULT_LIVE_MATCH_SETTINGS.formats.map(({ periods, minutesPerPeriod }) => [periods, minutesPerPeriod])).toEqual([
      [2, 25],
      [3, 20],
      [2, 30],
    ])
  })

  it('rejects invalid period counts and durations', () => {
    expect(isLiveMatchSettings(DEFAULT_LIVE_MATCH_SETTINGS)).toBe(true)
    expect(isLiveMatchSettings({
      formats: [
        { id: 'format1', periods: 4, minutesPerPeriod: 25 },
        { id: 'format2', periods: 3, minutesPerPeriod: 20 },
        { id: 'format3', periods: 2, minutesPerPeriod: 30 },
      ],
    })).toBe(false)
    expect(isLiveMatchSettings({
      formats: [
        { id: 'format1', periods: 2, minutesPerPeriod: 0 },
        { id: 'format2', periods: 3, minutesPerPeriod: 20 },
        { id: 'format3', periods: 2, minutesPerPeriod: 30 },
      ],
    })).toBe(false)
  })
})
