import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PlanningEvent, PlanningEventFields } from '@/lib/team-planning-shared'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/google-sheets', () => ({
  ensureAuthenticatedSheetTab: vi.fn(),
  getAuthenticatedSheetRows: vi.fn(),
  updateAuthenticatedSheetValues: vi.fn(),
}))

import { getAuthenticatedSheetRows, updateAuthenticatedSheetValues } from '@/lib/google-sheets'
import { getTeamPlanningEvents, saveTeamPlanningEvents, updateTeamPlanningSeries } from '@/lib/team-planning'

const headers = [
  'ID',
  'Date',
  'Type',
  'Équipe',
  'Titre',
  'Heure de rendez-vous',
  'Début',
  'Fin',
  'Lieu',
  'Consignes',
  'Statut',
  'Identifiant de série',
  'Fin de récurrence',
]
const fields: PlanningEventFields = {
  date: '2026-11-24',
  type: 'training',
  team: 'both',
  title: 'Entraînement',
  meetingTime: '',
  startTime: '18:00',
  endTime: '19:30',
  location: 'Stade',
  notes: '',
  status: 'confirmed',
}
const firstId = '550e8400-e29b-41d4-a716-446655440000'
const secondId = '550e8400-e29b-41d4-a716-446655440001'
const seriesId = 'c3e6eac0-d48c-4c72-a374-b458239d14c8'

function row(event: PlanningEvent) {
  return [
    event.id,
    event.date,
    event.type,
    event.team,
    event.title,
    event.meetingTime,
    event.startTime,
    event.endTime,
    event.location,
    event.notes,
    event.status,
    event.recurrenceGroupId ?? '',
    event.recurrenceEndDate ?? '',
  ]
}

describe('team planning storage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAuthenticatedSheetRows).mockResolvedValue({
      sheetTitle: '📅 Planning',
      rows: [headers],
    })
    vi.mocked(updateAuthenticatedSheetValues).mockResolvedValue(undefined)
  })

  it('adds series columns to an existing planning sheet without changing old events', async () => {
    const oldHeaders = headers.slice(0, 11)
    const oldEvent = { ...fields, id: firstId }
    vi.mocked(getAuthenticatedSheetRows).mockResolvedValue({
      sheetTitle: '📅 Planning',
      rows: [oldHeaders, row(oldEvent).slice(0, 11)],
    })

    const events = await getTeamPlanningEvents()

    expect(events).toEqual([oldEvent])
    expect(updateAuthenticatedSheetValues).toHaveBeenCalledWith([{
      range: "'📅 Planning'!L1:M1",
      values: [['Identifiant de série', 'Fin de récurrence']],
    }])
  })

  it('writes a recurrence series in one batched sheet update', async () => {
    const existing = { ...fields, id: firstId }
    const firstOccurrence: PlanningEvent = {
      ...fields,
      id: secondId,
      recurrenceGroupId: seriesId,
      recurrenceEndDate: '2026-12-08',
    }
    const secondOccurrence: PlanningEvent = {
      ...firstOccurrence,
      id: '550e8400-e29b-41d4-a716-446655440002',
      date: '2026-12-01',
    }
    vi.mocked(getAuthenticatedSheetRows).mockResolvedValue({
      sheetTitle: '📅 Planning',
      rows: [headers, row(existing)],
    })

    await saveTeamPlanningEvents([firstOccurrence, secondOccurrence])

    expect(updateAuthenticatedSheetValues).toHaveBeenCalledWith([
      { range: "'📅 Planning'!A3:M3", values: [row(firstOccurrence)] },
      { range: "'📅 Planning'!A4:M4", values: [row(secondOccurrence)] },
    ])
  })

  it('updates all series occurrences while preserving their dates and IDs', async () => {
    const firstOccurrence: PlanningEvent = {
      ...fields,
      id: firstId,
      recurrenceGroupId: seriesId,
      recurrenceEndDate: '2026-12-08',
    }
    const secondOccurrence: PlanningEvent = {
      ...firstOccurrence,
      id: secondId,
      date: '2026-12-01',
    }
    vi.mocked(getAuthenticatedSheetRows).mockResolvedValue({
      sheetTitle: '📅 Planning',
      rows: [headers, row(firstOccurrence), row(secondOccurrence)],
    })
    const updatedFields = { ...fields, startTime: '18:30', endTime: '20:00' }

    const updated = await updateTeamPlanningSeries(seriesId, updatedFields)

    expect(updated).toEqual([
      { ...updatedFields, id: firstId, date: firstOccurrence.date, recurrenceGroupId: seriesId, recurrenceEndDate: '2026-12-08' },
      { ...updatedFields, id: secondId, date: secondOccurrence.date, recurrenceGroupId: seriesId, recurrenceEndDate: '2026-12-08' },
    ])
    expect(updateAuthenticatedSheetValues).toHaveBeenCalledWith([
      { range: "'📅 Planning'!A2:M2", values: [row(updated[0])] },
      { range: "'📅 Planning'!A3:M3", values: [row(updated[1])] },
    ])
  })
})
