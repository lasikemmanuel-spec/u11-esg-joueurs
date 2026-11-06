'use client'

import { useEffect, useMemo, useState } from 'react'
import { Armchair, ChevronDown, Save, X } from 'lucide-react'
import type { Convocation } from '@/lib/convocations'
import type { MatchSheetEntry } from '@/lib/match-results'
import type { PublicPlayer } from '@/lib/players'
import type { MatchLineup } from '@/lib/match-lineups'

type LineupRole = 'starter' | 'substitute'
type LineupAssignments = Record<number, LineupRole>

function JerseyIcon({ number }: { number: number }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" className="size-7">
      <path
        d="M11 3.5 6 6 2.5 14l5 2.5L10 12v16h12V12l2.5 4.5 5-2.5L26 6l-5-2.5c-1 2.4-2.5 3.5-5 3.5s-4-1.1-5-3.5Z"
        fill="#172554"
        stroke="#d4af37"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <path d="M11 4c.8 2.3 2.4 3.5 5 3.5S20.2 6.3 21 4" fill="none" stroke="#d4af37" strokeWidth="1.3" />
      <text
        x="16"
        y="21"
        fill="white"
        fontSize={number > 99 ? 5 : number > 9 ? 7 : 9}
        fontWeight="700"
        textAnchor="middle"
      >
        {number}
      </text>
    </svg>
  )
}

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
  const [selectedTeam, setSelectedTeam] = useState<'E1' | 'E2'>('E1')
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
  const upcomingDateGroups = useMemo(() => {
    const matchesByDate = new Map<string, typeof upcomingMatches>()
    for (const match of upcomingMatches) {
      matchesByDate.set(match.date, [...(matchesByDate.get(match.date) ?? []), match])
    }
    return [...matchesByDate.entries()].map(([date, matches]) => ({
      date,
      matches: [...matches].sort((a, b) =>
        a.team === b.team ? a.slotColumn - b.slotColumn : a.team === 'E1' ? -1 : 1,
      ),
    }))
  }, [upcomingMatches])
  const previousMatches = useMemo(() => {
    const today = localToday()
    return entries
      .filter((entry) => entry.resultLabel !== 'Annulé')
      .map((entry) => ({ ...entry, date: dateKey(entry.date) }))
      .filter((entry) => entry.date && entry.date < today)
      .sort((a, b) => b.date.localeCompare(a.date) || a.slotColumn - b.slotColumn)
  }, [entries])
  const upcomingTeamCounts = {
    E1: upcomingMatches.filter((match) => match.team === 'E1').length,
    E2: upcomingMatches.filter((match) => match.team === 'E2').length,
  }
  const activeTeam = upcomingTeamCounts[selectedTeam] > 0
    ? selectedTeam
    : selectedTeam === 'E1' && upcomingTeamCounts.E2 > 0
      ? 'E2'
      : 'E1'

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

  return (
    <section aria-label="Feuilles de match" className="mt-4 rounded-xl border border-accent/50 bg-card p-4 shadow-sm">
      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement des feuilles de match…</p>
      ) : (
        <>
          {error && <p role="alert" className="mb-3 text-sm font-medium text-destructive">{error}</p>}
          {notice && <p role="status" className="mb-3 text-sm font-medium text-emerald-700">{notice}</p>}
          {upcomingMatches.length > 0 && (
            <>
              <div role="tablist" aria-label="Choisir une équipe pour la feuille de match" className="mb-3 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
                {(['E1', 'E2'] as const).map((team) => {
                  const isE1 = team === 'E1'
                  const selected = team === activeTeam
                  return (
                    <button
                      key={team}
                      id={`lineup-tab-${team}`}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      aria-controls="upcoming-lineups-panel"
                      disabled={upcomingTeamCounts[team] === 0}
                      onClick={() => setSelectedTeam(team)}
                      className={[
                        'flex min-h-10 items-center justify-center gap-2 rounded-md px-2 py-1.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                        selected
                          ? isE1
                            ? 'bg-[#172554] text-white'
                            : 'bg-amber-400 text-blue-950'
                          : isE1
                            ? 'text-[#172554] hover:bg-background/70'
                            : 'text-amber-900 hover:bg-background/70',
                      ].join(' ')}
                    >
                      <span>Équipe {isE1 ? '1' : '2'}</span>
                      <span className={`rounded-full px-1.5 text-xs ${selected ? 'bg-white/20' : 'bg-foreground/5'}`}>
                        {upcomingTeamCounts[team]}
                      </span>
                    </button>
                  )
                })}
              </div>
              <div id="upcoming-lineups-panel" role="tabpanel" aria-labelledby={`lineup-tab-${activeTeam}`}>
                {upcomingDateGroups.map(({ date, matches }) => {
                  const teamMatches = matches.filter((match) => match.team === activeTeam)
                  if (teamMatches.length === 0) return null
                  const teamIsE1 = activeTeam === 'E1'

                  return (
                    <div key={date} className="mb-3">
                      <p className="mb-2 border-b border-border px-1 pb-1 text-xs font-medium capitalize text-muted-foreground">
                        {new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </p>
                      <div className="grid gap-2">
                        {teamMatches.map((match) => {
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
                          const accentClass = teamIsE1
                            ? 'border-l-[#172554] bg-[#172554]/[0.04]'
                            : 'border-l-amber-400 bg-amber-400/[0.08]'

                          return (
                            <details key={key} className={`group min-w-0 overflow-hidden rounded-md border border-l-4 ${teamIsE1 ? 'border-y-border border-r-border border-l-[#172554]' : 'border-y-border border-r-border border-l-amber-400'}`}>
                              <summary className={`flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 ${accentClass} [&::-webkit-details-marker]:hidden`}>
                                <span className="flex min-w-0 items-center gap-2">
                                  <span className="min-w-0">
                                    <span className={`block truncate text-sm font-semibold ${teamIsE1 ? 'text-[#172554]' : 'text-amber-950'}`}>{match.opponent || 'Adversaire à préciser'}</span>
                                    <span className="block truncate text-xs text-muted-foreground">
                                      {match.competition}
                                    </span>
                                  </span>
                                </span>
                                <span className="flex shrink-0 items-center gap-2">
                                  <span className="rounded-full bg-background/80 px-2 py-0.5 text-xs text-muted-foreground">
                                    {calledPlayers.length}
                                  </span>
                                  <ChevronDown aria-hidden="true" className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
                                </span>
                              </summary>
                              <div className="bg-background px-2 py-2">
                                {calledPlayers.length === 0 ? (
                                  <p className="rounded-lg bg-muted px-3 py-4 text-center text-sm text-muted-foreground">
                                    La feuille sera alimentée dès l’enregistrement des convocations pour cette équipe.
                                  </p>
                                ) : (
                                  <>
                                    <ul className="divide-y divide-border rounded-lg border border-border">
                                      {calledPlayers.map((player) => {
                                        const currentRole = assignments[player.number]
                                        const updateRole = (role: LineupRole | null) => {
                                          const nextAssignments = { ...assignments }
                                          if (role === currentRole || role === null) delete nextAssignments[player.number]
                                          else nextAssignments[player.number] = role
                                          const nextStarters = Object.entries(nextAssignments)
                                            .filter(([, assignment]) => assignment === 'starter')
                                            .map(([number]) => Number(number))
                                          const nextSubstitutes = Object.entries(nextAssignments)
                                            .filter(([, assignment]) => assignment === 'substitute')
                                            .map(([number]) => Number(number))
                                          void saveLineup(match, nextStarters, nextSubstitutes)
                                        }
                                        const buttonClass = 'inline-flex size-10 items-center justify-center rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'

                                        return (
                                          <li key={player.number} className="flex min-w-0 flex-col items-stretch gap-2 px-2 py-2 sm:flex-row sm:items-center sm:justify-between">
                                            <div className="min-w-0 flex-1">
                                              <span className="min-w-0 whitespace-normal break-words text-sm font-medium">
                                                {player.firstName} <span className="font-bold uppercase">{player.lastName}</span>
                                              </span>
                                            </div>
                                            <div role="group" aria-label={`Action pour ${player.firstName} ${player.lastName}`} className="flex shrink-0 items-center gap-2">
                                              <button
                                                type="button"
                                                title="Commence le match"
                                                aria-label={`${currentRole === 'starter' ? 'Retirer : ' : 'Choisir : '}commence le match pour ${player.firstName} ${player.lastName}`}
                                                aria-pressed={currentRole === 'starter'}
                                                disabled={pendingKey === key || (currentRole !== 'starter' && starters.length >= 8)}
                                                onClick={() => updateRole('starter')}
                                                className={`${buttonClass} ${currentRole === 'starter' ? 'border-primary bg-primary text-primary-foreground' : 'border-accent/50 bg-background text-foreground hover:bg-muted'}`}
                                              >
                                                <JerseyIcon number={player.number} />
                                              </button>
                                              <button
                                                type="button"
                                                title="Peut entrer en cours de jeu"
                                                aria-label={`${currentRole === 'substitute' ? 'Retirer : ' : 'Choisir : '}peut entrer en cours de jeu pour ${player.firstName} ${player.lastName}`}
                                                aria-pressed={currentRole === 'substitute'}
                                                disabled={pendingKey === key}
                                                onClick={() => updateRole('substitute')}
                                                className={`${buttonClass} ${currentRole === 'substitute' ? 'border-primary bg-primary text-primary-foreground' : 'border-accent/50 bg-background text-foreground hover:bg-muted'}`}
                                              >
                                                <Armchair aria-hidden="true" className="size-5" />
                                              </button>
                                              {currentRole && (
                                                <button
                                                  type="button"
                                                  title="Retirer ce choix"
                                                  aria-label={`Retirer le choix pour ${player.firstName} ${player.lastName}`}
                                                  disabled={pendingKey === key}
                                                  onClick={() => updateRole(null)}
                                                  className={`${buttonClass} border-accent/50 bg-background text-muted-foreground hover:bg-muted`}
                                                >
                                                  <X aria-hidden="true" className="size-5" />
                                                </button>
                                              )}
                                            </div>
                                          </li>
                                        )
                                      })}
                                    </ul>
                                    <p className="mt-2 text-xs text-muted-foreground">
                                      {starters.length}/8 au départ · {substitutes.length} sur le banc
                                    </p>
                                    {starters.length >= 8 && (
                                      <p role="status" className="mt-1 text-xs font-medium text-amber-800">
                                        Les 8 places de titulaires sont prises. Retire d’abord un titulaire avec le bouton × pour en choisir un autre.
                                      </p>
                                    )}
                                  </>
                                )}
                                {pendingKey === key && (
                                  <p role="status" className="mt-2 text-xs text-muted-foreground">Enregistrement…</p>
                                )}
                              </div>
                            </details>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
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
                              <li key={player.number} className="flex min-w-0 flex-col gap-1 px-2 py-2 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                                <div className="min-w-0 flex-1">
                                  <span className="min-w-0 whitespace-normal break-words font-medium">
                                    {player.firstName} <span className="font-bold uppercase">{player.lastName}</span>
                                  </span>
                                </div>
                                {role ? (
                                  <span
                                    title={role === 'starter' ? 'Commence le match' : 'Peut entrer en cours de jeu'}
                                    aria-label={role === 'starter' ? 'Commence le match' : 'Peut entrer en cours de jeu'}
                                    className="shrink-0 text-primary"
                                  >
                                    {role === 'starter'
                                      ? <JerseyIcon number={player.number} />
                                      : <Armchair aria-hidden="true" className="size-5" />}
                                  </span>
                                ) : (
                                  <span className="shrink-0 text-xs text-muted-foreground">Action non définie</span>
                                )}
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
