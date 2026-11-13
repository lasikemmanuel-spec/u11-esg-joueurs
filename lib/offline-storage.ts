'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import type { LiveMatchSession } from '@/lib/live-match-shared'

export type OfflinePendingLiveMatch = {
  key: string
  action: 'save' | 'finalize' | 'reset'
  session: LiveMatchSession
  queuedAt: number
}

export type OfflinePendingAttendance = {
  date: string
  entries: Array<{ number: number; status: string }>
  queuedAt: number
}

export type OfflinePendingLineup = {
  key: string
  date: string
  team: 'E1' | 'E2'
  slotColumn: number
  starters: number[]
  substitutes: number[]
  queuedAt: number
}

export type MatchLineupData = {
  date: string
  team: 'E1' | 'E2'
  slotColumn: number
  starters: number[]
  substitutes: number[]
}

const STORAGE_PREFIX = 'esg_offline_'
const PENDING_LIVE_PREFIX = `${STORAGE_PREFIX}pending_live_`
const PENDING_ATTENDANCE_PREFIX = `${STORAGE_PREFIX}pending_att_`
const PENDING_LINEUP_PREFIX = `${STORAGE_PREFIX}pending_lineup_`
const LIVE_SESSION_PREFIX = `${STORAGE_PREFIX}live_session_`
const ATTENDANCE_PREFIX = `${STORAGE_PREFIX}attendance_`
const LINEUPS_CACHE_KEY = `${STORAGE_PREFIX}all_lineups`

export function liveMatchKey(match: { date: string; team: string; slotColumn: number }) {
  const normalizedDate = match.date.replace(/[/. ]/g, '-')
  return `${normalizedDate}_${match.team}_${match.slotColumn}`
}

function safeGetItem(key: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSetItem(key: string, value: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    window.localStorage.setItem(key, value)
    notifyListeners()
    return true
  } catch {
    return false
  }
}

function safeRemoveItem(key: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    window.localStorage.removeItem(key)
    notifyListeners()
    return true
  } catch {
    return false
  }
}

// Système de notification d'événements pour mettre à jour les hooks React
const listeners = new Set<() => void>()
function notifyListeners() {
  for (const listener of listeners) {
    listener()
  }
}

function subscribe(callback: () => void) {
  listeners.add(callback)
  return () => {
    listeners.delete(callback)
  }
}

/* =========================================================================
 * 1. Live Match
 * ========================================================================= */

export function saveOfflineLiveMatch(session: LiveMatchSession): void {
  const key = `${LIVE_SESSION_PREFIX}${liveMatchKey(session)}`
  safeSetItem(key, JSON.stringify(session))
}

export function getOfflineLiveMatch(
  date: string,
  team: string,
  slotColumn: number,
): LiveMatchSession | null {
  const key = `${LIVE_SESSION_PREFIX}${liveMatchKey({ date, team, slotColumn })}`
  const data = safeGetItem(key)
  if (!data) return null
  try {
    return JSON.parse(data) as LiveMatchSession
  } catch {
    return null
  }
}

export function queuePendingLiveMatch(
  session: LiveMatchSession,
  action: 'save' | 'finalize' | 'reset' = 'save',
): void {
  const matchKey = liveMatchKey(session)
  const item: OfflinePendingLiveMatch = {
    key: matchKey,
    action,
    session,
    queuedAt: Date.now(),
  }
  safeSetItem(`${PENDING_LIVE_PREFIX}${matchKey}`, JSON.stringify(item))
  saveOfflineLiveMatch(session)
}

export function getPendingLiveMatches(): OfflinePendingLiveMatch[] {
  if (typeof window === 'undefined') return []
  const items: OfflinePendingLiveMatch[] = []
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i)
      if (key?.startsWith(PENDING_LIVE_PREFIX)) {
        const raw = window.localStorage.getItem(key)
        if (raw) {
          items.push(JSON.parse(raw) as OfflinePendingLiveMatch)
        }
      }
    }
  } catch {
    // Erreur silencieuse
  }
  return items.sort((a, b) => a.queuedAt - b.queuedAt)
}

