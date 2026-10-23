'use client'

import { useState } from 'react'
import { MatchCallupBreakdown } from '@/components/match-callup-breakdown'
import { PlayerStats } from '@/components/player-stats'
import type { Convocation } from '@/lib/convocations'
import type { PlayerStats as PlayerStat } from '@/lib/stats'

type TabKey = 'players' | 'history'

export function DashboardTabs({
  players,
  convocations,
}: {
  players: PlayerStat[]
  convocations: Convocation[]
}) {
  const [activeTab, setActiveTab] = useState<TabKey>('players')

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'players', label: 'Stats joueurs' },
    { key: 'history', label: 'Historique match' },
  ]

  return (
    <section className="overflow-hidden rounded-2xl border border-border/70 bg-card/90 shadow-[0_18px_40px_rgba(15,23,42,0.08)] ring-1 ring-black/5 backdrop-blur-sm">
      <div className="sticky top-4 z-10 border-b border-border/70 bg-card/80 p-2 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center gap-2 rounded-full border border-border/80 bg-muted/60 p-1.5 shadow-inner shadow-black/5">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key

            return (
              <button
                key={tab.key}
                type="button"
                aria-pressed={isActive}
                onClick={() => setActiveTab(tab.key)}
                className={[
                  'relative flex-1 rounded-full px-4 py-2.5 text-sm font-semibold tracking-wide transition-all duration-200 ease-out',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  isActive
                    ? 'bg-gradient-to-r from-primary via-primary to-[oklch(0.42_0.07_272)] text-primary-foreground shadow-[0_8px_18px_rgba(39,38,98,0.28)]'
                    : 'text-muted-foreground hover:bg-background/80 hover:text-foreground',
                ].join(' ')}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="p-4 md:p-5">
        {activeTab === 'players' && <PlayerStats players={players} convocations={convocations} />}
        {activeTab === 'history' && <MatchCallupBreakdown convocations={convocations} />}
      </div>
    </section>
  )
}
