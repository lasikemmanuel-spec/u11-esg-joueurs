import { beforeEach, describe, expect, it, vi } from 'vitest'

const { ensureAuthenticatedSheetColumnCount, getAuthenticatedSheetRows, updateAuthenticatedSheetValues } = vi.hoisted(() => ({
  ensureAuthenticatedSheetColumnCount: vi.fn(),
  getAuthenticatedSheetRows: vi.fn(),
  updateAuthenticatedSheetValues: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/google-sheets', () => ({
  ensureAuthenticatedSheetColumnCount,
  getAuthenticatedSheetRows,
  updateAuthenticatedSheetValues,
}))

import { deleteMatchDay, deleteMatchResult, getMatchResults, MATCH_TABS, writeMatchResult } from '@/lib/match-results'

function sheetRows(entries: Array<{ column: number; date: string; opponent: string }>) {
  const rows = Array.from({ length: 10 }, () => Array(40).fill(''))
  rows[1][0] = ''
  rows[1][1] = ''
  rows[2][1] = ''
  for (const { column, date, opponent } of entries) {
    rows[1][column] = opponent
    rows[2][column] = date
    rows[3][column] = 'Championnat'
  }
  rows[8][0] = '1'
  rows[8][1] = 'Joueur'
  rows[8][2] = 'Titulaire'
  rows[9][0] = '2'
  rows[9][1] = 'Joueuse'
  rows[9][2] = 'Remplaçant'
  return rows
}

describe('match deletion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ensureAuthenticatedSheetColumnCount.mockResolvedValue(undefined)
    updateAuthenticatedSheetValues.mockResolvedValue(undefined)
  })

  it('stores match time alongside venue and exposes it separately when reading', async () => {
    const rows = sheetRows([{ column: 2, date: '14/11/2026', opponent: 'Club' }])
    rows[4][2] = 'Domicile · 10:30'
    getAuthenticatedSheetRows
      .mockResolvedValueOnce({ sheetTitle: MATCH_TABS.E1, rows })
      .mockResolvedValueOnce({
        sheetTitle: MATCH_TABS.E2,
        rows: sheetRows([{ column: 2, date: '14/11/2026', opponent: 'Autre club' }]),
      })

    const results = await getMatchResults()
    expect(results.entries.find((entry) => entry.team === 'E1' && entry.slotColumn === 2)).toMatchObject({
      homeAway: 'Domicile',
      kickoffTime: '10:30',
    })
    expect(results.E1).toEqual([])

    getAuthenticatedSheetRows.mockResolvedValue({
      sheetTitle: MATCH_TABS.E1,
      rows: sheetRows([{ column: 2, date: '21/11/2026', opponent: 'Club existant' }]),
    })
    await writeMatchResult({
      team: 'E1',
      date: '2026-11-14',
      opponent: 'Nouveau club',
      competition: 'Championnat',
      homeAway: 'Domicile',
      kickoffTime: '10:30',
      resultLabel: '',
      goalsFor: null,
      goalsAgainst: null,
    })
    expect(updateAuthenticatedSheetValues.mock.calls[0][0]).toContainEqual({
      range: "'⚽ Feuille de Match Equipe 1'!G5",
      values: [['Domicile · 10:30']],
    })
  })

  it('clears match data and player roles from one slot', async () => {
    getAuthenticatedSheetRows.mockResolvedValue({
      sheetTitle: MATCH_TABS.E1,
      rows: sheetRows([{ column: 2, date: '14/11/2026', opponent: 'Club' }]),
    })

    await expect(deleteMatchResult({
      team: 'E1',
      date: '2026-11-14',
      slotColumn: 2,
    })).resolves.toMatchObject({ deletedMatches: 1 })

    const updates = updateAuthenticatedSheetValues.mock.calls[0][0]
    expect(updates).toContainEqual({ range: "'⚽ Feuille de Match Equipe 1'!C2", values: [['Adversaire']] })
    expect(updates).toContainEqual({ range: "'⚽ Feuille de Match Equipe 1'!C3", values: [['']] })
    expect(updates).toContainEqual({ range: "'⚽ Feuille de Match Equipe 1'!C9", values: [['']] })
    expect(updates).toContainEqual({ range: "'⚽ Feuille de Match Equipe 1'!C10", values: [['']] })
  })

  it('deletes all matches in a day from both teams without clearing other dates', async () => {
    getAuthenticatedSheetRows
      .mockResolvedValueOnce({
        sheetTitle: MATCH_TABS.E1,
        rows: sheetRows([
          { column: 2, date: '14/11/2026', opponent: 'Club A' },
          { column: 6, date: '14/11/2026', opponent: 'Club B' },
        ]),
      })
      .mockResolvedValueOnce({
        sheetTitle: MATCH_TABS.E2,
        rows: sheetRows([
          { column: 2, date: '14/11/2026', opponent: 'Club C' },
          { column: 6, date: '21/11/2026', opponent: 'Club D' },
        ]),
      })

    await expect(deleteMatchDay('2026-11-14')).resolves.toEqual({ deletedMatches: 3 })

    const updates = updateAuthenticatedSheetValues.mock.calls[0][0] as Array<{
      range: string
      values: string[][]
    }>
    expect(updates).toContainEqual({ range: "'⚽ Feuille de Match Equipe 1'!C3", values: [['']] })
    expect(updates).toContainEqual({ range: "'⚽ Feuille de Match Equipe 1'!G3", values: [['']] })
    expect(updates).toContainEqual({ range: "'⚽ Feuille de Match Equipe 2'!C3", values: [['']] })
    expect(updates.some((update) => update.range === "'⚽ Feuille de Match Equipe 2'!G3")).toBe(false)
  })

  it('does not write when the requested match no longer occupies its slot', async () => {
    getAuthenticatedSheetRows.mockResolvedValue({
      sheetTitle: MATCH_TABS.E1,
      rows: sheetRows([{ column: 2, date: '21/11/2026', opponent: 'Club' }]),
    })

    await expect(deleteMatchResult({
      team: 'E1',
      date: '2026-11-14',
      slotColumn: 2,
    })).rejects.toThrow('Le match a changé')
    expect(updateAuthenticatedSheetValues).not.toHaveBeenCalled()
  })

  it('does not delete a match that already has a result', async () => {
    const rows = sheetRows([{ column: 2, date: '14/11/2026', opponent: 'Club' }])
    rows[5][2] = 'Gagné'
    getAuthenticatedSheetRows.mockResolvedValue({
      sheetTitle: MATCH_TABS.E1,
      rows,
    })

    await expect(deleteMatchResult({
      team: 'E1',
      date: '2026-11-14',
      slotColumn: 2,
    })).rejects.toThrow('n’est plus en planification')
    expect(updateAuthenticatedSheetValues).not.toHaveBeenCalled()
  })
})
