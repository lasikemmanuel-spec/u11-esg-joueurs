'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowLeftRight,
  Check,
  CircleHelp,
  Clock3,
  Flag,
  Pause,
  Play,
  RotateCcw,
  Save,
  Trash2,
  Trophy,
  X,
} from 'lucide-react'
import type { MatchSheetEntry } from '@/lib/match-results'
import type { PublicPlayer } from '@/lib/players'
import {
  calculateLiveMatchSummary,
  createLiveMatchSession,
  formatLiveMinute,
  getLiveElapsedSeconds,
  getLiveMinute,
  getLivePlayersOnPitch,
  type LiveMatchEvent,
  type LiveMatchSession,
} from '@/lib/live-match-shared'

function playerName(players: PublicPlayer[], number: number) {
  const player = players.find((item) => item.number === number)
  return player ? `${player.firstName} ${player.lastName}` : `N° ${number}`
}

function formatClock(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function LiveMatchConsole({
  match,
  players,
  starters,
  substitutes,
  onClose,
  onFinalized,
}: {
  match: MatchSheetEntry
  players: PublicPlayer[]
  starters: number[]
  substitutes: number[]
  onClose: () => void
  onFinalized: () => void
}) {
  const [session, setSession] = useState<LiveMatchSession | null>(null)
  const [mounted, setMounted] = useState(false)
  const [now, setNow] = useState(Date.now())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [eventMinuteOverride, setEventMinuteOverride] = useState<number | null>(null)
  const [scorerNumber, setScorerNumber] = useState('')
  const [assistNumber, setAssistNumber] = useState('')
  const [playerOut, setPlayerOut] = useState('')
  const [playerIn, setPlayerIn] = useState('')
  const [showReview, setShowReview] = useState(false)
  const autoPauseRef = useRef(false)

  const persistSession = useCallback(async (nextSession: LiveMatchSession, action: 'save' | 'finalize' = 'save') => {
    setSaving(true)
    setError('')
    try {
      const response = await fetch('/api/educators/live-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, session: nextSession }),
      })
      const result = await response.json() as { error?: string; session?: LiveMatchSession }
      if (!response.ok) throw new Error(result.error ?? 'Impossible de sauvegarder le match.')
      if (!result.session) throw new Error('La sauvegarde du match est invalide.')
      setSession(result.session)
      setNow(Date.now())
      return result.session
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Impossible de sauvegarder le match.')
      throw saveError
    } finally {
      setSaving(false)
    }
  }, [])

  useEffect(() => {
    setMounted(true)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose, saving])

  useEffect(() => {
    let active = true
    const params = new URLSearchParams({
      date: match.date,
      team: match.team,
      slotColumn: String(match.slotColumn),
    })
    fetch(`/api/educators/live-match?${params}`, { cache: 'no-store' })
      .then(async (response) => {
        const result = await response.json() as { error?: string; session?: LiveMatchSession | null }
        if (!response.ok) throw new Error(result.error ?? 'Impossible de charger le match.')
        const saved = result.session ?? createLiveMatchSession({
          date: match.date,
          team: match.team,
          slotColumn: match.slotColumn,
          starters,
          substitutes,
        })
        if (active) {
          setSession(saved)
        }
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Impossible de charger le match.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [match.date, match.slotColumn, match.team, starters, substitutes])

  const elapsedSeconds = session ? getLiveElapsedSeconds(session, now) : 0
  const summaryState = useMemo(() => {
    if (!session) return { summary: null, error: '' }
    try {
      return { summary: calculateLiveMatchSummary(session, now), error: '' }
    } catch (summaryError) {
      return {
        summary: null,
        error: summaryError instanceof Error ? summaryError.message : 'Impossible de calculer le récapitulatif du match.',
      }
    }
  }, [now, session])
  const summary = summaryState.summary
  const eventMinute = session ? eventMinuteOverride ?? getLiveMinute(session, now) : 1
  const onPitch = useMemo(
    () => session ? getLivePlayersOnPitch(session) : new Set<number>(),
    [session],
  )
  const activePlayers = useMemo(
    () => players.filter((player) => onPitch.has(player.number)),
    [onPitch, players],
  )
  const benchPlayers = useMemo(
    () => players.filter((player) => session &&
      [...session.starters, ...session.substitutes].includes(player.number) &&
      !onPitch.has(player.number),
    ),
    [onPitch, players, session],
  )

  const saveEvent = async (event: LiveMatchEvent) => {
    if (!session) return
    const nextSession = { ...session, events: [...session.events, event] }
    await persistSession(nextSession)
    setEventMinuteOverride(null)
  }

  const removeEvent = async (eventId: string) => {
    if (!session) return
    await persistSession({ ...session, events: session.events.filter((event) => event.id !== eventId) })
  }

  const startOrResume = async () => {
    if (!session) return
    const phase = session.phase === 'ready'
      ? 'firstHalf'
      : session.phase === 'halftime'
        ? 'secondHalf'
        : session.phase
    await persistSession({
      ...session,
      phase,
      elapsedSeconds: getLiveElapsedSeconds(session, now),
      runningSince: new Date().toISOString(),
    })
  }

  const pause = async () => {
    if (!session) return
    const elapsed = getLiveElapsedSeconds(session, now)
    const phase = session.phase === 'firstHalf' && elapsed >= 25 * 60
      ? 'halftime'
      : session.phase === 'secondHalf' && elapsed >= 50 * 60
        ? 'finished'
        : session.phase
    await persistSession({ ...session, elapsedSeconds: elapsed, runningSince: null, phase })
  }

  const finishMatch = async () => {
    if (!session) return
    await persistSession({
      ...session,
      elapsedSeconds: getLiveElapsedSeconds(session, now),
      runningSince: null,
      phase: 'finished',
    })
  }

  useEffect(() => {
    if (!session?.runningSince || session.phase === 'finished') return
    const timer = window.setInterval(() => {
      const elapsed = getLiveElapsedSeconds(session)
      setNow(Date.now())
      const firstHalfEnded = session.phase === 'firstHalf' && elapsed >= 25 * 60
      const matchEnded = session.phase === 'secondHalf' && elapsed >= 50 * 60
      if ((firstHalfEnded || matchEnded) && !autoPauseRef.current) {
        autoPauseRef.current = true
        const nextSession: LiveMatchSession = {
          ...session,
          elapsedSeconds: firstHalfEnded ? 25 * 60 : 50 * 60,
          runningSince: null,
          phase: firstHalfEnded ? 'halftime' : 'finished',
        }
        void persistSession(nextSession).finally(() => { autoPauseRef.current = false })
      }
    }, 500)
    return () => window.clearInterval(timer)
  }, [persistSession, session])

  const addGoal = async (side: 'for' | 'against') => {
    if (!session) return
    const minute = Number(eventMinute)
    const event: LiveMatchEvent = side === 'against'
      ? { id: crypto.randomUUID(), kind: 'goal', side, minute }
      : {
          id: crypto.randomUUID(),
          kind: 'goal',
          side,
          minute,
          ...(scorerNumber ? { scorerNumber: Number(scorerNumber) } : {}),
          ...(assistNumber ? { assistNumber: Number(assistNumber) } : {}),
        }
    await saveEvent(event)
    setScorerNumber('')
    setAssistNumber('')
  }

  const addSubstitution = async () => {
    if (!session || !playerOut || !playerIn) return
    await saveEvent({
      id: crypto.randomUUID(),
      kind: 'substitution',
      minute: Number(eventMinute),
      playerOut: Number(playerOut),
      playerIn: Number(playerIn),
    })
    setPlayerOut('')
    setPlayerIn('')
  }

  const finalize = async () => {
    if (!session || session.phase !== 'finished') return
    const completed = await persistSession(session, 'finalize')
    if (completed.completed) onFinalized()
  }

  if (!mounted) return null

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="live-match-title"
      className="fixed inset-0 z-[90] overflow-y-auto bg-[#101c41] text-white"
    >
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-white/10 bg-[#101c41]/95 px-4 py-3 backdrop-blur">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`flex size-10 shrink-0 items-center justify-center rounded-full ${match.team === 'E1' ? 'bg-sky-300/15 text-sky-200' : 'bg-amber-300/15 text-amber-200'}`}>
            <Trophy aria-hidden="true" className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 id="live-match-title" className="truncate text-base font-black">
              Direct · Équipe {match.team === 'E1' ? '1' : '2'}
            </h2>
            <p className="truncate text-xs text-white/65">{match.opponent || 'Adversaire à préciser'}</p>
          </div>
        </div>
        <button type="button" onClick={onClose} disabled={saving} aria-label="Fermer le direct" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-50">
          <X aria-hidden="true" className="size-5" />
        </button>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-4 pb-10">
        {loading ? (
          <p role="status" className="rounded-2xl bg-white/5 p-6 text-center text-sm text-white/70">Chargement du match…</p>
        ) : !session ? (
          <p role="alert" className="rounded-2xl border border-red-300/30 bg-red-500/10 p-4 text-sm">{error || 'Le match ne peut pas être chargé.'}</p>
        ) : (
          <>
            <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#1e3a8a] to-[#172554] p-5 text-center shadow-xl">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">
                {session.phase === 'halftime' ? 'Mi-temps' : session.phase === 'finished' ? 'Fin du match' : session.phase === 'secondHalf' ? '2e mi-temps' : '1re mi-temps'}
              </p>
              <div className="mt-2 flex items-center justify-center gap-5">
                <div className="min-w-0 flex-1 text-right">
                  <p className="text-xs font-bold text-white/65">ESG</p>
                  <p className="text-5xl font-black tabular-nums">{summary?.goalsFor ?? 0}</p>
                </div>
                <span className="text-2xl font-black text-white/35">–</span>
                <div className="min-w-0 flex-1 text-left">
                  <p className="truncate text-xs font-bold text-white/65">{match.opponent || 'Adversaire'}</p>
                  <p className="text-5xl font-black tabular-nums">{summary?.goalsAgainst ?? 0}</p>
                </div>
              </div>
              <p className="mt-3 font-mono text-4xl font-black tabular-nums text-amber-300">{formatClock(elapsedSeconds)}</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {session.phase === 'ready' || session.phase === 'halftime' || session.runningSince === null && session.phase !== 'finished' ? (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void startOrResume().catch(() => undefined)}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full bg-emerald-400 px-5 text-sm font-black text-emerald-950 disabled:opacity-50"
                  >
                    <Play aria-hidden="true" className="size-4" />
                    {session.phase === 'ready' ? 'Démarrer la 1re mi-temps' : session.phase === 'halftime' ? 'Démarrer la 2e mi-temps' : 'Reprendre'}
                  </button>
                ) : session.runningSince ? (
                  <button type="button" disabled={saving} onClick={() => void pause().catch(() => undefined)} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-amber-300 px-5 text-sm font-black text-amber-950 disabled:opacity-50">
                    <Pause aria-hidden="true" className="size-4" />
                    Pause
                  </button>
                ) : null}
                {!['ready', 'finished'].includes(session.phase) && (
                  <button type="button" disabled={saving} onClick={() => void finishMatch().catch(() => undefined)} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 text-sm font-bold disabled:opacity-50">
                    <Flag aria-hidden="true" className="size-4" />
                    Terminer
                  </button>
                )}
              </div>
              <p className="mt-3 text-[11px] text-white/55">2 mi-temps de 25 min · sauvegarde automatique</p>
            </section>

            {session.phase !== 'ready' && session.phase !== 'finished' && (
              <>
                <section className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="font-black">Ajouter un but</h3>
                    <label className="flex items-center gap-2 text-xs font-bold text-white/70">
                      Minute
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={eventMinute}
                        onChange={(event) => setEventMinuteOverride(event.target.value ? Number(event.target.value) : getLiveMinute(session, now))}
                        className="h-9 w-16 rounded-lg border border-white/15 bg-[#101c41] px-2 text-center text-sm text-white"
                      />
                    </label>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="text-xs font-semibold text-white/70">
                      Buteur ESG (facultatif)
                      <select value={scorerNumber} onChange={(event) => setScorerNumber(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-white/15 bg-[#101c41] px-2 text-sm text-white">
                        <option value="">Choisir le buteur</option>
                        {activePlayers.map((player) => <option key={player.number} value={player.number}>{player.firstName} {player.lastName}</option>)}
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-white/70">
                      Passeur (facultatif)
                      <select value={assistNumber} onChange={(event) => setAssistNumber(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-white/15 bg-[#101c41] px-2 text-sm text-white">
                        <option value="">Sans passe décisive</option>
                        {activePlayers.filter((player) => String(player.number) !== scorerNumber).map((player) => <option key={player.number} value={player.number}>{player.firstName} {player.lastName}</option>)}
                      </select>
                    </label>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button type="button" disabled={saving} onClick={() => void addGoal('for').catch(() => undefined)} className="min-h-11 rounded-xl bg-emerald-400 px-3 text-sm font-black text-emerald-950 disabled:opacity-50">+ But ESG</button>
                    <button type="button" disabled={saving} onClick={() => void addGoal('against').catch(() => undefined)} className="min-h-11 rounded-xl bg-rose-400/15 px-3 text-sm font-black text-rose-100 disabled:opacity-50">+ But adverse</button>
                  </div>
                </section>

                <section className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="font-black">Remplacement</h3>
                    <span className="flex items-center gap-1 text-[10px] font-bold text-white/55"><RotateCcw aria-hidden="true" className="size-3" />Entrées libres</span>
                  </div>
                  <label className="mb-3 flex items-center gap-2 text-xs font-bold text-white/70">
                    Minute
                    <input type="number" min={1} max={50} value={eventMinute} onChange={(event) => setEventMinuteOverride(event.target.value ? Number(event.target.value) : getLiveMinute(session, now))} className="h-9 w-16 rounded-lg border border-white/15 bg-[#101c41] px-2 text-center text-sm text-white" />
                  </label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="text-xs font-semibold text-white/70">
                      Sort
                      <select value={playerOut} onChange={(event) => setPlayerOut(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-white/15 bg-[#101c41] px-2 text-sm text-white">
                        <option value="">Joueur sur le terrain</option>
                        {activePlayers.map((player) => <option key={player.number} value={player.number}>{player.firstName} {player.lastName}</option>)}
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-white/70">
                      Entre
                      <select value={playerIn} onChange={(event) => setPlayerIn(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-white/15 bg-[#101c41] px-2 text-sm text-white">
                        <option value="">Joueur sur le banc</option>
                        {benchPlayers.map((player) => <option key={player.number} value={player.number}>{player.firstName} {player.lastName}</option>)}
                      </select>
                    </label>
                  </div>
                  <button type="button" disabled={saving || !playerOut || !playerIn} onClick={() => void addSubstitution().catch(() => undefined)} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 text-sm font-black disabled:opacity-40">
                    <ArrowLeftRight aria-hidden="true" className="size-4" />
                    Enregistrer le remplacement
                  </button>
                </section>
              </>
            )}

            <section className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="font-black">Actions du match</h3>
                <span className="text-xs text-white/55">{session.events.length} action{session.events.length === 1 ? '' : 's'}</span>
              </div>
              {session.events.length === 0 ? (
                <p className="flex items-center gap-2 text-sm text-white/55"><CircleHelp aria-hidden="true" className="size-4" />Les buts et changements apparaîtront ici.</p>
              ) : (
                <ol className="flex flex-col gap-2">
                  {[...session.events].reverse().map((event) => (
                    <li key={event.id} className="flex items-center gap-3 rounded-xl bg-white/[0.06] px-3 py-2">
                      <span className="shrink-0 rounded-lg bg-white/10 px-2 py-1 text-xs font-black text-amber-200">{formatLiveMinute(event.minute)}</span>
                      <p className="min-w-0 flex-1 text-sm font-semibold">
                        {event.kind === 'goal'
                          ? event.side === 'against'
                            ? `But adverse · ${match.opponent || 'Adversaire'}`
                            : `But ${event.scorerNumber ? playerName(players, event.scorerNumber) : 'ESG'}${event.assistNumber ? ` · passe ${playerName(players, event.assistNumber)}` : ''}`
                          : `${playerName(players, event.playerOut)} sort · ${playerName(players, event.playerIn)} entre`}
                      </p>
                      <button type="button" disabled={saving || session.completed} onClick={() => void removeEvent(event.id).catch(() => undefined)} aria-label="Annuler cette action" className="flex size-9 shrink-0 items-center justify-center rounded-lg text-white/55 hover:bg-rose-400/15 hover:text-rose-200 disabled:opacity-30">
                        <Trash2 aria-hidden="true" className="size-4" />
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            {session.phase === 'finished' && summary && (
              <section className="rounded-2xl border border-amber-300/30 bg-amber-300/[0.08] p-4">
                <h3 className="text-lg font-black">Récapitulatif à valider</h3>
                <p className="mt-1 text-sm text-white/70">Score final : {summary.goalsFor} – {summary.goalsAgainst} · temps arrondi à la minute.</p>
                <div className="mt-3 overflow-hidden rounded-xl border border-white/10">
                  <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 bg-white/10 px-3 py-2 text-[10px] font-black uppercase text-white/65">
                    <span>Joueur</span><span>MN</span><span>BUT</span><span>PASSE</span>
                  </div>
                  {summary.players.map((player) => (
                    <div key={player.number} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 border-t border-white/10 px-3 py-2 text-sm">
                      <span className="min-w-0 truncate">{playerName(players, player.number)}</span>
                      <span className="w-10 text-right font-bold tabular-nums">{player.minutes}</span>
                      <span className="w-10 text-right font-bold tabular-nums">{player.goals}</span>
                      <span className="w-10 text-right font-bold tabular-nums">{player.assists}</span>
                    </div>
                  ))}
                </div>
                {session.completed ? (
                  <p role="status" className="mt-3 flex items-center gap-2 font-bold text-emerald-300"><Check aria-hidden="true" className="size-4" />Résultat et statistiques enregistrés dans la feuille.</p>
                ) : (
                  <>
                    <button type="button" onClick={() => setShowReview((value) => !value)} className="mt-3 min-h-10 text-xs font-bold text-amber-200 underline underline-offset-2">
                      {showReview ? 'Masquer la confirmation' : 'Je vérifie le récapitulatif'}
                    </button>
                    {showReview && (
                      <button type="button" disabled={saving} onClick={() => void finalize().catch(() => undefined)} className="mt-2 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-300 px-4 text-sm font-black text-amber-950 disabled:opacity-50">
                        <Save aria-hidden="true" className="size-4" />
                        {saving ? 'Enregistrement…' : 'Valider et remplir la feuille'}
                      </button>
                    )}
                    {summaryState.error && (
                      <p role="alert" className="rounded-xl border border-rose-300/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
                        {summaryState.error}
                      </p>
                    )}
                  </>
                )}
              </section>
            )}
          </>
        )}

        {error && <p role="alert" className="rounded-xl border border-rose-300/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">{error}</p>}
        {saving && <p role="status" className="text-center text-xs font-semibold text-white/60">Sauvegarde…</p>}
      </main>
    </div>,
    document.body,
  )
}
