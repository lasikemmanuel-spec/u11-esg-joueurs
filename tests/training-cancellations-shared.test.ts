import { describe, expect, it } from 'vitest'
import {
  isTrainingCancellationDate,
  isTrainingCancellationReason,
} from '@/lib/training-cancellations-shared'

describe('training cancellation validation', () => {
  it('accepts only real dates within the current season', () => {
    expect(isTrainingCancellationDate('2026-11-17')).toBe(true)
    expect(isTrainingCancellationDate('2026-02-30')).toBe(false)
    expect(isTrainingCancellationDate('2026-08-31')).toBe(false)
  })

  it('requires a non-empty reason of at most 240 characters', () => {
    expect(isTrainingCancellationReason('Météo')).toBe(true)
    expect(isTrainingCancellationReason('   ')).toBe(false)
    expect(isTrainingCancellationReason('x'.repeat(241))).toBe(false)
  })
})
