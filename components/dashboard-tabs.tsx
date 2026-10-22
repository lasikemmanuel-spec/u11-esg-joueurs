'use client'

import { useState } from 'react'
import { MatchCallupBreakdown } from '@/components/match-callup-breakdown'
import { PlayerStats } from '@/components/player-stats'
import type { Convocation } from '@/lib/convocations'
import type { PlayerStats as PlayerStat } from '@/lib/stats'

type TabKey = 'history' | 'players'

export function DashboardTabs({
  players,
  convocations,
}: {
  players: PlayerStat[]
  convocations: Convocation[]
}) {
  const [activeTab, setActiveTab] = useState<TabKey>('history')

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'history', label: 'Historique match' },
    { key: 'players', label: 'Stat joueurs' },
  ]

  return (
    <section className="rounded-xl border bg-card">
      <div className="flex flex-wrap gap-2 border-b p-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={[
              'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              activeTab === tab.key
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted text-muted-foreground hover:bg-muted/80',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-4 md:p-5">
        {activeTab === 'history' && <MatchCallupBreakdown convocations={convocations} />}
        {activeTab === 'players' && <PlayerStats players={players} convocations={convocations} />}
      </div>
    </section>
  )
}
