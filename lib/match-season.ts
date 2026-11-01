export const MATCH_SEASON_START = '2026-09-01'
export const MATCH_SEASON_END = '2027-06-30'

export const MATCH_SEASON_MONTHS = Array.from({ length: 10 }, (_, index) => {
  const date = new Date(Date.UTC(2026, 8 + index, 1))
  const value = date.toISOString().slice(0, 7)
  const label = date.toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })

  return { value, label: label.charAt(0).toLocaleUpperCase('fr-FR') + label.slice(1) }
})

export function clampToMatchSeason(date: string) {
  if (date < MATCH_SEASON_START) return MATCH_SEASON_START
  if (date > MATCH_SEASON_END) return MATCH_SEASON_END
  return date
}
