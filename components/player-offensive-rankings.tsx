'use client'

import { useState } from 'react'
import type { PlayerStats } from '@/lib/stats'
import { Crown, Sparkles, Trophy } from 'lucide-react'
import { ClubCrest } from '@/components/club-crest'

type RankingProps = {
  id: string
  kicker: string
  title: string
  players: PlayerStats[]
  getValue: (player: PlayerStats) => number | null
  formatValue: (value: number) => string
  getSecondaryValue?: (player: PlayerStats) => number | null
  formatSecondaryValue?: (value: number) => string
  barClass: string
  trackClass: string
  badgeClass: string
  emptyMessage: string
}

type RankingKey = 'scorers' | 'assists' | 'training' | 'matches'

function Ranking({
  id,
  kicker,
  title,
  players,
  getValue,
  formatValue,
  getSecondaryValue,
  formatSecondaryValue,
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
          <ClubCrest className="size-10 ring-2 ring-[#d4af37]" />
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
                <div className={index === 0
                  ? 'flex min-w-0 flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-2'
                  : 'min-w-0'}
                >
                  <p className="min-w-0 break-words text-sm font-bold">{player.name}</p>
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
              <span className="flex shrink-0 flex-col items-end gap-1">
                <span className={[
                  'rounded-lg px-2.5 py-1 font-mono text-xs font-extrabold sm:text-sm',
                  index === 0 ? 'bg-[#172554] text-[#f0cf68]' : badgeClass,
                ].join(' ')}>
                  {formatValue(value)}
                </span>
                {getSecondaryValue && formatSecondaryValue && (() => {
                  const secondaryValue = getSecondaryValue(player)
                  return secondaryValue === null ? null : (
                    <span className="font-mono text-[10px] font-semibold text-muted-foreground">
                      {formatSecondaryValue(secondaryValue)}
                    </span>
                  )
                })()}
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
  const [selectedViews, setSelectedViews] = useState<Set<RankingKey>>(() => new Set(['scorers']))
  const scorerRanking: RankingProps = {
    id: 'top-scorers-title',
    kicker: 'Top 5',
    title: 'Classement buteurs',
    players,
    getValue: (player) => player.goals,
    formatValue: (value) => `${value} but${value === 1 ? '' : 's'}`,
    barClass: 'bg-accent',
    trackClass: 'bg-accent/30',
    badgeClass: 'bg-accent/30 text-accent-foreground',
    emptyMessage: 'Aucun but renseigné pour le moment.',
  }
  const passerRanking: RankingProps = {
    id: 'top-assisters-title',
    kicker: 'Top 5',
    title: 'Classement passeurs',
    players,
    getValue: (player) => player.assists,
    formatValue: (value) => `${value} passe${value === 1 ? '' : 's'}`,
    barClass: 'bg-primary',
    trackClass: 'bg-secondary',
    badgeClass: 'bg-secondary text-primary',
    emptyMessage: 'Aucune passe décisive renseignée pour le moment.',
  }
  const trainingRanking: RankingProps = {
    id: 'top-training-title',
    kicker: 'Top 5',
    title: 'Présence entraînements',
    players,
    getValue: (player) => player.trainingRate,
    formatValue: (value) => `${value}%`,
    barClass: 'bg-accent',
    trackClass: 'bg-accent/30',
    badgeClass: 'bg-accent/30 text-accent-foreground',
    emptyMessage: 'Aucun taux de présence renseigné.',
  }
  const matchRanking: RankingProps = {
    id: 'top-matches-title',
    kicker: 'Top 5',
    title: 'Classement matchs joués',
    players,
    getValue: (player) =>
      player.starts === null && player.subs === null
        ? null
        : (player.starts ?? 0) + (player.subs ?? 0),
    formatValue: (value) => `${value} match${value === 1 ? '' : 's'}`,
    getSecondaryValue: (player) => player.minutes,
    formatSecondaryValue: (value) => `${value} min`,
    barClass: 'bg-primary',
    trackClass: 'bg-secondary',
    badgeClass: 'bg-secondary text-primary',
    emptyMessage: 'Aucun nombre de matchs joués renseigné.',
  }
  const rankingOptions: { key: RankingKey; label: string }[] = [
    { key: 'scorers', label: 'Buteurs' },
    { key: 'assists', label: 'Passeurs' },
    { key: 'training', label: 'Entraînements' },
    { key: 'matches', label: 'Matchs' },
  ]
  const allRankingsSelected = selectedViews.size === rankingOptions.length

  return (
    <section aria-label="Classements des joueurs" className="flex flex-col gap-4">
      <div className="sticky top-2 z-20 flex flex-col gap-2 rounded-xl border border-accent/50 bg-card/95 p-2 shadow-md backdrop-blur xl:hidden">
        <div className="flex items-center justify-between gap-2">
          <p id="player-ranking-picker" className="text-xs font-bold text-primary">Classements à afficher</p>
          <button
            type="button"
            onClick={() => setSelectedViews(allRankingsSelected
              ? new Set()
              : new Set(rankingOptions.map((option) => option.key)))}
            className="shrink-0 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-bold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {allRankingsSelected ? 'Tout effacer' : 'Tout sélectionner'}
          </button>
        </div>
        <div role="group" aria-labelledby="player-ranking-picker" className="flex flex-wrap gap-1.5">
          {rankingOptions.map(({ key, label }) => {
            const isSelected = selectedViews.has(key)
            return (
              <button
                key={key}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setSelectedViews((current) => {
                  const next = new Set(current)
                  if (next.has(key)) next.delete(key)
                  else next.add(key)
                  return next
                })}
                className={`min-h-9 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  isSelected
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-accent/50 bg-background text-muted-foreground hover:bg-secondary'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-2">
        <div className={selectedViews.has('scorers') ? 'block xl:block' : 'hidden xl:block'}>
          <Ranking {...scorerRanking} />
        </div>
        <div className={selectedViews.has('assists') ? 'block xl:block' : 'hidden xl:block'}>
          <Ranking {...passerRanking} />
        </div>
        <div className={selectedViews.has('training') ? 'block xl:block' : 'hidden xl:block'}>
          <Ranking {...trainingRanking} />
        </div>
        <div className={selectedViews.has('matches') ? 'block xl:block' : 'hidden xl:block'}>
          <Ranking {...matchRanking} />
        </div>
        {selectedViews.size === 0 && (
          <p className="rounded-xl border border-dashed border-accent/60 bg-card p-4 text-center text-sm text-muted-foreground xl:hidden">
            Sélectionnez au moins un classement ci-dessus.
          </p>
        )}
      </div>
    </section>
  )
}
