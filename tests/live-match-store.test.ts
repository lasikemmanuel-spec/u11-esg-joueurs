import { beforeEach, describe, expect, it, vi } from 'vitest'

const { ensureAuthenticatedSheetTab, getAuthenticatedSheetRows, updateAuthenticatedSheetValues } = vi.hoisted(() => ({
  ensureAuthenticatedSheetTab: vi.fn(),
  getAuthenticatedSheetRows: vi.fn(),
  updateAuthenticatedSheetValues: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/google-sheets', () => ({
  ensureAuthenticatedSheetTab,
  getAuthenticatedSheetRows,
  updateAuthenticatedSheetValues,
}))

import { archiveLiveMatchHistory, finalizeLiveMatch, getSavedLiveMatch } from '@/lib/live-match-store'
import { MATCH_TABS } from '@/lib/match-results'
import type { LiveMatchSession, LiveMatchSummary } from '@/lib/live-match-shared'

function session(): LiveMatchSession {
  return {
    date: '2026-11-14',
    team: 'E1',
    slotColumn: 2,
    phase: 'finished',
    elapsedSeconds: 50 * 60,
    runningSince: null,
    starters: [1],
    substitutes: [],
    events: [],
    completed: false,
  }
}

function matchSheetRows() {
  const rows = Array.from({ length: 14 }, () => Array(8).fill(''))
  rows[2][2] = '14/11/2026'
  rows[10][2] = 'Tit/Rem'
  rows[10][3] = 'MN'
  rows[10][4] = 'BUT'
  rows[10][5] = 'PASSE'
  rows[11][0] = '1'
  rows[11][1] = 'Joueur Un'
  rows[12][0] = '2'
  rows[12][1] = 'Joueur Deux'
  return rows
}

