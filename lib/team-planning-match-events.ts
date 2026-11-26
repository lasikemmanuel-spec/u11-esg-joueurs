import type { MatchSheetEntry } from '@/lib/match-results'
import { normalizeMatchDate } from '@/lib/match-day-display'
import { isValidPlanningDate, type PlanningEvent } from '@/lib/team-planning-shared'

export type PlanningCardEvent = PlanningEvent & {
  source?: 'match-sheet'
  weather?: {
    eventTime: string
    homeAway: string
    opponent: string
    venue?: string
  }
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr-FR')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function isAlreadyInPlanning(
  match: MatchSheetEntry,
  date: string,
  planningEvents: PlanningEvent[],
) {
  const opponent = normalizeText(match.opponent)
  if (!opponent) return false

  return planningEvents.some((event) =>
    event.type === 'match' &&
    event.date === date &&
    (event.team === match.team || event.team === 'both') &&
    ` ${normalizeText(event.title)} `.includes(` ${opponent} `),
  )
}

export function getScheduledMatchPlanningEvents(
  matches: MatchSheetEntry[],
  planningEvents: PlanningEvent[],
  today: string,
): PlanningCardEvent[] {
  return matches.flatMap((match) => {
    const date = normalizeMatchDate(match.date)
    if (
      !isValidPlanningDate(date) ||
      date < today ||
      match.resultLabel ||
      match.goalsFor !== null ||
      match.goalsAgainst !== null ||
      normalizeText(match.competition).includes('entrainement') ||
      isAlreadyInPlanning(match, date, planningEvents)
    ) return []

    return [{
      id: `match-sheet-${match.team}-${match.slotColumn}`,
      date,
      endDate: date,
      type: 'match',
      team: match.team,
      title: match.opponent.trim() ? `Match contre ${match.opponent.trim()}` : 'Match programmé',
      meetingTime: match.meetingTime?.trim() ?? '',
      startTime: match.kickoffTime.trim(),
      endTime: '',
      location: match.venueAddress?.trim() ||
        (match.homeAway === 'Domicile' ? 'Genech' : match.homeAway.trim() || 'Lieu à préciser'),
      notes: match.competition.trim(),
      status: 'confirmed',
      source: 'match-sheet',
      weather: {
        eventTime: match.kickoffTime,
        homeAway: match.homeAway,
        opponent: match.opponent,
        venue: match.venueAddress?.trim() || undefined,
      },
    }]
  })
}
