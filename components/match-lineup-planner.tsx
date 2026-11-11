'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRef } from 'react'
import { Armchair, ChevronRight, X } from 'lucide-react'
import { ClubCrest } from '@/components/club-crest'
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
    (callup.team === team || callup.team === 'E1+E2'),
  )
}

export function useMatchLineups(enabled: boolean) {
  const [lineups, setLineups] = useState<MatchLineup[]>([])
  const [loading, setLoading] = useState(true)
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(() => new Set())
  const [savedKey, setSavedKey] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)
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
  }, [enabled])

  const saveLineup = useCallback(async (
    match: MatchSheetEntry & { date: string },
    starters: number[],
    substitutes: number[],
  ) => {
    const key = matchKey(match)
    setPendingKeys((current) => new Set(current).add(key))
    setError('')
    setSavedKey('')
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
      setSavedKey(key)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Impossible d’enregistrer la feuille de match.')
    } finally {
      setPendingKeys((current) => {
        const next = new Set(current)
        next.delete(key)
        return next
      })
    }
  }, [])

  return { lineups, loading, pendingKeys, savedKey, error, saveLineup }
}

export function MatchLineupEntry({
  match,
  players,
  convocations,
  lineups,
  pendingKeys,
  savedKey,
  saveLineup,
}: {
  match: MatchSheetEntry
  players: PublicPlayer[]
  convocations: Convocation[]
  lineups: MatchLineup[]
  pendingKeys: Set<string>
  savedKey: string
  saveLineup: (
    match: MatchSheetEntry & { date: string },
    starters: number[],
    substitutes: number[],
  ) => Promise<void>
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const key = matchKey(match)
  const assignments = assignmentsFromLineup(lineups.find((item) => matchKey(item) === key))
  const calledPlayers = players.filter((player) => isCalledForTeam(
    convocations.find((convocation) => convocation.number === player.number),
    dateKey(match.date),
    match.team,
  ))
  const starters = calledPlayers.filter((player) => assignments[player.number] === 'starter')
  const substitutes = calledPlayers.filter((player) => assignments[player.number] === 'substitute')
  const pending = pendingKeys.has(key)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (dialogOpen && !dialog.open) dialog.showModal()
    if (!dialogOpen && dialog.open) dialog.close()
  }, [dialogOpen])

  const updateRole = (playerNumber: number, role: LineupRole | null) => {
    const nextAssignments = { ...assignments }
    if (role === assignments[playerNumber] || role === null) delete nextAssignments[playerNumber]
    else nextAssignments[playerNumber] = role
    const nextStarters = Object.entries(nextAssignments)
      .filter(([, assignment]) => assignment === 'starter')
      .map(([number]) => Number(number))
    const nextSubstitutes = Object.entries(nextAssignments)
      .filter(([, assignment]) => assignment === 'substitute')
      .map(([number]) => Number(number))
    void saveLineup({ ...match, date: dateKey(match.date) }, nextStarters, nextSubstitutes)
  }

  return (
    <>
    <button
      id={`match-sheet-${dateKey(match.date)}-${match.team}-${match.slotColumn}`}
      type="button"
      onClick={() => setDialogOpen(true)}
      aria-haspopup="dialog"
      className={`mt-2 flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border-l-4 px-3 py-2 text-left text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${match.team === 'E1' ? 'border-l-[#172554] bg-[#172554]/[0.05] text-[#172554]' : 'border-l-amber-400 bg-amber-400/[0.1] text-amber-950'}`}
    >
      <span className="flex min-w-0 items-center gap-2">
        <ClubCrest className="size-8 ring-1 ring-[#d4af37]/70" />
        <span className="min-w-0">
          <span className="block font-black">Feuille de match · Équipe {match.team === 'E1' ? '1' : '2'}</span>
          <span className="block text-xs font-medium text-muted-foreground">{calledPlayers.length} convoqué{calledPlayers.length === 1 ? '' : 's'} · {match.opponent || 'adversaire'}</span>
        </span>
      </span>
      <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
    </button>

    <dialog
      ref={dialogRef}
      aria-labelledby={`match-sheet-title-${dateKey(match.date)}-${match.team}-${match.slotColumn}`}
      onClose={() => setDialogOpen(false)}
      onCancel={(event) => {
        event.preventDefault()
        setDialogOpen(false)
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) setDialogOpen(false)
      }}
      className="fixed inset-0 m-auto flex max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-3xl flex-col overflow-hidden rounded-3xl border-2 border-[#d4af37]/70 bg-[#eef2ff] p-0 text-[#172554] shadow-2xl backdrop:bg-[#07102a]/70 backdrop:backdrop-blur-sm dark:bg-[#111b3b] dark:text-white"
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b-4 border-[#d4af37] bg-gradient-to-r from-[#172554] via-[#1e3a8a] to-[#172554] px-4 py-3 text-white sm:px-6 sm:py-4">
        <div className="flex min-w-0 items-center gap-3">
          <ClubCrest className="size-11 ring-2 ring-[#d4af37] sm:size-12" />
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#f4ce45]">ES Genech · U11</p>
            <h2 id={`match-sheet-title-${dateKey(match.date)}-${match.team}-${match.slotColumn}`} className="truncate text-base font-black sm:text-lg">
              Feuille de match · Équipe {match.team === 'E1' ? '1' : '2'}
            </h2>
            <p className="truncate text-xs font-medium text-white/70">{match.opponent || 'Adversaire à préciser'}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDialogOpen(false)}
          aria-label="Fermer la feuille de match"
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <X aria-hidden="true" className="size-5" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-5">
        {calledPlayers.length === 0 ? (
          <p className="rounded-xl bg-muted px-3 py-5 text-center text-sm text-muted-foreground">
            Enregistre d’abord les convocations de cette équipe.
          </p>
        ) : (
          <>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {calledPlayers.map((player) => {
                const currentRole = assignments[player.number]
                const buttonClass = 'inline-flex size-10 items-center justify-center rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'
                return (
                  <li key={player.number} className="flex min-w-0 flex-col items-stretch gap-2 px-2 py-2 sm:flex-row sm:items-center sm:justify-between">
                    <span className="min-w-0 whitespace-normal break-words text-sm font-medium">
                      {player.firstName} <span className="font-bold uppercase">{player.lastName}</span>
                    </span>
                    <div role="group" aria-label={`Action pour ${player.firstName} ${player.lastName}`} className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        title="Commence le match"
                        aria-label={`${currentRole === 'starter' ? 'Retirer : ' : 'Choisir : '}commence le match pour ${player.firstName} ${player.lastName}`}
                        aria-pressed={currentRole === 'starter'}
                        disabled={pending || (currentRole !== 'starter' && starters.length >= 8)}
                        onClick={() => updateRole(player.number, 'starter')}
                        className={`${buttonClass} ${currentRole === 'starter' ? 'border-primary bg-primary text-primary-foreground' : 'border-accent/50 bg-background text-foreground hover:bg-muted'}`}
                      >
                        <JerseyIcon number={player.number} />
                      </button>
                      <button
                        type="button"
                        title="Peut entrer en cours de jeu"
                        aria-label={`${currentRole === 'substitute' ? 'Retirer : ' : 'Choisir : '}peut entrer en cours de jeu pour ${player.firstName} ${player.lastName}`}
                        aria-pressed={currentRole === 'substitute'}
                        disabled={pending}
                        onClick={() => updateRole(player.number, 'substitute')}
                        className={`${buttonClass} ${currentRole === 'substitute' ? 'border-primary bg-primary text-primary-foreground' : 'border-accent/50 bg-background text-foreground hover:bg-muted'}`}
                      >
                        <Armchair aria-hidden="true" className="size-5" />
                      </button>
                      {currentRole && (
                        <button
                          type="button"
                          title="Retirer ce choix"
                          aria-label={`Retirer le choix pour ${player.firstName} ${player.lastName}`}
                          disabled={pending}
                          onClick={() => updateRole(player.number, null)}
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
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="font-semibold text-[#172554]">{starters.length}/8 titulaires</span>
              <span>{substitutes.length} remplaçant{substitutes.length === 1 ? '' : 's'}</span>
            </p>
            {starters.length >= 8 && (
              <p role="status" className="mt-1 text-xs font-medium text-amber-800">
                Les 8 places de titulaires sont prises. Retire d’abord un titulaire avec le bouton × pour en choisir un autre.
              </p>
            )}
          </>
        )}
        {pending ? (
          <p role="status" className="mt-2 text-xs font-medium text-[#172554]">Enregistrement en cours…</p>
        ) : savedKey === key ? (
          <p role="status" className="mt-2 text-xs font-semibold text-emerald-700">Feuille enregistrée.</p>
        ) : null}
      </div>
    </dialog>
    </>
  )
}
