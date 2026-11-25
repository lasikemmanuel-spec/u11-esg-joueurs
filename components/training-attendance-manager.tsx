'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CalendarDays,
  CloudRain,
  CircleCheck,
  CircleHelp,
  HeartPulse,
  MessageCircle,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  UsersRound,
  X,
} from 'lucide-react'
import { ClubCrest } from '@/components/club-crest'
import {
  getOfflineAttendance,
  queuePendingAttendance,
  removePendingAttendance,
  saveOfflineAttendance,
} from '@/lib/offline-storage'
import type { PublicPlayer } from '@/lib/players'
import {
  TRAINING_ATTENDANCE_STATUSES,
  type TrainingAttendanceSession,
  type TrainingAttendanceStatus,
} from '@/lib/training-attendance-shared'
import { MATCH_SEASON_END, MATCH_SEASON_START } from '@/lib/match-season'

const STATUS_PRESENTATION = {
  P: { icon: CircleCheck, label: 'Présent', active: 'border-emerald-400 bg-emerald-500 text-white', idle: 'border-emerald-200 bg-emerald-50/70 text-emerald-800 hover:bg-emerald-100', accent: 'border-l-emerald-400' },
  AJ: { icon: ShieldCheck, label: 'Absence justifiée', active: 'border-amber-400 bg-amber-400 text-amber-950', idle: 'border-amber-200 bg-amber-50/70 text-amber-900 hover:bg-amber-100', accent: 'border-l-amber-400' },
  AI: { icon: X, label: 'Absence injustifiée', active: 'border-rose-400 bg-rose-500 text-white', idle: 'border-rose-200 bg-rose-50/70 text-rose-800 hover:bg-rose-100', accent: 'border-l-rose-400' },
  B: { icon: HeartPulse, label: 'Blessé', active: 'border-sky-400 bg-sky-500 text-white', idle: 'border-sky-200 bg-sky-50/70 text-sky-800 hover:bg-sky-100', accent: 'border-l-sky-400' },
  E: { icon: CircleHelp, label: 'Exempt', active: 'border-violet-400 bg-violet-500 text-white', idle: 'border-violet-200 bg-violet-50/70 text-violet-800 hover:bg-violet-100', accent: 'border-l-violet-400' },
} as const

