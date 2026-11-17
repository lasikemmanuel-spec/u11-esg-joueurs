import { normalizeMatchDate } from '@/lib/match-day-display'
import { isCountedTrainingStatus } from '@/lib/training-attendance-metrics'
import type { Convocation } from '@/lib/convocations'
import type { MatchSheetEntry } from '@/lib/match-results'
import type { TrainingAttendanceSession } from '@/lib/training-attendance-shared'

export type WeekRange = { start: string; end: string }

export function getWeekRange(date: string): WeekRange | null {
  const normalizedDate = normalizeMatchDate(date)
  if (!normalizedDate) return null

  const current = new Date(`${normalizedDate}T12:00:00Z`)
  if (Number.isNaN(current.getTime())) return null

  const daysSinceMonday = (current.getUTCDay() + 6) % 7
  current.setUTCDate(current.getUTCDate() - daysSinceMonday)
  const start = current.toISOString().slice(0, 10)
  current.setUTCDate(current.getUTCDate() + 6)
  return { start, end: current.toISOString().slice(0, 10) }
}

export function getUpcomingMatchesForWeek(matches: MatchSheetEntry[], today: string) {
  const normalizedToday = normalizeMatchDate(today)
  const week = getWeekRange(normalizedToday)
  if (!normalizedToday || !week) return []

  return matches
    .filter((match) => {
      const date = normalizeMatchDate(match.date)
      return date >= normalizedToday &&
        date <= week.end &&
        match.resultLabel !== 'Annulé' &&
        !match.resultLabel &&
        match.goalsFor === null &&
        match.goalsAgainst === null
    })
    .sort((a, b) => normalizeMatchDate(a.date).localeCompare(normalizeMatchDate(b.date)))
}

export function getMatchCallupCount(
  convocations: Convocation[],
  match: Pick<MatchSheetEntry, 'date' | 'team'>,
) {
  const date = normalizeMatchDate(match.date)
  if (!date) return 0

  return convocations.filter((player) =>
    player.matches.some((entry) =>
      normalizeMatchDate(entry.date) === date &&
      (entry.team === match.team || entry.team === 'E1+E2') &&
      ['called', 'calledAbsent', 'present'].includes(entry.status),
    ),
  ).length
}

export function getWeeklyTrainingSummary(
  sessions: TrainingAttendanceSession[],
  playerNumbers: number[],
  week: WeekRange,
  today: string,
) {
  const normalizedToday = normalizeMatchDate(today)
  const weekSessions = sessions.filter((session) => {
    const date = normalizeMatchDate(session.date)
    return date >= week.start && date <= week.end && date <= normalizedToday
  })

  let present = 0
  let counted = 0
  for (const session of weekSessions) {
    for (const number of playerNumbers) {
      const status = session.playerStatuses[number]?.trim() ?? ''
      if (!isCountedTrainingStatus(status)) continue
      counted += 1
      if (status === 'P') present += 1
    }
  }

  return {
    sessionCount: weekSessions.length,
    present,
    counted,
    rate: counted === 0 ? null : Math.round((present / counted) * 100),
  }
}

export function getRecentAttendanceTrends(
  sessions: TrainingAttendanceSession[],
  players: Array<{ number: number; name: string }>,
  today: string,
) {
  const recentSessions = sessions
    .filter((session) => {
      const date = normalizeMatchDate(session.date)
      return date !== '' && date <= today
    })
    .sort((a, b) => normalizeMatchDate(a.date).localeCompare(normalizeMatchDate(b.date)))
    .slice(-6)
  if (recentSessions.length < 6) return []

  const previous = recentSessions.slice(0, -3)
  const latest = recentSessions.slice(-3)
  return players.flatMap((player) => {
    const rate = (period: TrainingAttendanceSession[]) => {
      let presents = 0
      let counted = 0
      for (const session of period) {
        const status = session.playerStatuses[player.number]?.trim() ?? ''
        if (!isCountedTrainingStatus(status)) continue
        counted += 1
        if (status === 'P') presents += 1
      }
      return counted === 0 ? null : Math.round((presents / counted) * 100)
    }

    const previousRate = rate(previous)
    const latestRate = rate(latest)
    if (previousRate === null || latestRate === null || previousRate === latestRate) return []
    return [{ ...player, previousRate, latestRate, change: latestRate - previousRate }]
  }).sort((a, b) => Math.abs(b.change) - Math.abs(a.change)).slice(0, 4)
}

