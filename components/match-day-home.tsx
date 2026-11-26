'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import {
  ArrowRight,
  Clock3,
  MapPin,
  Pencil,
  RotateCcw,
  Radio,
  Sun,
  Trophy,
  UsersRound,
} from 'lucide-react'
import { ClubCrest } from '@/components/club-crest'
import { MatchWeather } from '@/components/match-weather'
import { useMatchLineups } from '@/components/match-lineup-planner'
import type { Convocation } from '@/lib/convocations'
import type { MatchSheetEntry } from '@/lib/match-results'
import type { MatchDayPlayer, PublicPlayer } from '@/lib/players'
import type { MatchLineup } from '@/lib/match-lineups'
import { getLatestPlayedMatches, getNextPlannedMatchDate, normalizeMatchDate } from '@/lib/match-day-display'

const LiveMatchConsole = dynamic(() => import('@/components/live-match-console').then((module) => module.LiveMatchConsole))

function callupPositionRank(position: string | null) {
  const lower = position?.toLocaleLowerCase('fr-FR') ?? ''
  if (lower.startsWith('gard')) return 0
  if (lower.startsWith('déf') || lower.startsWith('def') || lower.startsWith('lat') || lower.startsWith('cent')) return 1
  if (lower.startsWith('mil') || lower.startsWith('ail')) return 2
  if (lower.startsWith('att') || lower.startsWith('av')) return 3
  return 4
}

