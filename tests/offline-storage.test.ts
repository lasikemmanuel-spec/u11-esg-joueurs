import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getOfflineAttendance,
  getOfflineLineups,
  getOfflineLiveMatch,
  getPendingAttendances,
  getPendingLineups,
  getPendingLiveMatches,
  getTotalPendingOfflineCount,
  liveMatchKey,
  queuePendingAttendance,
  queuePendingLineup,
  queuePendingLiveMatch,
  removePendingAttendance,
  removePendingLineup,
  removePendingLiveMatch,
  saveOfflineAttendance,
  saveOfflineLineups,
  saveOfflineLiveMatch,
  syncAllPendingData,
} from '@/lib/offline-storage'
import type { LiveMatchSession } from '@/lib/live-match-shared'

describe('offline-storage', () => {
  const sampleSession: LiveMatchSession = {
    date: '2026-11-14',
    team: 'E1',
    slotColumn: 3,
    phase: 'firstHalf',
    elapsedSeconds: 120,
    runningSince: null,
    starters: [1, 2, 3],
    substitutes: [4, 5],
    events: [],
    completed: false,
  }

  let storageMap: Map<string, string>

  const mockLocalStorage = {
    getItem: (key: string) => storageMap.get(key) ?? null,
    setItem: (key: string, value: string) => { storageMap.set(key, String(value)) },
    removeItem: (key: string) => { storageMap.delete(key) },
    clear: () => { storageMap.clear() },
    key: (index: number) => Array.from(storageMap.keys())[index] ?? null,
    get length() { return storageMap.size },
  }

  beforeEach(() => {
    storageMap = new Map()
    const mockWindow = {
      localStorage: mockLocalStorage,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
    // @ts-expect-error test mock
    globalThis.window = mockWindow
    try {
      Object.defineProperty(globalThis.navigator, 'onLine', {
        value: true,
        configurable: true,
        writable: true,
      })
    } catch {
      // navigator déjà configuré
    }
    vi.restoreAllMocks()
  })

  afterEach(() => {
    storageMap.clear()
    // @ts-expect-error test mock
    delete globalThis.window
  })

  it('computes consistent liveMatchKey', () => {
    expect(liveMatchKey({ date: '2026-11-14', team: 'E1', slotColumn: 2 })).toBe('2026-11-14_E1_2')
    expect(liveMatchKey({ date: '14/11/2026', team: 'E2', slotColumn: 5 })).toBe('14-11-2026_E2_5')
  })

  it('saves and retrieves offline live match', () => {
    expect(getOfflineLiveMatch('2026-11-14', 'E1', 3)).toBeNull()
    saveOfflineLiveMatch(sampleSession)
    const retrieved = getOfflineLiveMatch('2026-11-14', 'E1', 3)
    expect(retrieved).toEqual(sampleSession)
  })

  it('queues, lists and removes pending live match mutations', () => {
    queuePendingLiveMatch(sampleSession, 'save')
    const pending = getPendingLiveMatches()
    expect(pending).toHaveLength(1)
    expect(pending[0].session.team).toBe('E1')
    expect(pending[0].action).toBe('save')

    removePendingLiveMatch(pending[0].key)
    expect(getPendingLiveMatches()).toHaveLength(0)
  })

  it('manages offline attendance and pending attendance queue', () => {
    const entries = [{ number: 7, status: 'P' }, { number: 9, status: 'AI' }]
    saveOfflineAttendance('2026-11-14', entries)
    expect(getOfflineAttendance('2026-11-14')).toEqual(entries)

    queuePendingAttendance('2026-11-14', entries)
    const pending = getPendingAttendances()
    expect(pending).toHaveLength(1)
    expect(pending[0].date).toBe('2026-11-14')

    removePendingAttendance('2026-11-14')
    expect(getPendingAttendances()).toHaveLength(0)
  })

  it('manages offline lineups and pending lineup queue', () => {
    const lineup = {
      date: '2026-11-14',
      team: 'E1' as const,
      slotColumn: 3,
      starters: [1, 2, 3, 4, 5, 6, 7, 8],
      substitutes: [9, 10],
    }

    saveOfflineLineups([lineup])
    expect(getOfflineLineups()).toEqual([lineup])

    queuePendingLineup(lineup)
    const pending = getPendingLineups()
    expect(pending).toHaveLength(1)
    expect(pending[0].team).toBe('E1')

    removePendingLineup(pending[0].key)
    expect(getPendingLineups()).toHaveLength(0)
  })

  it('calculates total pending offline count across all features', () => {
    expect(getTotalPendingOfflineCount()).toBe(0)

    queuePendingLiveMatch(sampleSession, 'save')
    expect(getTotalPendingOfflineCount()).toBe(1)

    queuePendingAttendance('2026-11-14', [{ number: 10, status: 'P' }])
    expect(getTotalPendingOfflineCount()).toBe(2)

    queuePendingLineup({
      date: '2026-11-14',
      team: 'E2',
      slotColumn: 4,
      starters: [1, 2],
      substitutes: [3],
    })
    expect(getTotalPendingOfflineCount()).toBe(3)
  })

  it('syncAllPendingData sends pending items and clears them on success', async () => {
    queuePendingLiveMatch(sampleSession, 'save')
    queuePendingAttendance('2026-11-14', [{ number: 1, status: 'P' }])

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    })
    globalThis.fetch = fetchMock

    const result = await syncAllPendingData()
    expect(result.synced).toBe(2)
    expect(result.failed).toBe(0)
    expect(getTotalPendingOfflineCount()).toBe(0)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
