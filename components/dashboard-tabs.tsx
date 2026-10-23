'use client'

import { useState } from 'react'
import { MatchCallupBreakdown } from '@/components/match-callup-breakdown'
import { PlayerStats } from '@/components/player-stats'
import { PositionBreakdown } from '@/components/position-breakdown'
import type { Convocation } from '@/lib/convocations'
import type { Player } from '@/lib/players'
import type { TeamMatchResults } from '@/lib/match-results'
import type { PlayerStats as PlayerStat } from '@/lib/stats'

type TabKey = 'players' | 'matches'

export function DashboardTabs({
  players,
  rosterPlayers,
  convocations,
  presentCounts,
  matchResults,
}: {
  players: PlayerStat[]
  rosterPlayers: Player[]
  convocations: Convocation[]
  presentCounts: Record<string, number>
  matchResults: TeamMatchResults
}) {
  const [activeTab, setActiveTab] = useState<TabKey>('players')

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'players', label: 'Stats Joueurs' },
    { key: 'matches', label: 'Stats Matchs' },
  ]

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="border-b border-border bg-card p-2">
        <div className="mx-auto flex max-w-3xl gap-2 rounded-full bg-muted p-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key

            return (
              <button
                key={tab.key}
                type="button"
                aria-pressed={isActive}
                onClick={() => setActiveTab(tab.key)}
                className={[
                  'flex-1 rounded-full px-4 py-2.5 text-sm font-semibold transition-all duration-200',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-background hover:text-foreground',
                ].join(' ')}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="p-4 md:p-5">
        {activeTab === 'players' && (
          <div className="flex flex-col gap-6">
            <PlayerStats players={players} convocations={convocations} />
            <PositionBreakdown players={rosterPlayers} />
          </div>
        )}
        {activeTab === 'matches' && (
          <MatchCallupBreakdown
            convocations={convocations}
            presentCounts={presentCounts}
            players={players}
            matchResults={matchResults}
          />
        )}
      </div>
    </section>
  )
}
