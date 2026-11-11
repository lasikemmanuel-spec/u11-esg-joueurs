type CancelledMatchEntry = {
  date: string
  team: 'E1' | 'E2'
  resultLabel: string
}

type PlayerMatchCallup = {
  date: string
  team: string | null
  status: string
}

type PlayerCallupHistory = {
  number: number
  matches: PlayerMatchCallup[]
}

function dateKey(value: string) {
  const date = value.trim()
  const iso = date.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`

  const dayFirst = date.match(/^(\d{1,2})[/. -](\d{1,2})[/. -](\d{4})$/)
  if (dayFirst) return `${dayFirst[3]}-${dayFirst[2].padStart(2, '0')}-${dayFirst[1].padStart(2, '0')}`
  return date.toLocaleLowerCase('fr-FR')
}

export function countCancelledCallupsForPlayer(
  playerNumber: number,
  convocations: PlayerCallupHistory[],
  entries: CancelledMatchEntry[],
) {
  const callup = convocations.find((player) => player.number === playerNumber)
  if (!callup) return 0

  const calledStatuses = new Set(['called', 'calledAbsent', 'present'])
  const cancelledMatches = new Set<string>()

  for (const entry of entries) {
    if (!entry.resultLabel.toLocaleLowerCase('fr-FR').includes('annul')) continue
    const entryDate = dateKey(entry.date)
    if (!entryDate) continue
    const key = `${entryDate}:${entry.team}`
    if (cancelledMatches.has(key)) continue
    const cancelledTeamsOnDate = new Set(
      entries
        .filter((match) =>
          dateKey(match.date) === entryDate &&
          match.resultLabel.toLocaleLowerCase('fr-FR').includes('annul'),
        )
        .map((match) => match.team),
    )
    const wasCalled = callup.matches.some((match) =>
      dateKey(match.date) === entryDate &&
      (match.team === entry.team || match.team === 'E1+E2' || (!match.team && cancelledTeamsOnDate.size === 1)) &&
      calledStatuses.has(match.status),
    )
    if (wasCalled) cancelledMatches.add(key)
  }

  return cancelledMatches.size
}
