import type { PlayerStats } from '@/lib/stats'
import { Crown, Sparkles, Trophy } from 'lucide-react'

type RankingProps = {
  id: string
  kicker: string
  title: string
  players: PlayerStats[]
  getValue: (player: PlayerStats) => number | null
  formatValue: (value: number) => string
  barClass: string
  trackClass: string
  badgeClass: string
  emptyMessage: string
}

function Ranking({
  id,
  kicker,
  title,
  players,
  getValue,
  formatValue,
  barClass,
  trackClass,
  badgeClass,
  emptyMessage,
}: RankingProps) {
  const ranked = players
    .map((player) => ({ player, value: getValue(player) }))
    .filter((entry): entry is { player: PlayerStats; value: number } => entry.value !== null && entry.value > 0)
    .sort((a, b) => b.value - a.value || a.player.name.localeCompare(b.player.name, 'fr'))
    .slice(0, 5)
  const maxValue = ranked[0]?.value ?? 0

  return (
    <section
      aria-labelledby={id}
      className="group overflow-hidden rounded-2xl border border-[#d4af37]/60 bg-card shadow-[0_8px_24px_rgba(23,37,84,0.10)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_14px_30px_rgba(23,37,84,0.18)]"
    >
      <div className="relative overflow-hidden border-b border-[#d4af37]/60 bg-gradient-to-r from-[#172554] via-[#1e3a70] to-[#172554] px-5 py-4">
        <Sparkles aria-hidden="true" className="absolute -right-1 -top-2 size-16 rotate-12 text-[#d4af37]/20 transition-transform duration-500 group-hover:rotate-45" />
        <div className="relative flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[#d4af37]/50 bg-[#d4af37]/15 text-[#f0cf68] shadow-inner">
            <Trophy aria-hidden="true" className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#f0cf68]">{kicker}</p>
            <h2 id={id} className="mt-0.5 text-base font-extrabold leading-tight text-white sm:text-lg">{title}</h2>
          </div>
        </div>
      </div>
      {ranked.length > 0 ? (
        <ol className="space-y-2 p-3 sm:p-4">
          {ranked.map(({ player, value }, index) => (
            <li
              key={player.number}
              className={[
                'flex items-center gap-3 rounded-xl border px-3 py-3 transition-all duration-200 hover:scale-[1.01] hover:shadow-sm',
                index === 0
                  ? 'border-[#d4af37]/70 bg-[#d4af37]/10'
                  : 'border-border/70 bg-background/70 hover:border-[#d4af37]/50',
              ].join(' ')}
            >
              <span className={[
                'flex size-9 shrink-0 items-center justify-center rounded-full border font-mono text-sm font-extrabold',
                index === 0
                  ? 'border-[#d4af37] bg-gradient-to-br from-[#f5dc86] to-[#c69b2b] text-[#172554] shadow-[0_2px_8px_rgba(212,175,55,0.4)]'
                  : index === 1
                    ? 'border-slate-300 bg-slate-100 text-slate-700'
                    : index === 2
                      ? 'border-orange-300 bg-orange-100 text-orange-800'
                      : 'border-[#172554]/15 bg-[#172554]/5 text-[#172554]',
              ].join(' ')}>
                {index === 0 && <Crown aria-hidden="true" className="size-3 fill-current" />}
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-bold">{player.name}</p>
                  {index === 0 && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#172554] px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-[#f0cf68]">
                      <Sparkles aria-hidden="true" className="size-2.5" />
                      Leader
                    </span>
                  )}
                </div>
                <div
                  className={`mt-2 h-2 overflow-hidden rounded-full ${trackClass}`}
                  role="progressbar"
                  aria-label={`Performance de ${player.name}`}
                  aria-valuenow={Math.round((value / maxValue) * 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className={`h-full rounded-full ${index === 0 ? 'bg-gradient-to-r from-[#d4af37] to-[#f0cf68]' : barClass} transition-[width] duration-700`}
                    style={{ width: `${(value / maxValue) * 100}%` }}
                  />
                </div>
              </div>
              <span className={[
                'shrink-0 rounded-lg px-2.5 py-1 font-mono text-xs font-extrabold sm:text-sm',
                index === 0 ? 'bg-[#172554] text-[#f0cf68]' : badgeClass,
              ].join(' ')}>
                {formatValue(value)}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="px-5 py-6 text-sm text-muted-foreground">{emptyMessage}</p>
      )}
    </section>
  )
}

export function PlayerOffensiveRankings({ players }: { players: PlayerStats[] }) {
  const rankings: RankingProps[] = [
    {
      id: 'top-training-title',
      kicker: 'Assiduité',
      title: 'Top 5 présence aux entraînements',
      players,
      getValue: (player) => player.trainingRate,
      formatValue: (value) => `${value}%`,
      barClass: 'bg-accent',
      trackClass: 'bg-accent/30',
      badgeClass: 'bg-accent/30 text-accent-foreground',
      emptyMessage: 'Aucun taux de présence renseigné.',
    },
    {
      id: 'top-minutes-title',
      kicker: 'Temps de jeu',
      title: 'Top 5 minutes jouées',
      players,
      getValue: (player) => player.minutes,
      formatValue: (value) => `${value} min`,
      barClass: 'bg-primary',
      trackClass: 'bg-secondary',
      badgeClass: 'bg-secondary text-primary',
      emptyMessage: 'Aucun temps de jeu renseigné.',
    },
    {
      id: 'top-callup-rate-title',
      kicker: 'Convocations',
      title: 'Top 5 taux de convocation',
      players,
      getValue: (player) => player.callUpRate,
      formatValue: (value) => `${value}%`,
      barClass: 'bg-accent',
      trackClass: 'bg-accent/30',
      badgeClass: 'bg-accent/30 text-accent-foreground',
      emptyMessage: 'Aucun taux de convocation renseigné.',
    },
    {
      id: 'top-appearances-title',
      kicker: 'Matchs',
      title: 'Top 5 matchs joués',
      players,
      getValue: (player) =>
        player.starts === null && player.subs === null
          ? null
          : (player.starts ?? 0) + (player.subs ?? 0),
      formatValue: (value) => `${value} match${value === 1 ? '' : 's'}`,
      barClass: 'bg-primary',
      trackClass: 'bg-secondary',
      badgeClass: 'bg-secondary text-primary',
      emptyMessage: 'Aucun nombre de matchs joués renseigné.',
    },
    {
      id: 'top-scorers-title',
      kicker: 'Classement offensif',
      title: 'Top 5 buteurs',
      players,
      getValue: (player) => player.goals,
      formatValue: (value) => `${value} but${value === 1 ? '' : 's'}`,
      barClass: 'bg-accent',
      trackClass: 'bg-accent/30',
      badgeClass: 'bg-accent/30 text-accent-foreground',
      emptyMessage: 'Aucun but renseigné pour le moment.',
    },
    {
      id: 'top-assisters-title',
      kicker: 'Classement collectif',
      title: 'Top 5 passeurs',
      players,
      getValue: (player) => player.assists,
      formatValue: (value) => `${value} passe${value === 1 ? '' : 's'}`,
      barClass: 'bg-primary',
      trackClass: 'bg-secondary',
      badgeClass: 'bg-secondary text-primary',
      emptyMessage: 'Aucune passe décisive renseignée pour le moment.',
    },
  ]

  return (
    <section aria-label="Classements des joueurs" className="flex flex-col gap-4">
      <header className="relative overflow-hidden rounded-2xl border border-[#d4af37]/50 bg-gradient-to-r from-[#172554] via-[#1e3a70] to-[#172554] px-5 py-4 shadow-[0_8px_24px_rgba(23,37,84,0.16)]">
        <Sparkles aria-hidden="true" className="absolute -right-2 -top-4 size-24 rotate-12 text-[#d4af37]/15" />
        <div className="relative flex items-center gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-[#d4af37]/50 bg-[#d4af37]/15 text-[#f0cf68]">
            <Trophy aria-hidden="true" className="size-6" />
          </span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#f0cf68]">ES Genech · Les stats du groupe</p>
            <h2 className="mt-0.5 text-xl font-black tracking-tight text-white sm:text-2xl">Classements joueurs</h2>
            <p className="mt-1 text-xs font-medium text-white/75">Les performances de l’équipe, place au podium !</p>
          </div>
        </div>
      </header>
      <div className="grid gap-4 lg:grid-cols-2">
        {rankings.map((ranking) => <Ranking key={ranking.id} {...ranking} />)}
      </div>
    </section>
  )
}
