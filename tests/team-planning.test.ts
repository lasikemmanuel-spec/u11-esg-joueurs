import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createCalendarFile,
  getWeeklyRecurrenceDates,
  isPlanningEvent,
  parsePlanningEventFields,
  type PlanningEvent,
} from '@/lib/team-planning-shared'

vi.mock('@/lib/educator-auth', () => ({
  getEducatorSession: vi.fn(),
  hasEducatorAccess: (educator: { role: string }) =>
    educator.role === 'educator' || educator.role === 'admin',
  isSameOriginRequest: (request: Request) =>
    request.headers.get('origin') === new URL(request.url).origin,
}))
vi.mock('@/lib/team-planning', () => ({
  getTeamPlanningEvents: vi.fn(),
  saveTeamPlanningEvent: vi.fn(),
  saveTeamPlanningEvents: vi.fn(),
  updateTeamPlanningSeries: vi.fn(),
}))
vi.mock('@/lib/security-logger', () => ({
  logSecurityEvent: vi.fn(),
  getClientIp: vi.fn(() => '127.0.0.1'),
  getUserAgent: vi.fn(() => 'test'),
}))
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))

import { POST, PUT, GET } from '@/app/api/team-planning/route'
import { getEducatorSession } from '@/lib/educator-auth'
import {
  getTeamPlanningEvents,
  saveTeamPlanningEvent,
  saveTeamPlanningEvents,
  updateTeamPlanningSeries,
} from '@/lib/team-planning'

const educator = { username: 'coach', displayName: 'Coach', role: 'educator' as const }
const reader = { username: 'reader', displayName: 'Reader', role: 'reader' as const }
const fields = {
  date: '2026-11-21',
  type: 'match',
  team: 'E1',
  title: 'Match contre Genech',
  meetingTime: '09:00',
  startTime: '10:00',
  endTime: '11:30',
  location: 'Stade municipal',
  notes: '',
  status: 'confirmed',
}
const planningEvent: PlanningEvent = {
  ...fields,
  type: 'match',
  team: 'E1',
  status: 'confirmed',
  id: '550e8400-e29b-41d4-a716-446655440000',
}
const recurrenceGroupId = 'c3e6eac0-d48c-4c72-a374-b458239d14c8'
const recurringPlanningEvent: PlanningEvent = {
  ...planningEvent,
  recurrenceGroupId,
  recurrenceEndDate: '2026-12-05',
}

