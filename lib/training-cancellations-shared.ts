import { MATCH_SEASON_END, MATCH_SEASON_START } from '@/lib/match-season'

export type TrainingCancellation = {
  date: string
  reason: string
  cancelledBy: string
  cancelledAt: string
}

export function isTrainingCancellationDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value &&
    value >= MATCH_SEASON_START &&
    value <= MATCH_SEASON_END
}

export function isTrainingCancellationReason(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 240
}
