'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CalendarDays,
  Check,
  CircleCheck,
  CircleHelp,
  HeartPulse,
  RefreshCw,
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
  P: { icon: CircleCheck, label: 'Présent', active: 'border-emerald-400 bg-emerald-500 text-white', idle: 'border-emerald-200 bg-emerald-50/70 text-emerald-800 hover:bg-emerald-100' },
  AJ: { icon: ShieldCheck, label: 'Absence justifiée', active: 'border-amber-400 bg-amber-400 text-amber-950', idle: 'border-amber-200 bg-amber-50/70 text-amber-900 hover:bg-amber-100' },
  AI: { icon: X, label: 'Absence injustifiée', active: 'border-rose-400 bg-rose-500 text-white', idle: 'border-rose-200 bg-rose-50/70 text-rose-800 hover:bg-rose-100' },
  B: { icon: HeartPulse, label: 'Blessé', active: 'border-sky-400 bg-sky-500 text-white', idle: 'border-sky-200 bg-sky-50/70 text-sky-800 hover:bg-sky-100' },
  E: { icon: CircleHelp, label: 'Exempt', active: 'border-violet-400 bg-violet-500 text-white', idle: 'border-violet-200 bg-violet-50/70 text-violet-800 hover:bg-violet-100' },
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

export function TrainingAttendanceManager({
  players,
  sessions,
  loadError,
}: {
  players: PublicPlayer[]
  sessions: TrainingAttendanceSession[]
  loadError: boolean
}) {
  const router = useRouter()
  const [date, setDate] = useState('')
  const [query, setQuery] = useState('')
  const [statuses, setStatuses] = useState<Record<number, TrainingAttendanceStatus | ''>>({})
  const [saving, setSaving] = useState(false)
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
      const value = serverValue ?? offlineMap?.[player.number] ?? ''
      next[player.number] = TRAINING_ATTENDANCE_STATUSES.some((status) => status.value === value)
        ? value as TrainingAttendanceStatus
        : ''
    }
    setStatuses(next)
    setMessage('')
    setError('')
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

  const visiblePlayers = useMemo(() => {
    const term = normalizeSearch(query)
    if (!term) return players
    return players.filter((player) =>
      normalizeSearch(`${player.firstName} ${player.lastName} ${player.number}`).includes(term),
    )
  }, [players, query])

  const setAllPresent = () => {
    const next = Object.fromEntries(players.map((player) => [player.number, 'P' as const]))
    setStatuses(next)
    if (date) {
      saveOfflineAttendance(date, players.map((p) => ({ number: p.number, status: 'P' })))
    }
    setMessage('')
    setError('')
  }

  const resetAttendance = () => {
    const next = Object.fromEntries(players.map((player) => [player.number, '' as const]))
    setStatuses(next)
    if (date) {
      saveOfflineAttendance(date, players.map((p) => ({ number: p.number, status: '' })))
    }
    setMessage('')
    setError('')
  }

  const save = async () => {
    setSaving(true)
    setMessage('')
    setError('')
    const entries = players.map((player) => ({ number: player.number, status: statuses[player.number] }))
    saveOfflineAttendance(date, entries)

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      queuePendingAttendance(date, entries)
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
      setMessage('Présences enregistrées dans le classeur Google.')
      router.refresh()
    } catch (cause) {
      const isNetwork =
        (typeof navigator !== 'undefined' && !navigator.onLine) ||
        cause instanceof TypeError ||
        (cause instanceof Error && (cause.message.includes('fetch') || cause.message.includes('NetworkError')))

      if (isNetwork) {
        queuePendingAttendance(date, entries)
        setMessage('Connexion coupée : présences enregistrées localement (mode hors-ligne) 📡. Elles seront envoyées dès le retour du réseau.')
      } else {
        setError(cause instanceof Error ? cause.message : 'Enregistrement impossible.')
      }
    } finally {
      setSaving(false)
    }
  }

  const canSave = Boolean(date) && !loadError && players.length > 0 && counts.missing === 0 && !saving
  const completion = players.length ? Math.round(counts.filled / players.length * 100) : 0

  return (
    <section className="flex flex-col gap-3 sm:gap-5" aria-labelledby="training-attendance-title">
      <header className="relative isolate overflow-hidden rounded-[2rem] border border-[#e0bd43]/60 bg-gradient-to-br from-[#101b40] via-[#1d397f] to-[#12224e] p-3 text-white shadow-xl sm:p-7 lg:p-8 xl:p-6 2xl:p-8">
        <div aria-hidden="true" className="pointer-events-none absolute -top-20 -right-14 -z-10 size-64 rounded-full bg-sky-300/10 blur-3xl" />
        <div className="flex flex-col gap-4 sm:gap-6 xl:flex-row xl:items-center xl:justify-between xl:gap-8">
          <div className="flex items-center gap-3 sm:gap-5 xl:min-w-0 xl:flex-[1.1]">
            <ClubCrest className="size-12 ring-4 ring-[#e0bd43] sm:size-20" />
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-amber-300 sm:text-xs">
                <Sparkles aria-hidden="true" className="size-3.5" />ES Genech · U11
              </p>
              <h2 id="training-attendance-title" className="mt-1 text-xl font-black leading-tight sm:text-3xl lg:text-4xl xl:whitespace-nowrap xl:text-3xl 2xl:text-4xl">Feuille de présence</h2>
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
                onChange={(event) => setDate(event.target.value)}
                className="h-10 min-w-0 rounded-xl border border-white/20 bg-white/10 px-3 text-sm font-bold text-white outline-none focus-visible:ring-2 focus-visible:ring-amber-300 [color-scheme:dark] sm:h-12"
              />
            </label>
          </div>
        </div>

        <div className="mt-3 grid gap-3 rounded-2xl border border-white/10 bg-white/[0.07] p-3 sm:mt-6 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-4 sm:p-5">
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
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/25 sm:mt-3 sm:h-2.5" role="progressbar" aria-label="Présences renseignées" aria-valuemin={0} aria-valuemax={players.length} aria-valuenow={counts.filled}>
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-lime-300 transition-[width] duration-500" style={{ width: `${completion}%` }} />
            </div>
          </div>
        </div>
      <div className="mt-2 flex flex-col gap-1.5 sm:flex-row sm:justify-end sm:gap-2 xl:mt-4 xl:border-t xl:border-white/10 xl:pt-4">
        <button type="button" onClick={setAllPresent} disabled={!players.length || loadError} aria-label="Marquer tous les joueurs présents" title="Remplace les statuts saisis par Présent pour toute l’équipe ; enregistre ensuite." className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-300 to-yellow-400 px-3 text-xs font-black text-[#14234e] shadow-lg transition hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-12 sm:px-5 sm:text-sm">
          <UsersRound aria-hidden="true" className="size-4 shrink-0" /><span className="whitespace-nowrap">Marquer tous les joueurs présents</span>
        </button>
        <button type="button" onClick={resetAttendance} disabled={!players.length || loadError || counts.filled === 0} title="Efface les choix de cette saisie à l’écran ; le classeur n’est pas modifié." className="inline-flex min-h-9 items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 text-[11px] font-bold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-10 sm:text-xs">
          <RefreshCw aria-hidden="true" className="size-3.5" />Réinitialiser la feuille
        </button>
      </div>
      </header>

      {loadError && (
        <div role="alert" className="rounded-xl border border-amber-500/50 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-bold">L’historique du classeur n’a pas pu être chargé.</p>
          <p className="mt-1">Actualise la page avant de saisir une séance pour éviter d’écraser des données.</p>
          <button type="button" onClick={() => router.refresh()} className="mt-3 font-bold underline"><RefreshCw aria-hidden="true" className="mr-1 inline size-4" />Réessayer</button>
        </div>
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
              className="h-12 w-full rounded-2xl border border-accent/40 bg-card pr-4 pl-12 text-sm shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          {savedSession && <p className="hidden w-fit max-w-full rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900 sm:block">Séance déjà enregistrée · tes changements remplaceront les anciennes valeurs</p>}
          {query && <p aria-live="polite" className="-mt-3 text-xs text-muted-foreground">{visiblePlayers.length} joueur{visiblePlayers.length === 1 ? '' : 's'} trouvé{visiblePlayers.length === 1 ? '' : 's'}</p>}

          {visiblePlayers.length === 0 ? (
            <p role="status" className="rounded-xl bg-muted p-4 text-sm">Aucun joueur ne correspond à « {query} ».</p>
          ) : (
          <ul className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {visiblePlayers.map((player) => (
              <li key={player.number} className={`group relative overflow-hidden rounded-2xl border bg-card p-3.5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-4 ${statuses[player.number] === 'P' ? 'border-emerald-300/80' : 'border-border'}`}>
                {statuses[player.number] === 'P' && <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-300 to-lime-400" />}
                <div className="mb-3 flex items-start gap-3">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#14234e] to-[#26478c] text-lg font-black text-amber-300 shadow-md ring-2 ring-amber-300/50">{player.number}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="whitespace-normal break-words text-sm font-black leading-snug text-foreground sm:text-base">{player.firstName} {player.lastName}</p>
                      {statuses[player.number] ? (
                        <span className={`inline-flex max-w-full items-center gap-1 whitespace-normal rounded-full border px-2 py-1 text-[9px] font-black leading-tight sm:text-[10px] ${STATUS_PRESENTATION[statuses[player.number] as TrainingAttendanceStatus].idle}`}>
                          {statuses[player.number] === 'P' && <Check aria-hidden="true" className="size-3 shrink-0" />}
                          {STATUS_PRESENTATION[statuses[player.number] as TrainingAttendanceStatus].label}
                        </span>
                      ) : <span className="inline-flex rounded-full bg-amber-100 px-2 py-1 text-[9px] font-black text-amber-900 sm:text-[10px]">À noter</span>}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {TRAINING_ATTENDANCE_STATUSES.map((status) => {
                    const presentation = STATUS_PRESENTATION[status.value]
                    const StatusIcon = presentation.icon
                    const selected = statuses[player.number] === status.value
                    return (
                      <button
                        key={status.value}
                        type="button"
                        aria-pressed={selected}
                        aria-label={`Marquer ${player.firstName} ${player.lastName} : ${status.label}`}
                        onClick={() => {
                          setStatuses((current) => ({ ...current, [player.number]: status.value }))
                          setMessage('')
                          setError('')
                        }}
                        className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl border px-2 text-[10px] font-black leading-tight transition active:scale-95 sm:text-[11px] ${selected ? `${presentation.active} shadow-sm ring-2 ring-current/15` : `${presentation.idle} hover:-translate-y-0.5`}`}
                      >
                        <StatusIcon aria-hidden="true" className="size-4" />
                        <span>{status.shortLabel}</span>
                      </button>
                    )
                  })}
                </div>
              </li>
            ))}
          </ul>
          )}

          <footer className="sticky bottom-20 z-10 flex flex-col gap-3 rounded-2xl border border-accent/50 bg-card/95 p-3 shadow-xl backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-5 xl:bottom-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-primary">{date ? formatDate(date) : 'Choisis une date'}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{counts.filled}/{players.length} réponses · {counts.missing ? `${counts.missing} à compléter` : 'tout est prêt'}</p>
            </div>
            <button type="button" onClick={() => void save()} disabled={!canSave} className="min-h-12 rounded-xl bg-gradient-to-r from-amber-300 to-yellow-400 px-6 font-black text-[#14234e] shadow-lg transition hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50">
              <Save aria-hidden="true" className="mr-2 inline size-4" />{saving ? 'Enregistrement…' : savedSession ? 'Mettre à jour la séance' : 'Enregistrer les présences'}
            </button>
          </footer>
          {message && <p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">{message}</p>}
          {error && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{error}</p>}
        </>
      )}
    </section>
  )
}
