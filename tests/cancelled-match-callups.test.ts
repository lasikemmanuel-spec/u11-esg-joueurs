import { describe, expect, it } from 'vitest'
import { countCancelledCallupsForPlayer } from '@/lib/cancelled-match-callups'

describe('countCancelledCallupsForPlayer', () => {
  const convocations = [
    {
      number: 7,
      matches: [
        { date: '07/11/2026', team: 'E1', status: 'present' },
        { date: '14/11/2026', team: 'E2', status: 'called' },
        { date: '21/11/2026', team: 'E1', status: 'notCalled' },
      ],
    },
  ]

  it('counts cancelled matches the player was called for, regardless of date format', () => {
    expect(countCancelledCallupsForPlayer(7, convocations, [
      { date: '2026-11-07', team: 'E1', resultLabel: 'Annulé - météo' },
      { date: '14/11/2026', team: 'E2', resultLabel: 'Annulé' },
    ])).toBe(2)
  })

  it('does not count non-cancelled games, other teams, or games the player was not called for', () => {
    expect(countCancelledCallupsForPlayer(7, convocations, [
      { date: '07/11/2026', team: 'E2', resultLabel: 'Annulé' },
      { date: '21/11/2026', team: 'E1', resultLabel: 'Annulé' },
      { date: '14/11/2026', team: 'E2', resultLabel: 'Gagné' },
    ])).toBe(0)
  })

  it('counts one cancelled fixture once if duplicate entries exist', () => {
    const cancelled = { date: '07/11/2026', team: 'E1' as const, resultLabel: 'Annulé' }
    expect(countCancelledCallupsForPlayer(7, convocations, [cancelled, cancelled])).toBe(1)
  })

  it('matches a team-less presence only when a single team was cancelled that day', () => {
    const playerWithNoTeam = [{
      number: 8,
      matches: [{ date: '07/11/2026', team: null, status: 'present' }],
    }]
    expect(countCancelledCallupsForPlayer(8, playerWithNoTeam, [
      { date: '07/11/2026', team: 'E1', resultLabel: 'Annulé' },
    ])).toBe(1)
    expect(countCancelledCallupsForPlayer(8, playerWithNoTeam, [
      { date: '07/11/2026', team: 'E1', resultLabel: 'Annulé' },
      { date: '07/11/2026', team: 'E2', resultLabel: 'Annulé' },
    ])).toBe(0)
  })
})
