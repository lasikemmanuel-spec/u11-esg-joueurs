'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, Search } from 'lucide-react'
import { PlayerCard } from '@/components/player-stats'
import { ClubCrest } from '@/components/club-crest'
import { countCancelledCallupsForPlayer } from '@/lib/cancelled-match-callups'
import type { Convocation } from '@/lib/convocations'
import type { TeamMatchResults } from '@/lib/match-results'
import type { PublicPlayer } from '@/lib/players'
import type { PlayerStats } from '@/lib/stats'

const POSITION_ORDER = ['gard', 'déf', 'def', 'lat', 'cent', 'mil', 'ail', 'att', 'av']

const normalizeName = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr-FR')

const positionRank = (position: string) => {
  const lower = position.toLowerCase()
  const index = POSITION_ORDER.findIndex((key) => lower.startsWith(key))
  return index === -1 ? POSITION_ORDER.length : index
}

export function PositionBreakdown({
  players,
  stats,
  convocations,
  matchesPlayed,
  matchResults,
}: {
  players: PublicPlayer[]
  stats: PlayerStats[]
  convocations: Convocation[]
  matchesPlayed: number
  matchResults: TeamMatchResults
}) {
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [expandedPositions, setExpandedPositions] = useState<Set<string>>(() => new Set())
  const playerDialogRef = useRef<HTMLDialogElement>(null)
  const shouldScrollToTopAfterCollapse = useRef(false)
  const searchTerm = normalizeName(query.trim())
  const matchingPlayers = searchTerm
    ? players.filter((player) =>
        normalizeName(`${player.firstName} ${player.lastName} ${player.number} ${player.position ?? ''} ${player.transferStatus ?? ''}`).includes(searchTerm),
      )
    : players
  const groups = new Map<string, PublicPlayer[]>()
  for (const player of matchingPlayers) {
    const key = player.position ?? 'Non renseigné'
    groups.set(key, [...(groups.get(key) ?? []), player])
  }

  const sorted = [...groups.entries()].sort(([a], [b]) => {
    if (a === 'Non renseigné') return 1
    if (b === 'Non renseigné') return -1
    return positionRank(a) - positionRank(b) || a.localeCompare(b, 'fr')
  })
  const allGroupsExpanded = sorted.length > 0 && (Boolean(searchTerm) || sorted.every(([position, list]) =>
    expandedPositions.has(position) || list.some((player) => player.number === selectedNumber),
  ))
  const hasExpandedVisibleGroup = sorted.some(([position, list]) =>
    Boolean(searchTerm) || expandedPositions.has(position) || list.some((player) => player.number === selectedNumber),
  )
  const selectedPlayer = players.find((player) => player.number === selectedNumber)
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

  const collapseAllPositions = () => {
    shouldScrollToTopAfterCollapse.current = true
    setExpandedPositions(new Set())
    setSelectedNumber(null)
  }

  useLayoutEffect(() => {
    if (!shouldScrollToTopAfterCollapse.current) return
    shouldScrollToTopAfterCollapse.current = false
    if (window.matchMedia('(max-width: 639px)').matches) {
      window.scrollTo({ top: 0, behavior: 'instant' })
    }
  }, [expandedPositions, selectedNumber])

  useEffect(() => {
    const dialog = playerDialogRef.current
    if (!dialog) return
    if (selectedPlayer && !dialog.open) dialog.showModal()
    if (!selectedPlayer && dialog.open) dialog.close()
  }, [selectedPlayer])

  return (
    <section
      aria-label="Effectifs regroupés par poste"
      className="flex flex-col gap-3 rounded-xl border border-accent/60 bg-gradient-to-br from-secondary/30 via-card to-card p-4 shadow-sm"
    >
      <div className="flex items-center gap-2">
        {sorted.length > 0 && !searchTerm && (
          <button
            type="button"
            onClick={() => {
              if (allGroupsExpanded) {
                collapseAllPositions()
              } else {
                setExpandedPositions(new Set(sorted.map(([position]) => position)))
              }
            }}
            aria-label={allGroupsExpanded ? 'Fermer tous les postes' : 'Ouvrir tous les postes'}
            title={allGroupsExpanded ? 'Fermer tous les postes' : 'Ouvrir tous les postes'}
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-accent/40 bg-card px-2 text-xs font-semibold text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {allGroupsExpanded ? <ChevronUp aria-hidden="true" className="size-3.5" /> : <ChevronDown aria-hidden="true" className="size-3.5" />}
            <span>{allGroupsExpanded ? 'Tout −' : 'Tout +'}</span>
          </button>
        )}
        <label className="relative block min-w-0 flex-1">
          <span className="sr-only">Rechercher un joueur par nom, numéro ou poste</span>
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            aria-label="Rechercher un joueur par nom, numéro ou poste"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setSelectedNumber(null)
            }}
            placeholder="Nom, prénom"
            className="h-9 w-full rounded-lg border border-accent/40 bg-background pr-3 pl-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
      </div>

      <div className={`roster-player-groups ${
        allGroupsExpanded
          ? 'columns-1 gap-3 sm:columns-2 xl:columns-3'
          : 'grid grid-cols-1 items-start gap-3 sm:grid-cols-2 xl:grid-cols-3'
      }`}>
            {matchingPlayers.length === 0 && (
              <p className="break-inside-avoid rounded-lg border border-accent/40 bg-card p-3 text-sm text-muted-foreground">
                {searchTerm
                  ? `Aucun joueur ne correspond à « ${query} ».`
                  : 'Aucun joueur dans l’effectif.'}
              </p>
            )}
            {sorted.map(([position, list], groupIndex) => {
              const isSelectedGroup = list.some((player) => player.number === selectedPlayer?.number)
              const isExpanded = Boolean(searchTerm) || expandedPositions.has(position) || isSelectedGroup
              const groupId = `roster-position-${groupIndex}`
              return (
              <article key={position} className={`flex scroll-mt-4 flex-col overflow-hidden rounded-lg border border-accent/50 bg-card shadow-sm ${
                allGroupsExpanded ? 'mb-3 inline-block w-full break-inside-avoid' : ''
              }`}>
                <h3>
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    aria-controls={isExpanded ? groupId : undefined}
                    onClick={(event) => {
                      const opening = !isExpanded
                      setExpandedPositions((current) => {
                        const next = new Set(current)
                        if (next.has(position)) next.delete(position)
                        else next.add(position)
                        return next
                      })
                      if (opening && window.matchMedia('(max-width: 639px)').matches) {
                        const target = event.currentTarget.closest('article')
                        window.requestAnimationFrame(() => target?.scrollIntoView({
                          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
                          block: 'start',
                        }))
                      }
                    }}
                    className="flex w-full items-center justify-between gap-2 bg-gradient-to-r from-[#172554] via-[#1e3a8a] to-[#172554] px-3.5 py-2.5 text-left text-white shadow-sm border-b border-amber-400/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <ChevronDown aria-hidden="true" className={`size-4 shrink-0 text-amber-300 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                      <ClubCrest className="size-6 shrink-0 ring-1 ring-amber-400/80 shadow-sm" />
                      <span className="min-w-0 flex-1 break-words text-sm font-extrabold uppercase tracking-wide text-white">{position}</span>
                    </span>
                    <span className="rounded-full bg-amber-400 px-2.5 py-0.5 font-mono text-xs font-black text-blue-950 shadow-sm">
                      {list.length}
                    </span>
                  </button>
                </h3>
                {isExpanded && <ul id={groupId} className="flex flex-col divide-y divide-border/60 bg-card px-2.5 py-1 text-sm">
                  {[...list]
                    .sort((a, b) => a.lastName.localeCompare(b.lastName, 'fr'))
                    .map((player) => {
                      const isSelected = player.number === selectedPlayer?.number
                      return (
                        <li key={player.number}>
                          <button
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() => setSelectedNumber(isSelected ? null : player.number)}
                            className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                              isSelected ? 'bg-amber-400/20 border border-amber-400/50' : 'hover:bg-slate-100 dark:hover:bg-slate-800/60'
                            }`}
                          >
                            <span
                              title={`N°${player.number}`}
                              className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#172554] text-xs font-black text-amber-300 ring-1 ring-amber-400/40 shadow-sm"
                            >
                              {player.number}
                            </span>
                            <span className="min-w-0 flex-1 break-words">
                              <span className="font-extrabold uppercase tracking-wide text-foreground">{player.lastName}</span>{' '}
                              <span className="font-medium text-foreground/90">{player.firstName}</span>
                            </span>
                            {player.transferStatus && (
                              <span className="ml-auto shrink-0 rounded-md bg-amber-400/20 border border-amber-400/40 px-1.5 py-0.5 text-[11px] font-bold text-amber-900 dark:text-amber-200">
                                {player.transferStatus}
                              </span>
                            )}
                          </button>
                        </li>
                      )
                    })}
                </ul>}
              </article>
            )})}
          </div>
      {selectedPlayer && selectedStats && (
        <dialog
          ref={playerDialogRef}
          aria-labelledby="selected-player-card-title"
          onClose={() => setSelectedNumber(null)}
          onClick={(event) => {
            if (event.target === event.currentTarget) event.currentTarget.close()
          }}
          className="fixed inset-0 m-auto max-h-[calc(100dvh-1.5rem)] w-[min(42rem,calc(100vw-1.5rem))] overflow-y-auto overscroll-contain rounded-2xl border-0 bg-transparent p-0 shadow-2xl backdrop:bg-[#07102a]/65"
        >
            <PlayerCard
              stats={selectedStats}
              player={selectedPlayer}
              onClose={() => playerDialogRef.current?.close()}
              convocation={convocations.find((convocation) => convocation.number === selectedPlayer.number)}
              matchesPlayed={matchesPlayed}
              cancelledMatchesForPlayer={countCancelledCallupsForPlayer(
                selectedPlayer.number,
                convocations,
                matchResults.entries,
              )}
            />
        </dialog>
      )}
      {hasExpandedVisibleGroup && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 flex justify-center sm:hidden">
          <button
            type="button"
            onClick={collapseAllPositions}
            aria-label="Replier tous les postes ouverts"
            title="Replier tous les postes ouverts"
            className="pointer-events-auto inline-flex min-h-10 items-center gap-1.5 rounded-full border border-amber-400/50 bg-[#172554] px-4 text-xs font-black text-amber-300 shadow-xl active:scale-95"
          >
            <ChevronUp aria-hidden="true" className="size-4" />
            Tout replier
          </button>
        </div>
      )}
    </section>
  )
}
