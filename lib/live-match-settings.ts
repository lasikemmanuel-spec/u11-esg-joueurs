import type { LiveMatchFormat } from '@/lib/live-match-shared'

export type LiveMatchPreset = LiveMatchFormat & {
  id: 'format1' | 'format2' | 'format3'
}

export type LiveMatchSettings = {
  formats: [LiveMatchPreset, LiveMatchPreset, LiveMatchPreset]
}

export const DEFAULT_LIVE_MATCH_SETTINGS: LiveMatchSettings = {
  formats: [
    { id: 'format1', periods: 2, minutesPerPeriod: 25 },
    { id: 'format2', periods: 3, minutesPerPeriod: 20 },
    { id: 'format3', periods: 2, minutesPerPeriod: 30 },
  ],
}

export function isLiveMatchSettings(value: unknown): value is LiveMatchSettings {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const formats = (value as Record<string, unknown>).formats
  if (!Array.isArray(formats) || formats.length !== 3) return false
  const expectedIds = ['format1', 'format2', 'format3']
  return formats.every((format, index) => {
    if (typeof format !== 'object' || format === null || Array.isArray(format)) return false
    const item = format as Record<string, unknown>
    return item.id === expectedIds[index] &&
      (item.periods === 2 || item.periods === 3) &&
      typeof item.minutesPerPeriod === 'number' &&
      Number.isSafeInteger(item.minutesPerPeriod) &&
      item.minutesPerPeriod >= 1 &&
      item.minutesPerPeriod <= 60
  })
}

export function getLiveMatchFormatLabel(format: LiveMatchFormat) {
  return `${format.periods} × ${format.minutesPerPeriod} min`
}