function ConvocationOverlay({
  teamName,
  players,
  canShowLicenseNumbers,
  hasCallups,
  canEdit,
  onEdit,
}: {
  teamName: string
  players: { name: string; absent: boolean; position: string | null; licenseNumber: string | null }[]
  canShowLicenseNumbers: boolean
  hasCallups: boolean
  canEdit: boolean
  onEdit: () => void
}) {
  const [open, setOpen] = useState(false)
  const [showLicenseNumbers, setShowLicenseNumbers] = useState(false)
  const orderedPlayers = players
    .map((player, index) => ({ player, index }))
    .sort((a, b) => callupPositionRank(a.player.position) - callupPositionRank(b.player.position) || a.index - b.index)

  if (players.length === 0) {
    return null
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="absolute right-2 top-2 z-10 inline-flex min-h-8 min-w-9 items-center justify-center gap-1 rounded-full border border-white/20 bg-[#172554]/65 px-2 text-[10px] font-black text-white shadow-sm backdrop-blur transition hover:border-amber-200/70 hover:bg-[#172554]/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 sm:text-xs"
        aria-haspopup="dialog"
        aria-label={`Voir les ${players.length} convoqués de ${teamName}`}
      >
        <UsersRound aria-hidden="true" className="size-3.5 text-amber-200" />
        <span>{players.length}</span>
      </button>
      {open && createPortal(
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-[#07102a]/75 p-1 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => setOpen(false)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-label={`Convocations ${teamName}`}
            className="flex max-h-[calc(100dvh-0.5rem)] w-full max-w-xl flex-col overflow-hidden rounded-[1.75rem] border border-amber-200/70 bg-gradient-to-br from-[#172554] via-[#1e3a8a] to-[#101a3d] text-white shadow-2xl animate-in slide-in-from-bottom-4 duration-200"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="flex shrink-0 items-start justify-between gap-3 border-b border-white/10 p-3 sm:p-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-200">Jour de match · U11</p>
                <h3 className="mt-1 text-xl font-black">Les convoqués</h3>
                <p className="mt-1 text-xs font-bold text-white/70">{teamName} · {players.length} joueur{players.length === 1 ? '' : 's'}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fermer" className="grid size-10 shrink-0 place-items-center rounded-full border border-white/15 bg-white/10 text-xl">×</button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4">
              {hasCallups && players.length > 0 && canShowLicenseNumbers && (
                <label className="mb-2 inline-flex min-h-8 cursor-pointer items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 text-[10px] font-semibold text-white/75 transition hover:bg-white/10">
                  <input
                    type="checkbox"
                    checked={showLicenseNumbers}
                    onChange={(event) => setShowLicenseNumbers(event.target.checked)}
                    className="size-3.5 accent-[#d4af37]"
                  />
                  Afficher les n° de licence
                </label>
              )}
              {!hasCallups ? (
                <div className="rounded-2xl border border-dashed border-white/25 bg-white/5 p-6 text-center">
                  <span className="text-3xl" aria-hidden="true">⚽</span>
                  <p className="mt-2 font-black">Pas encore de convocation</p>
                  <p className="mt-1 text-xs text-white/65">La liste apparaîtra ici dès qu’elle sera préparée.</p>
                </div>
              ) : players.length === 0 ? (
                <p className="rounded-2xl bg-white/10 p-4 text-center text-sm font-semibold">Aucun joueur convoqué pour cette équipe.</p>
              ) : (
                <ul className="grid grid-cols-2 gap-1.5">
                  {orderedPlayers.map(({ player, index }) => (
                    <li key={`${player.name}-${index}`} className="flex min-w-0 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.08] p-2 text-[11px] font-bold leading-tight">
                      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-amber-300 text-[#172554]">{player.absent ? '!' : '✓'}</span>
                      <span className="min-w-0 break-words">
                        <span className="block">{player.name}{player.absent ? ' · absent' : ''}</span>
                        {player.position && (
                          <span className="mt-0.5 block text-[9px] font-medium text-white/55">Poste · {player.position}</span>
                        )}
                        {showLicenseNumbers && (
                          <span className="mt-0.5 block whitespace-nowrap text-[10px] font-medium text-white/70">
                            N° licence · <span className="font-bold tabular-nums text-white/90">{player.licenseNumber || 'Non renseigné'}</span>
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {canEdit && (
              <footer className="shrink-0 border-t border-white/10 p-3 sm:p-4">
                <button type="button" onClick={() => { setOpen(false); onEdit() }} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-300 to-yellow-200 px-4 text-sm font-black text-[#172554] shadow-lg transition hover:brightness-105">
                  <UsersRound aria-hidden="true" className="size-4" /> {hasCallups ? 'Modifier la convocation' : 'Préparer la convocation'} <ArrowRight aria-hidden="true" className="size-4" />
                </button>
              </footer>
            )}
          </section>
        </div>,
        document.body,
      )}
    </>
  )
}

function localToday() {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  return now.toISOString().slice(0, 10)
}

function daysFromToday(date: string, today: string) {
  const dateTime = Date.parse(`${date}T00:00:00Z`)
  const todayTime = Date.parse(`${today}T00:00:00Z`)
  return Math.round((dateTime - todayTime) / 86_400_000)
}

export function MatchDayHome({
  entries,
  convocations,
  players,
  rosterPlayers,
  convocationDates,
  canManageMatches,
  onSelectMatch,
  onOpenCallups,
}: {
  entries: MatchSheetEntry[]
  convocations: Convocation[]
  players: PublicPlayer[]
  rosterPlayers: MatchDayPlayer[]
  convocationDates: string[]
  canManageMatches: boolean
  onSelectMatch: (entry: MatchSheetEntry) => void
  onOpenCallups: (date: string) => void
}) {
  const router = useRouter()
  const [licenseNumbers, setLicenseNumbers] = useState<Record<number, string>>({})
  const [lineupToStartLive, setLineupToStartLive] = useState<{
    match: MatchSheetEntry
    lineup: MatchLineup
  } | null>(null)
  useEffect(() => {
    if (!canManageMatches) {
      setLicenseNumbers({})
      return
    }

    let active = true
    fetch('/api/educators/players', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return
        const result = await response.json() as {
          players?: Array<{ number?: unknown; licenseNumber?: unknown }>
        }
        if (!active || !Array.isArray(result.players)) return
        setLicenseNumbers(Object.fromEntries(
          result.players.flatMap((player) =>
            typeof player.number === 'number' && Number.isSafeInteger(player.number) && typeof player.licenseNumber === 'string'
              ? [[player.number, player.licenseNumber] as const]
              : [],
          ),
        ))
      })
      .catch(() => {})

    return () => { active = false }
  }, [canManageMatches])

  const matchLineups = useMatchLineups(canManageMatches)
  const today = localToday()
  const plannedDate = getNextPlannedMatchDate(entries, today)
  const latestResults = getLatestPlayedMatches(entries, today)
  const matchesOnPlannedDate = useMemo(
    () => plannedDate
      ? entries.filter((entry) =>
          normalizeMatchDate(entry.date) === plannedDate &&
          !entry.resultLabel &&
          entry.goalsFor === null &&
          entry.goalsAgainst === null,
        )
      : [],
    [entries, plannedDate],
  )
  const lastMatchDate = useMemo(
    () => entries
      .map((entry) => normalizeMatchDate(entry.date))
      .filter((date) => date && date < today)
      .sort()
      .at(-1) ?? null,
    [entries, today],
  )
  const canEditCallups = Boolean(
    canManageMatches && plannedDate && new Date(`${plannedDate}T12:00:00`).getDay() === 6,
  )
  const daysUntilPlannedMatch = plannedDate ? daysFromToday(plannedDate, today) : null
  const hasCallups = plannedDate !== null && convocationDates.some(
    (date) => normalizeMatchDate(date) === plannedDate,
  )
  return (
    <section
      aria-labelledby="match-day-home-title"
      className="overflow-hidden rounded-[1.75rem] border border-[#d4af37]/45 bg-gradient-to-br from-[#172554] via-[#1e3a8a] to-[#172554] text-white shadow-xl"
    >
      <div className="relative overflow-hidden p-3 sm:p-4">
        <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-12 opacity-10">
          <ClubCrest className="size-56" />
        </div>
        <div className="relative">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-[#d4af37] sm:text-[10px]">
                ES Genech · Jour de match
              </p>
              <h2 id="match-day-home-title" className="mt-0.5 text-xl font-black sm:text-2xl">
                {plannedDate ? 'Prochain rendez-vous' : 'Le calendrier des matchs'}
              </h2>
            </div>
            {plannedDate && (
              <span className="shrink-0 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white/80">
                U11
              </span>
            )}
          </div>
          {plannedDate ? (
            <>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-bold capitalize text-white/80 sm:text-sm">
                  {new Date(`${plannedDate}T12:00:00`).toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                </p>
                {daysUntilPlannedMatch !== null && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-200/20 bg-amber-200/10 px-2.5 py-1 text-[10px] font-black text-amber-100 sm:text-xs">
                    ⚽ {daysUntilPlannedMatch === 0
                      ? 'Aujourd’hui'
                      : daysUntilPlannedMatch === 1
                        ? 'Demain'
                        : `Dans ${daysUntilPlannedMatch} jours`}
                  </span>
                )}
              </div>
              <div className="mt-2 grid items-stretch gap-2 sm:grid-cols-2">
                {matchesOnPlannedDate.map((match) => {
                  const savedLineup = matchLineups.lineups.find((lineup) =>
                    normalizeMatchDate(lineup.date) === plannedDate &&
                    lineup.team === match.team &&
                    lineup.slotColumn === match.slotColumn,
                  )
                  const lineupSaveKey = `${plannedDate}-${match.team}-${match.slotColumn}`
                  const calledPlayers = convocations.flatMap((player) => {
                    const callup = player.matches.find((item) =>
                      normalizeMatchDate(item.date) === plannedDate &&
                      (item.team === match.team || item.team === 'E1+E2') &&
                      (item.status === 'called' || item.status === 'calledAbsent' || item.status === 'present'),
                    )
                    if (!callup) return []
                    const rosterPlayer = rosterPlayers.find((item) => item.number === player.number)
                    return [{
                      name: player.name,
                      absent: callup.status === 'calledAbsent',
                      position: rosterPlayer?.position ?? null,
                      licenseNumber: rosterPlayer ? licenseNumbers[rosterPlayer.number] ?? null : null,
                    }]
                  })

                  return (
                    <div
                      key={`${match.team}-${match.slotColumn}`}
                      className={[
                        'relative flex min-w-0 flex-col overflow-hidden rounded-[1.35rem] border p-2.5 shadow-lg backdrop-blur-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-xl sm:h-full',
                        match.team === 'E1'
                          ? 'border-sky-300/45 bg-gradient-to-br from-[#1d4ed8] to-[#172554] text-white'
                          : 'border-amber-200/80 bg-gradient-to-br from-[#ffd23f] to-[#fbbf24] text-[#172554]',
                      ].join(' ')}
                    >
                      <button
                        type="button"
                        onClick={() => onSelectMatch(match)}
                        aria-label={`Ouvrir la feuille de match, ES Genech ${match.team === 'E1' ? '1' : '2'} contre ${match.opponent || 'adversaire à préciser'}`}
                        className="group flex w-full min-w-0 flex-1 flex-col items-stretch gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-current"
                      >
                        <div className="flex min-w-0 items-center gap-2.5 pr-8">
                          <ClubCrest className={[
                            'size-10 shrink-0 rounded-full ring-2 shadow-md transition-transform group-hover:scale-105',
                            match.team === 'E1' ? 'ring-sky-300' : 'ring-white/90',
                          ].join(' ')} />
                          <div className="min-w-0 flex-1">
                            <p className={[
                              'text-[9px] font-black uppercase tracking-[0.16em]',
                              match.team === 'E1' ? 'text-sky-200' : 'text-[#1e3a8a]',
                            ].join(' ')}>
                              ES Genech {match.team === 'E1' ? '1' : '2'}
                            </p>
                            <p className="mt-0.5 truncate text-base font-black leading-tight sm:text-lg">
                              {match.opponent || 'Adversaire à préciser'}
                            </p>
                          </div>
                        </div>
                        <div className="flex min-w-0 flex-wrap items-center gap-1 text-[9px] font-bold sm:text-[10px]">
                          <span className={[
                            'inline-flex shrink-0 items-center rounded-full px-2 py-1',
                            match.team === 'E1' ? 'border border-sky-200/25 bg-white/10' : 'bg-white/65',
                          ].join(' ')}>
                            {match.competition || 'Type non renseigné'}
                          </span>
                          <span className={[
                            'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1',
                            match.team === 'E1' ? 'border border-white/10 bg-black/10' : 'bg-white/55',
                          ].join(' ')}>
                            <MapPin aria-hidden="true" className="size-3 sm:size-3.5 md:size-4" />
                            {match.homeAway || 'Lieu à préciser'}
                          </span>
                          {match.kickoffTime && (
                            <span className={[
                              'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 tabular-nums',
                              match.team === 'E1' ? 'border border-white/10 bg-black/10' : 'bg-white/55',
                            ].join(' ')}>
                              <Clock3 aria-hidden="true" className="size-3 sm:size-3.5 md:size-4" />
                              {match.kickoffTime}
                            </span>
                          )}
                          {daysUntilPlannedMatch !== null &&
                            daysUntilPlannedMatch >= 0 &&
                            daysUntilPlannedMatch <= 15 &&
                            (match.homeAway === 'Domicile' || match.homeAway === 'Extérieur') && (
                              <MatchWeather
                                date={plannedDate}
                                eventTime={match.kickoffTime}
                                homeAway={match.homeAway}
                                opponent={match.opponent}
                                today={today}
                                venue={match.venueAddress}
                                tone={match.team === 'E1' ? 'dark' : 'light'}
                              />
                            )}
                        </div>
                      </button>
                      <div className="mt-2 grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => onSelectMatch(match)}
                          className={[
                            'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border px-2 text-[11px] font-black transition',
                            match.team === 'E1'
                              ? 'border-sky-200/30 bg-white/10 text-white hover:bg-white/15'
                              : 'border-[#172554]/25 bg-white/45 text-[#172554] hover:bg-white/70',
                          ].join(' ')}
                        >
                          <RotateCcw aria-hidden="true" className="size-3.5" />
                          Feuille
                        </button>
                        {canManageMatches ? (
                          <button
                            type="button"
                            onClick={() => onSelectMatch(match)}
                            className={[
                              'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border px-2 text-[11px] font-black transition',
                              match.team === 'E1'
                                ? 'border-sky-200/30 bg-white/10 text-white hover:bg-white/15'
                                : 'border-[#172554]/25 bg-white/45 text-[#172554] hover:bg-white/70',
                            ].join(' ')}
                          >
                            <Pencil aria-hidden="true" className="size-3.5" />
                            Modifier
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onOpenCallups(plannedDate)}
                            className={[
                              'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border px-2 text-[11px] font-black transition',
                              match.team === 'E1'
                                ? 'border-sky-200/30 bg-white/10 text-white hover:bg-white/15'
                                : 'border-[#172554]/25 bg-white/45 text-[#172554] hover:bg-white/70',
                            ].join(' ')}
                          >
                            <UsersRound aria-hidden="true" className="size-3.5" />
                            Convoqués
                          </button>
                        )}
                      </div>
                      {canManageMatches && savedLineup && savedLineup.starters.length > 0 && (
                        <div className="mt-1.5 flex justify-end">
                          <button
                            type="button"
                            disabled={matchLineups.pendingKeys.has(lineupSaveKey)}
                            onClick={() => setLineupToStartLive({
                              match: { ...match, date: plannedDate },
                              lineup: savedLineup,
                            })}
                            aria-label={`Lancer le direct, ES Genech ${match.team === 'E1' ? '1' : '2'} contre ${match.opponent || 'adversaire'}`}
                            title={`Lancer le match contre ${match.opponent || 'cet adversaire'}`}
                            className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border border-emerald-200/40 bg-emerald-400/15 px-3 text-[10px] font-black uppercase tracking-wider text-emerald-100 shadow-sm transition hover:bg-emerald-400/25 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 disabled:cursor-wait disabled:opacity-60 sm:hidden"
                          >
                            <span aria-hidden="true" className="size-1.5 rounded-full bg-rose-300 shadow-[0_0_0_2px_rgba(252,165,165,0.2)] motion-safe:animate-pulse" />
                            <Radio aria-hidden="true" className="size-4" />
                            <span>Direct</span>
                          </button>
                        </div>
                      )}
                      <ConvocationOverlay
                        teamName={`ES Genech ${match.team === 'E1' ? '1' : '2'}`}
                        players={calledPlayers}
                        canShowLicenseNumbers={canManageMatches && rosterPlayers.length > 0}
                        hasCallups={hasCallups}
                        canEdit={canEditCallups}
                        onEdit={() => onOpenCallups(plannedDate)}
                      />
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <>
              <p className="mt-2 max-w-xl text-sm text-white/80">
                Aucun match à venir n’est planifié.
                {lastMatchDate && (
                  <> Dernière journée : {new Date(`${lastMatchDate}T12:00:00`).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}.</>
                )}
              </p>
            </>
          )}
          {(latestResults.E1 || latestResults.E2) && (
            <div className="mt-4">
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/65">
                Derniers résultats
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {(['E1', 'E2'] as const).map((team) => {
                  const result = latestResults[team]
                  if (!result) return null
                  const isWin = result.goalsFor > result.goalsAgainst
                  const isDraw = result.goalsFor === result.goalsAgainst
                  const teamName = `ES Genech ${team === 'E1' ? '1' : '2'}`
                  const teamLabel = teamName
                  const scoreStyle = isWin
                    ? 'bg-emerald-300 text-emerald-950'
                    : isDraw
                      ? 'bg-amber-200 text-amber-950'
                      : 'bg-rose-300 text-rose-950'
                  const resultStyle = isWin
                    ? 'border-emerald-300/75 border-l-4 bg-gradient-to-r from-emerald-500/35 to-emerald-300/10'
                    : isDraw
                      ? 'border-amber-300/75 border-l-4 bg-gradient-to-r from-amber-400/35 to-amber-200/10'
                      : 'border-rose-300/75 border-l-4 bg-gradient-to-r from-rose-500/35 to-rose-300/10'
                  const outcomeStyle = isWin
                    ? 'bg-emerald-300/20 text-emerald-100'
                    : isDraw
                      ? 'bg-amber-200/20 text-amber-100'
                      : 'bg-rose-300/20 text-rose-100'

                  return (
                    <div
                      key={team}
                      className={`flex min-w-0 items-center gap-2 rounded-xl border p-2.5 shadow-sm ${resultStyle}`}
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/10">
                        {isWin
                          ? <Trophy aria-hidden="true" className="size-4 text-amber-300" />
                          : <ClubCrest className="size-7 rounded-full" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[9px] font-black uppercase tracking-wider text-white/70">
                          {teamLabel} · {new Date(`${result.normalizedDate}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                        </p>
                        <p className={`mt-0.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${outcomeStyle}`}>
                          {isWin ? 'Victoire' : isDraw ? 'Match nul' : 'Défaite'}
                        </p>
                        <p className="mt-0.5 break-words text-xs font-semibold leading-snug text-white">
                          vs {result.opponent || 'adversaire non renseigné'}
                        </p>
                      </div>
                      <span aria-label={`Score de ES Genech ${team === 'E1' ? '1' : '2'} : ${result.goalsFor} à ${result.goalsAgainst}`} className={`shrink-0 rounded-xl px-2.5 py-1 text-base font-black tabular-nums ${scoreStyle}`}>
                        {result.goalsFor}–{result.goalsAgainst}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
      {lineupToStartLive && (
        <LiveMatchConsole
          match={lineupToStartLive.match}
          players={players}
          starters={lineupToStartLive.lineup.starters}
          substitutes={lineupToStartLive.lineup.substitutes}
          onClose={() => setLineupToStartLive(null)}
          onFinalized={() => {
            setLineupToStartLive(null)
            router.refresh()
          }}
        />
      )}
    </section>
  )
}
