import { describe, expect, it } from 'vitest'
import { findClosestWeatherHour } from '@/lib/weather-forecast'

describe('findClosestWeatherHour', () => {
  const hours = [
    '2026-11-26T17:00',
    '2026-11-26T18:00',
    '2026-11-26T19:00',
    '2026-11-27T18:00',
  ]

  it('finds the forecast for the event hour', () => {
    expect(findClosestWeatherHour(hours, '2026-11-26', '18:00')).toBe(1)
  })

  it('uses the nearest forecast hour when the event starts between hours', () => {
    expect(findClosestWeatherHour(hours, '2026-11-26', '18:40')).toBe(2)
    expect(findClosestWeatherHour(hours, '2026-11-26', '18:30')).toBe(1)
  })

  it('returns no forecast when the date or event time is invalid', () => {
    expect(findClosestWeatherHour(hours, '2026-11-25', '18:00')).toBe(-1)
    expect(findClosestWeatherHour(hours, '2026-11-26', '')).toBe(-1)
  })
})
