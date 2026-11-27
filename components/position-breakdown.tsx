'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, LayoutGrid, ListFilter, Search, UserRound } from 'lucide-react'
import { PlayerCard } from '@/components/player-stats'
import { ClubCrest } from '@/components/club-crest'
import { countCancelledCallupsForPlayer } from '@/lib/cancelled-match-callups'
import type { Convocation } from '@/lib/convocations'
import type { TeamMatchResults } from '@/lib/match-results'
import type { PublicPlayer } from '@/lib/players'
import { ireStatus, type PlayerStats } from '@/lib/stats-shared'
import type { TrainingAttendanceSession } from '@/lib/training-attendance-shared'

const POSITION_ORDER = ['gard', 'déf', 'def', 'lat', 'cent', 'mil', 'ail', 'att', 'av']

const normalizeName = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr-FR')

const positionRank = (position: string) => {
  const lower = position.toLowerCase()
  const index = POSITION_ORDER.findIndex((key) => lower.startsWith(key))
  return index === -1 ? POSITION_ORDER.length : index
}

function getPositionMeta(position: string | null) {
  if (!position) return { label: 'Joueur', icon: '⚽', badgeClass: 'bg-slate-700/80 text-slate-100 border-slate-500/60' }
  const lower = position.toLowerCase()
  if (lower.startsWith('gard')) return { label: 'Gardien', icon: '🧤', badgeClass: 'bg-emerald-950/80 text-emerald-200 border-emerald-500/70' }
  if (lower.startsWith('déf') || lower.startsWith('def') || lower.startsWith('lat') || lower.startsWith('cent')) {
    return { label: 'Défenseur', icon: '🛡️', badgeClass: 'bg-blue-950/80 text-blue-200 border-blue-500/70' }
  }
  if (lower.startsWith('mil') || lower.startsWith('ail')) {
    return { label: 'Milieu', icon: '⚡', badgeClass: 'bg-amber-950/80 text-amber-200 border-amber-500/70' }
  }
  if (lower.startsWith('att') || lower.startsWith('av')) {
    return { label: 'Attaquant', icon: '🎯', badgeClass: 'bg-rose-950/80 text-rose-200 border-rose-500/70' }
  }
  return { label: position, icon: '⚽', badgeClass: 'bg-[#172554] text-amber-200 border-amber-400/60' }
}

