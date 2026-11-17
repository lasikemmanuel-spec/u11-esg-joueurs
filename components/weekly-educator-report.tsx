'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, CalendarDays, ClipboardList, Dumbbell, RefreshCw, UsersRound } from 'lucide-react'
import type { Convocation } from '@/lib/convocations'
import { normalizeMatchDate } from '@/lib/match-day-display'
import type { MatchLineup } from '@/lib/match-lineups'
import type { MatchSheetEntry } from '@/lib/match-results'
import type { PublicPlayer } from '@/lib/players'
import type { TrainingAttendanceSession } from '@/lib/training-attendance-shared'
import {
  getMatchCallupCount,
  getRecentAttendanceTrends,
  getUpcomingMatchesForWeek,
  getWeekRange,
  getWeeklyTrainingSummary,
} from '@/lib/weekly-report'

type Props = {
  players: PublicPlayer[]
  convocations: Convocation[]
  matchResults: MatchSheetEntry[]
  trainingAttendance: TrainingAttendanceSession[]
  trainingAttendanceError: boolean
  onNavigate: (tab: 'matches' | 'training' | 'stats') => void
}

type LineupResponse = { enabled: boolean; lineups: MatchLineup[]; error?: string }

function todayInParis() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  return `${value('year')}-${value('month')}-${value('day')}`
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Paris',
  }).format(new Date(`${date}T12:00:00Z`))
}

function isMatchLineup(value: unknown): value is MatchLineup {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const lineup = value as Record<string, unknown>
  return typeof lineup.date === 'string' &&
    (lineup.team === 'E1' || lineup.team === 'E2') &&
    typeof lineup.slotColumn === 'number' &&
    Number.isSafeInteger(lineup.slotColumn) &&
    Array.isArray(lineup.starters) &&
    lineup.starters.every((number) => typeof number === 'number' && Number.isSafeInteger(number)) &&
    Array.isArray(lineup.substitutes) &&
    lineup.substitutes.every((number) => typeof number === 'number' && Number.isSafeInteger(number))
}

