import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/educator-auth', () => ({
  getEducatorSession: vi.fn(),
  hasEducatorAccess: (educator: { role: string }) =>
    educator.role === 'educator' || educator.role === 'admin',
  isSameOriginRequest: (request: Request) =>
    request.headers.get('origin') === new URL(request.url).origin,
}))

vi.mock('@/lib/educator-directory', () => ({
  saveOwnEducatorDirectoryEntry: vi.fn(),
}))
vi.mock('@/lib/educator-phones', () => ({
  migrateEducatorPhones: vi.fn(),
}))
vi.mock('@/lib/convocation-management', () => ({
  writeCallupSchedule: vi.fn(),
}))
vi.mock('@/lib/match-lineups', () => ({
  getMatchLineups: vi.fn(),
  saveMatchLineup: vi.fn(),
  syncMatchLineupsWithCallups: vi.fn(),
}))
vi.mock('@/lib/match-results', () => ({
  deleteMatchDay: vi.fn(),
  deleteMatchResult: vi.fn(),
  getMatchResults: vi.fn(),
  writeMatchResult: vi.fn(),
}))
vi.mock('@/lib/convocations', () => ({
  getConvocations: vi.fn(),
}))
vi.mock('@/lib/players', () => ({
  getRoster: vi.fn(),
}))
vi.mock('@/lib/training-attendance', () => ({
  saveTrainingAttendance: vi.fn(),
}))
vi.mock('@/lib/training-cancellations', () => ({
  getTrainingCancellations: vi.fn(),
  removeTrainingCancellation: vi.fn(),
  saveTrainingCancellation: vi.fn(),
}))
vi.mock('@/lib/security-logger', () => ({
  logSecurityEvent: vi.fn(),
  getClientIp: vi.fn(() => '127.0.0.1'),
  getUserAgent: vi.fn(() => 'test'),
}))
vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}))

import { getEducatorSession } from '@/lib/educator-auth'
import { getTrainingCancellations as getStoredTrainingCancellations } from '@/lib/training-cancellations'
import { saveTrainingAttendance } from '@/lib/training-attendance'
import { saveOwnEducatorDirectoryEntry } from '@/lib/educator-directory'
import { migrateEducatorPhones } from '@/lib/educator-phones'
import { GET as getLineups } from '@/app/api/educators/match-lineups/route'
import { POST as saveCallups } from '@/app/api/educators/callups/route'
import { DELETE as deleteMatch, POST as saveMatchResult } from '@/app/api/match-results/route'
import { deleteMatchDay, deleteMatchResult, writeMatchResult } from '@/lib/match-results'
import { PUT as saveOwnDirectoryEntry } from '@/app/api/educators/directory/me/route'
import { POST as migrateContacts } from '@/app/api/educators/contacts/migrate/route'
import {
  DELETE as reinstateTrainingSession,
  GET as getTrainingCancellations,
  POST as cancelTrainingSession,
} from '@/app/api/educators/training-cancellations/route'
import { POST as saveTrainingSessionAttendance } from '@/app/api/educators/training-attendance/route'
import {
  removeTrainingCancellation,
  saveTrainingCancellation,
} from '@/lib/training-cancellations'

type Session = { username: string; displayName: string; role: 'reader' | 'educator' | 'admin' }

const educator: Session = { username: 'coach', displayName: 'Coach', role: 'educator' }
const admin: Session = { username: 'admin', displayName: 'Admin', role: 'admin' }
const reader: Session = { username: 'reader', displayName: 'Reader', role: 'reader' }

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

