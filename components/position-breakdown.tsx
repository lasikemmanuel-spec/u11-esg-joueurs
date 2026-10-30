'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, Search } from 'lucide-react'
import { PlayerCard } from '@/components/player-stats'
import type { Convocation } from '@/lib/convocations'
import type { Player } from '@/lib/players'
import type { PlayerStats } from '@/lib/stats'

const POSITION_ORDER = ['gard', 'déf', 'def', 'lat', 'cent', 'mil', 'ail', 'att', 'av']

const normalizeName = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr-FR')

const positionRank = (position: string) => {
  const lower = position.toLowerCase()
  const index = POSITION_ORDER.findIndex((key) => lower.startsWith(key))
  return index === -1 ? POSITION_ORDER.length : index
}

export function PositionBreakdown({
  players,
  stats,
  convocations,
  matchesPlayed,
}: {
  players: Player[]
  stats: PlayerStats[]
  convocations: Convocation[]
  matchesPlayed: number
}) {
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [expandedPositions, setExpandedPositions] = useState<Set<string>>(() => new Set())
  const playerCardRef = useRef<HTMLDivElement>(null)
  const searchTerm = normalizeName(query.trim())
  const matchingPlayers = searchTerm
    ? players.filter((player) =>
        normalizeName(`${player.firstName} ${player.lastName}`).includes(searchTerm),
      )
    : players
  const groups = new Map<string, Player[]>()
  for (const player of matchingPlayers) {
    const key = player.position ?? 'Non renseigné'
    groups.set(key, [...(groups.get(key) ?? []), player])
  }

  const sorted = [...groups.entries()].sort(([a], [b]) => {
    if (a === 'Non renseigné') return 1
    if (b === 'Non renseigné') return -1
    return positionRank(a) - positionRank(b) || a.localeCompare(b, 'fr')
  })
  const allGroupsExpanded = sorted.length > 0 && sorted.every(([position, list]) =>
    expandedPositions.has(position) || list.some((player) => player.number === selectedNumber),
  )
  const selectedPlayer = players.find((player) => player.number === selectedNumber)
  const selectedStats = selectedPlayer
    ? stats.find((playerStats) => playerStats.number === selectedPlayer.number) ?? {
        number: selectedPlayer.number,
        name: `${selectedPlayer.firstName} ${selectedPlayer.lastName}`.trim(),
        trainingRate: null,
        matchesCalled: null,
        callUpRate: null,
        starts: null,
        subs: null,
        minutes: null,
        goals: null,
        assists: null,
        ire: null,
      }
    : null

  useEffect(() => {
    if (selectedNumber === null) return

    const frame = window.requestAnimationFrame(() => {
      playerCardRef.current?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'start',
      })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [selectedNumber])

  return (
    <section
      aria-label="Effectifs regroupés par poste"
      className="flex flex-col gap-3 rounded-xl border border-accent/60 bg-gradient-to-br from-secondary/30 via-card to-card p-4 shadow-sm"
    >
      <div className="flex items-center gap-2">
        {sorted.length > 0 && (
          <button
            type="button"
            onClick={() => {
              if (allGroupsExpanded) {
                setExpandedPositions(new Set())
                setSelectedNumber(null)
              } else {
                setExpandedPositions(new Set(sorted.map(([position]) => position)))
              }
            }}
            aria-label={allGroupsExpanded ? 'Fermer tous les postes' : 'Ouvrir tous les postes'}
            title={allGroupsExpanded ? 'Fermer tous les postes' : 'Ouvrir tous les postes'}
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-accent/40 bg-card px-2 text-xs font-semibold text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {allGroupsExpanded ? <ChevronUp aria-hidden="true" className="size-3.5" /> : <ChevronDown aria-hidden="true" className="size-3.5" />}
            <span>{allGroupsExpanded ? 'Tout −' : 'Tout +'}</span>
          </button>
        )}
        <label className="relative block min-w-0 flex-1">
          <span className="sr-only">Recherche par joueurs</span>
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            aria-label="Recherche par joueurs"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setSelectedNumber(null)
            }}
            placeholder="Recherche par joueurs"
            className="h-9 w-full rounded-lg border border-accent/40 bg-background pr-3 pl-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <span className="hidden shrink-0 text-xs text-muted-foreground lg:inline">
          {matchingPlayers.length} joueurs · {sorted.length} postes
        </span>
      </div>

      <div className={`roster-player-layout grid items-start gap-4 ${selectedPlayer ? 'has-selected-player' : ''}`}>
        <div className={`roster-player-groups columns-1 gap-3 sm:columns-2 ${selectedPlayer ? '2xl:columns-2' : 'xl:columns-3'}`}>
            {matchingPlayers.length === 0 && (
              <p className="break-inside-avoid rounded-lg border border-accent/40 bg-card p-3 text-sm text-muted-foreground">
                {searchTerm
                  ? `Aucun joueur ne correspond à « ${query} ».`
                  : 'Aucun joueur dans l’effectif.'}
              </p>
            )}
            {sorted.map(([position, list], groupIndex) => {
              const isSelectedGroup = list.some((player) => player.number === selectedPlayer?.number)
              const isExpanded = expandedPositions.has(position) || isSelectedGroup
              const groupId = `roster-position-${groupIndex}`
              return (
              <article key={position} className="mb-3 flex scroll-mt-4 break-inside-avoid flex-col overflow-hidden rounded-lg border border-accent/50 bg-card shadow-sm">
                <h3>
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    aria-controls={isExpanded ? groupId : undefined}
                    onClick={(event) => {
                      const opening = !isExpanded
                      setExpandedPositions((current) => {
                        const next = new Set(current)
                        if (next.has(position)) next.delete(position)
                        else next.add(position)
                        return next
                      })
                      if (opening && window.matchMedia('(max-width: 639px)').matches) {
                        const target = event.currentTarget.closest('article')
                        window.requestAnimationFrame(() => target?.scrollIntoView({
                          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
                          block: 'start',
                        }))
                      }
                    }}
                    className="flex w-full items-center justify-between gap-2 bg-primary px-3 py-2 text-left text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <ChevronDown aria-hidden="true" className={`size-4 shrink-0 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                      <span className="truncate font-semibold">{position}</span>
                    </span>
                    <span className="rounded-full bg-accent px-2.5 py-0.5 font-mono text-xs font-bold text-accent-foreground">
                      {list.length}
                    </span>
                  </button>
                </h3>
                {isExpanded && <ul id={groupId} className="flex flex-col divide-y divide-accent/30 px-2.5 text-sm">
                  {[...list]
                    .sort((a, b) => a.lastName.localeCompare(b.lastName, 'fr'))
                    .map((player) => {
                      const isSelected = player.number === selectedPlayer?.number
                      return (
                        <li key={player.number}>
                          <button
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() => setSelectedNumber(isSelected ? null : player.number)}
                            className={`flex w-full items-center gap-3 rounded-md px-1 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                              isSelected ? 'bg-accent/30' : 'hover:bg-secondary/60'
                            }`}
                          >
                            <span className="truncate">
                              <span className="font-semibold uppercase tracking-wide">{player.lastName}</span> {player.firstName}
                            </span>
                            {player.transferStatus && (
                              <span className="ml-auto shrink-0 rounded bg-accent px-1.5 py-0.5 text-xs font-medium text-accent-foreground">
                                {player.transferStatus}
                              </span>
                            )}
                          </button>
                        </li>
                      )
                    })}
                </ul>}
              </article>
            )})}
          </div>
        {selectedPlayer && selectedStats && (
          <div ref={playerCardRef} className="roster-player-card scroll-mt-4 xl:sticky xl:top-6">
            <PlayerCard
              stats={selectedStats}
              player={selectedPlayer}
              convocation={convocations.find((convocation) => convocation.number === selectedPlayer.number)}
              matchesPlayed={matchesPlayed}
            />
          </div>
        )}
      </div>
    </section>
  )
}
