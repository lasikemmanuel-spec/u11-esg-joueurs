import type { PlayerStats } from '@/lib/stats'

export function PlayerOffensiveRankings({ players }: { players: PlayerStats[] }) {
  const topScorers = [...players]
    .filter((player) => player.goals !== null && player.goals > 0)
    .sort((a, b) => (b.goals ?? 0) - (a.goals ?? 0) || a.name.localeCompare(b.name, 'fr'))
    .slice(0, 5)
  const topAssisters = [...players]
    .filter((player) => player.assists !== null && player.assists > 0)
    .sort((a, b) => (b.assists ?? 0) - (a.assists ?? 0) || a.name.localeCompare(b.name, 'fr'))
    .slice(0, 5)
  const maxGoals = topScorers[0]?.goals ?? 0
  const maxAssists = topAssisters[0]?.assists ?? 0

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section aria-labelledby="top-scorers-title" className="overflow-hidden rounded-xl border border-accent/60 bg-gradient-to-br from-secondary via-card to-accent/10 shadow-sm">
        <div className="border-b border-accent/50 bg-primary px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Classement offensif</p>
          <h2 id="top-scorers-title" className="mt-1 text-lg font-bold text-primary-foreground">Top 5 buteurs</h2>
        </div>
        {topScorers.length > 0 ? (
          <ol className="divide-y divide-accent/30 px-4">
            {topScorers.map((player, index) => (
              <li key={player.number} className="flex items-center gap-3 py-3">
                <span className={[
                  'flex size-8 shrink-0 items-center justify-center rounded-full font-mono text-sm font-bold',
                  index === 0 ? 'bg-accent text-accent-foreground' : 'bg-secondary text-primary',
                ].join(' ')}>
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{player.name}</p>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-accent/30">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${((player.goals ?? 0) / maxGoals) * 100}%` }} />
                  </div>
                </div>
                <span className="shrink-0 rounded-lg bg-accent/30 px-2.5 py-1 font-mono text-sm font-bold text-accent-foreground">
                  {player.goals} <span className="font-sans text-xs font-medium">but{player.goals === 1 ? '' : 's'}</span>
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="px-5 py-6 text-sm text-muted-foreground">Aucun but renseigné pour le moment.</p>
        )}
      </section>
      <section aria-labelledby="top-assisters-title" className="overflow-hidden rounded-xl border border-accent/60 bg-gradient-to-br from-secondary via-card to-accent/10 shadow-sm">
        <div className="border-b border-accent/50 bg-primary px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Classement collectif</p>
          <h2 id="top-assisters-title" className="mt-1 text-lg font-bold text-primary-foreground">Top 5 passeurs</h2>
        </div>
        {topAssisters.length > 0 ? (
          <ol className="divide-y divide-accent/30 px-4">
            {topAssisters.map((player, index) => (
              <li key={player.number} className="flex items-center gap-3 py-3">
                <span className={[
                  'flex size-8 shrink-0 items-center justify-center rounded-full font-mono text-sm font-bold',
                  index === 0 ? 'bg-primary text-primary-foreground' : 'bg-secondary text-primary',
                ].join(' ')}>
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{player.name}</p>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${((player.assists ?? 0) / maxAssists) * 100}%` }} />
                  </div>
                </div>
                <span className="shrink-0 rounded-lg bg-secondary px-2.5 py-1 font-mono text-sm font-bold text-primary">
                  {player.assists} <span className="font-sans text-xs font-medium">passe{player.assists === 1 ? '' : 's'}</span>
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="px-5 py-6 text-sm text-muted-foreground">Aucune passe décisive renseignée pour le moment.</p>
        )}
      </section>
    </div>
  )
}
