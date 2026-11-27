export const PLANNING_EVENT_TYPES = ['training', 'match', 'tournament', 'meeting', 'cohesion'] as const
export const PLANNING_TEAMS = ['E1', 'E2', 'both'] as const
export const PLANNING_STATUSES = ['confirmed', 'postponed', 'cancelled'] as const

export type PlanningEventType = (typeof PLANNING_EVENT_TYPES)[number]
export type PlanningTeam = (typeof PLANNING_TEAMS)[number]
export type PlanningStatus = (typeof PLANNING_STATUSES)[number]
export type TournamentFormat = 'futsal' | 'football8' | ''

export type PlanningEventFields = {
  date: string
  endDate: string
  type: PlanningEventType
  tournamentFormat?: TournamentFormat
  team: PlanningTeam
  title: string
  meetingTime: string
  startTime: string
  endTime: string
  location: string
  notes: string
  status: PlanningStatus
}

export type PlanningEvent = PlanningEventFields & {
  id: string
  recurrenceGroupId?: string
  recurrenceEndDate?: string
}

export const MAX_WEEKLY_RECURRENCE_EVENTS = 52

export function getWeeklyRecurrenceDates(startDate: string, endDate: string): string[] | null {
  if (!isValidPlanningDate(startDate) || !isValidPlanningDate(endDate) || endDate <= startDate) return null

  const dates: string[] = []
  let date = startDate
  while (date <= endDate) {
    dates.push(date)
    if (dates.length > MAX_WEEKLY_RECURRENCE_EVENTS) return null

    const nextDate = new Date(`${date}T00:00:00Z`)
    nextDate.setUTCDate(nextDate.getUTCDate() + 7)
    date = nextDate.toISOString().slice(0, 10)
  }

  return dates
}

export function isValidPlanningDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function addPlanningDateDays(date: string, days: number) {
  const result = new Date(`${date}T00:00:00Z`)
  result.setUTCDate(result.getUTCDate() + days)
  return result.toISOString().slice(0, 10)
}

export function getPlanningDateDurationDays(startDate: string, endDate: string) {
  return (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86_400_000
}

export function planningEventOverlapsDateRange(
  eventStartDate: string,
  eventEndDate: string,
  rangeStartDate: string,
  rangeEndDate: string,
) {
  return eventStartDate <= rangeEndDate && eventEndDate >= rangeStartDate
}

function isValidTime(value: string, optional = false) {
  if (optional && value === '') return true
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)
}

export function parsePlanningEventFields(input: unknown): PlanningEventFields | null {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return null
  const value = input as Record<string, unknown>
  const date = value.date
  const endDate = value.endDate === undefined ? date : value.endDate
  const nextDay = typeof date === 'string' && isValidPlanningDate(date)
    ? addPlanningDateDays(date, 1)
    : ''
  const endsAfterMidnight = typeof value.endTime === 'string' &&
    typeof value.startTime === 'string' &&
    value.endTime <= value.startTime
  const invalidNonTournamentEndDate = value.type !== 'tournament' &&
    endDate !== date &&
    !(endDate === nextDay && endsAfterMidnight)
  if (
    typeof date !== 'string' ||
    !isValidPlanningDate(date) ||
    typeof endDate !== 'string' ||
    !isValidPlanningDate(endDate) ||
    endDate < date ||
    typeof value.type !== 'string' ||
    !PLANNING_EVENT_TYPES.includes(value.type as PlanningEventType) ||
    (value.tournamentFormat !== undefined &&
      value.tournamentFormat !== '' &&
      value.tournamentFormat !== 'futsal' &&
      value.tournamentFormat !== 'football8') ||
    (value.type === 'tournament' && typeof value.tournamentFormat !== 'string') ||
    (value.type !== 'tournament' && value.tournamentFormat !== undefined && value.tournamentFormat !== '') ||
    invalidNonTournamentEndDate ||
    typeof value.team !== 'string' ||
    !PLANNING_TEAMS.includes(value.team as PlanningTeam) ||
    typeof value.title !== 'string' ||
    !value.title.trim() ||
    value.title.trim().length > 100 ||
    typeof value.meetingTime !== 'string' ||
    !isValidTime(value.meetingTime, true) ||
    typeof value.startTime !== 'string' ||
    !isValidTime(value.startTime) ||
    typeof value.endTime !== 'string' ||
    !isValidTime(value.endTime) ||
    (endDate === date && value.endTime <= value.startTime) ||
    typeof value.location !== 'string' ||
    !value.location.trim() ||
    value.location.trim().length > 160 ||
    typeof value.notes !== 'string' ||
    value.notes.length > 600 ||
    typeof value.status !== 'string' ||
    !PLANNING_STATUSES.includes(value.status as PlanningStatus)
  ) {
    return null
  }

  return {
    date,
    endDate,
    type: value.type as PlanningEventType,
    tournamentFormat: value.type === 'tournament' ? value.tournamentFormat as TournamentFormat : '',
    team: value.team as PlanningTeam,
    title: value.title.trim(),
    meetingTime: value.meetingTime,
    startTime: value.startTime,
    endTime: value.endTime,
    location: value.location.trim(),
    notes: value.notes.trim(),
    status: value.status as PlanningStatus,
  }
}