function request(path: string, method: string, body?: object, sameOrigin = true) {
  return new Request(`https://club.example${path}`, {
    method,
    headers: {
      ...(sameOrigin ? { origin: 'https://club.example' } : { origin: 'https://attacker.example' }),
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}

describe('team planning', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('VERCEL_ENV', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('rejects invalid dates and times', () => {
    expect(parsePlanningEventFields({ ...fields, date: '2026-02-30' })).toBeNull()
    expect(parsePlanningEventFields({ ...fields, startTime: '25:00' })).toBeNull()
    expect(parsePlanningEventFields({ ...fields, endTime: '09:30' })).toBeNull()
  })

  it('creates weekly event dates through the inclusive end date', () => {
    expect(getWeeklyRecurrenceDates('2026-11-21', '2026-12-05')).toEqual([
      '2026-11-21',
      '2026-11-28',
      '2026-12-05',
    ])
  })

  it('rejects weekly recurrence ranges outside the supported limits', () => {
    expect(getWeeklyRecurrenceDates('2026-11-21', '2026-11-21')).toBeNull()
    expect(getWeeklyRecurrenceDates('2026-11-21', '2026-11-20')).toBeNull()
    expect(getWeeklyRecurrenceDates('2026-11-21', '2027-11-20')).toBeNull()
  })

  it('accepts recurrence metadata only when the series is valid', () => {
    expect(isPlanningEvent(recurringPlanningEvent)).toBe(true)
    expect(isPlanningEvent({ ...recurringPlanningEvent, recurrenceEndDate: '2026-11-20' })).toBe(false)
    expect(isPlanningEvent({ ...recurringPlanningEvent, recurrenceGroupId: 'invalid' })).toBe(false)
  })

  it('creates a Europe/Paris calendar file and escapes event text', () => {
    const calendar = createCalendarFile({
      ...planningEvent,
      title: 'Match, puis goûter',
    })

    expect(calendar).toContain('TZID:Europe/Paris')
    expect(calendar).toContain('DTSTART;TZID=Europe/Paris:20261121T100000')
    expect(calendar).toContain('SUMMARY:Match\\, puis goûter')
    expect(calendar).toContain('STATUS:CONFIRMED')
    expect(calendar).toContain('BEGIN:VALARM\r\nTRIGGER:-PT24H\r\nACTION:DISPLAY')

    const cancelledCalendar = createCalendarFile({ ...planningEvent, status: 'cancelled' })
    expect(cancelledCalendar).toContain('STATUS:CANCELLED')
    expect(cancelledCalendar).not.toContain('BEGIN:VALARM')
  })

  it('allows readers to view the planning', async () => {
    vi.mocked(getTeamPlanningEvents).mockResolvedValue([planningEvent])

    const response = await GET()

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ events: [planningEvent] })
  })

  it('denies planning edits to reader accounts', async () => {
    vi.mocked(getEducatorSession).mockResolvedValue(reader)

    const response = await POST(request('/api/team-planning', 'POST', fields))

    expect(response.status).toBe(403)
    expect(saveTeamPlanningEvent).not.toHaveBeenCalled()
  })

  it('requires an educator session before editing', async () => {
    vi.mocked(getEducatorSession).mockResolvedValue(null)

    const response = await POST(request('/api/team-planning', 'POST', fields))

    expect(response.status).toBe(401)
    expect(saveTeamPlanningEvent).not.toHaveBeenCalled()
  })

  it('rejects cross-origin planning edits', async () => {
    vi.mocked(getEducatorSession).mockResolvedValue(educator)

    const response = await POST(request('/api/team-planning', 'POST', fields, false))

    expect(response.status).toBe(403)
    expect(saveTeamPlanningEvent).not.toHaveBeenCalled()
  })

  it('allows educators to add validated events', async () => {
    vi.mocked(getEducatorSession).mockResolvedValue(educator)
    vi.mocked(saveTeamPlanningEvents).mockResolvedValue()

    const response = await POST(request('/api/team-planning', 'POST', fields))
    const result = await response.json() as { event: PlanningEvent }

    expect(response.status).toBe(201)
    expect(result.event).toMatchObject(fields)
    expect(result.event.id).toMatch(/^[0-9a-f-]{36}$/i)
    expect(saveTeamPlanningEvents).toHaveBeenCalledWith([result.event])
  })

  it('creates one event per weekly recurrence date', async () => {
    vi.mocked(getEducatorSession).mockResolvedValue(educator)
    vi.mocked(saveTeamPlanningEvents).mockResolvedValue()

    const response = await POST(request('/api/team-planning', 'POST', {
      ...fields,
      date: '2026-11-24',
      type: 'training',
      title: 'Entraînement',
      recurrence: { frequency: 'weekly', endDate: '2026-12-08' },
    }))
    const result = await response.json() as { events: PlanningEvent[] }

    expect(response.status).toBe(201)
    expect(result.events.map((event) => event.date)).toEqual([
      '2026-11-24',
      '2026-12-01',
      '2026-12-08',
    ])
    expect(new Set(result.events.map((event) => event.id)).size).toBe(3)
    expect(new Set(result.events.map((event) => event.recurrenceGroupId)).size).toBe(1)
    expect(result.events.every((event) => event.recurrenceEndDate === '2026-12-08')).toBe(true)
    expect(saveTeamPlanningEvents).toHaveBeenCalledWith(result.events)
  })

  it('rejects recurrence ranges that exceed 52 weekly events', async () => {
    vi.mocked(getEducatorSession).mockResolvedValue(educator)

    const response = await POST(request('/api/team-planning', 'POST', {
      ...fields,
      recurrence: { frequency: 'weekly', endDate: '2027-11-20' },
    }))

    expect(response.status).toBe(400)
    expect(saveTeamPlanningEvents).not.toHaveBeenCalled()
  })

  it('does not save events with invalid dates', async () => {
    vi.mocked(getEducatorSession).mockResolvedValue(educator)

    const response = await POST(request('/api/team-planning', 'POST', {
      ...fields,
      date: '2026-02-30',
    }))

    expect(response.status).toBe(400)
    expect(saveTeamPlanningEvent).not.toHaveBeenCalled()
  })

  it('allows educators to update an existing event', async () => {
    vi.mocked(getEducatorSession).mockResolvedValue(educator)
    vi.mocked(saveTeamPlanningEvent).mockResolvedValue(true)

    const response = await PUT(request('/api/team-planning', 'PUT', {
      ...fields,
      id: planningEvent.id,
      title: 'Match reporté',
      status: 'postponed',
    }))

    expect(response.status).toBe(200)
    expect(saveTeamPlanningEvent).toHaveBeenCalledWith(
      { ...planningEvent, title: 'Match reporté', status: 'postponed' },
      'update',
    )
  })

  it('updates all occurrences when asked to update a series', async () => {
    vi.mocked(getEducatorSession).mockResolvedValue(educator)
    const updatedEvents = [
      recurringPlanningEvent,
      { ...recurringPlanningEvent, id: '550e8400-e29b-41d4-a716-446655440001', date: '2026-11-28' },
    ]
    vi.mocked(updateTeamPlanningSeries).mockResolvedValue(updatedEvents)

    const response = await PUT(request('/api/team-planning', 'PUT', {
      ...fields,
      scope: 'series',
      seriesId: recurrenceGroupId,
      status: 'cancelled',
    }))
    const result = await response.json() as { events: PlanningEvent[] }

    expect(response.status).toBe(200)
    expect(result.events).toEqual(updatedEvents)
    expect(updateTeamPlanningSeries).toHaveBeenCalledWith(recurrenceGroupId, {
      ...fields,
      status: 'cancelled',
    })
  })

  it('preserves recurrence metadata when updating one occurrence', async () => {
    vi.mocked(getEducatorSession).mockResolvedValue(educator)
    vi.mocked(saveTeamPlanningEvent).mockResolvedValue(true)

    const response = await PUT(request('/api/team-planning', 'PUT', {
      ...recurringPlanningEvent,
      title: 'Entraînement déplacé',
    }))

    expect(response.status).toBe(200)
    expect(saveTeamPlanningEvent).toHaveBeenCalledWith({
      ...recurringPlanningEvent,
      title: 'Entraînement déplacé',
    }, 'update')
  })
})
