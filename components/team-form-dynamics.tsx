'use client'

import { useMemo, useState } from 'react'
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  Flame,
  Home,
  MapPin,
  Plane,
  Shield,
  ShieldCheck,
  Sparkles,
  Swords,
  TrendingUp,
  Trophy,
} from 'lucide-react'
import { ClubCrest } from '@/components/club-crest'
import type { TeamMatchResults } from '@/lib/match-results'
import {
  calculateTeamDynamics,
  filterMatchesByCompetition,
  type RecentFormMatch,
  type TeamCompetitionFilter,
  type TeamDynamics,
} from '@/lib/team-dynamics'

function formatDateFr(dateStr: string): string {
  const iso = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (iso) {
    return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
    })
  }
  const dayFirst = dateStr.match(/^(\d{1,2})[/. -](\d{1,2})(?:[/. -](\d{4}))?$/)
  if (dayFirst) {
    const year = dayFirst[3] ? Number(dayFirst[3]) : new Date().getFullYear()
    return new Date(year, Number(dayFirst[2]) - 1, Number(dayFirst[1])).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
    })
  }
  return dateStr
}

function OutcomePill({ outcome }: { outcome: 'win' | 'draw' | 'loss' }) {
  if (outcome === 'win') {
    return (
      <span
        title="Victoire"
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 font-black text-xs text-white shadow-md shadow-emerald-500/20 ring-2 ring-emerald-300/40"
      >
        V
      </span>
    )
  }
  if (outcome === 'draw') {
    return (
      <span
        title="Match nul"
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-400 font-black text-xs text-amber-950 shadow-md shadow-amber-400/20 ring-2 ring-amber-300/40"
      >
        N
      </span>
    )
  }
  return (
    <span
      title="Défaite"
      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-rose-500 font-black text-xs text-white shadow-md shadow-rose-500/20 ring-2 ring-rose-300/40"
    >
      D
    </span>
  )
}

