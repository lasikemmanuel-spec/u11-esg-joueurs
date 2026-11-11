'use client'

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { CircleAlert, CircleCheck, CircleHelp, CircleMinus, Save, UsersRound } from 'lucide-react'
import { ClubCrest } from '@/components/club-crest'
import type { Convocation, MatchStatus } from '@/lib/convocations'
import type { EditableCallupStatus } from '@/lib/convocation-management'
import type { PublicPlayer } from '@/lib/players'
import type { PlayerStats } from '@/lib/stats'
import type { TrainingAttendanceSession } from '@/lib/training-attendance'
import type { MatchSheetEntry } from '@/lib/match-results'
import { MATCH_SEASON_END, MATCH_SEASON_START } from '@/lib/match-season'

const STATUS_OPTIONS: Array<{ value: EditableCallupStatus; label: string }> = [
  { value: '✅ Convoqué E1', label: '✅ Convoqué E1' },
  { value: '✅ Convoqué E1 + E2', label: '✅ Convoqué E1 + E2' },
  { value: '❌ Non convoqué', label: '❌ Non convoqué' },
  { value: '⚠️ Convoqué absent', label: '⚠️ Convoqué absent' },
  { value: '🗓️ Absent', label: '🗓️ Absent' },
  { value: '✅ Convoqué E2', label: '✅ Convoqué E2' },
  { value: '🩺 Blessé', label: '🩺 Blessé' },
  { value: 'Pas de licence', label: 'Pas de licence' },
]
type SelectionValue = EditableCallupStatus | ''

