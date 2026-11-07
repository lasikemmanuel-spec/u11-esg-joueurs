export function getDefaultExpandedMatchDate(dates: string[], today: string) {
  const upcoming = dates.filter((date) => date >= today).sort()
  if (upcoming.length > 0) return upcoming[0]
  return dates.filter((date) => date < today).sort().at(-1) ?? null
}