export function removePendingLiveMatch(key: string): void {
  safeRemoveItem(`${PENDING_LIVE_PREFIX}${key}`)
}

/* =========================================================================
 * 2. Training Attendance
 * ========================================================================= */

export function saveOfflineAttendance(
  date: string,
  entries: Array<{ number: number; status: string }>,
): void {
  safeSetItem(`${ATTENDANCE_PREFIX}${date}`, JSON.stringify(entries))
}

export function getOfflineAttendance(
  date: string,
): Array<{ number: number; status: string }> | null {
  const raw = safeGetItem(`${ATTENDANCE_PREFIX}${date}`)
  if (!raw) return null
  try {
    return JSON.parse(raw) as Array<{ number: number; status: string }>
  } catch {
    return null
  }
}

export function queuePendingAttendance(
  date: string,
  entries: Array<{ number: number; status: string }>,
): void {
  const item: OfflinePendingAttendance = {
    date,
    entries,
    queuedAt: Date.now(),
  }
  safeSetItem(`${PENDING_ATTENDANCE_PREFIX}${date}`, JSON.stringify(item))
  saveOfflineAttendance(date, entries)
}

export function getPendingAttendances(): OfflinePendingAttendance[] {
  if (typeof window === 'undefined') return []
  const items: OfflinePendingAttendance[] = []
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i)
      if (key?.startsWith(PENDING_ATTENDANCE_PREFIX)) {
        const raw = window.localStorage.getItem(key)
        if (raw) {
          items.push(JSON.parse(raw) as OfflinePendingAttendance)
        }
      }
    }
  } catch {
    // Erreur silencieuse
  }
  return items.sort((a, b) => a.queuedAt - b.queuedAt)
}

export function removePendingAttendance(date: string): void {
  safeRemoveItem(`${PENDING_ATTENDANCE_PREFIX}${date}`)
}

/* =========================================================================
 * 3. Match Lineups
 * ========================================================================= */

export function saveOfflineLineups(lineups: MatchLineupData[]): void {
  safeSetItem(LINEUPS_CACHE_KEY, JSON.stringify(lineups))
}

export function getOfflineLineups(): MatchLineupData[] | null {
  const raw = safeGetItem(LINEUPS_CACHE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as MatchLineupData[]
  } catch {
    return null
  }
}

export function queuePendingLineup(lineup: MatchLineupData): void {
  const key = `${lineup.date}_${lineup.team}_${lineup.slotColumn}`
  const item: OfflinePendingLineup = {
    key,
    ...lineup,
    queuedAt: Date.now(),
  }
  safeSetItem(`${PENDING_LINEUP_PREFIX}${key}`, JSON.stringify(item))

  // Mettre à jour aussi le cache complet des compositions
  const existing = getOfflineLineups() ?? []
  const next = [
    ...existing.filter((item) => !(item.date === lineup.date && item.team === lineup.team && item.slotColumn === lineup.slotColumn)),
    lineup,
  ]
  saveOfflineLineups(next)
}

export function getPendingLineups(): OfflinePendingLineup[] {
  if (typeof window === 'undefined') return []
  const items: OfflinePendingLineup[] = []
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i)
      if (key?.startsWith(PENDING_LINEUP_PREFIX)) {
        const raw = window.localStorage.getItem(key)
        if (raw) {
          items.push(JSON.parse(raw) as OfflinePendingLineup)
        }
      }
    }
  } catch {
    // Erreur silencieuse
  }
  return items.sort((a, b) => a.queuedAt - b.queuedAt)
}

export function removePendingLineup(key: string): void {
  safeRemoveItem(`${PENDING_LINEUP_PREFIX}${key}`)
}

