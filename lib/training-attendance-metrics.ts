import type { TrainingAttendanceSession } from '@/lib/training-attendance-shared'

export type CountedTrainingStatus = 'P' | 'AJ' | 'AI'

export function isCountedTrainingStatus(status: string): status is CountedTrainingStatus {
  return status === 'P' || status === 'AJ' || status === 'AI'
}

export function calculateTrainingAttendanceRate(presents: number, countedSessions: number): number | null {
  if (countedSessions <= 0) return null
  return Math.round((presents / countedSessions) * 100)
}

export function getTrainingAttendanceCounts(
  sessions: TrainingAttendanceSession[],
  playerNumber: number,
): { presents: number; countedSessions: number } {
  let presents = 0
  let countedSessions = 0

  for (const session of sessions) {
    const status = session.playerStatuses[playerNumber]?.trim() ?? ''
    if (!isCountedTrainingStatus(status)) continue
    countedSessions += 1
    if (status === 'P') presents += 1
  }

  return { presents, countedSessions }
}
