'use client'

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Save, UsersRound, X } from 'lucide-react'
import { ClubCrest } from '@/components/club-crest'
import { CallupPlayerDialog } from '@/components/callup-player-dialog'
import { CallupPlayerList, type CallupSelection } from '@/components/callup-player-list'
import type { Convocation } from '@/lib/convocations'
import type { PublicPlayer } from '@/lib/players'
import type { PlayerStats } from '@/lib/stats'
import type { TrainingAttendanceSession } from '@/lib/training-attendance'
import type { MatchSheetEntry } from '@/lib/match-results'
import { MATCH_SEASON_END, MATCH_SEASON_START } from '@/lib/match-season'

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

function selectionForPlayer(
  playerNumber: number,
  date: string,
  convocations: Convocation[],
): CallupSelection {
  const entry = convocations
    .find((player) => player.number === playerNumber)
    ?.matches.find((match) => dateKey(match.date) === date)
  if (!entry) return ''
  const { status, team } = entry
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
  matchesPlayed,
  onClose,
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
  matchesPlayed: number
  onClose: () => void
}) {
  const router = useRouter()
  const callupTitleRef = useRef<HTMLElement>(null)
  const [date, setDate] = useState(initialDate ?? '')
  const [selectedPlayerNumber, setSelectedPlayerNumber] = useState<number | null>(null)
  const [selections, setSelections] = useState<Record<number, CallupSelection>>({})
  const [query, setQuery] = useState('')
  const [pending, setPending] = useState(false)
  const [savingEnabled, setSavingEnabled] = useState(false)
  const [savingStatusChecked, setSavingStatusChecked] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const selectedPlayer = players.find((player) => player.number === selectedPlayerNumber) ?? null

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
    const teamPriority = (playerNumber: number) => {
      const status = selections[playerNumber]
      if (status === '✅ Convoqué E1' || status === '✅ Convoqué E1 + E2') return 0
      if (status === '✅ Convoqué E2') return 1
      return 2
    }
    return [...players]
      .filter((player) => !normalizedQuery || `${player.firstName} ${player.lastName}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr-FR').includes(normalizedQuery))
      .sort((a, b) => teamPriority(a.number) - teamPriority(b.number) ||
        a.lastName.localeCompare(b.lastName, 'fr') || a.firstName.localeCompare(b.firstName, 'fr'))
  }, [players, query, selections])

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
      <header ref={callupTitleRef} className="sticky top-0 z-20 flex scroll-mt-4 items-center gap-3 rounded-t-xl border-b border-[#d4af37]/70 bg-gradient-to-r from-[#172554] via-[#1e3a70] to-[#172554] px-4 py-3 text-white shadow-md sm:px-5 sm:py-4">
        <ClubCrest className="size-12 ring-2 ring-[#d4af37] sm:size-14" />
        <div className="min-w-0 flex-1">
          <h2 id="callup-entry-title" className="font-bold">Convocations du samedi</h2>
          <p className="mt-0.5 text-[10px] font-medium text-white/70">Présences d’entraînement : M = mardi · V = vendredi · le dernier match indique aussi son équipe.</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer les convocations"
          title="Fermer les convocations"
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37]"
        >
          <X aria-hidden="true" className="size-5" />
        </button>
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

        <CallupPlayerList
          players={visiblePlayers}
          playerStats={playerStats}
          selections={selections}
          trainingSessions={relevantTrainingSessions}
          lastCompletedMatches={lastCompletedMatches}
          lastCompletedMatchDate={lastCompletedMatchDate}
          onSelectPlayer={setSelectedPlayerNumber}
          onSelectionChange={(playerNumber, value) =>
            setSelections((current) => ({ ...current, [playerNumber]: value }))
          }
        />

        {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
        {notice && <p role="status" className="text-sm font-medium text-emerald-700 dark:text-emerald-300">{notice}</p>}
        <div className="fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-3 py-1 xl:inset-x-auto xl:right-24 xl:bottom-6 xl:justify-end xl:px-0">
          <div className="flex max-w-full flex-col items-center gap-1">
            {saveDisabledReason && !pending && (
              <p role="status" className="max-w-full rounded-lg bg-white px-3 py-1 text-center text-xs font-semibold text-[#172554] shadow">
                {saveDisabledReason}
              </p>
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                aria-label="Fermer les convocations"
                title="Fermer les convocations"
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-[#172554]/15 bg-white text-[#172554] shadow-lg transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37]"
              >
                <X aria-hidden="true" className="size-5" />
              </button>
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
        </div>
        <p className="text-xs text-muted-foreground">
          Les statuts sont enregistrés dans l’onglet « 📣 Convocations Matchs ». Une date déjà saisie sera mise à jour.
        </p>
      </form>
      <CallupPlayerDialog
        player={selectedPlayer}
        playerStats={playerStats}
        trainingAttendance={trainingAttendance}
        convocations={convocations}
        matchEntries={matchEntries}
        matchesPlayed={matchesPlayed}
        onClose={() => setSelectedPlayerNumber(null)}
      />
    </section>
  )
}