export function PositionBreakdown({
  players,
  stats,
  convocations,
  matchesPlayed,
  matchResults,
  trainingAttendance,
}: {
  players: PublicPlayer[]
  stats: PlayerStats[]
  convocations: Convocation[]
  matchesPlayed: number
  matchResults: TeamMatchResults
  trainingAttendance: TrainingAttendanceSession[]
}) {
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [selectedPositionTab, setSelectedPositionTab] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'cards' | 'accordion'>('cards')
  const [expandedPositions, setExpandedPositions] = useState<Set<string>>(() => new Set())
  const playerDialogRef = useRef<HTMLDialogElement>(null)
  const navScrollRef = useRef<HTMLElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const shouldScrollToTopAfterCollapse = useRef(false)

  const searchTerm = normalizeName(query.trim())

  // Filtrage par recherche
  const searchFilteredPlayers = useMemo(() => {
    if (!searchTerm) return players
    return players.filter((player) =>
      normalizeName(`${player.firstName} ${player.lastName} ${player.number} ${player.position ?? ''} ${player.transferStatus ?? ''}`).includes(searchTerm),
    )
  }, [players, searchTerm])

  // Catégories de postes pour les filtres rapides
  const positionTabs = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of searchFilteredPlayers) {
      const pos = p.position ?? 'Non renseigné'
      counts.set(pos, (counts.get(pos) ?? 0) + 1)
    }

    const ordered = [...counts.entries()].sort(([a], [b]) => {
      if (a === 'Non renseigné') return 1
      if (b === 'Non renseigné') return -1
      return positionRank(a) - positionRank(b) || a.localeCompare(b, 'fr')
    })

    return [
      { key: 'all', label: 'Tous', icon: '⚽', count: searchFilteredPlayers.length },
      ...ordered.map(([pos, count]) => {
        const meta = getPositionMeta(pos)
        return { key: pos, label: meta.label, icon: meta.icon, count }
      }),
    ]
  }, [searchFilteredPlayers])

  const checkNavScroll = useCallback(() => {
    const el = navScrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 6)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 10)
  }, [])

  useEffect(() => {
    const timer = setTimeout(checkNavScroll, 100)
    const el = navScrollRef.current
    if (!el) return () => clearTimeout(timer)
    el.addEventListener('scroll', checkNavScroll, { passive: true })
    window.addEventListener('resize', checkNavScroll)
    return () => {
      clearTimeout(timer)
      el.removeEventListener('scroll', checkNavScroll)
      window.removeEventListener('resize', checkNavScroll)
    }
  }, [checkNavScroll, positionTabs])

  const scrollNav = (direction: 'left' | 'right') => {
    const el = navScrollRef.current
    if (!el) return
    el.scrollBy({ left: direction === 'right' ? 160 : -160, behavior: 'smooth' })
  }

  // Joueurs finaux à afficher selon le filtre de poste actif (en vue cartes)
  const displayedPlayers = useMemo(() => {
    if (selectedPositionTab === 'all') return searchFilteredPlayers
    return searchFilteredPlayers.filter((p) => (p.position ?? 'Non renseigné') === selectedPositionTab)
  }, [searchFilteredPlayers, selectedPositionTab])

  // Groupes pour la vue accordéon classique
  const groups = useMemo(() => {
    const map = new Map<string, PublicPlayer[]>()
    for (const player of searchFilteredPlayers) {
      const key = player.position ?? 'Non renseigné'
      map.set(key, [...(map.get(key) ?? []), player])
    }
    return [...map.entries()].sort(([a], [b]) => {
      if (a === 'Non renseigné') return 1
      if (b === 'Non renseigné') return -1
      return positionRank(a) - positionRank(b) || a.localeCompare(b, 'fr')
    })
  }, [searchFilteredPlayers])

  const allGroupsExpanded = groups.length > 0 && (Boolean(searchTerm) || groups.every(([position, list]) =>
    expandedPositions.has(position) || list.some((player) => player.number === selectedNumber),
  ))

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
      aria-label="Effectifs de l'équipe U11"
      className="flex flex-col gap-3 rounded-2xl border-2 border-[#172554]/15 bg-card p-3 shadow-md sm:p-4 dark:border-amber-400/30"
    >
      {/* Barre d'outils : Recherche + Bascule Cartes / Accordéon */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative block min-w-0 flex-1">
          <span className="sr-only">Rechercher un joueur</span>
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            aria-label="Rechercher un joueur par nom, numéro ou poste"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setSelectedNumber(null)
            }}
            placeholder="Rechercher un joueur…"
            className="h-10 w-full rounded-xl border border-border/80 bg-background pr-3 pl-9 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          />
        </label>

        {/* Boutons de bascule de vue : Cartes vs Liste */}
        <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-[#0c1630] p-1">
          <button
            type="button"
            aria-pressed={viewMode === 'cards'}
            onClick={() => setViewMode('cards')}
            title="Vue Cartes Collector"
            className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold transition-all ${
              viewMode === 'cards'
                ? 'border border-amber-400/40 bg-gradient-to-r from-[#172554] to-blue-900 text-amber-300 shadow-sm'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <LayoutGrid aria-hidden="true" className="size-3.5" />
            <span className="hidden sm:inline">Cartes</span>
          </button>
          <button
            type="button"
            aria-pressed={viewMode === 'accordion'}
            onClick={() => setViewMode('accordion')}
            title="Vue par poste"
            className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold transition-all ${
              viewMode === 'accordion'
                ? 'border border-amber-400/40 bg-gradient-to-r from-[#172554] to-blue-900 text-amber-300 shadow-sm'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <ListFilter aria-hidden="true" className="size-3.5" />
            <span className="hidden sm:inline">Postes</span>
          </button>
        </div>
      </div>

      {/* Barre de filtres rapides par poste avec boutons de défilement explicites */}
      <div className="relative flex items-center">
        {/* Bouton défilement gauche */}
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scrollNav('left')}
            aria-label="Faire défiler les postes vers la gauche"
            className="absolute left-0 z-20 flex size-8 items-center justify-center rounded-full border border-amber-400/80 bg-gradient-to-r from-[#172554] to-blue-900 text-amber-300 shadow-xl ring-2 ring-amber-400/30 transition-all active:scale-95"
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
          </button>
        )}

        {/* Barre de filtres scrollable */}
        <nav
          ref={navScrollRef}
          aria-label="Filtres de postes"
          className={`flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none pl-0.5 scroll-smooth ${canScrollRight ? 'pr-10' : 'pr-0.5'} ${canScrollLeft ? 'pl-10' : ''}`}
        >
          {positionTabs.map((tab) => {
            const isActive = selectedPositionTab === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                aria-pressed={isActive}
                onClick={() => setSelectedPositionTab(tab.key)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black transition-all ${
                  isActive
                    ? 'border border-amber-400/70 bg-gradient-to-r from-[#172554] via-[#1e3a8a] to-[#172554] text-amber-300 shadow-md ring-2 ring-amber-400/30'
                    : 'border border-white/10 bg-[#172554]/80 text-slate-100 hover:bg-[#1e3a8a] hover:text-white'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                <span className={`ml-0.5 rounded-full px-1.5 py-0.2 text-[10px] font-black ${
                  isActive ? 'bg-amber-400 text-blue-950' : 'bg-white/10 text-slate-200'
                }`}>
                  {tab.count}
                </span>
              </button>
            )
          })}
        </nav>

        {/* Bouton discret indiquant que d'autres postes sont accessibles */}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => scrollNav('right')}
            aria-label="Faire défiler les postes vers la droite"
            className="absolute right-0 z-20 flex size-8 items-center justify-center rounded-full border border-amber-400 bg-gradient-to-r from-[#172554] to-[#1e3a8a] text-amber-300 shadow-lg ring-1 ring-amber-400/30 transition-all active:scale-95"
          >
            <span className="sr-only">Plus de postes</span>
            <ChevronRight aria-hidden="true" className="size-3.5" />
          </button>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          1. VUE GALERIE DE CARTES COLLECTOR EA FC (OPTION 2)
      ───────────────────────────────────────────────────────────── */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 gap-2.5 pt-1 sm:grid-cols-2 sm:gap-3 xl:grid-cols-3 2xl:grid-cols-4">
          {displayedPlayers.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-dashed border-border/80 bg-muted/30 p-8 text-center text-sm text-muted-foreground">
              {searchTerm ? `Aucun joueur ne correspond à « ${query} ».` : 'Aucun joueur pour ce poste.'}
            </div>
          ) : (
            displayedPlayers.map((player) => {
              const playerStat = stats.find((s) => s.number === player.number)
              const goals = playerStat?.goals ?? 0
              const assists = playerStat?.assists ?? 0
              const rate = playerStat?.trainingRate ?? null
              const ireValue = playerStat?.ire ?? null
              const ireFormatted = ireValue !== null ? ireValue.toFixed(2).replace('.', ',') : null
              const ireStatusKey = playerStat ? ireStatus(playerStat) : 'none'
              const pos = getPositionMeta(player.position)
              const isSelected = player.number === selectedPlayer?.number
              const initials = `${player.firstName.trim().charAt(0)}${player.lastName.trim().charAt(0)}`.toLocaleUpperCase('fr-FR')
              const cardMetrics = [
                { label: 'ENTRAÎN.', value: rate === null ? '—' : `${rate}%`, tone: rate !== null && rate >= 75 ? 'text-emerald-300' : 'text-amber-300' },
                { label: 'CONVOC.', value: playerStat?.callUpRate == null ? '—' : `${playerStat.callUpRate}%`, tone: 'text-sky-300' },
                { label: 'TITULAR', value: playerStat?.starts == null ? '—' : String(playerStat.starts), tone: 'text-white' },
                { label: 'BUTS', value: goals > 0 ? String(goals) : '—', tone: 'text-amber-300' },
                { label: 'PASSES', value: assists > 0 ? String(assists) : '—', tone: 'text-sky-300' },
                { label: 'IRE', value: ireFormatted ?? '—', tone: ireStatusKey === 'fair' ? 'text-emerald-300' : ireStatusKey === 'under' ? 'text-amber-300' : ireStatusKey === 'over' ? 'text-rose-300' : 'text-slate-200' },
              ]

              return (
                <button
                  key={player.number}
                  type="button"
                  aria-pressed={isSelected}
                  aria-label={`Fiche de ${player.firstName} ${player.lastName}, numéro ${player.number}, ${pos.label}`}
                  onClick={() => setSelectedNumber(player.number)}
                  className={`player-hex-card group relative flex min-h-[480px] w-full max-w-[330px] justify-self-center flex-col items-center overflow-hidden border px-5 pt-16 pb-11 text-center transition-all duration-200 active:scale-[0.98] ${
                    isSelected
                      ? 'border-amber-300 bg-[#1b2d5c] shadow-lg ring-2 ring-amber-300/50'
                      : 'border-amber-400/60 bg-[#111d3d] hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-lg'
                  }`}
                >
                  <div className="relative z-10 flex w-[82%] min-w-0 items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-col items-start gap-1.5">
                      <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl border border-amber-300/80 bg-[#0a142d] font-mono text-xl font-black text-amber-300 shadow-md ring-2 ring-amber-400/20">
                        {player.number}
                      </span>
                      <span className={`inline-flex max-w-full items-center gap-1 rounded-lg border px-2 py-1 text-[10px] leading-tight font-extrabold ${pos.badgeClass}`}>
                        <span aria-hidden="true">{pos.icon}</span>
                        <span>{pos.label}</span>
                      </span>
                    </div>
                    <ClubCrest className="mt-1 size-10 opacity-85 drop-shadow-md" />
                  </div>

                  <div className="player-card-portrait relative z-10 mt-1 flex h-40 w-[84%] items-end justify-center overflow-hidden border-b border-amber-300/60">
                    <ClubCrest className="absolute top-1/2 left-1/2 size-32 -translate-x-1/2 -translate-y-1/2 opacity-[0.13]" />
                    <UserRound aria-hidden="true" className="absolute bottom-0 size-36 text-white/20" strokeWidth={1.1} />
                    <span className="relative mb-2 font-mono text-5xl font-black tracking-wider text-amber-100 drop-shadow-lg">{initials || '⚽'}</span>
                  </div>

                  <div className="relative z-10 mt-3 w-[82%] min-w-0">
                    <h4 className="break-words text-xl font-black leading-tight text-white transition-colors group-hover:text-amber-200 sm:text-2xl">
                      {player.firstName}
                    </h4>
                    <p className="mt-0.5 break-words text-xs font-semibold uppercase tracking-[0.1em] text-slate-300 sm:text-sm">
                      {player.lastName}
                    </p>
                    {player.transferStatus && (
                      <span className="mt-1 inline-flex max-w-full break-words rounded-md bg-amber-400/15 px-2 py-0.5 text-[9px] font-bold text-amber-200">
                        {player.transferStatus}
                      </span>
                    )}
                  </div>

                  <div className="relative z-10 mt-auto mb-1 grid w-[82%] grid-cols-3 gap-x-2 gap-y-3 border-t border-amber-300/55 pt-4">
                    {cardMetrics.map((metric) => (
                      <div key={metric.label} className="min-w-0 text-center">
                        <p className="whitespace-nowrap text-[9px] font-extrabold uppercase tracking-[0.06em] text-slate-300">{metric.label}</p>
                        <p className={`mt-0.5 truncate font-mono text-base font-black ${metric.tone}`}>{metric.value}</p>
                      </div>
                    ))}
                  </div>
                </button>
              )
            })
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          2. VUE ACCORDÉON PAR POSTE (ALTERNATIVE CLASSIQUE)
      ───────────────────────────────────────────────────────────── */}
      {viewMode === 'accordion' && (
        <div className="flex flex-col gap-2.5 pt-1">
          {groups.map(([position, list]) => {
            const isExpanded = expandedPositions.has(position)
            const meta = getPositionMeta(position)
            const groupId = `position-accordion-${position}`

            return (
              <article key={position} className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  aria-controls={groupId}
                  onClick={() => {
                    setExpandedPositions((curr) => {
                      const next = new Set(curr)
                      if (next.has(position)) next.delete(position)
                      else next.add(position)
                      return next
                    })
                  }}
                  className="flex w-full items-center justify-between gap-2 bg-gradient-to-r from-[#172554] via-[#1e3a8a] to-[#172554] px-4 py-3 text-left text-white shadow-sm border-b border-amber-400/20"
                >
                  <span className="flex items-center gap-2.5">
                    <ChevronDown aria-hidden="true" className={`size-4 text-amber-300 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                    <span className="text-lg">{meta.icon}</span>
                    <span className="font-extrabold uppercase tracking-wide text-sm sm:text-base text-white">{meta.label}</span>
                  </span>
                  <span className="rounded-full bg-amber-400 px-2.5 py-0.5 font-mono text-xs font-black text-blue-950 shadow-sm">
                    {list.length}
                  </span>
                </button>

                {isExpanded && (
                  <div id={groupId} className="grid gap-2 p-2.5 sm:grid-cols-2">
                    {list.map((player) => {
                      const playerStat = stats.find((s) => s.number === player.number)
                      const goals = playerStat?.goals ?? 0
                      const rate = playerStat?.trainingRate ?? null
                      const ireValue = playerStat?.ire ?? null
                      const ireFormatted = ireValue !== null ? ireValue.toFixed(2).replace('.', ',') : null
                      const ireStatusKey = playerStat ? ireStatus(playerStat) : 'none'

                      return (
                        <button
                          key={player.number}
                          type="button"
                          onClick={() => setSelectedNumber(player.number)}
                          className="flex items-center justify-between gap-2.5 rounded-xl border border-border/70 bg-background/80 p-2.5 text-left transition-all hover:border-amber-400/60 hover:bg-muted/40"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[#172554] font-mono text-xs font-black text-amber-300 ring-1 ring-amber-400/40">
                              {player.number}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-xs sm:text-sm font-black text-foreground">{player.firstName}</p>
                              <p className="truncate text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{player.lastName}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {goals > 0 && <span className="font-mono text-xs font-black text-amber-500">⚽ {goals}</span>}
                            {rate !== null && (
                              <span
                                title={`Taux de présence aux entraînements : ${rate}%`}
                                className={`rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                                  rate >= 75
                                    ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300'
                                    : 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
                                }`}
                              >
                                🏋️ Entraînement {rate}%
                              </span>
                            )}
                            {ireFormatted !== null && (
                              <span
                                title={`Indice IRE : ${ireFormatted}`}
                                className={`rounded-md px-1.5 py-0.5 font-mono text-[10px] font-black ${
                                  ireStatusKey === 'fair'
                                    ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300'
                                    : ireStatusKey === 'under'
                                      ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
                                      : ireStatusKey === 'over'
                                        ? 'bg-red-500/15 text-red-800 dark:text-red-300'
                                        : 'bg-muted/60 text-muted-foreground'
                                }`}
                              >
                                IRE {ireFormatted}
                              </span>
                            )}
                            <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground" />
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}

      {/* Dialogue modal de la Fiche Joueur complète */}
      {selectedPlayer && selectedStats && (
        <dialog
          ref={playerDialogRef}
          aria-labelledby="selected-player-card-title"
          onClose={() => setSelectedNumber(null)}
          onClick={(event) => {
            if (event.target === event.currentTarget) event.currentTarget.close()
          }}
          className="fixed inset-0 m-auto max-h-[calc(100dvh-1.5rem)] w-[min(42rem,calc(100vw-1.5rem))] overflow-y-auto overscroll-contain rounded-3xl border-0 bg-transparent p-0 shadow-2xl backdrop:bg-[#07102a]/70"
        >
          <PlayerCard
            stats={selectedStats}
            player={selectedPlayer}
            trainingAttendance={trainingAttendance}
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
    </section>
  )
}
