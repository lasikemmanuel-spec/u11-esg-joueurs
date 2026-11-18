import type { TrainingAttendanceSession } from '@/lib/training-attendance-shared'

export type CallupTrainingSession = {
  targetDate: string
  date: string
  playerStatuses?: Record<number, string>
  sessionAvailable: boolean
  isPrevious: boolean
  isCancelled: boolean
}

export function getCallupTrainingSessions(
  targetDates: string[],
  sessions: TrainingAttendanceSession[],
): CallupTrainingSession[] {
  const sortedSessions = [...sessions].sort((a, b) => a.date.localeCompare(b.date))
  const selectedSessions = new Map<string, TrainingAttendanceSession>()
  const usedSessionDates = new Set<string>()

  for (const targetDate of [...targetDates].sort((a, b) => b.localeCompare(a))) {
    const cancellation = sortedSessions.find(
      (session) => session.date === targetDate && session.cancellation,
    )
    if (cancellation) {
      selectedSessions.set(targetDate, cancellation)
      usedSessionDates.add(cancellation.date)
      continue
    }

    const session = [...sortedSessions].reverse().find(
      (attendance) =>
        attendance.date <= targetDate &&
        !attendance.cancellation &&
        !usedSessionDates.has(attendance.date),
    )
    if (session) {
      selectedSessions.set(targetDate, session)
      usedSessionDates.add(session.date)
    }
  }

  return targetDates
    .map((targetDate) => {
      const session = selectedSessions.get(targetDate)
      const isCancelled = Boolean(session?.cancellation)
      return {
        targetDate,
        date: session?.date ?? targetDate,
        playerStatuses: isCancelled ? undefined : session?.playerStatuses,
        sessionAvailable: Boolean(session) && !isCancelled,
        isPrevious: Boolean(session && !isCancelled && session.date !== targetDate),
        isCancelled,
      }
    })
    .sort((a, b) => a.targetDate.localeCompare(b.targetDate))
}
