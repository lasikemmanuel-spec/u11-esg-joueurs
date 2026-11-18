import { describe, expect, it } from 'vitest'
import { getCallupTrainingSessions } from '@/lib/callup-training-attendance'
import type { TrainingAttendanceSession } from '@/lib/training-attendance-shared'

describe('callup training attendance', () => {
  it('marks a cancelled training date instead of reusing its saved attendance', () => {
    const sessions: TrainingAttendanceSession[] = [
      { date: '2026-11-13', playerStatuses: { 7: 'P' } },
      {
        date: '2026-11-17',
        playerStatuses: { 7: 'P' },
        cancellation: {
          date: '2026-11-17',
          reason: 'Météo',
          cancelledBy: 'coach',
          cancelledAt: '2026-11-17T12:00:00.000Z',
        },
      },
    ]

    const result = getCallupTrainingSessions(['2026-11-17', '2026-11-13'], sessions)

    expect(result).toEqual([
      {
        targetDate: '2026-11-13',
        date: '2026-11-13',
        playerStatuses: { 7: 'P' },
        sessionAvailable: true,
        isPrevious: false,
        isCancelled: false,
      },
      {
        targetDate: '2026-11-17',
        date: '2026-11-17',
        playerStatuses: undefined,
        sessionAvailable: false,
        isPrevious: false,
        isCancelled: true,
      },
    ])
  })

  it('skips cancelled sessions when finding an earlier attendance record', () => {
    const sessions: TrainingAttendanceSession[] = [
      { date: '2026-11-10', playerStatuses: { 7: 'AJ' } },
      {
        date: '2026-11-17',
        playerStatuses: { 7: 'P' },
        cancellation: {
          date: '2026-11-17',
          reason: 'Météo',
          cancelledBy: 'coach',
          cancelledAt: '2026-11-17T12:00:00.000Z',
        },
      },
    ]

    const [result] = getCallupTrainingSessions(['2026-11-18'], sessions)

    expect(result).toMatchObject({
      targetDate: '2026-11-18',
      date: '2026-11-10',
      playerStatuses: { 7: 'AJ' },
      sessionAvailable: true,
      isPrevious: true,
      isCancelled: false,
    })
  })
})