/* =========================================================================
 * 4. Compteurs & Synchronisation globale
 * ========================================================================= */

export function getTotalPendingOfflineCount(): number {
  if (typeof window === 'undefined') return 0
  return (
    getPendingLiveMatches().length +
    getPendingAttendances().length +
    getPendingLineups().length
  )
}

export async function syncAllPendingData(): Promise<{
  synced: number
  failed: number
  errors: string[]
}> {
  if (typeof window === 'undefined' || !navigator.onLine) {
    return { synced: 0, failed: 0, errors: ['Appareil hors ligne.'] }
  }

  let synced = 0
  let failed = 0
  const errors: string[] = []

  // 1. Sync Live Matches
  const pendingLive = getPendingLiveMatches()
  for (const item of pendingLive) {
    try {
      const response = await fetch('/api/educators/live-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: item.action, session: item.session }),
      })
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `Erreur serveur (${response.status})`)
      }
      removePendingLiveMatch(item.key)
      synced += 1
    } catch (cause) {
      failed += 1
      errors.push(`Match direct (${item.key}) : ${cause instanceof Error ? cause.message : 'Échec'}`)
    }
  }

  // 2. Sync Training Attendances
  const pendingAttendance = getPendingAttendances()
  for (const item of pendingAttendance) {
    try {
      const response = await fetch('/api/educators/training-attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: item.date, entries: item.entries }),
      })
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `Erreur serveur (${response.status})`)
      }
      removePendingAttendance(item.date)
      synced += 1
    } catch (cause) {
      failed += 1
      errors.push(`Présences (${item.date}) : ${cause instanceof Error ? cause.message : 'Échec'}`)
    }
  }

  // 3. Sync Lineups
  const pendingLineups = getPendingLineups()
  for (const item of pendingLineups) {
    try {
      const response = await fetch('/api/educators/match-lineups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: item.date,
          team: item.team,
          slotColumn: item.slotColumn,
          starters: item.starters,
          substitutes: item.substitutes,
        }),
      })
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `Erreur serveur (${response.status})`)
      }
      removePendingLineup(item.key)
      synced += 1
    } catch (cause) {
      failed += 1
      errors.push(`Feuille de match (${item.key}) : ${cause instanceof Error ? cause.message : 'Échec'}`)
    }
  }

  notifyListeners()
  return { synced, failed, errors }
}

/* =========================================================================
 * 5. React Hook useOnlineStatus
 * ========================================================================= */

function getOnlineSnapshot() {
  return typeof navigator !== 'undefined' ? navigator.onLine : true
}

function getPendingCountSnapshot() {
  return getTotalPendingOfflineCount()
}

export function useOnlineStatus() {
  const isOnline = useSyncExternalStore(
    (callback) => {
      window.addEventListener('online', callback)
      window.addEventListener('offline', callback)
      return () => {
        window.removeEventListener('online', callback)
        window.removeEventListener('offline', callback)
      }
    },
    getOnlineSnapshot,
    () => true,
  )

  const pendingCount = useSyncExternalStore(
    subscribe,
    getPendingCountSnapshot,
    () => 0,
  )

  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{
    synced: number
    failed: number
    errors: string[]
  } | null>(null)

  // Auto-sync quand la connexion revient et qu'il y a des données en attente
  useEffect(() => {
    if (isOnline && pendingCount > 0 && !syncing) {
      setSyncing(true)
      syncAllPendingData()
        .then((result) => {
          setSyncResult(result)
        })
        .finally(() => {
          setSyncing(false)
        })
    }
  }, [isOnline, pendingCount, syncing])

  const triggerSync = async () => {
    if (syncing || !isOnline) return
    setSyncing(true)
    try {
      const result = await syncAllPendingData()
      setSyncResult(result)
      return result
    } finally {
      setSyncing(false)
    }
  }

  return {
    isOnline,
    pendingCount,
    syncing,
    syncResult,
    triggerSync,
  }
}