export function WeeklyEducatorReport({
  players,
  convocations,
  matchResults,
  trainingAttendance,
  trainingAttendanceError,
  onNavigate,
}: Props) {
  const today = useMemo(todayInParis, [])
  const week = useMemo(() => getWeekRange(today), [today])
  const [lineups, setLineups] = useState<MatchLineup[]>([])
  const [lineupsEnabled, setLineupsEnabled] = useState<boolean | null>(null)
  const [lineupsError, setLineupsError] = useState('')

  useEffect(() => {
    let active = true
    fetch('/api/educators/match-lineups', { cache: 'no-store' })
      .then(async (response) => {
        const result = await response.json() as LineupResponse
        if (!response.ok) throw new Error(result.error ?? 'Impossible de charger les compositions.')
        if (typeof result.enabled !== 'boolean' || !Array.isArray(result.lineups) ||
          !result.lineups.every(isMatchLineup)) {
          throw new Error('Les compositions reçues sont invalides.')
        }
        if (active) {
          setLineups(result.lineups)
          setLineupsEnabled(result.enabled)
          setLineupsError('')
        }
      })
      .catch((error: unknown) => {
        if (active) setLineupsError(error instanceof Error ? error.message : 'Impossible de charger les compositions.')
      })
    return () => {
      active = false
    }
  }, [])

  const upcomingMatches = useMemo(() => getUpcomingMatchesForWeek(matchResults, today), [matchResults, today])
  const playerNumbers = useMemo(() => players.map((player) => player.number), [players])
  const attendance = useMemo(
    () => week ? getWeeklyTrainingSummary(trainingAttendance, playerNumbers, week, today) : null,
    [trainingAttendance, playerNumbers, today, week],
  )
  const trends = useMemo(
    () => getRecentAttendanceTrends(
      trainingAttendance,
      players.map((player) => ({
        number: player.number,
        name: `${player.firstName} ${player.lastName}`.trim(),
      })),
      today,
    ),
    [players, today, trainingAttendance],
  )
  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-5">
      <header className="rounded-2xl border border-[#d4af37]/40 bg-gradient-to-br from-[#172554] via-[#1e3a8a] to-[#172554] p-5 text-white shadow-lg sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-300">Espace éducateurs</p>
        <h2 className="mt-2 text-2xl font-black sm:text-3xl">Bilan de la semaine</h2>
        {week && <p className="mt-1 text-sm font-medium text-white/75">{formatDate(week.start)} – {formatDate(week.end)}</p>}
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-accent/50 bg-card p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-blue-500/10 text-blue-700"><Dumbbell aria-hidden="true" className="size-5" /></span>
            <div>
              <h3 className="font-black text-foreground">Présences entraînements</h3>
              <p className="text-xs text-muted-foreground">Semaine en cours</p>
            </div>
          </div>
          {trainingAttendanceError ? (
            <p role="alert" className="text-sm text-rose-700">Les données de présence aux entraînements n’ont pas pu être chargées.</p>
          ) : attendance?.sessionCount && attendance.rate !== null ? (
            <>
              <p className="text-3xl font-black text-[#172554]">{attendance.rate}%</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {attendance.present} présence{attendance.present === 1 ? '' : 's'} sur {attendance.counted} statuts renseignés · {attendance.sessionCount} séance{attendance.sessionCount === 1 ? '' : 's'}
              </p>
            </>
          ) : attendance?.sessionCount ? (
            <p className="text-sm text-muted-foreground">
              {attendance.sessionCount} séance{attendance.sessionCount === 1 ? '' : 's'} enregistrée{attendance.sessionCount === 1 ? '' : 's'}, statuts à renseigner.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Aucune présence enregistrée cette semaine.</p>
          )}
          <button type="button" onClick={() => onNavigate('training')} className="mt-4 min-h-11 rounded-lg px-3 text-sm font-bold text-primary hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Ouvrir les entraînements
          </button>
        </section>

        <section className="rounded-2xl border border-accent/50 bg-card p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-amber-500/10 text-amber-700"><UsersRound aria-hidden="true" className="size-5" /></span>
            <div>
              <h3 className="font-black text-foreground">Évolution de l’assiduité</h3>
              <p className="text-xs text-muted-foreground">Comparaison des 3 dernières séances aux 3 précédentes</p>
            </div>
          </div>
          {trainingAttendanceError ? (
            <p role="alert" className="text-sm text-rose-700">Tendances indisponibles : les présences n’ont pas pu être chargées.</p>
          ) : trends.length > 0 ? (
            <ul className="space-y-2">
              {trends.map((trend) => {
                const Icon = trend.change > 0 ? ArrowUpRight : ArrowDownRight
                return (
                  <li key={trend.number} className="flex items-center justify-between gap-3 rounded-lg bg-muted/60 px-3 py-2 text-sm">
                    <span className="min-w-0 truncate font-semibold">{trend.name}</span>
                    <span className={`flex shrink-0 items-center gap-1 font-black ${trend.change > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      <Icon aria-hidden="true" className="size-4" />
                      {trend.change > 0 ? '+' : ''}{trend.change} pts
                    </span>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Historique insuffisant pour dégager une tendance (6 séances avec présences nécessaires).</p>
          )}
          <button type="button" onClick={() => onNavigate('stats')} className="mt-4 min-h-11 rounded-lg px-3 text-sm font-bold text-primary hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Voir les statistiques
          </button>
        </section>
      </div>

      <section className="rounded-2xl border border-accent/50 bg-card p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-700"><CalendarDays aria-hidden="true" className="size-5" /></span>
          <div>
            <h3 className="font-black text-foreground">Matchs à préparer</h3>
            <p className="text-xs text-muted-foreground">Rencontres à venir d’ici dimanche</p>
          </div>
        </div>
        {upcomingMatches.length === 0 ? (
          <p className="rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground">Aucun match restant à préparer cette semaine.</p>
        ) : (
          <ul className="divide-y divide-border">
            {upcomingMatches.map((match) => {
              const callupCount = getMatchCallupCount(convocations, match)
              const matchDate = normalizeMatchDate(match.date)
              const hasCallups = callupCount > 0
              const lineup = lineups.find((item) =>
                item.date === matchDate &&
                item.team === match.team &&
                item.slotColumn === match.slotColumn,
              )
              return (
                <li key={`${match.date}-${match.team}-${match.slotColumn}`} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div className="min-w-0">
                    <p className="font-bold text-foreground">Équipe {match.team === 'E1' ? '1' : '2'} · {match.opponent || 'Adversaire'}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{formatDate(matchDate)}{match.kickoffTime ? ` · ${match.kickoffTime}` : ''}{match.competition ? ` · ${match.competition}` : ''}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs font-bold">
                    <span className={`rounded-full px-3 py-1.5 ${hasCallups ? 'bg-emerald-500/10 text-emerald-800' : 'bg-amber-500/15 text-amber-900'}`}>
                      {hasCallups ? `${callupCount} convoqué${callupCount === 1 ? '' : 's'}` : 'Convocations à vérifier'}
                    </span>
                    {lineupsError ? (
                      <span className="rounded-full bg-rose-500/10 px-3 py-1.5 text-rose-800">Composition indisponible</span>
                    ) : lineupsEnabled === false ? (
                      <span className="rounded-full bg-muted px-3 py-1.5 text-muted-foreground">Compositions indisponibles en aperçu</span>
                    ) : lineupsEnabled === null ? (
                      <span className="rounded-full bg-muted px-3 py-1.5 text-muted-foreground"><RefreshCw aria-hidden="true" className="mr-1 inline size-3" />Chargement composition</span>
                    ) : (
                      <span className={`rounded-full px-3 py-1.5 ${lineup && lineup.starters.length >= 8 ? 'bg-emerald-500/10 text-emerald-800' : 'bg-amber-500/15 text-amber-900'}`}>
                        {lineup ? `${Math.min(lineup.starters.length, 8)}/8 titulaires` : 'Composition à finaliser'}
                      </span>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        {lineupsError && <p role="alert" className="mt-3 text-sm text-rose-700">{lineupsError}</p>}
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <ClipboardList aria-hidden="true" className="size-4 shrink-0" />
          <span>Finalise les convocations et les 8 titulaires dans le calendrier du match.</span>
        </div>
        <button type="button" onClick={() => onNavigate('matches')} className="mt-3 min-h-11 rounded-lg px-3 text-sm font-bold text-primary hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Ouvrir les matchs
        </button>
      </section>
    </section>
  )
}
