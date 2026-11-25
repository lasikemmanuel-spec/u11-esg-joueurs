'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Check, Pencil, X, Sparkles, Trophy, Timer, Shirt, Users, Star, ArrowUpRight } from 'lucide-react'
import { ClubCrest } from '@/components/club-crest'
import { TrainingEvolutionChart } from '@/components/training-evolution-chart'
import { PlayerOffensiveRankings } from '@/components/player-offensive-rankings'
import { ireStatus, type IreStatus, type PlayerStats as Stats } from '@/lib/stats-shared'
import type { Convocation, MatchStatus } from '@/lib/convocations'
import type { PublicPlayer } from '@/lib/players'
import {
  TRAINING_ATTENDANCE_STATUSES,
  type TrainingAttendanceSession,
  type TrainingAttendanceStatus,
} from '@/lib/training-attendance-shared'

const MATCH_STYLES: Record<MatchStatus, { label: string; className: string }> = {
  called: { label: 'Convoqué', className: 'bg-emerald-600 text-white' },
  calledAbsent: { label: 'Convoqué absent', className: 'bg-amber-500 text-white' },
  present: { label: 'Présent', className: 'bg-emerald-600 text-white' },
  absent: { label: 'Absent', className: 'bg-blue-950 text-white' },
  injured: { label: 'Blessé', className: 'bg-red-600 text-white' },
  exempt: { label: 'Exempt', className: 'bg-violet-600 text-white' },
  notCalled: { label: 'Non convoqué', className: 'border border-lime-500 bg-lime-400 text-lime-950' },
  noLicense: { label: 'Pas de licence', className: 'bg-muted text-muted-foreground' },
  unknown: { label: '?', className: 'bg-muted text-muted-foreground' },
}

const TRAINING_STYLES: Record<string, { label: string; className: string }> = {
  P: { label: '✅ Présent', className: 'border border-emerald-200 bg-emerald-50 text-emerald-900' },
  AJ: { label: '🟡 Justifiée', className: 'border border-amber-200 bg-amber-50 text-amber-950' },
  AI: { label: '🔴 Injustifiée', className: 'border border-rose-200 bg-rose-50 text-rose-950' },
  B: { label: '🩹 Blessé', className: 'border border-sky-200 bg-sky-50 text-sky-950' },
  E: { label: '⭐ Exempt', className: 'border border-violet-200 bg-violet-50 text-violet-950' },
}

