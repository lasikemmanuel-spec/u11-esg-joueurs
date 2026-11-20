import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  ensureAuthenticatedSheetColumnCount,
  getAuthenticatedSheetRows,
  updateAuthenticatedSheetValues,
} = vi.hoisted(() => ({
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

import { saveTrainingAttendance } from '@/lib/training-attendance'

function attendanceRows() {
  return [
    ['', '', '', '', '', ''],
    ['', 'Numéro', 'Séance 3 (10/11/2026)', 'Séance 4 (13/11/2026)', 'Séance 5', 'Séance 6'],
    ['', '7', '', '', '', ''],
    ['', '8', '', '', '', ''],
  ]
}

describe('saveTrainingAttendance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ensureAuthenticatedSheetColumnCount.mockResolvedValue(undefined)
    updateAuthenticatedSheetValues.mockResolvedValue(undefined)
    getAuthenticatedSheetRows.mockResolvedValue({
      sheetTitle: '📅 Présences Entraînement',
      rows: attendanceRows(),
    })
  })

  it('uses the first empty numbered session column', async () => {
    await saveTrainingAttendance('2026-11-20', [{ number: 7, status: 'P' }])

    expect(updateAuthenticatedSheetValues).toHaveBeenCalledWith([
      { range: "'📅 Présences Entraînement'!E2", values: [['Séance 5 (20/11/2026)']] },
      { range: "'📅 Présences Entraînement'!E3", values: [['P']] },
    ])
    expect(ensureAuthenticatedSheetColumnCount).toHaveBeenCalledWith('📅 Présences Entraînement', 5)
  })

  it('does not reuse a numbered session column that already has attendance', async () => {
    const rows = attendanceRows()
    rows[3][4] = 'AJ'
    getAuthenticatedSheetRows.mockResolvedValue({
      sheetTitle: '📅 Présences Entraînement',
      rows,
    })

    await saveTrainingAttendance('2026-11-20', [{ number: 7, status: 'P' }])

    expect(updateAuthenticatedSheetValues).toHaveBeenCalledWith([
      { range: "'📅 Présences Entraînement'!F2", values: [['Séance 6 (20/11/2026)']] },
      { range: "'📅 Présences Entraînement'!F3", values: [['P']] },
    ])
  })

  it('updates the existing column when the date is already present', async () => {
    const rows = attendanceRows()
    rows[1][4] = 'Séance (20/11/2026)'
    getAuthenticatedSheetRows.mockResolvedValue({
      sheetTitle: '📅 Présences Entraînement',
      rows,
    })

    await saveTrainingAttendance('2026-11-20', [{ number: 7, status: 'AJ' }])

    expect(updateAuthenticatedSheetValues).toHaveBeenCalledWith([
      { range: "'📅 Présences Entraînement'!E2", values: [['Séance 5 (20/11/2026)']] },
      { range: "'📅 Présences Entraînement'!E3", values: [['AJ']] },
    ])
  })

  it('moves an already-saved date back into the first empty numbered session column', async () => {
    const rows = attendanceRows()
    rows[1][6] = 'Séance (20/11/2026)'
    rows[2][6] = 'AJ'
    rows[3][6] = 'P'
    getAuthenticatedSheetRows.mockResolvedValue({
      sheetTitle: '📅 Présences Entraînement',
      rows,
    })

    await saveTrainingAttendance('2026-11-20', [{ number: 7, status: 'P' }])

    const updates = updateAuthenticatedSheetValues.mock.calls[0][0]
    expect(updates).toContainEqual({
      range: "'📅 Présences Entraînement'!E2",
      values: [['Séance 5 (20/11/2026)']],
    })
    expect(updates).toContainEqual({ range: "'📅 Présences Entraînement'!E3", values: [['P']] })
    expect(updates).toContainEqual({ range: "'📅 Présences Entraînement'!E4", values: [['P']] })
    expect(updates).toContainEqual({ range: "'📅 Présences Entraînement'!G2", values: [['']] })
    expect(updates).toContainEqual({ range: "'📅 Présences Entraînement'!G3", values: [['']] })
    expect(updates).toContainEqual({ range: "'📅 Présences Entraînement'!G4", values: [['']] })
  })
})