describe('live match sheet persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ensureAuthenticatedSheetTab.mockResolvedValue(undefined)
    updateAuthenticatedSheetValues.mockResolvedValue(undefined)
  })

  it('finds a saved session when the fixture date is French-formatted', async () => {
    const saved = session()
    getAuthenticatedSheetRows.mockResolvedValue({
      sheetTitle: '⚽ Matchs en direct',
      rows: [
        ['Clé du match', 'Date', 'Équipe', 'Colonne', 'Données live'],
        ['2026-11-14-E1-2', saved.date, saved.team, '2', JSON.stringify(saved)],
      ],
    })

    await expect(getSavedLiveMatch({
      date: '14/11/2026',
      team: 'E1',
      slotColumn: 2,
    })).resolves.toEqual(saved)
  })

  it('archives a completed match once with its full session', async () => {
    const historyRows: string[][] = []
    getAuthenticatedSheetRows.mockImplementation(async (tab: string) => ({
      sheetTitle: tab,
      rows: tab === '⚽ Historique feuilles de match' ? historyRows : [],
    }))
    updateAuthenticatedSheetValues.mockImplementation(async (updates: Array<{ range: string; values: string[][] }>) => {
      for (const update of updates) {
        const rowNumber = Number(update.range.match(/!A(\d+):E\d+$/)?.[1])
        if (rowNumber > 0) historyRows[rowNumber - 1] = update.values[0]
      }
    })
    const completed = {
      ...session(),
      startedAt: '2026-11-21T14:00:00.000Z',
      historyStartedAt: '2026-11-21T14:00:00.000Z',
      completed: true,
    }

    await archiveLiveMatchHistory(completed, {
      opponent: 'Adversaire',
      competition: 'Amical',
      homeAway: 'Domicile',
      kickoffTime: '15:00',
    })
    await archiveLiveMatchHistory(completed, {
      opponent: 'Adversaire',
      competition: 'Amical',
      homeAway: 'Domicile',
      kickoffTime: '15:00',
    })

    expect(historyRows).toHaveLength(2)
    expect(historyRows[0]).toEqual([
      'Clé historique',
      'Archivé le',
      'Date',
      'Équipe',
      'Feuille complète',
    ])
    expect(JSON.parse(historyRows[1][4])).toMatchObject({
      session: { completed: true, starters: [1] },
      match: { opponent: 'Adversaire' },
    })
    expect(updateAuthenticatedSheetValues).toHaveBeenCalledTimes(2)
  })

  it('writes score and player statistics to the verified match block', async () => {
    getAuthenticatedSheetRows.mockResolvedValue({
      sheetTitle: MATCH_TABS.E1,
      rows: matchSheetRows(),
    })
    const summary: LiveMatchSummary = {
      goalsFor: 2,
      goalsAgainst: 1,
      elapsedSeconds: 50 * 60,
      players: [
        { number: 1, minutes: 50, goals: 1, assists: 1 },
        { number: 2, minutes: 0, goals: 1, assists: 0 },
      ],
    }

    await finalizeLiveMatch(session(), summary)

    expect(updateAuthenticatedSheetValues).toHaveBeenCalledWith(expect.arrayContaining([
      { range: "'⚽ Feuille de Match Equipe 1'!C6", values: [['Gagné']] },
      { range: "'⚽ Feuille de Match Equipe 1'!C7", values: [['2']] },
      { range: "'⚽ Feuille de Match Equipe 1'!C8", values: [['1']] },
      { range: "'⚽ Feuille de Match Equipe 1'!D12", values: [['50']] },
      { range: "'⚽ Feuille de Match Equipe 1'!E12", values: [['1']] },
      { range: "'⚽ Feuille de Match Equipe 1'!F12", values: [['1']] },
    ]))
  })

  it('writes player statistics to columns even when the sheet headers are reordered', async () => {
    const rows = matchSheetRows()
    rows[10][3] = 'BUT'
    rows[10][4] = 'PASSE'
    rows[10][5] = 'MN'
    getAuthenticatedSheetRows.mockResolvedValue({
      sheetTitle: MATCH_TABS.E1,
      rows,
    })

    await finalizeLiveMatch(session(), {
      goalsFor: 2,
      goalsAgainst: 1,
      elapsedSeconds: 50 * 60,
      players: [{ number: 1, minutes: 50, goals: 1, assists: 1 }],
    })

    expect(updateAuthenticatedSheetValues).toHaveBeenCalledWith(expect.arrayContaining([
      { range: "'⚽ Feuille de Match Equipe 1'!D12", values: [['1']] },
      { range: "'⚽ Feuille de Match Equipe 1'!E12", values: [['1']] },
      { range: "'⚽ Feuille de Match Equipe 1'!F12", values: [['50']] },
    ]))
  })

  it('accepts the Min, Buts, Passes headers used in the match sheet', async () => {
    const rows = matchSheetRows()
    rows[10][3] = 'Min'
    rows[10][4] = 'Buts'
    rows[10][5] = 'Passes'
    getAuthenticatedSheetRows.mockResolvedValue({
      sheetTitle: MATCH_TABS.E1,
      rows,
    })

    await finalizeLiveMatch(session(), {
      goalsFor: 2,
      goalsAgainst: 1,
      elapsedSeconds: 50 * 60,
      players: [{ number: 1, minutes: 50, goals: 1, assists: 1 }],
    })

    expect(updateAuthenticatedSheetValues).toHaveBeenCalledWith(expect.arrayContaining([
      { range: "'⚽ Feuille de Match Equipe 1'!D12", values: [['50']] },
      { range: "'⚽ Feuille de Match Equipe 1'!E12", values: [['1']] },
      { range: "'⚽ Feuille de Match Equipe 1'!F12", values: [['1']] },
    ]))
  })

  it('refuses to write when the match block has unexpected stat headers', async () => {
    const rows = matchSheetRows()
    rows[10][5] = 'Temps'
    getAuthenticatedSheetRows.mockResolvedValue({ sheetTitle: MATCH_TABS.E1, rows })

    await expect(finalizeLiveMatch(session(), {
      goalsFor: 0,
      goalsAgainst: 0,
      elapsedSeconds: 50 * 60,
      players: [{ number: 1, minutes: 50, goals: 0, assists: 0 }],
    })).rejects.toThrow('Min/MN, Buts/BUT et Passes/PASSE')
    expect(updateAuthenticatedSheetValues).not.toHaveBeenCalled()
  })
})