export function isPlanningEvent(value: unknown): value is PlanningEvent {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const event = value as Record<string, unknown>
  if (
    typeof event.id !== 'string' ||
    !/^[0-9a-f-]{36}$/i.test(event.id) ||
    parsePlanningEventFields(event) === null
  ) return false

  const hasSeriesMetadata = event.recurrenceGroupId !== undefined || event.recurrenceEndDate !== undefined
  if (!hasSeriesMetadata) return true

  return typeof event.recurrenceGroupId === 'string' &&
    /^[0-9a-f-]{36}$/i.test(event.recurrenceGroupId) &&
    typeof event.recurrenceEndDate === 'string' &&
    isValidPlanningDate(event.recurrenceEndDate) &&
    typeof event.date === 'string' &&
    event.date <= event.recurrenceEndDate
}

function escapeCalendarText(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
}

export function createCalendarFile(event: PlanningEvent) {
  const date = event.date.replace(/-/g, '')
  const endDate = event.endDate.replace(/-/g, '')
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const status = event.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED'
  const description = [
    `Équipe : ${event.team === 'both' ? 'E1 et E2' : event.team}`,
    event.tournamentFormat ? `Format : ${event.tournamentFormat === 'futsal' ? 'Futsal' : 'Foot à 8 extérieur'}` : '',
    event.meetingTime ? `Rendez-vous : ${event.meetingTime}` : '',
    event.status === 'postponed' ? 'Événement reporté' : '',
    event.notes,
  ].filter(Boolean).join('\n')
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ES Genech//Planning U11//FR',
    'CALSCALE:GREGORIAN',
    'BEGIN:VTIMEZONE',
    'TZID:Europe/Paris',
    'X-LIC-LOCATION:Europe/Paris',
    'BEGIN:DAYLIGHT',
    'TZOFFSETFROM:+0100',
    'TZOFFSETTO:+0200',
    'TZNAME:CEST',
    'DTSTART:19700329T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
    'END:DAYLIGHT',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:+0200',
    'TZOFFSETTO:+0100',
    'TZNAME:CET',
    'DTSTART:19701025T030000',
    'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
    'END:STANDARD',
    'END:VTIMEZONE',
    'BEGIN:VEVENT',
    `UID:${event.id}@es-genech-u11`,
    `DTSTAMP:${stamp}Z`,
    `DTSTART;TZID=Europe/Paris:${date}T${event.startTime.replace(':', '')}00`,
    `DTEND;TZID=Europe/Paris:${endDate}T${event.endTime.replace(':', '')}00`,
    `SUMMARY:${escapeCalendarText(event.title)}`,
    `LOCATION:${escapeCalendarText(event.location)}`,
    `DESCRIPTION:${escapeCalendarText(description)}`,
    `STATUS:${status}`,
    ...(event.status === 'cancelled'
      ? []
      : [
          'BEGIN:VALARM',
          'TRIGGER:-PT24H',
          'ACTION:DISPLAY',
          `DESCRIPTION:${escapeCalendarText(`Rappel : ${event.title}`)}`,
          'END:VALARM',
        ]),
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return `${lines.join('\r\n')}\r\n`
}
