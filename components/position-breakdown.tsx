'use client'

import { useState } from 'react'
import { PlayerCard } from '@/components/player-stats'
import type { Convocation } from '@/lib/convocations'
import type { Player } from '@/lib/players'
import type { PlayerStats } from '@/lib/stats'

const POSITION_ORDER = ['gard', 'déf', 'def', 'lat', 'cent', 'mil', 'ail', 'att', 'av']

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
  const [selectedNumber, setSelectedNumber] = useState<number | null>(players[0]?.number ?? null)
  const groups = new Map<string, Player[]>()
  for (const player of players) {
    const key = player.position ?? 'Non renseigné'
    groups.set(key, [...(groups.get(key) ?? []), player])
  }

  const sorted = [...groups.entries()].sort(([a], [b]) => {
    if (a === 'Non renseigné') return 1
    if (b === 'Non renseigné') return -1
    return positionRank(a) - positionRank(b) || a.localeCompare(b, 'fr')
  })
  const selectedPlayer = players.find((player) => player.number === selectedNumber) ?? players[0]
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

  return (
    <section
      aria-labelledby="positions-title"
      className="flex flex-col gap-4 rounded-xl border border-accent/60 bg-gradient-to-br from-secondary/30 via-card to-card p-5 shadow-sm"
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/70">ES Genech</p>
        <h2 id="positions-title" className="font-semibold text-primary">Effectif par poste</h2>
        <p className="text-sm text-muted-foreground">
          {sorted.length} poste{sorted.length > 1 ? 's' : ''} · {players.length} joueurs · sélectionnez un joueur pour ouvrir sa fiche
        </p>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-4 sm:grid-cols-2">
          {sorted.map(([position, list]) => (
            <article key={position} className="flex flex-col overflow-hidden rounded-lg border border-accent/50 bg-card shadow-sm">
              <header className="flex items-center justify-between gap-2 bg-primary px-4 py-3 text-primary-foreground">
                <h3 className="font-semibold">{position}</h3>
                <span className="rounded-full bg-accent px-2.5 py-0.5 font-mono text-xs font-bold text-accent-foreground">
                  {list.length}
                </span>
              </header>
              <ul className="flex flex-col divide-y divide-accent/30 px-3 text-sm">
                {[...list]
                  .sort((a, b) => a.lastName.localeCompare(b.lastName, 'fr'))
                  .map((player) => {
                    const isSelected = player.number === selectedPlayer?.number
                    return (
                      <li key={player.number}>
                        <button
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => setSelectedNumber(player.number)}
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
          <div className="scroll-mt-4 xl:sticky xl:top-6">
            <PlayerCard
              stats={selectedStats}
              player={selectedPlayer}
              convocation={convocations.find((convocation) => convocation.number === selectedPlayer.number)}
            />
          </div>
        )}
      </div>
    </section>
  )
}
