'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Save, UsersRound } from 'lucide-react'
import { ClubCrest } from '@/components/club-crest'
import type { Convocation, MatchStatus } from '@/lib/convocations'
import type { EditableCallupStatus } from '@/lib/convocation-management'
import type { PublicPlayer } from '@/lib/players'
import { MATCH_SEASON_END, MATCH_SEASON_START } from '@/lib/match-season'

const STATUS_OPTIONS: Array<{ value: EditableCallupStatus; label: string }> = [
  { value: '✅ Convoqué E1', label: '✅ Convoqué E1' },
  { value: '❌ Non convoqué', label: '❌ Non convoqué' },
  { value: '⚠️ Convoqué absent', label: '⚠️ Convoqué absent' },
  { value: '🗓️ Absent', label: '🗓️ Absent' },
  { value: '✅ Convoqué E2', label: '✅ Convoqué E2' },
  { value: '🩺 Blessé', label: '🩺 Blessé' },
  { value: 'Pas de licence', label: 'Pas de licence' },
]
const TEAM_ONE_STATUS: EditableCallupStatus = '✅ Convoqué E1'
const TEAM_TWO_STATUS: EditableCallupStatus = '✅ Convoqué E2'
const OTHER_STATUS_OPTIONS = STATUS_OPTIONS.filter(
  ({ value }) => value !== TEAM_ONE_STATUS && value !== TEAM_TWO_STATUS,
)

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