function TeamCard({ dynamics }: { dynamics: TeamDynamics }) {
  const { team, overall, home, away, recentMatches, streak } = dynamics
  const isE1 = team === 'E1'
  const teamLabel = isE1 ? 'Équipe 1' : 'Équipe 2'
  const accentColor = isE1 ? 'from-sky-500/15 via-blue-500/10 to-indigo-500/5' : 'from-amber-500/15 via-yellow-500/10 to-orange-500/5'
  const badgeBorder = isE1 ? 'border-sky-400/40 text-sky-300 bg-sky-950/60' : 'border-amber-400/40 text-amber-300 bg-amber-950/60'

  return (
    <section
      aria-label={`Dynamique de l'${teamLabel}`}
      className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-gradient-to-br from-[#101b40] via-[#142657] to-[#101c41] p-4 text-white shadow-xl sm:p-6"
    >
      {/* Header équipe */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-white/10 ring-2 ring-white/15">
            <Trophy className={`size-5 ${isE1 ? 'text-sky-300' : 'text-amber-300'}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-black tracking-tight sm:text-xl">{teamLabel}</h3>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${badgeBorder}`}>
                {isE1 ? 'U11 A' : 'U11 B'}
              </span>
            </div>
            <p className="text-xs text-white/60">
              {overall.matches > 0
                ? `${overall.matches} match${overall.matches > 1 ? 's' : ''} disputé${overall.matches > 1 ? 's' : ''}`
                : 'Aucun match enregistré pour ce filtre'}
            </p>
          </div>
        </div>

        {/* Badge de série */}
        {overall.matches > 0 && (
          <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/15 px-3 py-1 text-xs font-bold text-amber-300 shadow-sm">
            <Flame className="size-3.5 text-amber-400" />
            <span>{streak.label}</span>
          </div>
        )}
      </div>

      {overall.matches === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-8 text-center text-sm text-white/60">
          Aucun résultat de match renseigné pour l’{teamLabel}.
        </div>
      ) : (
        <>
          {/* Forme récente (5 derniers matchs) */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-300">
                <Activity className="size-3.5" /> Forme récente (5 derniers matchs)
              </p>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-white/60">
                <span>Ancien</span>
                <span className="text-white/40">→</span>
                <span>Récent</span>
              </div>
            </div>

            {/* Pastilles chronologiques */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 py-1">
              {recentMatches.map((match, idx) => (
                <div
                  key={`${match.date}-${idx}`}
                  className="group relative flex flex-col items-center gap-1 rounded-2xl border border-white/10 bg-white/[0.05] p-2 hover:bg-white/10 transition"
                >
                  <OutcomePill outcome={match.outcome} />
                  <span className="font-mono text-[11px] font-bold text-white/90">
                    {match.goalsFor}-{match.goalsAgainst}
                  </span>
                  <span className="max-w-[70px] truncate text-[9px] text-white/60" title={match.opponent}>
                    {match.opponent}
                  </span>
                  <span className="text-[9px] text-white/40">
                    {formatDateFr(match.date)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Ratios & Statistiques Clés */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {/* Taux de victoires */}
            <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
              <span className="text-[11px] font-semibold text-white/65">Victoires</span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-black tabular-nums text-emerald-400">{overall.wins}</span>
                <span className="text-xs font-bold text-white/50">/ {overall.matches}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-[10px] text-white/60">
                <span>Taux de succès</span>
                <span className="font-bold text-emerald-300">{overall.winRate}%</span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${overall.winRate}%` }}
                />
              </div>
            </div>

            {/* Attaque (Ratio Buts Marqués) */}
            <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
              <span className="text-[11px] font-semibold text-white/65">Attaque (Moyenne)</span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-black tabular-nums text-sky-300">{overall.avgGoalsFor}</span>
                <span className="text-xs font-bold text-white/50">buts/m</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-[10px] text-white/60">
                <span>Total inscrits</span>
                <span className="font-bold text-sky-200">{overall.goalsFor} buts</span>
              </div>
              <div className="mt-1 flex items-center gap-1 text-[10px] text-sky-300/80">
                <ArrowUpRight className="size-3" />
                <span>{overall.wins} V · {overall.draws} N · {overall.losses} D</span>
              </div>
            </div>

            {/* Défense (Ratio Buts Encaissés) */}
            <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
              <span className="text-[11px] font-semibold text-white/65">Défense (Moyenne)</span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-black tabular-nums text-amber-300">{overall.avgGoalsAgainst}</span>
                <span className="text-xs font-bold text-white/50">buts/m</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-[10px] text-white/60">
                <span>Total concédés</span>
                <span className="font-bold text-amber-200">{overall.goalsAgainst} buts</span>
              </div>
              <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-300/80">
                <ArrowDownRight className="size-3" />
                <span>Diff. : {overall.goalDifference > 0 ? `+${overall.goalDifference}` : overall.goalDifference}</span>
              </div>
            </div>

            {/* Clean Sheets (Matchs sans but) */}
            <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
              <span className="text-[11px] font-semibold text-white/65">Clean Sheets</span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-black tabular-nums text-indigo-300">{overall.cleanSheets}</span>
                <span className="text-xs font-bold text-white/50">match{overall.cleanSheets > 1 ? 's' : ''}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-[10px] text-white/60">
                <span>Invincibilité défensive</span>
                <span className="font-bold text-indigo-200">
                  {overall.matches > 0 ? Math.round((overall.cleanSheets / overall.matches) * 100) : 0}%
                </span>
              </div>
              <div className="mt-1 flex items-center gap-1 text-[10px] text-indigo-300/80">
                <ShieldCheck className="size-3" />
                <span>Cage inviolée</span>
              </div>
            </div>
          </div>

          {/* Répartition Domicile vs Extérieur */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Domicile */}
            <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-xl bg-sky-500/20 text-sky-300">
                    <Home className="size-4" />
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-white/80">À Domicile</span>
                </div>
                <span className="font-mono text-xs font-black text-sky-300">
                  {home.matches} match{home.matches > 1 ? 's' : ''}
                </span>
              </div>

              {home.matches > 0 ? (
                <div className="grid grid-cols-3 gap-2 pt-2 text-center">
                  <div className="rounded-xl bg-white/[0.04] p-2">
                    <span className="block text-[10px] text-white/50 font-semibold">Bilan</span>
                    <span className="font-mono text-xs font-bold text-white">
                      {home.wins}V - {home.draws}N - {home.losses}D
                    </span>
                  </div>
                  <div className="rounded-xl bg-white/[0.04] p-2">
                    <span className="block text-[10px] text-white/50 font-semibold">Buts</span>
                    <span className="font-mono text-xs font-bold text-white">
                      {home.goalsFor} - {home.goalsAgainst}
                    </span>
                  </div>
                  <div className="rounded-xl bg-white/[0.04] p-2">
                    <span className="block text-[10px] text-white/50 font-semibold">Moyenne</span>
                    <span className="font-mono text-xs font-bold text-sky-300">
                      {home.avgGoalsFor} / {home.avgGoalsAgainst}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-center text-xs text-white/40 py-2">Aucun match à domicile</p>
              )}
            </div>

            {/* Extérieur */}
            <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-xl bg-amber-500/20 text-amber-300">
                    <Plane className="size-4" />
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-white/80">À l’Extérieur</span>
                </div>
                <span className="font-mono text-xs font-black text-amber-300">
                  {away.matches} match{away.matches > 1 ? 's' : ''}
                </span>
              </div>

              {away.matches > 0 ? (
                <div className="grid grid-cols-3 gap-2 pt-2 text-center">
                  <div className="rounded-xl bg-white/[0.04] p-2">
                    <span className="block text-[10px] text-white/50 font-semibold">Bilan</span>
                    <span className="font-mono text-xs font-bold text-white">
                      {away.wins}V - {away.draws}N - {away.losses}D
                    </span>
                  </div>
                  <div className="rounded-xl bg-white/[0.04] p-2">
                    <span className="block text-[10px] text-white/50 font-semibold">Buts</span>
                    <span className="font-mono text-xs font-bold text-white">
                      {away.goalsFor} - {away.goalsAgainst}
                    </span>
                  </div>
                  <div className="rounded-xl bg-white/[0.04] p-2">
                    <span className="block text-[10px] text-white/50 font-semibold">Moyenne</span>
                    <span className="font-mono text-xs font-bold text-amber-300">
                      {away.avgGoalsFor} / {away.avgGoalsAgainst}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-center text-xs text-white/40 py-2">Aucun match à l’extérieur</p>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  )
}

export function TeamFormDynamics({ matchResults }: { matchResults: TeamMatchResults }) {
  const [selectedView, setSelectedView] = useState<'both' | 'E1' | 'E2'>('both')
  const [competitionFilter, setCompetitionFilter] = useState<TeamCompetitionFilter>('all')

  const filteredE1 = useMemo(
    () => filterMatchesByCompetition(matchResults.E1, competitionFilter),
    [matchResults.E1, competitionFilter],
  )
  const filteredE2 = useMemo(
    () => filterMatchesByCompetition(matchResults.E2, competitionFilter),
    [matchResults.E2, competitionFilter],
  )
  const dynamicsE1 = useMemo(() => calculateTeamDynamics('E1', filteredE1), [filteredE1])
  const dynamicsE2 = useMemo(() => calculateTeamDynamics('E2', filteredE2), [filteredE2])
  const allResults = useMemo(() => [...matchResults.E1, ...matchResults.E2], [matchResults.E1, matchResults.E2])
  const competitionOptions: Array<{ key: TeamCompetitionFilter; label: string; count: number }> = [
    { key: 'all', label: 'Toutes', count: allResults.length },
    { key: 'championship', label: 'Championnat', count: filterMatchesByCompetition(allResults, 'championship').length },
    { key: 'friendly', label: 'Amicaux', count: filterMatchesByCompetition(allResults, 'friendly').length },
  ]

  return (
    <div className="flex flex-col gap-5" aria-labelledby="dynamics-title">
      {/* En-tête avec titre et sélecteur */}
      <header className="relative isolate overflow-hidden rounded-[2rem] border border-[#e0bd43]/60 bg-gradient-to-br from-[#101b40] via-[#1d397f] to-[#12224e] p-5 text-white shadow-xl sm:p-7">
        <div aria-hidden="true" className="pointer-events-none absolute -top-20 -right-14 -z-10 size-64 rounded-full bg-sky-300/10 blur-3xl" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 sm:gap-4">
            <ClubCrest className="size-12 ring-4 ring-[#e0bd43] sm:size-16" />
            <div>
              <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-amber-300 sm:text-xs">
                <Sparkles className="size-3.5" /> ES Genech · U11
              </p>
              <h2 id="dynamics-title" className="text-xl font-black sm:text-2xl md:text-3xl">
                Dynamique &amp; État de forme
              </h2>
              <p className="text-xs text-white/70">
                Progression collective, séries récentes et ratios de buts
              </p>
            </div>
          </div>

          {/* Boutons de sélection */}
          <div className="flex items-center rounded-2xl border border-white/20 bg-white/10 p-1 backdrop-blur-md self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setSelectedView('both')}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                selectedView === 'both' ? 'bg-[#e0bd43] text-[#101b40] shadow' : 'text-white/80 hover:text-white'
              }`}
            >
              Vue d’ensemble
            </button>
            <button
              type="button"
              onClick={() => setSelectedView('E1')}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                selectedView === 'E1' ? 'bg-[#e0bd43] text-[#101b40] shadow' : 'text-white/80 hover:text-white'
              }`}
            >
              Équipe 1
            </button>
            <button
              type="button"
              onClick={() => setSelectedView('E2')}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                selectedView === 'E2' ? 'bg-[#e0bd43] text-[#101b40] shadow' : 'text-white/80 hover:text-white'
              }`}
            >
              Équipe 2
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/55">Type de compétition</p>
          <div role="group" aria-label="Filtrer par type de compétition" className="grid grid-cols-3 gap-1 rounded-2xl border border-white/15 bg-black/10 p-1">
            {competitionOptions.map(({ key, label, count }) => (
              <button
                key={key}
                type="button"
                aria-pressed={competitionFilter === key}
                onClick={() => setCompetitionFilter(key)}
                className={[
                  'flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-2.5 text-[11px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 sm:px-4',
                  competitionFilter === key
                    ? 'bg-emerald-300 text-emerald-950 shadow'
                    : 'text-white/75 hover:bg-white/10 hover:text-white',
                ].join(' ')}
              >
                {label}
                <span className={competitionFilter === key ? 'rounded-full bg-emerald-950/10 px-1.5 py-0.5 text-[9px]' : 'rounded-full bg-white/10 px-1.5 py-0.5 text-[9px]'}>
                  {count}
                </span>
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Affichage des fiches d'équipes */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {(selectedView === 'both' || selectedView === 'E1') && (
          <div className={selectedView === 'E1' ? 'lg:col-span-2' : ''}>
            <TeamCard dynamics={dynamicsE1} />
          </div>
        )}
        {(selectedView === 'both' || selectedView === 'E2') && (
          <div className={selectedView === 'E2' ? 'lg:col-span-2' : ''}>
            <TeamCard dynamics={dynamicsE2} />
          </div>
        )}
      </div>
    </div>
  )
}
