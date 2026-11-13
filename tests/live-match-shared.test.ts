import { describe, expect, it } from 'vitest'
import {
  areLiveSessionsEqual,
  calculateLiveMatchSummary,
  createLiveMatchSession,
  formatLiveMinute,
  getLiveMinute,
} from '@/lib/live-match-shared'

function session() {
  return createLiveMatchSession({
    date: '2026-11-14',
    team: 'E1',
    slotColumn: 2,
    starters: [1, 2, 3, 4, 5, 6, 7, 8],
    substitutes: [9, 10],
  })
}

describe('live match calculations', () => {
  it('counts goals, assists, and playing time through repeated substitutions', () => {
    const match = session()
    match.phase = 'finished'
    match.elapsedSeconds = 50 * 60
    match.events = [
      { id: 'goal', kind: 'goal', side: 'for', minute: 5, scorerNumber: 1, assistNumber: 2 },
      { id: 'against', kind: 'goal', side: 'against', minute: 8 },
      { id: 'sub-1', kind: 'substitution', minute: 10, playerOut: 1, playerIn: 9 },
      { id: 'sub-2', kind: 'substitution', minute: 20, playerOut: 9, playerIn: 1 },
      { id: 'sub-3', kind: 'substitution', minute: 30, playerOut: 1, playerIn: 10 },
      { id: 'sub-4', kind: 'substitution', minute: 40, playerOut: 10, playerIn: 1 },
    ]

    expect(calculateLiveMatchSummary(match)).toMatchObject({
      goalsFor: 1,
      goalsAgainst: 1,
      players: expect.arrayContaining([
        { number: 1, minutes: 30, goals: 1, assists: 0 },
        { number: 2, minutes: 50, goals: 0, assists: 1 },
        { number: 9, minutes: 10, goals: 0, assists: 0 },
        { number: 10, minutes: 10, goals: 0, assists: 0 },
      ]),
    })
  })

  it('starts second-half event minutes at 1+25', () => {
    const match = session()
    match.phase = 'secondHalf'
    match.elapsedSeconds = 25 * 60

    expect(getLiveMinute(match)).toBe(26)
    expect(formatLiveMinute(getLiveMinute(match))).toBe('1+25′')
    match.elapsedSeconds = 26 * 60
    expect(getLiveMinute(match)).toBe(27)
    expect(formatLiveMinute(getLiveMinute(match))).toBe('2+25′')
  })

  it('calculates playing time correctly for substitutions in the second half', () => {
    const match = session()
    match.phase = 'finished'
    match.elapsedSeconds = 50 * 60
    match.events = [
      { id: 'sub-out', kind: 'substitution', minute: 26, playerOut: 1, playerIn: 9 },
      { id: 'sub-in', kind: 'substitution', minute: 27, playerOut: 9, playerIn: 1 },
    ]

    expect(calculateLiveMatchSummary(match).players).toEqual(expect.arrayContaining([
      { number: 1, minutes: 49, goals: 0, assists: 0 },
      { number: 9, minutes: 1, goals: 0, assists: 0 },
    ]))
  })

  it('rejects substitutions involving a player who is not on the pitch', () => {
    const match = session()
    match.elapsedSeconds = 50 * 60
    match.events = [
      { id: 'sub-1', kind: 'substitution', minute: 10, playerOut: 9, playerIn: 1 },
    ]

    expect(() => calculateLiveMatchSummary(match)).toThrow('Remplacement invalide')
  })

  it('correctly compares two live sessions for polling reconciliation', () => {
    const s1 = session()
    const s2 = session()
    expect(areLiveSessionsEqual(s1, s2)).toBe(true)

    s2.elapsedSeconds = 10
    expect(areLiveSessionsEqual(s1, s2)).toBe(false)

    s1.elapsedSeconds = 10
    expect(areLiveSessionsEqual(s1, s2)).toBe(true)

    s1.events.push({ id: 'g1', kind: 'goal', side: 'for', minute: 4, scorerNumber: 9 })
    expect(areLiveSessionsEqual(s1, s2)).toBe(false)

    s2.events.push({ id: 'g1', kind: 'goal', side: 'for', minute: 4, scorerNumber: 9 })
    expect(areLiveSessionsEqual(s1, s2)).toBe(true)
  })
})
