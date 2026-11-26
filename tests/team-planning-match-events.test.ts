import { describe, expect, it } from 'vitest'
import type { MatchSheetEntry } from '@/lib/match-results'
import type { PlanningEvent } from '@/lib/team-planning-shared'
import { getScheduledMatchPlanningEvents } from '@/lib/team-planning-match-events'

function match(overrides: Partial<MatchSheetEntry> = {}): MatchSheetEntry {
  return {
    team: 'E1',
    slotColumn: 2,
    date: '29/11/2026',
    opponent: 'FC Lille',
    competition: 'Championnat',
    homeAway: 'Extérieur',
    kickoffTime: '10:00',
    meetingTime: '09:15',
    venueAddress: 'Stade municipal, Lille',
    resultLabel: '',
    goalsFor: null,
    goalsAgainst: null,
    ...overrides,
  }
}

function planningEvent(overrides: Partial<PlanningEvent> = {}): PlanningEvent {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    date: '2026-11-29',
    type: 'match',
    team: 'E1',
    title: 'Match contre FC Lille',
    meetingTime: '',
    startTime: '10:00',
    endTime: '11:30',
    location: 'Stade municipal, Lille',
    notes: '',
    status: 'confirmed',
    ...overrides,
  }
}

describe('getScheduledMatchPlanningEvents', () => {
  it('converts future unplayed match entries into planning cards', () => {
    expect(getScheduledMatchPlanningEvents([match()], [], '2026-11-26')).toEqual([{
      id: 'match-sheet-E1-2',
      date: '2026-11-29',
      type: 'match',
      team: 'E1',
      title: 'Match contre FC Lille',
      meetingTime: '09:15',
      startTime: '10:00',
      endTime: '',
      location: 'Stade municipal, Lille',
      notes: 'Championnat',
      status: 'confirmed',
      source: 'match-sheet',
    }])
  })

  it('excludes past, completed, cancelled, training, and already-entered matches', () => {
    const matches = [
      match(),
      match({ slotColumn: 6, opponent: 'FC Lens' }),
      match({ slotColumn: 10, date: '2026-11-22' }),
      match({ slotColumn: 14, resultLabel: 'Annulé' }),
      match({ slotColumn: 18, goalsFor: 2, goalsAgainst: 1 }),
      match({ slotColumn: 22, competition: 'Entraînement' }),
    ]

    expect(getScheduledMatchPlanningEvents(matches, [planningEvent()], '2026-11-26'))
      .toMatchObject([{ id: 'match-sheet-E1-6', title: 'Match contre FC Lens' }])
  })
})
