import { describe, expect, it } from 'vitest'
import {
  calculateTrainingAttendanceRate,
  getTrainingAttendanceCounts,
} from '@/lib/training-attendance-metrics'
import type { TrainingAttendanceSession } from '@/lib/training-attendance-shared'

describe('training attendance metrics', () => {
  it('excludes injured and exempt sessions from the attendance rate', () => {
    const sessions: TrainingAttendanceSession[] = [
      { date: '2026-11-01', playerStatuses: { 1: 'P' } },
      { date: '2026-11-02', playerStatuses: { 1: 'P' } },
      { date: '2026-11-03', playerStatuses: { 1: 'P' } },
      { date: '2026-11-04', playerStatuses: { 1: 'AJ' } },
      { date: '2026-11-05', playerStatuses: { 1: 'AI' } },
      { date: '2026-11-06', playerStatuses: { 1: 'B' } },
      { date: '2026-11-07', playerStatuses: { 1: 'E' } },
      { date: '2026-11-08', playerStatuses: { 1: 'AJ' } },
      { date: '2026-11-09', playerStatuses: { 1: 'AI' } },
      { date: '2026-11-10', playerStatuses: { 1: 'AJ' } },
      { date: '2026-11-11', playerStatuses: { 1: 'AI' } },
      { date: '2026-11-12', playerStatuses: { 1: 'AJ' } },
      { date: '2026-11-13', playerStatuses: { 1: 'AI' } },
      { date: '2026-11-14', playerStatuses: { 1: 'AJ' } },
      { date: '2026-11-15', playerStatuses: { 1: 'B' } },
      { date: '2026-11-16', playerStatuses: { 1: 'E' } },
      { date: '2026-11-17', playerStatuses: { 1: '' } },
    ]

    const counts = getTrainingAttendanceCounts(sessions, 1)

    expect(counts).toEqual({ presents: 3, countedSessions: 12 })
    expect(calculateTrainingAttendanceRate(counts.presents, counts.countedSessions)).toBe(25)
  })

  it('returns no rate when all recorded sessions are excused', () => {
    const sessions: TrainingAttendanceSession[] = [
      { date: '2026-11-01', playerStatuses: { 1: 'B' } },
      { date: '2026-11-02', playerStatuses: { 1: 'E' } },
    ]
    const counts = getTrainingAttendanceCounts(sessions, 1)

    expect(counts).toEqual({ presents: 0, countedSessions: 0 })
    expect(calculateTrainingAttendanceRate(counts.presents, counts.countedSessions)).toBeNull()
  })
})
