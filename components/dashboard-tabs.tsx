'use client'

import { useState } from 'react'
import { MatchCallupBreakdown } from '@/components/match-callup-breakdown'
import { PlayerStats } from '@/components/player-stats'
import { PositionBreakdown } from '@/components/position-breakdown'
import type { Convocation } from '@/lib/convocations'
import type { Player } from '@/lib/players'
import type { TeamMatchResults } from '@/lib/match-results'
import type { PlayerStats as PlayerStat } from '@/lib/stats'

type TabKey = 'players' | 'matches' | 'roster'

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
    { key: 'roster', label: 'Effectifs' },
  ]

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm xl:grid xl:grid-cols-[220px_minmax(0,1fr)]">
      <nav aria-label="Statistiques" className="hidden border-b border-border bg-card p-2 xl:block xl:border-r xl:border-b-0 xl:p-3">
        <div className="mx-auto flex max-w-3xl gap-2 rounded-full bg-muted p-1 xl:flex-col xl:rounded-xl">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key

            return (
              <button
                key={tab.key}
                type="button"
                aria-pressed={isActive}
                onClick={() => setActiveTab(tab.key)}
                className={[
                  'flex-1 rounded-full px-4 py-2.5 text-sm font-semibold transition-all duration-200 xl:flex-none xl:text-left',
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
      </nav>

      <div className="min-w-0 p-4 md:p-5">
        {activeTab === 'players' && (
          <PlayerStats players={players} convocations={convocations} rosterPlayers={rosterPlayers} />
        )}
        {activeTab === 'matches' && (
          <MatchCallupBreakdown
            convocations={convocations}
            presentCounts={presentCounts}
            matchResults={matchResults}
          />
        )}
        {activeTab === 'roster' && (
          <PositionBreakdown players={rosterPlayers} stats={players} convocations={convocations} />
        )}
      </div>

      <nav
        aria-label="Navigation des statistiques"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-accent/60 bg-card/95 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(0,0,0,0.12)] backdrop-blur xl:hidden"
      >
        <div className="mx-auto flex max-w-lg gap-2 rounded-xl bg-muted p-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key

            return (
              <button
                key={tab.key}
                type="button"
                aria-pressed={isActive}
                onClick={() => setActiveTab(tab.key)}
                className={[
                  'min-h-11 flex-1 rounded-lg px-2 py-2 text-xs font-semibold transition-colors sm:text-sm',
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
      </nav>
    </section>
  )
}