describe('write and read access boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-17T12:00:00Z'))
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.mocked(saveOwnEducatorDirectoryEntry).mockResolvedValue({ id: 'entry' })
    vi.mocked(migrateEducatorPhones).mockResolvedValue(0)
    vi.mocked(getStoredTrainingCancellations).mockResolvedValue([])
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
  })

  it.each([
    ['public', null, 401],
    ['reader', reader, 403],
  ] as const)('denies %s access to the private match lineups', async (_label, session, status) => {
    vi.mocked(getEducatorSession).mockResolvedValue(session)

    const response = await getLineups(request('/api/educators/match-lineups', 'GET'))

    expect(response.status).toBe(status)
  })

  it.each([
    ['public', null, 401],
    ['reader', reader, 403],
  ] as const)('denies %s access to saving callups', async (_label, session, status) => {
    vi.mocked(getEducatorSession).mockResolvedValue(session)

    const response = await saveCallups(request('/api/educators/callups', 'POST', {}))

    expect(response.status).toBe(status)
  })

  it.each([
    ['public', null, 401],
    ['reader', reader, 403],
  ] as const)('denies %s access to reading training cancellations', async (_label, session, status) => {
    vi.mocked(getEducatorSession).mockResolvedValue(session)

    const response = await getTrainingCancellations(request('/api/educators/training-cancellations', 'GET'))

    expect(response.status).toBe(status)
  })

  it.each([
    ['public', null, 401],
    ['reader', reader, 403],
  ] as const)('denies %s access to cancelling a training session', async (_label, session, status) => {
    vi.mocked(getEducatorSession).mockResolvedValue(session)

    const response = await cancelTrainingSession(request('/api/educators/training-cancellations', 'POST', {
      date: '2026-11-17',
      reason: 'Météo',
    }))

    expect(response.status).toBe(status)
    expect(saveTrainingCancellation).not.toHaveBeenCalled()
  })

  it('requires same-origin requests when cancelling a training session', async () => {
    vi.mocked(getEducatorSession).mockResolvedValue(educator)

    const response = await cancelTrainingSession(request(
      '/api/educators/training-cancellations',
      'POST',
      { date: '2026-11-17', reason: 'Météo' },
      false,
    ))

    expect(response.status).toBe(403)
    expect(saveTrainingCancellation).not.toHaveBeenCalled()
  })

  it('validates cancellation input before writing', async () => {
    vi.mocked(getEducatorSession).mockResolvedValue(educator)

    const response = await cancelTrainingSession(request('/api/educators/training-cancellations', 'POST', {
      date: '2026-02-30',
      reason: 'Météo',
    }))

    expect(response.status).toBe(400)
    expect(saveTrainingCancellation).not.toHaveBeenCalled()
  })

  it('allows educators to cancel and reinstate a training session', async () => {
    vi.mocked(getEducatorSession).mockResolvedValue(educator)
    vi.mocked(saveTrainingCancellation).mockResolvedValue(undefined)
    vi.mocked(removeTrainingCancellation).mockResolvedValue(true)

    const cancelResponse = await cancelTrainingSession(request('/api/educators/training-cancellations', 'POST', {
      date: '2026-11-17',
      reason: 'Météo',
    }))
    const reinstateResponse = await reinstateTrainingSession(request(
      '/api/educators/training-cancellations?date=2026-11-17',
      'DELETE',
    ))

    expect(cancelResponse.status).toBe(200)
    expect(reinstateResponse.status).toBe(200)
    expect(saveTrainingCancellation).toHaveBeenCalledWith(
      '2026-11-17',
      'Météo',
      'coach',
      expect.any(String),
    )
    expect(removeTrainingCancellation).toHaveBeenCalledWith('2026-11-17')
  })

  it('prevents saving attendance for a cancelled training session', async () => {
    vi.mocked(getEducatorSession).mockResolvedValue(educator)
    vi.mocked(getStoredTrainingCancellations).mockResolvedValue([{
      date: '2026-11-17',
      reason: 'Météo',
      cancelledBy: 'coach',
      cancelledAt: '2026-11-17T12:00:00.000Z',
    }])

    const response = await saveTrainingSessionAttendance(request('/api/educators/training-attendance', 'POST', {
      date: '2026-11-17',
      entries: [{ number: 7, status: 'P' }],
    }))

    expect(response.status).toBe(409)
    expect(saveTrainingAttendance).not.toHaveBeenCalled()
  })

  it.each([
    ['public', null, 401],
    ['reader', reader, 403],
  ] as const)('denies %s access to saving match results', async (_label, session, status) => {
    vi.mocked(getEducatorSession).mockResolvedValue(session)

    const response = await saveMatchResult(request('/api/match-results', 'POST', {}))

    expect(response.status).toBe(status)
  })

  it('requires same-origin requests for match-result changes', async () => {
    vi.mocked(getEducatorSession).mockResolvedValue(educator)

    const response = await saveMatchResult(
      request('/api/match-results', 'POST', {}, false),
    )

    expect(response.status).toBe(403)
  })

  it('validates the planned match time before saving', async () => {
    vi.mocked(getEducatorSession).mockResolvedValue(educator)

    const response = await saveMatchResult(request('/api/match-results', 'POST', {
      team: 'E1',
      date: '2026-11-14',
      opponent: 'Club',
      competition: 'Championnat',
      homeAway: 'Domicile',
      kickoffTime: '25:70',
      resultLabel: '',
      goalsFor: null,
      goalsAgainst: null,
    }))

    expect(response.status).toBe(400)
    expect(writeMatchResult).not.toHaveBeenCalled()
  })

  it('returns a retryable response when Google Sheets rate-limits match saving', async () => {
    vi.mocked(getEducatorSession).mockResolvedValue(educator)
    vi.mocked(writeMatchResult).mockRejectedValue(new Error('Impossible de lire l’onglet protégé (429).'))

    const response = await saveMatchResult(request('/api/match-results', 'POST', {
      team: 'E1',
      date: '2026-11-21',
      opponent: 'Club',
      competition: 'Championnat',
      homeAway: 'Domicile',
      kickoffTime: '',
      meetingTime: '',
      venueAddress: '',
      resultLabel: '',
      goalsFor: null,
      goalsAgainst: null,
    }))

    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({
      error: 'Google Sheets limite temporairement les requêtes. Attends une minute puis réessaie.',
    })
  })

  it.each([
    ['public', null, 401],
    ['reader', reader, 403],
  ] as const)('denies %s access to deleting matches', async (_label, session, status) => {
    vi.mocked(getEducatorSession).mockResolvedValue(session)

    const response = await deleteMatch(request('/api/match-results', 'DELETE', {
      scope: 'day',
      date: '2026-11-14',
    }))

    expect(response.status).toBe(status)
    expect(deleteMatchDay).not.toHaveBeenCalled()
    expect(deleteMatchResult).not.toHaveBeenCalled()
  })

  it('requires same-origin requests when deleting matches', async () => {
    vi.mocked(getEducatorSession).mockResolvedValue(educator)

    const response = await deleteMatch(request(
      '/api/match-results',
      'DELETE',
      { scope: 'day', date: '2026-11-14' },
      false,
    ))

    expect(response.status).toBe(403)
    expect(deleteMatchDay).not.toHaveBeenCalled()
  })

  it('validates match deletion input before calling the sheet service', async () => {
    vi.mocked(getEducatorSession).mockResolvedValue(educator)

    const response = await deleteMatch(request('/api/match-results', 'DELETE', {
      scope: 'match',
      date: '2026-11-14',
      team: 'E1',
      slotColumn: 3,
    }))

    expect(response.status).toBe(400)
    expect(deleteMatchResult).not.toHaveBeenCalled()
  })

  it('does not allow deleting a match day that has already passed', async () => {
    vi.mocked(getEducatorSession).mockResolvedValue(educator)

    const response = await deleteMatch(request('/api/match-results', 'DELETE', {
      scope: 'day',
      date: '2026-11-06',
    }))

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      error: 'Seuls les matchs à venir peuvent être supprimés.',
    })
    expect(deleteMatchDay).not.toHaveBeenCalled()
  })

  it('allows educators to delete a whole match day', async () => {
    vi.mocked(getEducatorSession).mockResolvedValue(educator)
    vi.mocked(deleteMatchDay).mockResolvedValue({ deletedMatches: 2 })

    const response = await deleteMatch(request('/api/match-results', 'DELETE', {
      scope: 'day',
      date: '2026-11-20',
    }))

    expect(response.status).toBe(200)
    expect(deleteMatchDay).toHaveBeenCalledWith('2026-11-20')
    expect(await response.json()).toMatchObject({ ok: true, deletedMatches: 2 })
  })

  it.each([
    ['public', null, 401],
    ['reader', reader, 403],
  ] as const)('denies %s access to editing their educator directory entry', async (_label, session, status) => {
    vi.mocked(getEducatorSession).mockResolvedValue(session)

    const response = await saveOwnDirectoryEntry(request(
      '/api/educators/directory/me',
      'PUT',
      { licenseNumber: '', phone: '' },
    ))

    expect(response.status).toBe(status)
    expect(saveOwnEducatorDirectoryEntry).not.toHaveBeenCalled()
  })

  it('allows educators to update only their own directory entry', async () => {
    vi.mocked(getEducatorSession).mockResolvedValue(educator)

    const response = await saveOwnDirectoryEntry(request(
      '/api/educators/directory/me',
      'PUT',
      { licenseNumber: 'LIC', phone: '0600000000' },
    ))

    expect(response.status).toBe(200)
    expect(saveOwnEducatorDirectoryEntry).toHaveBeenCalledWith({
      name: 'Coach',
      licenseNumber: 'LIC',
      phone: '0600000000',
    })
  })

  it.each([
    ['public', null, 401],
    ['educator', educator, 403],
    ['reader', reader, 403],
  ] as const)('denies %s access to contact migration', async (_label, session, status) => {
    vi.mocked(getEducatorSession).mockResolvedValue(session)

    const response = await migrateContacts(request(
      '/api/educators/contacts/migrate',
      'POST',
      { backupConfirmed: true },
    ))

    expect(response.status).toBe(status)
    expect(migrateEducatorPhones).not.toHaveBeenCalled()
  })

  it('allows only an admin to migrate contacts', async () => {
    vi.mocked(getEducatorSession).mockResolvedValue(admin)

    const response = await migrateContacts(request(
      '/api/educators/contacts/migrate',
      'POST',
      { backupConfirmed: true },
    ))

    expect(response.status).toBe(200)
    expect(migrateEducatorPhones).toHaveBeenCalledOnce()
  })

  it('requires an administrator to confirm the spreadsheet backup before migration', async () => {
    vi.mocked(getEducatorSession).mockResolvedValue(admin)

    const response = await migrateContacts(request(
      '/api/educators/contacts/migrate',
      'POST',
      {},
    ))

    expect(response.status).toBe(400)
    expect(migrateEducatorPhones).not.toHaveBeenCalled()
  })
})