function nextTrainingDate() {
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  while (date.getDay() !== 2 && date.getDay() !== 5) date.setDate(date.getDate() + 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function normalizeSearch(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr-FR').trim()
}

type PlayerStatusFilter = 'all' | 'todo' | TrainingAttendanceStatus

export function TrainingAttendanceManager({
  players,
  sessions,
  loadError,
  onPrepareCancellation,
}: {
  players: PublicPlayer[]
  sessions: TrainingAttendanceSession[]
  loadError: boolean
  onPrepareCancellation: (date: string) => void
}) {
  const router = useRouter()
  const [date, setDate] = useState('')
  const [query, setQuery] = useState('')
  const [quickEntryMode, setQuickEntryMode] = useState(false)
  const [quickStatus, setQuickStatus] = useState<TrainingAttendanceStatus | null>(null)
  const [playerStatusFilter, setPlayerStatusFilter] = useState<PlayerStatusFilter>('all')
  const [statuses, setStatuses] = useState<Record<number, TrainingAttendanceStatus | ''>>({})
  const [savedStatuses, setSavedStatuses] = useState<Record<number, TrainingAttendanceStatus | ''>>({})
  const [saving, setSaving] = useState(false)
  const [cancellationSaving, setCancellationSaving] = useState(false)
  const [showCancellationForm, setShowCancellationForm] = useState(false)
  const [cancellationReason, setCancellationReason] = useState('Météo')
  const [cancellationError, setCancellationError] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!date) setDate(nextTrainingDate())
  }, [date])

  const savedSession = useMemo(() => sessions.find((session) => session.date === date), [sessions, date])
  useEffect(() => {
    const next: Record<number, TrainingAttendanceStatus | ''> = {}
    const offlineEntries = getOfflineAttendance(date)
    const offlineMap = offlineEntries ? Object.fromEntries(offlineEntries.map((e) => [e.number, e.status])) : null

    for (const player of players) {
      const serverValue = savedSession?.playerStatuses[player.number]
      const value = savedSession?.cancellation ? '' : serverValue ?? offlineMap?.[player.number] ?? ''
      next[player.number] = TRAINING_ATTENDANCE_STATUSES.some((status) => status.value === value)
        ? value as TrainingAttendanceStatus
        : ''
    }
    setStatuses(next)
    setSavedStatuses(next)
    setQuickEntryMode(false)
    setQuickStatus(null)
    setPlayerStatusFilter('all')
    setMessage('')
    setError('')
    setShowCancellationForm(false)
    setCancellationError('')
  }, [date, savedSession, players])

  const counts = useMemo(() => {
    let filled = 0
    let present = 0
    for (const value of Object.values(statuses)) {
      if (!value) continue
      filled += 1
      if (value === 'P') present += 1
    }
    return { filled, present, missing: players.length - filled }
  }, [players.length, statuses])

  const hasUnsavedChanges = useMemo(
    () => players.some((player) => (statuses[player.number] ?? '') !== (savedStatuses[player.number] ?? '')),
    [players, savedStatuses, statuses],
  )

  const statusCounts = useMemo(() => {
    const next: Record<TrainingAttendanceStatus, number> = { P: 0, AJ: 0, AI: 0, B: 0, E: 0 }
    for (const value of Object.values(statuses)) {
      if (value) next[value] += 1
    }
    return next
  }, [statuses])

  const visiblePlayers = useMemo(() => {
    const term = normalizeSearch(query)
    return players.filter((player) => {
      const status = statuses[player.number]
      const matchesFilter = playerStatusFilter === 'all'
        ? true
        : playerStatusFilter === 'todo'
          ? !status
          : status === playerStatusFilter
      const matchesSearch = !term || normalizeSearch(`${player.firstName} ${player.lastName} ${player.number}`).includes(term)
      return matchesFilter && matchesSearch
    })
  }, [players, query, playerStatusFilter, statuses])

  const setAllPresent = () => {
    const next = Object.fromEntries(players.map((player) => [player.number, 'P' as const]))
    setStatuses(next)
    setQuickEntryMode(true)
    setQuickStatus(null)
    if (date) {
      saveOfflineAttendance(date, players.map((p) => ({ number: p.number, status: 'P' })))
    }
    setMessage('')
    setError('')
  }

  const resetAttendance = () => {
    const next = Object.fromEntries(players.map((player) => [player.number, '' as const]))
    setStatuses(next)
    setQuickEntryMode(false)
    setQuickStatus(null)
    if (date) {
      saveOfflineAttendance(date, players.map((p) => ({ number: p.number, status: '' })))
    }
    setMessage('')
    setError('')
  }

  const cancelSession = async () => {
    if (!date || !cancellationReason.trim()) return
    setCancellationSaving(true)
    setCancellationError('')
    try {
      const response = await fetch('/api/educators/training-cancellations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, reason: cancellationReason }),
      })
      const result = await response.json() as { error?: string }
      if (!response.ok) throw new Error(result.error ?? 'Impossible d’annuler la séance.')
      setShowCancellationForm(false)
      removePendingAttendance(date)
      saveOfflineAttendance(date, players.map((player) => ({ number: player.number, status: '' })))
      const emptyStatuses: Record<number, TrainingAttendanceStatus | ''> = Object.fromEntries(
        players.map((player) => [player.number, '']),
      )
      setStatuses(emptyStatuses)
      setSavedStatuses(emptyStatuses)
      router.refresh()
    } catch (cause) {
      setCancellationError(cause instanceof Error ? cause.message : 'Impossible d’annuler la séance.')
    } finally {
      setCancellationSaving(false)
    }
  }

  const reinstateSession = async () => {
    if (!date) return
    setCancellationSaving(true)
    setCancellationError('')
    try {
      const response = await fetch(`/api/educators/training-cancellations?date=${encodeURIComponent(date)}`, {
        method: 'DELETE',
      })
      const result = await response.json() as { error?: string }
      if (!response.ok) throw new Error(result.error ?? 'Impossible de rétablir la séance.')
      router.refresh()
    } catch (cause) {
      setCancellationError(cause instanceof Error ? cause.message : 'Impossible de rétablir la séance.')
    } finally {
      setCancellationSaving(false)
    }
  }

  const save = async () => {
    if (savedSession?.cancellation) return
    setSaving(true)
    setMessage('')
    setError('')
    const entries = players.map((player) => ({ number: player.number, status: statuses[player.number] }))
    const savedSnapshot = Object.fromEntries(entries.map((entry) => [entry.number, entry.status ?? '']))
    saveOfflineAttendance(date, entries)

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      queuePendingAttendance(date, entries)
      setSavedStatuses(savedSnapshot)
      setMessage('Présences sauvegardées localement (mode hors-ligne) 📡. Elles seront transmises automatiquement dès la reconnexion.')
      setSaving(false)
      return
    }

    try {
      const response = await fetch('/api/educators/training-attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, entries }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Enregistrement impossible.')
      removePendingAttendance(date)
      setSavedStatuses(savedSnapshot)
      setMessage('Présences enregistrées dans le classeur Google.')
      router.refresh()
    } catch (cause) {
      const isNetwork =
        (typeof navigator !== 'undefined' && !navigator.onLine) ||
        cause instanceof TypeError ||
        (cause instanceof Error && (cause.message.includes('fetch') || cause.message.includes('NetworkError')))

      if (isNetwork) {
        queuePendingAttendance(date, entries)
        setSavedStatuses(savedSnapshot)
        setMessage('Connexion coupée : présences enregistrées localement (mode hors-ligne) 📡. Elles seront envoyées dès le retour du réseau.')
      } else {
        setError(cause instanceof Error ? cause.message : 'Enregistrement impossible.')
      }
    } finally {
      setSaving(false)
    }
  }

  const canSave = Boolean(date) && !loadError && !savedSession?.cancellation && players.length > 0 && counts.missing === 0 && !saving && !cancellationSaving
  const completion = players.length ? Math.round(counts.filled / players.length * 100) : 0

  return (
    <section className="flex flex-col gap-2 sm:gap-5" aria-labelledby="training-attendance-title">
      <header className="relative isolate overflow-hidden rounded-[1.5rem] border border-[#e0bd43]/60 bg-gradient-to-br from-[#101b40] via-[#1d397f] to-[#12224e] p-2.5 text-white shadow-xl sm:rounded-[2rem] sm:p-7 lg:p-8 xl:p-6 2xl:p-8">
        <div aria-hidden="true" className="pointer-events-none absolute -top-20 -right-14 -z-10 size-64 rounded-full bg-sky-300/10 blur-3xl" />
        <div className="flex flex-col gap-3 sm:gap-6 xl:flex-row xl:items-center xl:justify-between xl:gap-8">
          <div className="flex items-center gap-2.5 sm:gap-5 xl:min-w-0 xl:flex-[1.1]">
            <ClubCrest className="size-10 ring-4 ring-[#e0bd43] sm:size-20" />
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-amber-300 sm:text-xs">
                <Sparkles aria-hidden="true" className="size-3.5" />ES Genech · U11
              </p>
              <h2 id="training-attendance-title" className="mt-1 text-lg font-black leading-tight sm:text-3xl lg:text-4xl xl:whitespace-nowrap xl:text-3xl 2xl:text-4xl">Feuille de présence</h2>
            </div>
          </div>
          <div className="grid min-w-0 gap-2 xl:w-full xl:max-w-[32rem] xl:flex-1 xl:rounded-2xl xl:border xl:border-white/15 xl:bg-white/[0.06] xl:p-4">
            <label className="grid gap-1 text-[11px] font-bold text-white/75 sm:gap-1.5 sm:text-xs">
              <span className="flex items-center gap-1.5"><CalendarDays aria-hidden="true" className="size-4 text-amber-300" />Date de la séance</span>
              <input
                type="date"
                min={MATCH_SEASON_START}
                max={MATCH_SEASON_END}
                value={date}
                onChange={(event) => {
                  const nextDate = event.target.value
                  if (!nextDate || nextDate === date) return
                  if (
                    hasUnsavedChanges &&
                    !window.confirm('Tu as des modifications non enregistrées. Changer de date les abandonnera. Continuer ?')
                  ) return
                  setDate(nextDate)
                }}
                className="h-10 min-w-0 rounded-xl border border-white/20 bg-white/10 px-3 text-sm font-bold text-white outline-none focus-visible:ring-2 focus-visible:ring-amber-300 [color-scheme:dark] sm:h-12"
              />
            </label>
            {hasUnsavedChanges && (
              <p role="status" className="rounded-lg border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-xs font-semibold text-amber-100">
                Modifications non enregistrées
              </p>
            )}
          </div>
        </div>

        {savedSession?.cancellation ? (
          <p className="mt-3 rounded-2xl border border-sky-200/30 bg-sky-100/10 p-4 text-sm font-bold text-sky-100 sm:mt-6">
            Séance annulée · exclue des statistiques de présence
          </p>
        ) : (
        <>
          <div className="mt-2 grid gap-2 rounded-2xl border border-white/10 bg-white/[0.07] p-2.5 sm:mt-6 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-4 sm:p-5">
          <div>
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/60 sm:text-xs">L’équipe est prête ?</p>
                <p className="mt-1 text-xl font-black tabular-nums sm:text-3xl">
                  <span className="text-emerald-300">{counts.present}</span><span className="text-white/45"> / {players.length}</span>
                  <span className="ml-2 text-base font-bold text-white/80">présents</span>
                </p>
              </div>
              <p className={`text-xs font-bold sm:text-sm ${counts.missing ? 'text-amber-200' : 'text-emerald-200'}`}>
                {counts.missing ? `Encore ${counts.missing} à renseigner` : players.length ? 'Groupe complet · prêt pour le terrain !' : 'Effectif indisponible'}
              </p>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/25 sm:mt-3 sm:h-2.5" role="progressbar" aria-label="Présences renseignées" aria-valuemin={0} aria-valuemax={players.length} aria-valuenow={counts.filled}>
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-lime-300 transition-[width] duration-500" style={{ width: `${completion}%` }} />
            </div>
          </div>
        </div>
      <div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:flex sm:justify-end sm:gap-2 xl:mt-4 xl:border-t xl:border-white/10 xl:pt-4">
        <button type="button" onClick={setAllPresent} disabled={!players.length || loadError || Boolean(savedSession?.cancellation)} aria-label="Marquer tous les joueurs présents" title="Marque toute l’équipe présente puis ouvre la correction rapide des exceptions." className="col-span-2 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-300 to-yellow-400 px-3 text-xs font-black text-[#14234e] shadow-lg transition hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-1 sm:min-h-12 sm:px-5 sm:text-sm">
          <UsersRound aria-hidden="true" className="size-4 shrink-0" />
          <span className="sm:hidden">Marquer tous présents</span>
          <span className="hidden whitespace-nowrap sm:inline">Marquer tous les joueurs présents</span>
        </button>
        <button
          type="button"
          aria-pressed={quickEntryMode}
          onClick={() => {
            setQuickEntryMode((current) => !current)
            setQuickStatus(null)
          }}
          disabled={!players.length || loadError || Boolean(savedSession?.cancellation)}
          className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-12 sm:px-4 sm:text-sm ${quickEntryMode ? 'border-sky-200 bg-sky-100 text-sky-950' : 'border-white/25 bg-white/10 text-white hover:bg-white/20'}`}
        >
          <HeartPulse aria-hidden="true" className="size-4 shrink-0" />
          <span className="sm:hidden">{quickEntryMode ? 'Terminer' : 'Corriger'}</span>
          <span className="hidden whitespace-nowrap sm:inline">{quickEntryMode ? 'Terminer les corrections' : 'Corriger les exceptions'}</span>
        </button>
        <button type="button" onClick={resetAttendance} disabled={!players.length || loadError || counts.filled === 0 || Boolean(savedSession?.cancellation)} title="Efface les choix de cette saisie à l’écran ; le classeur n’est pas modifié." className="inline-flex min-h-9 items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 text-[11px] font-bold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-10 sm:text-xs">
          <RefreshCw aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="sm:hidden">Réinitialiser</span>
          <span className="hidden whitespace-nowrap sm:inline">Réinitialiser la feuille</span>
        </button>
      </div>
      {quickEntryMode && (
        <div className="mt-2 rounded-xl border border-sky-200/20 bg-white/[0.05] p-3">
          <p className="text-[11px] font-semibold text-white/80">
            {quickStatus
              ? quickStatus === 'P'
                ? 'Touchez les joueurs à remettre présents.'
                : `Touchez les joueurs à marquer « ${STATUS_PRESENTATION[quickStatus].label} ». Retouchez-les pour les remettre présents.`
              : 'Choisissez un statut, puis touchez les joueurs concernés.'}
          </p>
          <div className="mt-2 grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap">
            {TRAINING_ATTENDANCE_STATUSES.map((status) => {
              const presentation = STATUS_PRESENTATION[status.value]
              const StatusIcon = presentation.icon
              const selected = quickStatus === status.value
              return (
                <button
                  key={status.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setQuickStatus(status.value)}
                  className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:text-xs ${selected ? `${presentation.active} ring-2 ring-white/70` : presentation.idle}`}
                >
                  <StatusIcon aria-hidden="true" className="size-3.5 shrink-0" />
                  {status.shortLabel}
                </button>
              )
            })}
          </div>
        </div>
      )}
        </>
        )}
      </header>

      {loadError && (
        <div role="alert" className="rounded-xl border border-amber-500/50 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-bold">L’historique du classeur n’a pas pu être chargé.</p>
          <p className="mt-1">Actualise la page avant de saisir une séance pour éviter d’écraser des données.</p>
          <button type="button" onClick={() => router.refresh()} className="mt-3 font-bold underline"><RefreshCw aria-hidden="true" className="mr-1 inline size-4" />Réessayer</button>
        </div>
      )}

      {savedSession?.cancellation ? (
        <section className="rounded-2xl border border-sky-300 bg-sky-50 p-4 text-sky-950 shadow-sm sm:p-5" aria-labelledby="training-cancelled-title">
          <div className="flex items-start gap-3">
            <CloudRain aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-sky-700" />
            <div className="min-w-0 flex-1">
              <h3 id="training-cancelled-title" className="font-black">Séance annulée · {formatDate(date)}</h3>
              <p className="mt-1 text-sm">Motif : {savedSession.cancellation.reason}</p>
              <p className="mt-1 text-xs text-sky-800">Cette séance est exclue des statistiques de présence.</p>
              <p className="mt-1 text-xs text-sky-800">Enregistrée par {savedSession.cancellation.cancelledBy}.</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 pl-8">
            <button type="button" onClick={() => onPrepareCancellation(date)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#25D366] px-4 text-sm font-bold text-white shadow-sm hover:brightness-105">
              <MessageCircle aria-hidden="true" className="size-4" />Préparer le message WhatsApp
            </button>
            <button type="button" onClick={() => void reinstateSession()} disabled={cancellationSaving || loadError} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-sky-300 bg-white px-4 text-sm font-bold text-sky-950 hover:bg-sky-100 disabled:opacity-50">
              <RotateCcw aria-hidden="true" className="size-4" />{cancellationSaving ? 'Rétablissement…' : 'Rétablir la séance'}
            </button>
          </div>
          {cancellationError && <p role="alert" className="mt-3 pl-8 text-sm font-semibold text-rose-700">{cancellationError}</p>}
        </section>
      ) : (
        <>
          {!loadError && (
            <section className="rounded-2xl border border-sky-200/70 bg-gradient-to-br from-sky-50/70 to-white/90 p-2.5 shadow-sm sm:p-4">
              {!showCancellationForm ? (
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setShowCancellationForm(true)} disabled={!date || saving} aria-label="Annuler cette séance" className="inline-flex min-h-12 min-w-0 items-center justify-center gap-1.5 rounded-xl border border-sky-200 bg-white/80 px-2 text-[11px] font-bold text-sky-950 shadow-sm transition hover:border-sky-300 hover:bg-sky-100 active:scale-[0.98] disabled:opacity-50 sm:gap-2 sm:px-3 sm:text-xs">
                    <CloudRain aria-hidden="true" className="size-4 shrink-0" /><span>Annuler séance</span>
                  </button>
                  <button type="button" onClick={() => onPrepareCancellation(date)} disabled={!date} aria-label="Préparer le message d’intempérie" title="Préparer le message d’intempérie" className="inline-flex min-h-12 min-w-0 items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-100 to-teal-100 px-2 text-[11px] font-bold text-emerald-950 shadow-sm transition hover:border-emerald-300 hover:from-emerald-200 hover:to-teal-200 active:scale-[0.98] disabled:opacity-50 sm:gap-2 sm:px-3 sm:text-xs">
                    <MessageCircle aria-hidden="true" className="size-4 shrink-0" /><span>Message intempérie</span>
                  </button>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                  <label className="grid gap-1 text-sm font-bold text-foreground">
                    Motif de l’annulation
                    <input
                      type="text"
                      maxLength={240}
                      value={cancellationReason}
                      onChange={(event) => setCancellationReason(event.target.value)}
                      className="h-11 rounded-xl border border-border bg-background px-3 font-normal"
                    />
                  </label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setShowCancellationForm(false)} disabled={cancellationSaving} className="min-h-11 rounded-xl px-4 text-sm font-bold text-muted-foreground hover:bg-muted disabled:opacity-50">Retour</button>
                    <button type="button" onClick={() => void cancelSession()} disabled={!date || !cancellationReason.trim() || saving || cancellationSaving} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-sky-700 px-4 text-sm font-bold text-white hover:bg-sky-800 disabled:opacity-50">
                      <CloudRain aria-hidden="true" className="size-4" />{cancellationSaving ? 'Enregistrement…' : 'Confirmer l’annulation'}
                    </button>
                  </div>
                </div>
              )}
              {cancellationError && <p role="alert" className="mt-3 text-sm font-semibold text-rose-700">{cancellationError}</p>}
            </section>
          )}
          {players.length === 0 ? (
        <p role="status" className="rounded-xl bg-muted p-4 text-sm">Aucun joueur dans l’effectif.</p>
      ) : (
        <>
          <label className="relative block sm:max-w-xl">
            <span className="sr-only">Rechercher un joueur par nom, prénom ou numéro</span>
            <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              aria-label="Rechercher un joueur par nom, prénom ou numéro"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher un joueur…"
              className="h-11 w-full rounded-2xl border border-accent/40 bg-card pr-4 pl-12 text-sm shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <div role="group" aria-label="Filtrer les joueurs par statut" className="flex flex-wrap gap-1.5">
              <button
                type="button"
                aria-pressed={playerStatusFilter === 'all'}
                onClick={() => setPlayerStatusFilter('all')}
                className={`inline-flex min-h-9 items-center gap-1 rounded-full border px-3 py-1 text-[10px] font-bold transition ${playerStatusFilter === 'all' ? 'border-[#172554] bg-[#172554] text-white' : 'border-border bg-card text-foreground hover:bg-muted'}`}
              >
                Tous <span className="tabular-nums">{players.length}</span>
              </button>
              <button
                type="button"
                aria-pressed={playerStatusFilter === 'todo'}
                onClick={() => setPlayerStatusFilter('todo')}
                className={`inline-flex min-h-9 items-center gap-1 rounded-full border px-3 py-1 text-[10px] font-bold transition ${playerStatusFilter === 'todo' ? 'border-amber-500 bg-amber-100 text-amber-950' : 'border-amber-200 bg-amber-50/70 text-amber-900 hover:bg-amber-100'}`}
              >
                À renseigner <span className="tabular-nums">{counts.missing}</span>
              </button>
              {TRAINING_ATTENDANCE_STATUSES.map((status) => {
                const presentation = STATUS_PRESENTATION[status.value]
                const StatusIcon = presentation.icon
                const selected = playerStatusFilter === status.value
                return (
                  <button
                    key={status.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setPlayerStatusFilter(status.value)}
                    className={`inline-flex min-h-9 items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold transition ${selected ? presentation.active : presentation.idle}`}
                  >
                    <StatusIcon aria-hidden="true" className="size-3" />
                    <span>{status.shortLabel}</span>
                    <span className="tabular-nums">{statusCounts[status.value]}</span>
                  </button>
                )
              })}
          </div>
          {savedSession && <p className="hidden w-fit max-w-full rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900 sm:block">Séance déjà enregistrée · tes changements remplaceront les anciennes valeurs</p>}
          {query && <p aria-live="polite" className="-mt-3 text-xs text-muted-foreground">{visiblePlayers.length} joueur{visiblePlayers.length === 1 ? '' : 's'} trouvé{visiblePlayers.length === 1 ? '' : 's'}</p>}

          {visiblePlayers.length === 0 ? (
            <p role="status" className="rounded-xl bg-muted p-4 text-sm">
              {query
                ? `Aucun joueur ne correspond à « ${query} ».`
                : playerStatusFilter === 'todo'
                  ? 'Tous les joueurs ont un statut.'
                  : 'Aucun joueur ne correspond à ce statut.'}
            </p>
          ) : (
          <ul className={`grid gap-2 sm:gap-3 sm:grid-cols-2 2xl:grid-cols-3 ${playerStatusFilter === 'all' && !query ? 'pb-28' : ''}`}>
            {visiblePlayers.map((player) => {
              const currentStatus = statuses[player.number]
              const selectedQuickStatus = quickStatus !== null && currentStatus === quickStatus
              return (
                <li key={player.number} className={`group relative overflow-hidden rounded-xl border border-border/70 border-l-4 bg-card/90 p-2 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md sm:rounded-2xl sm:p-3 ${currentStatus ? STATUS_PRESENTATION[currentStatus].accent : 'border-l-transparent'} ${quickEntryMode && selectedQuickStatus ? 'ring-2 ring-sky-400' : ''}`}>
                  {quickEntryMode ? (
                    <button
                      type="button"
                      disabled={!quickStatus}
                      aria-pressed={selectedQuickStatus}
                      aria-label={quickStatus
                        ? currentStatus === quickStatus && quickStatus !== 'P'
                          ? `Remettre ${player.firstName} ${player.lastName} présent`
                          : `Marquer ${player.firstName} ${player.lastName} : ${STATUS_PRESENTATION[quickStatus].label}`
                        : `Choisir un statut pour ${player.firstName} ${player.lastName}`}
                      onClick={() => {
                        if (!quickStatus) return
                        const nextStatus: TrainingAttendanceStatus =
                          quickStatus === 'P' || currentStatus === quickStatus ? 'P' : quickStatus
                        setStatuses((current) => ({ ...current, [player.number]: nextStatus }))
                        setMessage('')
                        setError('')
                      }}
                      className="flex min-h-14 w-full items-center gap-3 text-left disabled:cursor-not-allowed"
                    >
                      <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#14234e] to-[#26478c] text-lg font-black text-amber-300 shadow-md ring-2 ring-amber-300/50">{player.number}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block break-words text-sm font-black leading-snug text-foreground sm:text-base">{player.firstName} {player.lastName}</span>
                        <span className={`mt-1 inline-flex max-w-full rounded-full border px-2 py-1 text-[9px] font-black leading-tight sm:text-[10px] ${currentStatus ? STATUS_PRESENTATION[currentStatus].idle : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
                          {currentStatus ? STATUS_PRESENTATION[currentStatus].label : 'À noter'}
                        </span>
                      </span>
                      <span className={`shrink-0 rounded-lg px-2 py-1 text-[9px] font-black ${selectedQuickStatus ? 'bg-sky-100 text-sky-900' : 'bg-muted text-muted-foreground'}`}>
                        {selectedQuickStatus ? '✓ Fait' : quickStatus ? 'Marquer' : 'Choisir'}
                      </span>
                    </button>
                  ) : (
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#14234e] to-[#26478c] text-sm font-black text-amber-300 shadow-sm ring-2 ring-amber-300/50">{player.number}</span>
                      <p className="min-w-0 flex-1 break-words text-sm font-black leading-snug text-foreground sm:text-base">{player.firstName} {player.lastName}</p>
                      <label className="shrink-0">
                        <span className="sr-only">Statut de {player.firstName} {player.lastName}</span>
                        <select
                          aria-label={`Statut de ${player.firstName} ${player.lastName}`}
                          value={currentStatus}
                          onChange={(event) => {
                            const nextStatus = TRAINING_ATTENDANCE_STATUSES.find((status) => status.value === event.target.value)?.value ?? ''
                            setStatuses((current) => ({ ...current, [player.number]: nextStatus }))
                            setMessage('')
                            setError('')
                          }}
                          className={`h-9 w-44 rounded-xl border px-2 text-xs font-black outline-none transition focus-visible:ring-2 focus-visible:ring-[#d4af37] sm:w-48 ${currentStatus ? STATUS_PRESENTATION[currentStatus].idle : 'border-amber-200 bg-amber-50 text-amber-900'}`}
                        >
                          <option value="">À noter</option>
                          {TRAINING_ATTENDANCE_STATUSES.map((status) => (
                            <option key={status.value} value={status.value}>{status.label}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
          )}

          <footer className={`z-10 flex flex-col gap-3 rounded-2xl border border-accent/50 bg-card/95 p-3 shadow-xl backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-5 ${playerStatusFilter === 'all' && !query ? 'sticky bottom-20 xl:bottom-3' : 'relative'}`}>
            <button type="button" onClick={() => void save()} disabled={!canSave} className="min-h-12 w-full rounded-xl bg-gradient-to-r from-amber-300 to-yellow-400 px-6 font-black text-[#14234e] shadow-lg transition hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-64">
              <Save aria-hidden="true" className="mr-2 inline size-4" />{saving ? 'Enregistrement…' : savedSession ? 'Mettre à jour la séance' : 'Enregistrer les présences'}
            </button>
          </footer>
          {message && <p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">{message}</p>}
          {error && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{error}</p>}
        </>
      )}
        </>
      )}
    </section>
  )
}
