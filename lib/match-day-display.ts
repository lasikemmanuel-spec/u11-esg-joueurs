export function normalizeMatchDate(value: string) {
  const iso = value.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`

  const dayFirst = value.trim().match(/^(\d{1,2})[/. -](\d{1,2})[/. -](\d{4})$/)
  if (dayFirst) return `${dayFirst[3]}-${dayFirst[2].padStart(2, '0')}-${dayFirst[1].padStart(2, '0')}`
  return ''
}

type PlannedMatchDateInput = {
  date: string
  resultLabel: string
  goalsFor: number | null
  goalsAgainst: number | null
}

export function getNextPlannedMatchDate(matches: PlannedMatchDateInput[], today: string) {
  return matches
    .filter((match) =>
      normalizeMatchDate(match.date) >= today &&
      !match.resultLabel &&
      match.goalsFor === null &&
      match.goalsAgainst === null,
    )
    .map((match) => normalizeMatchDate(match.date))
    .filter(Boolean)
    .sort()[0] ?? null
}