function dateKey(value: string) {
  const iso = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`
  const dayFirst = value.match(/(?:^|\D)(\d{1,2})[/. -](\d{1,2})(?:[/. -](\d{4}))?(?:\D|$)/)
  if (dayFirst) {
    const [, day, month, enteredYear] = dayFirst
    const year = enteredYear ?? (Number(month) >= 9
      ? MATCH_SEASON_START.slice(0, 4)
      : MATCH_SEASON_END.slice(0, 4))
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }
  return ''
}

function existingSelection(status: MatchStatus, team: string | null): SelectionValue {
  if ((status === 'called' || status === 'present') && team === 'E1+E2') return '✅ Convoqué E1 + E2'
  if ((status === 'called' || status === 'present') && team === 'E1') return '✅ Convoqué E1'
  if ((status === 'called' || status === 'present') && team === 'E2') return '✅ Convoqué E2'
  if (status === 'calledAbsent') return '⚠️ Convoqué absent'
  if (status === 'absent') return '🗓️ Absent'
  if (status === 'injured') return '🩺 Blessé'
  if (status === 'notCalled') return '❌ Non convoqué'
  if (status === 'noLicense') return 'Pas de licence'
  return ''
}

function selectionForPlayer(
  playerNumber: number,
  date: string,
  convocations: Convocation[],
): SelectionValue {
  const entry = convocations
    .find((player) => player.number === playerNumber)
    ?.matches.find((match) => dateKey(match.date) === date)
  return entry ? existingSelection(entry.status, entry.team) : ''
}

function callupTrainingDates(matchDate: string) {
  if (!matchDate) return []
  const tuesday = new Date(`${matchDate}T12:00:00`)
  tuesday.setDate(tuesday.getDate() - 4)
  const friday = new Date(tuesday)
  friday.setDate(friday.getDate() - 4)
  const toDateKey = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

  return [toDateKey(tuesday), toDateKey(friday)]
}

function attendanceLabel(status: string | undefined) {
  if (!status) return 'Non renseigné'
  if (status === 'P') return 'Présent'
  if (status === 'AJ') return 'Abs. justifiée'
  if (status === 'AI') return 'Abs. injustifiée'
  if (status === 'B') return 'Blessé'
  if (status === 'E') return 'Exempt'
  return status
}

export function CallupScheduleEntry({
  players,
  playerStats,
  convocations,
  convocationDates,
  scheduledMatchDates,
  initialDate,
  trainingAttendance,
  trainingAttendanceError,
  matchEntries,
}: {
  players: PublicPlayer[]
  playerStats: PlayerStats[]
  convocations: Convocation[]
  convocationDates: string[]
  scheduledMatchDates: string[]
  initialDate?: string
  trainingAttendance: TrainingAttendanceSession[]
  trainingAttendanceError: boolean
  matchEntries: MatchSheetEntry[]
}) {
  const router = useRouter()
  const callupTitleRef = useRef<HTMLElement>(null)
  const [date, setDate] = useState(initialDate ?? '')
  const [selections, setSelections] = useState<Record<number, SelectionValue>>({})
  const [query, setQuery] = useState('')
  const [pending, setPending] = useState(false)
  const [savingEnabled, setSavingEnabled] = useState(false)
  const [savingStatusChecked, setSavingStatusChecked] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!initialDate) return
    const frame = window.requestAnimationFrame(() => {
      callupTitleRef.current?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'start',
      })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [initialDate])

  useEffect(() => {
    let active = true
    fetch('/api/educators/callups', { cache: 'no-store' })
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok) throw new Error(result.error ?? 'Impossible de vérifier les droits de saisie.')
        if (active) setSavingEnabled(Boolean(result.enabled))
      })
      .catch((statusError) => {
        if (active) setError(statusError instanceof Error ? statusError.message : 'Impossible de vérifier les droits de saisie.')
      })
      .finally(() => {
        if (active) setSavingStatusChecked(true)
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    setSelections(Object.fromEntries(
      players.map((player) => [player.number, selectionForPlayer(player.number, date, convocations)]),
    ))
  }, [players, convocations, date])

  const dates = useMemo(() => [...new Set(
    scheduledMatchDates
      .map(dateKey)
      .filter((value) => value >= MATCH_SEASON_START && value <= MATCH_SEASON_END)
      .filter((value) => new Date(`${value}T12:00:00`).getDay() === 6),
  )].sort(), [scheduledMatchDates])
  const savedDates = useMemo(() => new Set(convocationDates.map(dateKey).filter(Boolean)), [convocationDates])
  const sortedTrainingAttendance = useMemo(
    () => [...trainingAttendance].sort((a, b) => a.date.localeCompare(b.date)),
    [trainingAttendance],
  )
  const relevantTrainingDates = useMemo(() => callupTrainingDates(date), [date])
  const relevantTrainingSessions = useMemo(
    () => {
      const selectedSessions = new Map<string, TrainingAttendanceSession>()
      const usedSessionDates = new Set<string>()

      for (const targetDate of [...relevantTrainingDates].sort((a, b) => b.localeCompare(a))) {
        const session = [...sortedTrainingAttendance].reverse().find(
          (attendance) => attendance.date <= targetDate && !usedSessionDates.has(attendance.date),
        )
        if (session) {
          selectedSessions.set(targetDate, session)
          usedSessionDates.add(session.date)
        }
      }

      return relevantTrainingDates
        .map((targetDate) => {
          const session = selectedSessions.get(targetDate)
          return {
            targetDate,
            date: session?.date ?? targetDate,
            playerStatuses: session?.playerStatuses,
            sessionAvailable: Boolean(session),
            isPrevious: Boolean(session && session.date !== targetDate),
          }
        })
        .sort((a, b) => a.date.localeCompare(b.date))
    },
    [relevantTrainingDates, sortedTrainingAttendance],
  )
  const lastCompletedMatchDate = useMemo(() => matchEntries
    .filter((entry) => {
      const entryDate = dateKey(entry.date)
      return Boolean(
        date && entryDate && entryDate < date &&
        !entry.resultLabel.toLocaleLowerCase('fr-FR').includes('annul') &&
        entry.goalsFor !== null && entry.goalsAgainst !== null,
      )
    })
    .map((entry) => dateKey(entry.date))
    .sort()
    .at(-1) ?? '', [date, matchEntries])
  const lastCompletedMatches = useMemo(
    () => lastCompletedMatchDate
      ? matchEntries.filter((entry) => dateKey(entry.date) === lastCompletedMatchDate &&
        !entry.resultLabel.toLocaleLowerCase('fr-FR').includes('annul') &&
        entry.goalsFor !== null && entry.goalsAgainst !== null)
      : [],
    [lastCompletedMatchDate, matchEntries],
  )

  useEffect(() => {
    if (initialDate && dates.includes(initialDate)) {
      if (date !== initialDate) setDate(initialDate)
      return
    }
    if (dates.includes(date)) return
    const today = new Date()
    today.setMinutes(today.getMinutes() - today.getTimezoneOffset())
    const todayKey = today.toISOString().slice(0, 10)
    setDate(dates.find((value) => value >= todayKey) ?? dates.at(-1) ?? '')
  }, [dates, date, initialDate])

  const visiblePlayers = useMemo(() => {
    const normalizedQuery = query.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr-FR')
    return [...players]
      .filter((player) => !normalizedQuery || `${player.firstName} ${player.lastName}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr-FR').includes(normalizedQuery))
      .sort((a, b) => a.lastName.localeCompare(b.lastName, 'fr') || a.firstName.localeCompare(b.firstName, 'fr'))
  }, [players, query])

  const selectedCount = Object.values(selections).filter(Boolean).length
  const missingStatusCount = players.length - selectedCount
  const teamOneCount = Object.values(selections).filter((value) => value === '✅ Convoqué E1' || value === '✅ Convoqué E1 + E2').length
  const teamTwoCount = Object.values(selections).filter((value) => value === '✅ Convoqué E2' || value === '✅ Convoqué E1 + E2').length
  const existingDate = savedDates.has(date)
  const saveDisabledReason = !savingStatusChecked
    ? 'Vérification de la disponibilité de la saisie…'
    : !savingEnabled
      ? 'La saisie est disponible uniquement sur le site officiel.'
      : players.length === 0
        ? 'Aucun joueur à enregistrer.'
        : dates.length === 0
          ? 'Aucun match programmé. Ajoute d’abord un match dans la rubrique « Matchs ».'
          : ''

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!date) {
      setError('Aucun match programmé. Ajoute d’abord un match dans la rubrique « Matchs ».')
      return
    }
    if (date < MATCH_SEASON_START || date > MATCH_SEASON_END) {
      setError('La date doit être comprise entre le 1er septembre 2026 et le 30 juin 2027.')
      return
    }
    if (new Date(`${date}T12:00:00`).getDay() !== 6) {
      setError('Choisis un samedi pour enregistrer les convocations.')
      return
    }
    if (!savingEnabled) {
      setError('La saisie est désactivée dans cet aperçu. Elle sera disponible sur le site officiel.')
      return
    }
    setPending(true)
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/educators/callups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          selections: players.map((player) => ({ number: player.number, status: selections[player.number] })),
        }),
      })
      const result = await response.json()
      if (response.status === 401) {
        throw new Error('La session éducateur n’est plus valide. Reconnecte-toi dans un autre onglet, puis réessaie ici pour conserver tes choix.')
      }
      if (!response.ok) {
        if (result.callupsSaved) router.refresh()
        throw new Error(result.error ?? 'Impossible d’enregistrer les convocations.')
      }
      setNotice(existingDate
        ? 'Les convocations de ce samedi ont été mises à jour dans « ' + result.sheetTitle + ' ».'
        : 'Les convocations ont été enregistrées dans « ' + result.sheetTitle + ' ».')
      router.refresh()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Impossible d’enregistrer les convocations.')
    } finally {
      setPending(false)
    }
  }

  return (
    <section aria-labelledby="callup-entry-title" className="overflow-visible rounded-xl border border-[#172554]/20 bg-[#eef2ff] shadow-sm">
      <header ref={callupTitleRef} className="scroll-mt-4 flex items-center gap-3 rounded-t-xl bg-gradient-to-r from-[#172554] via-[#1e3a70] to-[#172554] px-4 py-3 text-white sm:px-5 sm:py-4">
        <ClubCrest className="size-12 ring-2 ring-[#d4af37] sm:size-14" />
        <div className="min-w-0">
          <h2 id="callup-entry-title" className="font-bold">Convocations du samedi</h2>
          <p className="mt-0.5 text-[10px] font-medium text-white/70">Présences d’entraînement : M = mardi · V = vendredi · le dernier match indique aussi son équipe.</p>
        </div>
      </header>

      <form onSubmit={save} className="flex flex-col gap-3 p-3 pb-24 sm:gap-4 sm:p-5 sm:pb-24">
        {!savingStatusChecked ? (
          <p role="status" className="rounded-lg bg-white/70 px-3 py-2 text-sm text-[#172554]">Vérification…</p>
        ) : !savingEnabled ? (
          <p className="rounded-lg bg-white/70 px-3 py-2 text-sm text-[#172554]">
            Saisie disponible sur le site officiel.
          </p>
        ) : null}
        {trainingAttendanceError && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
            Présences aux entraînements indisponibles.
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#dbeafe] px-3 py-2 text-xs font-semibold text-[#172554]">
          <span className="inline-flex items-center gap-1.5"><UsersRound aria-hidden="true" className="size-4" /> {selectedCount}/{players.length} statuts renseignés</span>
          <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1"><ClubCrest className="size-4 ring-1 ring-[#d4af37]/60" /><span className="text-[#172554]">E1 : {teamOneCount}</span></span>
            <span className="inline-flex items-center gap-1"><ClubCrest className="size-4 ring-1 ring-[#d4af37]/60" /><span className="text-amber-800">E2 : {teamTwoCount}</span></span>
          </span>
        </div>
        {missingStatusCount > 0 && (
          <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
            {missingStatusCount} joueur{missingStatusCount === 1 ? '' : 's'} sans statut. Vérifie la liste avant d’enregistrer.
          </p>
        )}

        <div className="flex items-center gap-2">
          {initialDate ? (
            <p className="min-w-0 flex-1 text-xs font-bold text-[#172554]">
              {new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          ) : (
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-bold text-[#172554]">
              Match programmé
              <span className="flex items-center gap-2">
                <select
                  value={date}
                  onChange={(event) => {
                    setDate(event.target.value)
                    setError('')
                    setNotice('')
                  }}
                  className="h-11 min-w-0 flex-1 rounded-lg border border-[#172554]/25 bg-white px-3 text-sm font-normal text-[#172554]"
                >
                  {dates.length === 0 ? (
                    <option value="">Aucun match programmé</option>
                  ) : dates.map((matchDate) => (
                    <option key={matchDate} value={matchDate}>
                      {new Date(`${matchDate}T12:00:00`).toLocaleDateString('fr-FR', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </option>
                  ))}
                </select>
              </span>
            </label>
          )}
          <button
            type="button"
            onClick={() => setSelections(Object.fromEntries(players.map((player) => [player.number, ''])))}
            className="min-h-8 shrink-0 rounded-lg border border-[#172554]/25 bg-white px-2 text-[10px] font-semibold text-[#172554] sm:text-xs"
          >
            Réinit statut
          </button>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor="callup-player-search">Rechercher un joueur</label>
          <input
            id="callup-player-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher un joueur…"
            className="h-11 min-w-0 flex-1 rounded-lg border border-[#172554]/20 bg-white px-3 text-sm"
          />
        </div>

        <ul className="divide-y divide-[#172554]/10 rounded-lg border border-[#172554]/15 bg-white/60">
          {visiblePlayers.map((player) => {
            const selection = selections[player.number] ?? ''
            const setSelection = (value: SelectionValue) =>
              setSelections((current) => ({ ...current, [player.number]: value }))
            const playerIre = playerStats.find((stats) => stats.number === player.number)?.ire
            const ireTone = playerIre === null || playerIre === undefined
              ? 'bg-slate-100 text-slate-700'
              : playerIre > 1.1
                ? 'bg-red-100 text-red-800'
                : playerIre < 0.9
                  ? 'bg-orange-100 text-orange-800'
                  : 'bg-emerald-100 text-emerald-800'
            const playerTrainingStatuses = relevantTrainingSessions.map((session) => ({
              ...session,
              status: session.playerStatuses?.[player.number],
            }))
            const teamsPlayedLastMatch = lastCompletedMatches
              .filter((match) => match.playedPlayerNumbers?.includes(player.number))
              .map((match) => match.team)
            const uniqueTeamsPlayed = [...new Set(teamsPlayedLastMatch)]
            const participationRecorded = lastCompletedMatches.length > 0 &&
              lastCompletedMatches.every((match) => match.hasParticipationData)
            const lastMatchIcon = uniqueTeamsPlayed.length > 0
              ? CircleCheck
              : participationRecorded
                ? CircleMinus
                : CircleHelp
            const lastMatchLabel = uniqueTeamsPlayed.length > 0
              ? `Joué · ${uniqueTeamsPlayed.join(' + ')}`
              : participationRecorded
                ? 'Pas joué'
                : 'Stats à saisir'
            const lastMatchTone = uniqueTeamsPlayed.length > 0
              ? 'bg-emerald-100 text-emerald-800'
              : participationRecorded
                ? 'bg-orange-100 text-orange-900'
                : 'bg-slate-100 text-slate-700'
            const lastMatchDateLabel = lastCompletedMatchDate
              ? new Date(`${lastCompletedMatchDate}T12:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
              : ''

            return (
              <li key={player.number} className="grid min-w-0 grid-cols-1 items-center gap-2 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,auto)] sm:py-2">
                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,auto)_auto]">
                  <span className="col-start-1 row-start-1 min-w-0 truncate text-sm font-semibold text-foreground">
                    {player.firstName} <span className="font-black uppercase text-primary">{player.lastName}</span>
                  </span>
                  <div className="col-span-2 row-start-2 flex flex-wrap items-center gap-1.5 sm:col-start-2 sm:col-span-1 sm:row-start-1">
                    {playerTrainingStatuses.map(({ targetDate, date: sessionDate, status, sessionAvailable, isPrevious }) => {
                      const sessionDateLabel = new Date(`${sessionDate}T12:00:00`).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                      })
                      const weekdayLabel = new Date(`${sessionDate}T12:00:00`).toLocaleDateString('fr-FR', {
                        weekday: 'short',
                      })
                      const targetDateLabel = new Date(`${targetDate}T12:00:00`).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                      })
                      const targetWeekdayLabel = new Date(`${targetDate}T12:00:00`).toLocaleDateString('fr-FR', {
                        weekday: 'short',
                      })
                      const label = sessionAvailable ? attendanceLabel(status) : 'Séance non trouvée'
                      const AttendanceIcon = !sessionAvailable || !status
                        ? CircleHelp
                        : status === 'P'
                          ? CircleCheck
                          : CircleAlert
                      const attendanceIconTone = !sessionAvailable || !status
                        ? 'border-slate-200 bg-slate-100 text-slate-600'
                        : status === 'P'
                          ? 'border-emerald-200 bg-emerald-100 text-emerald-700'
                          : 'border-orange-200 bg-orange-100 text-orange-700'
                      const dayInitial = weekdayLabel.toLocaleLowerCase('fr-FR').startsWith('ven') ? 'V' : 'M'
                      const attendanceDescription = isPrevious
                        ? `Séance avant ${targetWeekdayLabel} ${targetDateLabel}, tenue ${weekdayLabel} ${sessionDateLabel} : ${label}`
                        : `${weekdayLabel} ${sessionDateLabel} : ${label}`
                      return (
                        <span
                          key={targetDate}
                          role="img"
                          aria-label={attendanceDescription}
                          title={attendanceDescription}
                          className={`relative inline-flex size-7 shrink-0 items-center justify-center rounded-full border ${attendanceIconTone}`}
                        >
                          <AttendanceIcon aria-hidden="true" className="size-4" />
                          <span aria-hidden="true" className="absolute -right-1 -bottom-1 flex size-3.5 items-center justify-center rounded-full border border-white bg-[#172554] text-[8px] font-black leading-none text-white">{dayInitial}</span>
                        </span>
                      )
                    })}
                    {lastCompletedMatches.length > 0 && (() => {
                      const LastMatchIcon = lastMatchIcon
                      return (
                        <span
                          title={`Dernier match (${lastMatchDateLabel}) : ${uniqueTeamsPlayed.length ? `a joué avec ${uniqueTeamsPlayed.join(' et ')}` : participationRecorded ? 'n’a pas joué' : 'temps de jeu non renseigné'}`}
                          aria-label={`Dernier match : ${lastMatchLabel}`}
                          className={`inline-flex min-h-7 items-center gap-1 rounded-full px-2 py-1 text-[9px] font-black ${lastMatchTone}`}
                        >
                          <LastMatchIcon aria-hidden="true" className="size-3.5" />
                          {lastMatchLabel}
                        </span>
                      )
                    })()}
                  </div>
                  <span className={`col-start-2 row-start-1 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${ireTone} sm:col-start-3`}>
                    IRE {playerIre === null || playerIre === undefined ? '—' : playerIre.toFixed(2).replace('.', ',')}
                  </span>
                </div>
                <label className="sr-only" htmlFor={`callup-status-${player.number}`}>
                  Statut de {player.firstName} {player.lastName}
                </label>
                <select
                  id={`callup-status-${player.number}`}
                  value={selection}
                  onChange={(event) => setSelection(event.target.value as SelectionValue)}
                  className="h-11 w-full min-w-0 rounded-lg border border-[#172554]/20 bg-white px-2 text-sm text-[#172554] sm:h-10 sm:w-56"
                >
                  <option value="" disabled>Choisir un statut…</option>
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </li>
            )
          })}
        </ul>

        {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
        {notice && <p role="status" className="text-sm font-medium text-emerald-700 dark:text-emerald-300">{notice}</p>}
        <div className="fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-3 py-1 xl:inset-x-auto xl:right-24 xl:bottom-6 xl:justify-end xl:px-0">
          <div className="flex max-w-full flex-col items-center gap-1">
            {saveDisabledReason && !pending && (
              <p role="status" className="max-w-full rounded-lg bg-white px-3 py-1 text-center text-xs font-semibold text-[#172554] shadow">
                {saveDisabledReason}
              </p>
            )}
            <button
              type="submit"
              disabled={!savingEnabled || pending || players.length === 0 || dates.length === 0}
              className="inline-flex min-h-10 w-auto max-w-full items-center justify-center gap-2 rounded-lg bg-[#172554] px-5 text-sm font-bold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save aria-hidden="true" className="size-4" />
              {pending ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Les statuts sont enregistrés dans l’onglet « 📣 Convocations Matchs ». Une date déjà saisie sera mise à jour.
        </p>
      </form>
    </section>
  )
}