export function CallupScheduleEntry({
  players,
  convocations,
  convocationDates,
  scheduledMatchDates,
  initialDate,
}: {
  players: PublicPlayer[]
  convocations: Convocation[]
  convocationDates: string[]
  scheduledMatchDates: string[]
  initialDate?: string
}) {
  const router = useRouter()
  const [date, setDate] = useState(initialDate ?? '')
  const [selections, setSelections] = useState<Record<number, SelectionValue>>({})
  const [query, setQuery] = useState('')
  const [pending, setPending] = useState(false)
  const [savingEnabled, setSavingEnabled] = useState(false)
  const [savingStatusChecked, setSavingStatusChecked] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

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
  const teamOneCount = Object.values(selections).filter((value) => value === TEAM_ONE_STATUS).length
  const teamTwoCount = Object.values(selections).filter((value) => value === TEAM_TWO_STATUS).length
  const existingDate = savedDates.has(date)

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
      if (!response.ok) throw new Error(result.error ?? 'Impossible d’enregistrer les convocations.')
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
    <section aria-labelledby="callup-entry-title" className="overflow-hidden rounded-xl border border-[#172554]/20 bg-[#eef2ff] shadow-sm">
      <header className="flex items-center gap-3 bg-gradient-to-r from-[#172554] via-[#1e3a70] to-[#172554] px-4 py-3 text-white sm:px-5 sm:py-4">
        <ClubCrest className="size-12 ring-2 ring-[#d4af37] sm:size-14" />
        <div className="min-w-0">
          <h2 id="callup-entry-title" className="font-bold">Convocations du samedi</h2>
          <p className="mt-0.5 text-xs text-white/75">Répartir les joueurs entre E1 et E2</p>
        </div>
      </header>

      <form onSubmit={save} className="flex flex-col gap-3 p-3 sm:gap-4 sm:p-5">
        {!savingStatusChecked ? (
          <p role="status" className="rounded-lg bg-white/70 px-3 py-2 text-sm text-[#172554]">Vérification…</p>
        ) : !savingEnabled ? (
          <p className="rounded-lg bg-white/70 px-3 py-2 text-sm text-[#172554]">
            Saisie disponible sur le site officiel.
          </p>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#dbeafe] px-3 py-2 text-xs font-semibold text-[#172554]">
          <span className="inline-flex items-center gap-1.5"><UsersRound aria-hidden="true" className="size-4" /> {selectedCount}/{players.length} statuts renseignés</span>
          <span>Équipe 1 : {teamOneCount} · Équipe 2 : {teamTwoCount}</span>
        </div>

        {initialDate ? (
          <p className="flex flex-wrap items-center gap-2 text-xs font-bold text-[#172554]">
            {new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
            {existingDate && <span className="rounded-full bg-[#dbeafe] px-2 py-1 text-[10px]">Déjà saisi</span>}
          </p>
        ) : (
          <label className="flex flex-col gap-1 text-xs font-bold text-[#172554]">
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
              {existingDate && <span className="shrink-0 rounded-full bg-[#dbeafe] px-2 py-1 text-[10px] font-bold text-[#172554]">Déjà saisi</span>}
            </span>
          </label>
        )}

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
          <button
            type="button"
            onClick={() => setSelections(Object.fromEntries(players.map((player) => [player.number, '❌ Non convoqué'])))}
            className="min-h-11 rounded-lg border border-[#172554]/25 bg-white px-3 text-xs font-semibold text-[#172554]"
          >
            Tous non convoqués
          </button>
          <button
            type="button"
            onClick={() => setSelections(Object.fromEntries(players.map((player) => [player.number, ''])))}
            className="min-h-11 rounded-lg border border-[#172554]/25 bg-white px-3 text-xs font-semibold text-[#172554]"
          >
            Vider tous les statuts
          </button>
        </div>

        <ul className="divide-y divide-[#172554]/10 rounded-lg border border-[#172554]/15 bg-white/60">
          {visiblePlayers.map((player) => {
            const selection = selections[player.number] ?? ''
            const setSelection = (value: SelectionValue) =>
              setSelections((current) => ({ ...current, [player.number]: value }))

            return (
              <li key={player.number} className="grid min-w-0 grid-cols-1 items-center gap-2 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,auto)] sm:py-2">
                <span className="min-w-0 truncate text-sm font-semibold text-foreground">
                  {player.firstName} <span className="font-black uppercase text-primary">{player.lastName}</span>
                </span>
                <div className="grid grid-cols-2 gap-2 sm:hidden">
                  {[TEAM_ONE_STATUS, TEAM_TWO_STATUS].map((status, index) => {
                    const selected = selection === status
                    const teamLabel = index === 0 ? 'Équipe 1' : 'Équipe 2'
                    return (
                      <button
                        key={status}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setSelection(status)}
                        className={`min-h-11 rounded-lg border px-2 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#172554] ${
                          selected
                            ? 'border-[#172554] bg-[#172554] text-white'
                            : 'border-[#172554]/25 bg-white text-[#172554]'
                        }`}
                      >
                        ✅ {teamLabel}
                      </button>
                    )
                  })}
                </div>
                <label className="sr-only sm:hidden" htmlFor={`callup-other-status-${player.number}`}>
                  Autre statut de {player.firstName} {player.lastName}
                </label>
                <select
                  id={`callup-other-status-${player.number}`}
                  value={OTHER_STATUS_OPTIONS.some(({ value }) => value === selection) ? selection : ''}
                  onChange={(event) => setSelection(event.target.value as SelectionValue)}
                  className="h-11 w-full min-w-0 rounded-lg border border-[#172554]/20 bg-white px-2 text-sm text-[#172554] sm:hidden"
                >
                  <option value="" disabled>Autre statut…</option>
                  {OTHER_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <label className="sr-only hidden sm:block" htmlFor={`callup-status-${player.number}`}>
                  Statut de {player.firstName} {player.lastName}
                </label>
                <select
                  id={`callup-status-${player.number}`}
                  value={selection}
                  onChange={(event) => setSelection(event.target.value as SelectionValue)}
                  className="hidden h-10 w-full min-w-0 rounded-lg border border-[#172554]/20 bg-white px-2 text-sm text-[#172554] sm:block sm:w-56"
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
        <button
          type="submit"
          disabled={!savingEnabled || pending || players.length === 0 || dates.length === 0}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#172554] px-4 text-sm font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save aria-hidden="true" className="size-4" />
          {pending ? 'Enregistrement…' : existingDate ? 'Mettre à jour les convocations' : 'Enregistrer les convocations'}
        </button>
        <p className="text-xs text-muted-foreground">
          Les statuts sont enregistrés dans l’onglet « 📣 Convocations Matchs ». Une date déjà saisie sera mise à jour.
        </p>
      </form>
    </section>
  )
}
