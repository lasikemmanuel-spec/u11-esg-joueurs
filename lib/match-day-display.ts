export function getDefaultExpandedMatchDate(
  dates: string[],
  today: string,
  plannedDates: string[] = dates,
  displayedMonth = today.slice(0, 7),
) {
  if (displayedMonth < today.slice(0, 7)) return null

  const upcomingPlanned = plannedDates.filter((date) => date >= today).sort()
  if (upcomingPlanned.length > 0) return upcomingPlanned[0]

  return dates.filter((date) => date < today).sort().at(-1) ?? null
}
