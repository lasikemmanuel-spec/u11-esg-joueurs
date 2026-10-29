'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, Users } from 'lucide-react'
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
}: {
  players: Player[]
  stats: PlayerStats[]
  convocations: Convocation[]
}) {
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [selectedPosition, setSelectedPosition] = useState('all')
  const playerCardRef = useRef<HTMLDivElement>(null)
  const searchTerm = normalizeName(query.trim())
  const matchingPlayers = searchTerm
    ? players.filter((player) =>
        normalizeName(`${player.firstName} ${player.lastName}`).includes(searchTerm),
      )
    : players
  const filteredPlayers = selectedPosition === 'all'
    ? matchingPlayers
    : matchingPlayers.filter((player) => (player.position ?? 'Non renseigné') === selectedPosition)
  const positions = [...new Set(players.map((player) => player.position ?? 'Non renseigné'))].sort((a, b) => {
    if (a === 'Non renseigné') return 1
    if (b === 'Non renseigné') return -1
    return positionRank(a) - positionRank(b) || a.localeCompare(b, 'fr')
  })
  const groups = new Map<string, Player[]>()
  for (const player of filteredPlayers) {
    const key = player.position ?? 'Non renseigné'
    groups.set(key, [...(groups.get(key) ?? []), player])
  }

  const sorted = [...groups.entries()].sort(([a], [b]) => {
    if (a === 'Non renseigné') return 1
    if (b === 'Non renseigné') return -1
    return positionRank(a) - positionRank(b) || a.localeCompare(b, 'fr')
  })
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
      aria-labelledby="positions-title"
      className="flex flex-col gap-3 rounded-xl border border-accent/60 bg-gradient-to-br from-secondary/30 via-card to-card p-4 shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="positions-title" className="font-semibold text-primary">Effectif par poste</h2>
          <p className="text-xs text-muted-foreground">Touchez un joueur pour afficher sa fiche.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-card px-2.5 py-1 text-xs font-semibold text-muted-foreground">
            <Users aria-hidden="true" className="size-3.5 text-primary" />
            {filteredPlayers.length} joueur{filteredPlayers.length !== 1 ? 's' : ''}
          </span>
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
            {sorted.length} poste{sorted.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="grid gap-2 md:max-w-2xl md:grid-cols-2">
          <label className="relative block">
            <span className="sr-only">Rechercher par nom ou prénom</span>
            <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setSelectedNumber(null)
              }}
              placeholder="Rechercher par nom ou prénom…"
              className="h-10 w-full rounded-lg border border-accent/40 bg-background pr-3 pl-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            <span className="sr-only">Filtrer par poste</span>
            <select
              value={selectedPosition}
              onChange={(event) => {
                setSelectedPosition(event.target.value)
                setSelectedNumber(null)
              }}
              aria-label="Filtrer par poste"
              className="h-10 w-full rounded-lg border border-accent/40 bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="all">Tous les postes</option>
              {positions.map((position) => (
                <option key={position} value={position}>{position}</option>
              ))}
            </select>
          </label>
        </div>

        <div className={`grid items-start gap-4 ${selectedPlayer ? 'xl:grid-cols-[minmax(0,1fr)_320px]' : ''}`}>
          <div className={`grid content-start gap-3 sm:grid-cols-2 ${selectedPlayer ? '2xl:grid-cols-2' : 'xl:grid-cols-3'}`}>
            {filteredPlayers.length === 0 && (
              <p className="rounded-lg border border-accent/40 bg-card p-3 text-sm text-muted-foreground sm:col-span-2 xl:col-span-3">
                {searchTerm
                  ? `Aucun joueur ne correspond à « ${query} ».`
                  : selectedPosition !== 'all'
                    ? `Aucun joueur avec le poste « ${selectedPosition} ».`
                    : 'Aucun joueur dans l’effectif.'}
              </p>
            )}
            {sorted.map(([position, list]) => (
              <article key={position} className="flex flex-col overflow-hidden rounded-lg border border-accent/50 bg-card shadow-sm">
                <header className="flex items-center justify-between gap-2 bg-primary px-3 py-2 text-primary-foreground">
                  <h3 className="font-semibold">{position}</h3>
                  <span className="rounded-full bg-accent px-2.5 py-0.5 font-mono text-xs font-bold text-accent-foreground">
                    {list.length}
                  </span>
                </header>
                <ul className="flex flex-col divide-y divide-accent/30 px-2.5 text-sm">
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
                </ul>
              </article>
            ))}
          </div>
          {selectedPlayer && selectedStats && (
            <div ref={playerCardRef} className="scroll-mt-4 xl:sticky xl:top-6">
              <PlayerCard
                stats={selectedStats}
                player={selectedPlayer}
                convocation={convocations.find((convocation) => convocation.number === selectedPlayer.number)}
              />
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