function RateRow({
  label,
  rate,
  count,
  barClass,
}: {
  label: string
  rate: number | null
  count: number | null
  barClass: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span>{label}</span>
        <span className="flex items-baseline gap-2">
          {count !== null && <span className="text-xs text-muted-foreground">{count} match{count > 1 ? 's' : ''}</span>}
          <span className="font-mono font-semibold">{rate !== null ? `${rate}%` : '—'}</span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${barClass}`} style={{ width: `${Math.min(rate ?? 0, 100)}%` }} />
      </div>
    </div>
  )
}

function matchDateOrder(value: string) {
  const iso = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`
  const dayFirst = value.match(/^(\d{1,2})[/. -](\d{1,2})[/. -](\d{4})$/)
  if (dayFirst) return `${dayFirst[3]}-${dayFirst[2].padStart(2, '0')}-${dayFirst[1].padStart(2, '0')}`
  return value
}

function localToday() {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  return now.toISOString().slice(0, 10)
}

function TrainingHistory({ sessions, playerNumber }: { sessions: TrainingAttendanceSession[]; playerNumber: number }) {
  const router = useRouter()
  const [showAll, setShowAll] = useState(false)
  const [editingDate, setEditingDate] = useState('')
  const [draftStatus, setDraftStatus] = useState<TrainingAttendanceStatus | ''>('')
  const [statusOverrides, setStatusOverrides] = useState<Record<string, TrainingAttendanceStatus | ''>>({})
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const today = localToday()
  // Exclure les séances futures
  const pastSessions = sessions.filter((session) => session.date <= today)
  const activeSessions = pastSessions.filter((session) => !session.cancellation)
  if (pastSessions.length === 0) return null
  const orderedSessions = [...pastSessions].sort((a, b) => b.date.localeCompare(a.date))
  const statusForSession = (session: TrainingAttendanceSession) =>
    statusOverrides[session.date] ?? session.playerStatuses[playerNumber]?.trim() ?? ''
  const recordedCount = activeSessions.filter((session) => Boolean(statusForSession(session))).length
  const presentCount = activeSessions.filter((session) => statusForSession(session) === 'P').length

  const saveStatus = async (date: string) => {
    if (!draftStatus) {
      setEditError('Choisis un statut.')
      return
    }
    setSaving(true)
    setEditError('')
    try {
      const response = await fetch('/api/educators/training-attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          entries: [{ number: playerNumber, status: draftStatus }],
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Impossible de modifier le statut.')
      setStatusOverrides((current) => ({ ...current, [date]: draftStatus }))
      setEditingDate('')
      setDraftStatus('')
      router.refresh()
    } catch (error) {
      setEditError(error instanceof Error ? error.message : 'Impossible de modifier le statut.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="flex flex-col gap-3 border-t pt-3" aria-label="Historique des entraînements">
      <TrainingEvolutionChart sessions={pastSessions} playerNumber={playerNumber} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-xs font-bold text-primary">Détail des séances</h4>
          <p className="text-[10px] text-muted-foreground">{presentCount} présence{presentCount === 1 ? '' : 's'} · {recordedCount}/{activeSessions.length} statuts renseignés</p>
        </div>
        {pastSessions.length > 5 && (
          <button
            type="button"
            aria-expanded={showAll}
            onClick={() => setShowAll((current) => !current)}
            className="rounded-full border border-primary/20 bg-secondary/60 px-3 py-1 text-[11px] font-bold text-primary transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37]"
          >
            {showAll ? 'Réduire' : `Voir les ${pastSessions.length} séances`}
          </button>
        )}
      </div>
      <ol className="grid grid-cols-3 gap-1.5">
        {orderedSessions.slice(0, showAll ? undefined : 5).map((session) => {
          if (session.cancellation) {
            const [year, month, day] = session.date.split('-')
            const weekdayInitial = new Date(`${session.date}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long' }).charAt(0).toUpperCase()
            return (
              <li key={session.date} title={`${day}/${month}/${year} : séance annulée · ${session.cancellation.reason}`} className="flex h-12 min-w-0 flex-col items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-1 text-center text-[10px] leading-tight text-slate-500">
                <span className="font-mono">{weekdayInitial} {day}/{month}</span>
                <span className="font-semibold">☁️ Annulée</span>
              </li>
            )
          }
          const status = statusForSession(session)
          const style = TRAINING_STYLES[status] ?? { label: '▫️ À saisir', className: 'border border-slate-200 bg-slate-50 text-slate-600' }
          const [year, month, day] = session.date.split('-')
          const weekdayInitial = new Date(`${session.date}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long' }).charAt(0).toUpperCase()
          const isEditing = editingDate === session.date
          return (
            <li key={session.date} title={`${day}/${month}/${year} : ${style.label}`} className={`flex h-12 min-w-0 flex-col items-center justify-center rounded-lg px-1 text-center text-[10px] leading-tight transition ${style.className} ${isEditing ? 'ring-2 ring-[#d4af37] ring-offset-1' : ''}`}>
              <button
                type="button"
                onClick={() => {
                  setEditingDate(isEditing ? '' : session.date)
                  setDraftStatus(isEditing ? '' : status as TrainingAttendanceStatus)
                  setEditError('')
                }}
                className="flex h-full w-full flex-col items-center justify-center gap-0.5 outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                aria-label={`Modifier le statut du ${weekdayInitial} ${day}/${month}`}
              >
                <span className="font-mono font-medium">{weekdayInitial} {day}/{month}</span>
                <span className="inline-flex items-center gap-0.5 font-semibold">
                  <span className="whitespace-nowrap">{style.label}</span>
                  <Pencil aria-hidden="true" className="size-2.5 shrink-0 opacity-50" />
                </span>
              </button>
            </li>
          )
        })}
      </ol>
      {editingDate && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-primary/10 bg-secondary/30 p-2">
          <span className="mr-auto text-[11px] font-semibold text-primary">
            ✏️ {new Date(`${editingDate}T12:00:00`).toLocaleDateString('fr-FR', {
              weekday: 'short', day: 'numeric', month: 'short',
            })}
          </span>
          <div className="flex w-full gap-1.5 sm:w-auto">
            <label className="sr-only" htmlFor={`training-status-${playerNumber}`}>Statut de présence</label>
            <select
              id={`training-status-${playerNumber}`}
              value={draftStatus}
              onChange={(event) => setDraftStatus(event.target.value as TrainingAttendanceStatus)}
              className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-xs font-semibold text-foreground sm:w-44 sm:flex-none"
            >
              <option value="" disabled>Choisir un statut…</option>
              {TRAINING_ATTENDANCE_STATUSES.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <button
              type="button"
              disabled={saving || !draftStatus}
              onClick={() => saveStatus(editingDate)}
              className="inline-flex h-8 items-center justify-center gap-1 rounded-md bg-primary px-2.5 text-xs font-bold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Check aria-hidden="true" className="size-3.5" />
              {saving ? '…' : 'OK'}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                setEditingDate('')
                setDraftStatus('')
                setEditError('')
              }}
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground disabled:opacity-50"
              aria-label="Annuler"
            >
              <X aria-hidden="true" className="size-3.5" />
            </button>
          </div>
          {editError && (
            <p role="alert" className="w-full text-[11px] font-semibold text-destructive">
              {editError}
            </p>
          )}
        </div>
      )}
    </section>
  )
}

function SaturdaySection({
  convocation,
}: {
  convocation: Convocation
}) {
  const [showAllMatches, setShowAllMatches] = useState(false)
  const availability = [
    { label: 'Absence le samedi', rate: convocation.absentRate, count: convocation.absentCount, barClass: 'bg-blue-950' },
    { label: 'Blessé', rate: convocation.injuredRate, count: convocation.injuredCount, barClass: 'bg-red-600' },
    { label: 'Non convoqué', rate: convocation.notCalledRate, count: convocation.notCalledCount, barClass: 'bg-lime-400' },
  ].filter((item) => item.rate !== null && item.rate > 0)
    .sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0))

  return (
    <div className="player-saturday-section flex flex-col gap-3 border-t pt-4">
      <h4 className="text-sm font-semibold">Disponibilité match</h4>
      {availability.map((item) => <RateRow key={item.label} {...item} />)}

      {convocation.matches.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-muted-foreground">Historique de la saison · {convocation.matches.length} matchs</p>
            {convocation.matches.length > 5 && (
              <button
                type="button"
                aria-expanded={showAllMatches}
                onClick={() => setShowAllMatches((current) => !current)}
                className="rounded-full border border-primary/20 bg-secondary/60 px-3 py-1 text-[11px] font-bold text-primary transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37]"
              >
                {showAllMatches ? 'Réduire' : `Voir les ${convocation.matches.length} matchs`}
              </button>
            )}
          </div>
          <ol className="flex flex-wrap gap-1.5">
            {[...convocation.matches]
              .sort((a, b) => matchDateOrder(b.date).localeCompare(matchDateOrder(a.date)))
              .slice(0, showAllMatches ? undefined : 5)
              .map((m) => {
                const style = MATCH_STYLES[m.status]
                return (
                  <li
                    key={m.date}
                    title={`${m.date} : ${m.raw}`}
                    className={`flex min-w-12 flex-col items-center rounded-md px-1.5 py-1 text-[11px] leading-tight ${style.className}`}
                  >
                    <span className="font-mono">{m.date}</span>
                    <span className="whitespace-nowrap font-semibold">
                      {m.status === 'called'
                        ? (m.team ?? 'Conv.')
                        : m.status === 'calledAbsent'
                          ? 'Conv. abs.'
                          : m.status === 'notCalled'
                            ? 'Non conv.'
                            : m.status === 'noLicense'
                              ? 'Sans lic.'
                              : style.label.split(' ')[0]}
                    </span>
                    <span className="sr-only">{style.label}</span>
                  </li>
                )
            })}
          </ol>
          <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {(['called', 'calledAbsent', 'absent', 'injured', 'exempt', 'notCalled', 'noLicense'] as const).map((s) => (
              <li key={s} className="flex items-center gap-1">
                <span aria-hidden="true" className={`size-2.5 rounded-sm ${MATCH_STYLES[s].className}`} />
                {MATCH_STYLES[s].label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

const IRE_STYLES: Record<IreStatus, { label: string; className: string }> = {
  fair: { label: 'Juste', className: 'bg-emerald-100 text-emerald-800' },
  under: { label: 'Sous-convoqué', className: 'bg-amber-100 text-amber-900' },
  over: { label: 'Sur-convoqué', className: 'bg-red-100 text-red-800' },
  none: { label: 'Non convoqué', className: 'bg-muted text-muted-foreground' },
}

const display = (v: number | null) => (v === null ? '—' : v)

const rateTone = (rate: number | null) => {
  if (rate === null) return 'border-border bg-muted text-muted-foreground'
  return rate > 75
    ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
    : 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200'
}

function getPositionDetails(position: string | null) {
  if (!position) return { label: 'Joueur', icon: '⚽', badgeClass: 'bg-slate-700 text-slate-100 border-slate-500' }
  const lower = position.toLowerCase()
  if (lower.startsWith('gard')) return { label: 'Gardien', icon: '🧤', badgeClass: 'bg-emerald-800 text-emerald-100 border-emerald-500' }
  if (lower.startsWith('déf') || lower.startsWith('def') || lower.startsWith('lat') || lower.startsWith('cent')) {
    return { label: 'Défenseur', icon: '🛡️', badgeClass: 'bg-blue-900 text-blue-100 border-blue-400' }
  }
  if (lower.startsWith('mil') || lower.startsWith('ail')) {
    return { label: 'Milieu', icon: '⚡', badgeClass: 'bg-amber-800 text-amber-100 border-amber-400' }
  }
  if (lower.startsWith('att') || lower.startsWith('av')) {
    return { label: 'Attaquant', icon: '🎯', badgeClass: 'bg-rose-900 text-rose-100 border-rose-400' }
  }
  return { label: position, icon: '⚽', badgeClass: 'bg-[#172554] text-amber-200 border-amber-400' }
}

export function PlayerCard({
  stats,
  convocation,
  player,
  trainingAttendance = [],
  matchesPlayed,
  cancelledMatchesForPlayer = 0,
  onClose,
}: {
  stats: Stats
  convocation?: Convocation
  player?: PublicPlayer
  trainingAttendance?: TrainingAttendanceSession[]
  matchesPlayed: number
  cancelledMatchesForPlayer?: number
  onClose?: () => void
}) {
  const status = IRE_STYLES[ireStatus(stats)]
  const matchPresenceRate = convocation?.presentRate ?? null
  const saturdayCallUpRate = convocation?.callUpRate ?? null
  const playerName = player ? `${player.firstName} ${player.lastName}`.trim() : stats.name
  const posDetails = getPositionDetails(player?.position ?? null)

  const encouragement = stats.trainingRate === null || matchPresenceRate === null
    ? {
        title: 'Bilan de présence en cours',
        message: 'Les données de présence se complètent au fil des séances.',
      }
    : stats.trainingRate > 75 && matchPresenceRate > 75
      ? {
          title: 'Champion de l’assiduité ! ⭐',
          message: 'Une présence remarquable aux entraînements et aux matchs. Bravo !',
        }
      : {
          title: 'Toujours ensemble, on progresse ! 💪',
          message: 'Chaque entraînement compte pour progresser avec les copains.',
        }

  const countedMatches = stats.matchesCalled === null
    ? null
    : Math.max(0, stats.matchesCalled - cancelledMatchesForPlayer)
  const minutesPerMatch = countedMatches ? Math.round((stats.minutes ?? 0) / countedMatches) : null

  return (
    <article
      aria-live="polite"
      className="player-stats-card relative isolate flex flex-col gap-3.5 overflow-hidden rounded-3xl border-2 border-[#d4af37]/60 bg-card p-3.5 shadow-2xl sm:p-5"
    >
      {/* Halo d'ambiance dorée ESG */}
      <div aria-hidden="true" className="pointer-events-none absolute -top-20 -right-20 -z-10 size-56 rounded-full bg-amber-400/20 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 -left-20 -z-10 size-56 rounded-full bg-blue-900/20 blur-3xl" />

      {/* En-tête style Carte Collector ESG */}
      <header className="player-stats-header -mx-3.5 -mt-3.5 flex items-center justify-between gap-3 border-b-2 border-amber-400 bg-gradient-to-r from-[#0c1630] via-[#172554] to-[#1e3a8a] px-4 py-3 text-white shadow-md sm:-mx-5 sm:-mt-5 sm:px-5 sm:py-4">
        <div className="flex items-center gap-3">
          <ClubCrest className="size-11 shrink-0 rounded-full ring-2 ring-amber-400 shadow-md sm:size-12" />
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-300">ES Genech · U11</p>
            <h2 id="selected-player-card-title" className="text-xs font-bold text-white/85">Fiche Officielle Joueur</h2>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-xs font-black shadow-sm ${status.className}`}>
            {status.label}
          </span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer la fiche joueur"
              className="inline-flex size-9 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white transition-all hover:bg-white/20 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
            >
              <X aria-hidden="true" className="size-5" />
            </button>
          )}
        </div>
      </header>

      {/* Hero Joueur : Écusson Numéro + Nom en Grand + Badge Poste */}
      <div className="flex items-center gap-3.5 rounded-2xl border border-amber-400/30 bg-gradient-to-r from-[#172554]/10 via-amber-400/5 to-[#172554]/10 p-3 sm:p-4 dark:from-[#172554]/40 dark:to-[#172554]/20">
        {/* Médaillon Numéro de Maillot */}
        <div className="flex size-14 shrink-0 flex-col items-center justify-center rounded-2xl border-2 border-amber-400 bg-gradient-to-br from-[#172554] to-blue-950 text-white shadow-lg ring-2 ring-amber-400/30 sm:size-16">
          <span className="text-[9px] font-black uppercase tracking-wider text-amber-300 opacity-80 leading-none">N°</span>
          <span className="font-mono text-xl font-black leading-none text-white sm:text-2xl">
            {player?.number ?? stats.number}
          </span>
        </div>

        {/* Identité & Poste */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 pb-1">
            <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-black shadow-sm ${posDetails.badgeClass}`}>
              <span>{posDetails.icon}</span>
              <span>{posDetails.label}</span>
            </span>
            {player?.transferStatus && (
              <span className="rounded-md border border-amber-400/50 bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold text-amber-900 dark:text-amber-200">
                {player.transferStatus}
              </span>
            )}
          </div>
          {player ? (
            <div className="min-w-0">
              <h3 className="break-words text-xl font-black text-foreground sm:text-2xl leading-tight">
                {player.firstName}
              </h3>
              <p className="break-words text-xs font-bold uppercase tracking-wider text-muted-foreground sm:text-sm">
                {player.lastName}
              </p>
            </div>
          ) : (
            <h3 className="break-words text-lg font-black uppercase tracking-wide text-foreground sm:text-xl">
              {playerName}
            </h3>
          )}
        </div>
      </div>

      {/* Bannière d'encouragement ESG */}
      <div role="status" className="flex items-center gap-3 rounded-2xl border border-amber-400/50 bg-gradient-to-r from-amber-400/15 via-[#172554]/10 to-amber-400/15 p-3 text-foreground shadow-sm dark:bg-[#112040]">
        <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-400 text-base font-black text-blue-950 shadow-md">
          ★
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black text-foreground">{encouragement.title}</p>
          <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">{encouragement.message}</p>
        </div>
      </div>

      {/* 4 Piliers d'Assiduité */}
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: 'Entraînement', value: stats.trainingRate, tone: rateTone(stats.trainingRate) },
          { label: 'Présence Samedi', value: matchPresenceRate, tone: rateTone(matchPresenceRate) },
          { label: 'Convocation', value: saturdayCallUpRate, tone: rateTone(saturdayCallUpRate) },
          { label: 'Indice IRE', value: stats.ire, isIre: true, tone: status.className },
        ].map((item) => (
          <div
            key={item.label}
            className={`flex min-w-0 flex-col justify-between rounded-2xl border-2 border-t-4 border-t-amber-400 bg-card p-2.5 text-center shadow-sm ${item.tone}`}
          >
            <dt className="text-[10px] font-bold uppercase tracking-tight text-foreground/80">
              {item.label}
            </dt>
            <dd className="mt-1.5 font-mono text-xl font-black">
              {item.isIre
                ? (stats.ire !== null ? stats.ire.toFixed(2).replace('.', ',') : '—')
                : (item.value !== null ? `${item.value}%` : '—')}
            </dd>
          </div>
        ))}
      </dl>

      {/* Section Performance Matchs (Style Cartes Panini / EA FC) */}
      <div className="rounded-2xl border border-border/80 bg-secondary/30 p-3 dark:bg-[#0c1830]">
        <div className="flex items-center justify-between pb-2">
          <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-primary">
            <Trophy aria-hidden="true" className="size-3.5 text-amber-400" />
            Bilan en match
          </span>
          <span className="text-[10px] font-bold text-muted-foreground">
            {countedMatches ?? 0} match{(countedMatches ?? 0) > 1 ? 's' : ''} joué{(countedMatches ?? 0) > 1 ? 's' : ''}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {/* Buts */}
          <div className={`flex flex-col justify-between rounded-xl border p-2.5 shadow-sm transition-all ${
            (stats.goals ?? 0) > 0
              ? 'border-amber-400/80 bg-amber-400/15 dark:bg-amber-400/10'
              : 'border-border/60 bg-background/80'
          }`}>
            <span className="flex items-center justify-between text-[10px] font-extrabold uppercase text-muted-foreground">
              <span>Buts</span>
              <span className="text-base">⚽</span>
            </span>
            <span className="mt-1 font-mono text-2xl font-black text-[#172554] dark:text-amber-300">
              {display(stats.goals)}
            </span>
          </div>

          {/* Passes décisives */}
          <div className="flex flex-col justify-between rounded-xl border border-border/60 bg-background/80 p-2.5 shadow-sm">
            <span className="flex items-center justify-between text-[10px] font-extrabold uppercase text-muted-foreground">
              <span>Passes D.</span>
              <span className="text-base">🎯</span>
            </span>
            <span className="mt-1 font-mono text-2xl font-black text-foreground">
              {display(stats.assists)}
            </span>
          </div>

          {/* Minutes jouées */}
          <div className="flex flex-col justify-between rounded-xl border border-border/60 bg-background/80 p-2.5 shadow-sm">
            <span className="flex items-center justify-between text-[10px] font-extrabold uppercase text-muted-foreground">
              <span>Minutes</span>
              <Timer aria-hidden="true" className="size-3.5 text-amber-400" />
            </span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="font-mono text-2xl font-black text-foreground">
                {display(stats.minutes)}
              </span>
              <span className="text-[10px] font-bold text-muted-foreground">min</span>
            </div>
          </div>

          {/* Minutes par match */}
          <div className="flex flex-col justify-between rounded-xl border border-border/60 bg-background/80 p-2.5 shadow-sm">
            <span className="text-[10px] font-extrabold uppercase text-muted-foreground">
              Min. / match
            </span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="font-mono text-xl font-black text-foreground">
                {display(minutesPerMatch)}
              </span>
              <span className="text-[10px] font-bold text-muted-foreground">min</span>
            </div>
          </div>

          {/* Titularisations */}
          <div className="flex flex-col justify-between rounded-xl border border-border/60 bg-background/80 p-2.5 shadow-sm">
            <span className="flex items-center justify-between text-[10px] font-extrabold uppercase text-muted-foreground">
              <span>Titulaire</span>
              <Shirt aria-hidden="true" className="size-3.5 text-blue-600 dark:text-blue-400" />
            </span>
            <span className="mt-1 font-mono text-xl font-black text-foreground">
              {display(stats.starts)}
            </span>
          </div>

          {/* Remplaçant */}
          <div className="flex flex-col justify-between rounded-xl border border-border/60 bg-background/80 p-2.5 shadow-sm">
            <span className="flex items-center justify-between text-[10px] font-extrabold uppercase text-muted-foreground">
              <span>Remplaçant</span>
              <Users aria-hidden="true" className="size-3.5 text-slate-500" />
            </span>
            <span className="mt-1 font-mono text-xl font-black text-foreground">
              {display(stats.subs)}
            </span>
          </div>
        </div>
      </div>

      {/* Graphique d'Évolution d'Assiduité */}
      {player && <TrainingHistory sessions={trainingAttendance} playerNumber={player.number} />}

      {/* Disponibilité match du samedi */}
      {convocation && <SaturdaySection convocation={convocation} />}

      <p className="rounded-xl border-l-4 border-amber-400 bg-secondary/50 px-3 py-2 text-[10px] leading-relaxed text-muted-foreground">
        <strong>IRE (Indice de Justesse)</strong> : taux de convocation ÷ taux de présence. Entre 0,90 et 1,10 inclus : temps de jeu et convocations équilibrés.
      </p>
    </article>
  )
}

export function PlayerStats({ players }: { players: Stats[] }) {
  return <PlayerOffensiveRankings players={players} />
}
