'use client'

import { useEffect, useMemo, useState } from 'react'
import { Save } from 'lucide-react'
import type { Convocation } from '@/lib/convocations'
import type { MatchSheetEntry } from '@/lib/match-results'
import type { PublicPlayer } from '@/lib/players'
import type { MatchLineup } from '@/lib/match-lineups'

type LineupRole = 'starter' | 'substitute'
type LineupAssignments = Record<number, LineupRole>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isMatchLineup(value: unknown): value is MatchLineup {
  if (!isRecord(value)) return false
  return typeof value.date === 'string' &&
    (value.team === 'E1' || value.team === 'E2') &&
    typeof value.slotColumn === 'number' &&
    Number.isSafeInteger(value.slotColumn) &&
    Array.isArray(value.starters) &&
    value.starters.every((number) => typeof number === 'number' && Number.isSafeInteger(number)) &&
    Array.isArray(value.substitutes) &&
    value.substitutes.every((number) => typeof number === 'number' && Number.isSafeInteger(number))
}

function dateKey(value: string) {
  const iso = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`
  const dayFirst = value.match(/^(\d{1,2})[/. -](\d{1,2})[/. -](\d{4})$/)
  if (dayFirst) return `${dayFirst[3]}-${dayFirst[2].padStart(2, '0')}-${dayFirst[1].padStart(2, '0')}`
  return ''
}

function localToday() {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  return now.toISOString().slice(0, 10)
}

function matchKey(match: Pick<MatchSheetEntry, 'date' | 'team' | 'slotColumn'>) {
  return `${dateKey(match.date)}-${match.team}-${match.slotColumn}`
}

function assignmentsFromLineup(lineup?: MatchLineup): LineupAssignments {
  if (!lineup) return {}
  return Object.fromEntries([
    ...lineup.starters.map((number) => [number, 'starter' as const]),
    ...lineup.substitutes.map((number) => [number, 'substitute' as const]),
  ])
}

function isCalledForTeam(convocation: Convocation | undefined, date: string, team: 'E1' | 'E2') {
  const callup = convocation?.matches.find((item) => dateKey(item.date) === date)
  return Boolean(
    callup &&
    (callup.status === 'called' || callup.status === 'present') &&
    callup.team === team,
  )
}

export function MatchLineupPlanner({
  entries,
  players,
  convocations,
}: {
  entries: MatchSheetEntry[]
  players: PublicPlayer[]
  convocations: Convocation[]
}) {
  const [lineups, setLineups] = useState<MatchLineup[]>([])
  const [loading, setLoading] = useState(true)
  const [pendingKey, setPendingKey] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const upcomingMatches = useMemo(() => {
    const today = localToday()
    const scheduled = entries
      .filter((entry) => entry.resultLabel !== 'Annulé')
      .map((entry) => ({ ...entry, date: dateKey(entry.date) }))
      .filter((entry) => entry.date && entry.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date) || a.slotColumn - b.slotColumn)
    const upcomingDates = new Set([...new Set(scheduled.map((entry) => entry.date))].slice(0, 2))
    return scheduled.filter((entry) => upcomingDates.has(entry.date))
  }, [entries])
  const previousMatches = useMemo(() => {
    const today = localToday()
    return entries
      .filter((entry) => entry.resultLabel !== 'Annulé')
      .map((entry) => ({ ...entry, date: dateKey(entry.date) }))
      .filter((entry) => entry.date && entry.date < today)
      .sort((a, b) => b.date.localeCompare(a.date) || a.slotColumn - b.slotColumn)
  }, [entries])

  useEffect(() => {
    let active = true
    fetch('/api/educators/match-lineups', { cache: 'no-store' })
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok) throw new Error(result.error ?? 'Impossible de charger les feuilles de match.')
        const lineupsValue: unknown = result.lineups
        if (!Array.isArray(lineupsValue) || !lineupsValue.every(isMatchLineup)) {
          throw new Error('Les feuilles de match reçues sont invalides.')
        }
        if (active) setLineups(lineupsValue)
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Impossible de charger les feuilles de match.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [convocations])

  const saveLineup = async (
    match: MatchSheetEntry & { date: string },
    starters: number[],
    substitutes: number[],
  ) => {
    const key = matchKey(match)
    setPendingKey(key)
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/educators/match-lineups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: match.date,
          team: match.team,
          slotColumn: match.slotColumn,
          starters,
          substitutes,
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Impossible d’enregistrer la feuille de match.')
      if (!isMatchLineup(result.lineup)) throw new Error('La feuille de match enregistrée est invalide.')
      setLineups((current) => [
        ...current.filter((lineup) => matchKey(lineup) !== key),
        result.lineup,
      ])
      setNotice('Feuille de match enregistrée.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Impossible d’enregistrer la feuille de match.')
    } finally {
      setPendingKey('')
    }
  }

  if (upcomingMatches.length === 0 && previousMatches.length === 0) return null
  const upcomingDateCount = new Set(upcomingMatches.map((match) => match.date)).size

  return (
    <section aria-labelledby="match-lineup-title" className="mt-4 rounded-xl border border-accent/50 bg-card p-4 shadow-sm">
      <header className="mb-3">
        <h3 id="match-lineup-title" className="font-bold text-primary">
          {upcomingMatches.length === 0
            ? 'Feuilles de match'
            : upcomingDateCount === 1
              ? 'Feuille de match de la prochaine date'
              : 'Feuilles de match des 2 prochaines dates'}
        </h3>
        {upcomingMatches.length > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            Les joueurs convoqués sont ajoutés automatiquement. Choisis ici les titulaires et les remplaçants ; les rôles sont enregistrés immédiatement. Toute modification de convocation actualise la feuille.
          </p>
        )}
      </header>
      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement des feuilles de match…</p>
      ) : (
        <>
          {error && <p role="alert" className="mb-3 text-sm font-medium text-destructive">{error}</p>}
          {notice && <p role="status" className="mb-3 text-sm font-medium text-emerald-700">{notice}</p>}
          <div className="grid gap-3 lg:grid-cols-2">
            {upcomingMatches.map((match) => {
              const key = matchKey(match)
              const lineup = lineups.find((item) => matchKey(item) === key)
              const assignments = assignmentsFromLineup(lineup)
              const calledPlayers = players.filter((player) => isCalledForTeam(
                convocations.find((convocation) => convocation.number === player.number),
                match.date,
                match.team,
              ))
              const starters = calledPlayers.filter((player) => assignments[player.number] === 'starter')
              const substitutes = calledPlayers.filter((player) => assignments[player.number] === 'substitute')

              return (
                <article key={key} className="min-w-0 rounded-lg border border-border bg-background p-3">
                  <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-foreground">
                        {new Date(`${match.date}T12:00:00`).toLocaleDateString('fr-FR', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                        })}
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        Équipe {match.team === 'E1' ? '1' : '2'} · {match.opponent || 'Adversaire à préciser'} · {match.competition}
                      </p>
                    </div>
                    <span className="rounded-full bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">
                      {calledPlayers.length} convoqué{calledPlayers.length === 1 ? '' : 's'}
                    </span>
                  </header>

                  {calledPlayers.length === 0 ? (
                    <p className="rounded-lg bg-muted px-3 py-4 text-center text-sm text-muted-foreground">
                      La feuille sera alimentée dès l’enregistrement des convocations pour cette équipe.
                    </p>
                  ) : (
                    <>
                      <ul className="max-h-80 divide-y divide-border overflow-y-auto rounded-lg border border-border">
                        {calledPlayers.map((player) => (
                          <li key={player.number} className="flex min-w-0 items-center justify-between gap-2 px-2 py-2">
                            <span className="min-w-0 truncate text-sm font-medium">
                              {player.firstName} <span className="font-bold uppercase">{player.lastName}</span>
                            </span>
                            <label className="sr-only" htmlFor={`lineup-${key}-${player.number}`}>
                              Rôle de {player.firstName} {player.lastName}
                            </label>
                            <select
                              id={`lineup-${key}-${player.number}`}
                              disabled={pendingKey === key}
                              value={assignments[player.number] ?? ''}
                              onChange={(event) => {
                                const nextRole = event.target.value as '' | LineupRole
                                const nextAssignments = { ...assignments }
                                if (nextRole) nextAssignments[player.number] = nextRole
                                else delete nextAssignments[player.number]
                                const nextStarters = Object.entries(nextAssignments)
                                  .filter(([, role]) => role === 'starter')
                                  .map(([number]) => Number(number))
                                const nextSubstitutes = Object.entries(nextAssignments)
                                  .filter(([, role]) => role === 'substitute')
                                  .map(([number]) => Number(number))
                                void saveLineup(match, nextStarters, nextSubstitutes)
                              }}
                              className="h-9 w-36 shrink-0 rounded-lg border border-accent/50 bg-background px-2 text-xs"
                            >
                              <option value="">Rôle à définir</option>
                              <option value="starter" disabled={assignments[player.number] !== 'starter' && starters.length >= 8}>
                                Titulaire
                              </option>
                              <option value="substitute">Remplaçant</option>
                            </select>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {starters.length}/8 titulaires · {substitutes.length} remplaçant{substitutes.length === 1 ? '' : 's'}
                      </p>
                    </>
                  )}
                  {pendingKey === key && (
                    <p role="status" className="mt-2 text-xs text-muted-foreground">Enregistrement…</p>
                  )}
                </article>
              )
            })}
          </div>
          {previousMatches.length > 0 && (
            <details className="mt-4 rounded-lg border border-border">
              <summary className="cursor-pointer rounded-lg bg-muted/50 px-3 py-3 text-sm font-bold text-primary">
                Feuilles de match précédentes ({previousMatches.length})
              </summary>
              <div className="grid gap-2 p-3 lg:grid-cols-2">
                {previousMatches.map((match) => {
                  const key = matchKey(match)
                  const assignments = assignmentsFromLineup(lineups.find((item) => matchKey(item) === key))
                  const calledPlayers = players.filter((player) => isCalledForTeam(
                    convocations.find((convocation) => convocation.number === player.number),
                    match.date,
                    match.team,
                  ))

                  return (
                    <article key={key} className="min-w-0 rounded-lg border border-border bg-background p-3">
                      <header className="mb-2">
                        <h4 className="font-bold capitalize text-foreground">
                          {new Date(`${match.date}T12:00:00`).toLocaleDateString('fr-FR', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          Équipe {match.team === 'E1' ? '1' : '2'} · {match.opponent || 'Adversaire à préciser'} · {match.competition}
                        </p>
                      </header>
                      {calledPlayers.length === 0 ? (
                        <p className="rounded-lg bg-muted px-3 py-3 text-center text-sm text-muted-foreground">
                          Aucune convocation enregistrée pour cette équipe.
                        </p>
                      ) : (
                        <ul className="divide-y divide-border rounded-lg border border-border">
                          {calledPlayers.map((player) => {
                            const role = assignments[player.number]
                            return (
                              <li key={player.number} className="flex items-center justify-between gap-2 px-2 py-2 text-sm">
                                <span className="min-w-0 truncate font-medium">
                                  {player.firstName} <span className="font-bold uppercase">{player.lastName}</span>
                                </span>
                                <span className="shrink-0 text-xs text-muted-foreground">
                                  {role === 'starter' ? 'Titulaire' : role === 'substitute' ? 'Remplaçant' : 'Rôle non renseigné'}
                                </span>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </article>
                  )
                })}
              </div>
            </details>
          )}
        </>
      )}
    </section>
  )
}
