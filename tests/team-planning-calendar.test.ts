import { describe, expect, it } from 'vitest'
import {
  getPlanningMonthCalendarDays,
  getPlanningPeriodRange,
  shiftPlanningPeriod,
} from '@/lib/team-planning-calendar'

describe('team planning calendar periods', () => {
  it('starts weeks on Monday', () => {
    expect(getPlanningPeriodRange('week', '2026-11-26')).toEqual({
      startDate: '2026-11-23',
      endDate: '2026-11-29',
    })
  })

  it('returns complete month and year date ranges', () => {
    expect(getPlanningPeriodRange('month', '2024-02-20')).toEqual({
      startDate: '2024-02-01',
      endDate: '2024-02-29',
    })
    expect(getPlanningPeriodRange('year', '2026-11-26')).toEqual({
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    })
  })

  it('navigates by the selected period without skipping months', () => {
    expect(shiftPlanningPeriod('month', '2026-01-31', 1)).toBe('2026-02-01')
    expect(shiftPlanningPeriod('month', '2026-01-31', -1)).toBe('2025-12-01')
    expect(shiftPlanningPeriod('week', '2026-11-23', 1)).toBe('2026-11-30')
  })

  it('builds a Monday-to-Sunday month grid containing every day of the month', () => {
    const days = getPlanningMonthCalendarDays('2026-11-01')
    expect(days[0]).toBe('2026-10-26')
    expect(days.at(-1)).toBe('2026-12-06')
    expect(days).toContain('2026-11-01')
    expect(days).toContain('2026-11-30')
    expect(days).toHaveLength(42)
  })
})
