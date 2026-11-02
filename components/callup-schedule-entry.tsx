'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Save, UsersRound } from 'lucide-react'
import type { Convocation, MatchStatus } from '@/lib/convocations'
import type { EditableCallupStatus } from '@/lib/convocation-management'
import type { PublicPlayer } from '@/lib/players'
import { MATCH_SEASON_END, MATCH_SEASON_START } from '@/lib/match-season'

const STATUS_OPTIONS: Array<{ value: EditableCallupStatus; label: string }> = [
  { value: 'called:E1', label: 'Convoqué — Équipe 1' },
  { value: 'called:E2', label: 'Convoqué — Équipe 2' },
  { value: 'present:E1', label: 'Présent — Équipe 1' },
  { value: 'present:E2', label: 'Présent — Équipe 2' },
  { value: 'calledAbsent', label: 'Convoqué absent' },
  { value: 'absent', label: 'Absent' },
  { value: 'injured', label: 'Blessé' },
  { value: 'notCalled', label: 'Non convoqué' },
  { value: 'called', label: 'Convoqué — équipe à préciser' },
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

function nextSaturday() {
  const date = new Date()
  date.setDate(date.getDate() + ((6 - date.getDay() + 7) % 7))
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 10)
}

function existingSelection(status: MatchStatus, team: string | null): SelectionValue {
  if (status === 'called' && team === 'E1') return 'called:E1'
  if (status === 'called' && team === 'E2') return 'called:E2'
  if (status === 'present' && team === 'E1') return 'present:E1'
  if (status === 'present' && team === 'E2') return 'present:E2'
  if (status === 'calledAbsent' || status === 'absent' || status === 'injured' || status === 'notCalled') return status
  if (status === 'called') return 'called'
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
}: {
  players: PublicPlayer[]
  convocations: Convocation[]
}) {
  const router = useRouter()
  const [date, setDate] = useState(nextSaturday)
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

  const dates = useMemo(() => {
    const values = new Set(convocations.flatMap((player) => player.matches.map((match) => dateKey(match.date)).filter(Boolean)))
    return [...values].sort((a, b) => b.localeCompare(a))
  }, [convocations])

  const visiblePlayers = useMemo(() => {
    const normalizedQuery = query.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr-FR')
    return [...players]
      .filter((player) => !normalizedQuery || `${player.firstName} ${player.lastName}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr-FR').includes(normalizedQuery))
      .sort((a, b) => a.lastName.localeCompare(b.lastName, 'fr') || a.firstName.localeCompare(b.firstName, 'fr'))
  }, [players, query])

  const selectedCount = Object.values(selections).filter(Boolean).length
  const teamOneCount = Object.values(selections).filter((value) => value === 'called:E1' || value === 'present:E1').length
  const teamTwoCount = Object.values(selections).filter((value) => value === 'called:E2' || value === 'present:E2').length
  const existingDate = dates.includes(date)

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
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
    if (selectedCount !== players.length) {
      setError('Choisis un statut pour chaque joueur avant d’enregistrer.')
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
    <section aria-labelledby="callup-entry-title" className="rounded-xl border border-accent/50 bg-card p-4 shadow-sm">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="callup-entry-title" className="font-bold text-primary">Convocations du samedi</h2>
          <p className="mt-1 text-xs text-muted-foreground">Répartis les joueurs entre E1 et E2, puis indique le statut de chacun.</p>
        </div>
        <div className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground sm:items-end">
          <label htmlFor="callup-date">Date du samedi</label>
          <input
            id="callup-date"
            type="date"
            value={date}
            min={MATCH_SEASON_START}
            max={MATCH_SEASON_END}
            onChange={(event) => {
              setDate(event.target.value)
              setError('')
              setNotice('')
            }}
            className="h-10 rounded-lg border border-accent/50 bg-background px-3 text-sm font-normal text-foreground"
          />
        </div>
      </header>

      {dates.length > 0 && (
        <label className="mt-3 flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
          Reprendre une date déjà saisie
          <select
            value={dates.includes(date) ? date : ''}
            onChange={(event) => {
              if (!event.target.value) return
              setDate(event.target.value)
              setError('')
              setNotice('')
            }}
            className="h-10 rounded-lg border border-accent/50 bg-background px-3 text-sm font-normal text-foreground"
          >
            <option value="">Choisir une date enregistrée</option>
            {dates.map((savedDate) => (
              <option key={savedDate} value={savedDate}>
                {new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(`${savedDate}T12:00:00Z`))}
              </option>
            ))}
          </select>
        </label>
      )}

      <form onSubmit={save} className="mt-4 flex flex-col gap-3">
        {!savingStatusChecked ? (
          <p role="status" className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">Vérification des droits de saisie…</p>
        ) : !savingEnabled ? (
          <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
            La saisie est désactivée dans cet aperçu. Elle sera disponible sur le site officiel.
          </p>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/70 px-3 py-2 text-xs font-semibold">
          <span className="inline-flex items-center gap-1.5"><UsersRound aria-hidden="true" className="size-4" /> {selectedCount}/{players.length} statuts renseignés</span>
          <span>Équipe 1 : {teamOneCount} · Équipe 2 : {teamTwoCount}</span>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor="callup-player-search">Rechercher un joueur</label>
          <input
            id="callup-player-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher un joueur…"
            className="h-10 min-w-0 flex-1 rounded-lg border border-accent/50 bg-background px-3 text-sm"
          />
          <button
            type="button"
            onClick={() => setSelections(Object.fromEntries(players.map((player) => [player.number, 'notCalled'])))}
            className="min-h-10 rounded-lg border border-accent/50 bg-background px-3 text-xs font-semibold text-primary"
          >
            Tout mettre « Non convoqué »
          </button>
        </div>

        <ul className="divide-y divide-accent/30 rounded-lg border border-accent/40">
          {visiblePlayers.map((player) => (
            <li key={player.number} className="grid min-w-0 grid-cols-1 items-center gap-2 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,auto)]">
              <span className="min-w-0 truncate text-sm font-semibold text-foreground">
                {player.firstName} <span className="font-black uppercase text-primary">{player.lastName}</span>
              </span>
              <label className="sr-only" htmlFor={`callup-status-${player.number}`}>Statut de {player.firstName} {player.lastName}</label>
              <select
                id={`callup-status-${player.number}`}
                value={selections[player.number] ?? ''}
                onChange={(event) => {
                  const value = event.target.value as SelectionValue
                  setSelections((current) => ({ ...current, [player.number]: value }))
                }}
                className="h-10 w-full min-w-0 rounded-lg border border-accent/50 bg-background px-2 text-sm sm:w-56"
              >
                <option value="">Choisir un statut…</option>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </li>
          ))}
        </ul>

        {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
        {notice && <p role="status" className="text-sm font-medium text-emerald-700 dark:text-emerald-300">{notice}</p>}
        <button
          type="submit"
          disabled={!savingEnabled || pending || players.length === 0 || selectedCount !== players.length}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
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
