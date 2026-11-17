import { describe, expect, it } from 'vitest'
import { getRecentAttendanceTrends, getUpcomingMatchesForWeek, getWeekRange, getWeeklyTrainingSummary } from '@/lib/weekly-report'
import type { MatchSheetEntry } from '@/lib/match-results'

function match(date: string, updates: Partial<MatchSheetEntry> = {}): MatchSheetEntry {
  return {
    date,
    team: 'E1',
    slotColumn: 2,
    opponent: 'Adversaire',
    competition: 'Championnat',
    homeAway: 'Domicile',
    kickoffTime: '10:00',
    resultLabel: '',
    goalsFor: null,
    goalsAgainst: null,
    ...updates,
  }
}

describe('weekly educator report calculations', () => {
  it('uses Monday to Sunday for the current week, including Sunday boundaries', () => {
    expect(getWeekRange('2026-11-15')).toEqual({ start: '2026-11-09', end: '2026-11-15' })
    expect(getWeekRange('not-a-date')).toBeNull()
  })

  it('includes only unplayed, non-cancelled matches still to come this week', () => {
    const entries = [
      match('2026-11-16'),
      match('2026-11-22'),
      match('2026-11-14'),
      match('2026-11-15'),
      match('2026-11-14', { resultLabel: 'Annulé' }),
      match('2026-11-14', { resultLabel: 'Gagné', goalsFor: 2, goalsAgainst: 1 }),
    ]

    expect(getUpcomingMatchesForWeek(entries, '2026-11-14').map((entry) => entry.date)).toEqual([
      '2026-11-14',
      '2026-11-15',
    ])
  })

  it('counts attendance only for roster players with recorded attendance statuses', () => {
    const summary = getWeeklyTrainingSummary(
      [
        { date: '2026-11-10', playerStatuses: { 1: 'P', 2: 'AJ', 3: 'B' } },
        { date: '2026-11-12', playerStatuses: { 1: 'AI', 2: 'P' } },
      ],
      [1, 2],
      { start: '2026-11-09', end: '2026-11-15' },
      '2026-11-14',
    )

    expect(summary).toEqual({ sessionCount: 2, present: 2, counted: 4, rate: 50 })
  })

  it('compares the latest three sessions with the preceding three to find attendance trends', () => {
    const sessions = Array.from({ length: 6 }, (_, index) => ({
      date: `2026-11-${String(1 + index * 2).padStart(2, '0')}`,
      playerStatuses: { 1: index < 3 ? 'AJ' : 'P' },
    }))

    expect(getRecentAttendanceTrends(sessions, [{ number: 1, name: 'Joueur' }], '2026-11-15')).toEqual([
      { number: 1, name: 'Joueur', previousRate: 0, latestRate: 100, change: 100 },
    ])
  })
})
