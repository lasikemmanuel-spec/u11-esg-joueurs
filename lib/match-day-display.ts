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

type PlayedMatchInput = PlannedMatchDateInput & {
  team: 'E1' | 'E2'
  opponent: string
}

type CompletedPlayedMatch = Omit<PlayedMatchInput, 'goalsFor' | 'goalsAgainst'> & {
  goalsFor: number
  goalsAgainst: number
  normalizedDate: string
}

export function getLatestPlayedMatches(matches: PlayedMatchInput[], today: string) {
  const latest: Partial<Record<'E1' | 'E2', CompletedPlayedMatch>> = {}

  for (const match of matches) {
    const date = normalizeMatchDate(match.date)
    if (
      !date ||
      date > today ||
      match.resultLabel === 'Annulé' ||
      match.goalsFor === null ||
      match.goalsAgainst === null
    ) continue

    const current = latest[match.team]
    if (!current || date > current.normalizedDate) {
      latest[match.team] = {
        ...match,
        goalsFor: match.goalsFor,
        goalsAgainst: match.goalsAgainst,
        normalizedDate: date,
      }
    }
  }

  return latest
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
