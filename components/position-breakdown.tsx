'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, LayoutGrid, ListFilter, Search, Sparkles } from 'lucide-react'
import { PlayerCard } from '@/components/player-stats'
import { ClubCrest } from '@/components/club-crest'
import { countCancelledCallupsForPlayer } from '@/lib/cancelled-match-callups'
import type { Convocation } from '@/lib/convocations'
import type { TeamMatchResults } from '@/lib/match-results'
import type { PublicPlayer } from '@/lib/players'
import type { PlayerStats } from '@/lib/stats'
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
        <div className="flex items-center gap-1 rounded-xl border border-border/70 bg-muted/60 p-1">
          <button
            type="button"
            aria-pressed={viewMode === 'cards'}
            onClick={() => setViewMode('cards')}
            title="Vue Cartes Collector"
            className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold transition-all ${
              viewMode === 'cards'
                ? 'border border-amber-400/40 bg-gradient-to-r from-[#172554] to-blue-900 text-amber-300 shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
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
                : 'text-muted-foreground hover:text-foreground'
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
          className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none px-0.5 scroll-smooth"
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
                    : 'border border-border/70 bg-muted/70 text-muted-foreground hover:bg-card hover:text-foreground'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                <span className={`ml-0.5 rounded-full px-1.5 py-0.2 text-[10px] font-black ${
                  isActive ? 'bg-amber-400 text-blue-950' : 'bg-background text-muted-foreground'
                }`}>
                  {tab.count}
                </span>
              </button>
            )
          })}
        </nav>

        {/* Bouton indicateur de défilement droit (avec mention et flèche animée) */}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => scrollNav('right')}
            aria-label="Faire défiler les postes vers la droite"
            className="absolute right-0 z-20 flex items-center gap-1 rounded-full border border-amber-400 bg-gradient-to-r from-[#172554] via-[#1e3a8a] to-[#172554] py-1 pl-2.5 pr-1.5 text-[10px] font-black text-amber-300 shadow-xl ring-2 ring-amber-400/50 motion-safe:animate-pulse transition-all active:scale-95"
          >
            <span>Postes</span>
            <ChevronRight aria-hidden="true" className="size-3.5" />
          </button>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          1. VUE GALERIE DE CARTES COLLECTOR EA FC (OPTION 2)
      ───────────────────────────────────────────────────────────── */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 pt-1">
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
              const pos = getPositionMeta(player.position)
              const isSelected = player.number === selectedPlayer?.number

              return (
                <button
                  key={player.number}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedNumber(player.number)}
                  className={`group relative flex min-h-[148px] sm:min-h-[156px] flex-col justify-between overflow-hidden rounded-2xl border-2 p-3 text-left transition-all duration-200 active:scale-[0.98] ${
                    isSelected
                      ? 'border-amber-400 bg-amber-400/15 shadow-lg'
                      : 'border-amber-400/30 bg-gradient-to-b from-[#172554]/10 via-card to-card hover:-translate-y-1 hover:border-amber-400 hover:shadow-xl dark:from-[#172554]/40 dark:via-card/90 dark:to-card'
                  }`}
                >
                  {/* Halo d'ambiance collector */}
                  <div className="pointer-events-none absolute -top-10 -right-10 size-24 rounded-full bg-amber-400/10 blur-xl transition-all group-hover:bg-amber-400/25" />

                  {/* En-tête de la carte : Numéro maillot + Badge Poste */}
                  <div className="flex items-start justify-between gap-1 pb-1.5">
                    {/* Écusson Numéro */}
                    <div className="flex size-9 shrink-0 flex-col items-center justify-center rounded-xl border border-amber-400 bg-gradient-to-br from-[#172554] to-blue-950 text-white shadow-md ring-1 ring-amber-400/40">
                      <span className="font-mono text-sm font-black text-amber-300 leading-none">
                        {player.number}
                      </span>
                    </div>

                    {/* Badge Poste avec Icône */}
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black shadow-sm ${pos.badgeClass}`}>
                      <span>{pos.icon}</span>
                      <span className="truncate max-w-16">{pos.label}</span>
                    </span>
                  </div>

                  {/* Corps : Nom & Prénom du joueur (jamais coupé, 2 lignes si besoin) */}
                  <div className="min-w-0 py-1.5 flex-1 flex flex-col justify-center">
                    <h4 className="line-clamp-2 leading-tight text-xs sm:text-sm font-black uppercase tracking-wide text-foreground break-words group-hover:text-[#172554] dark:group-hover:text-amber-300">
                      {player.lastName}
                    </h4>
                    <p className="truncate text-[11px] sm:text-xs font-semibold text-muted-foreground pt-0.5">
                      {player.firstName}
                    </p>
                  </div>

                  {/* Pied de la carte : Badges Stats Clés */}
                  <div className="mt-2 flex flex-wrap items-center gap-1 border-t border-border/50 pt-2 text-[10px]">
                    {goals > 0 && (
                      <span className="inline-flex items-center gap-0.5 rounded-full border border-amber-400/60 bg-amber-400/20 px-1.5 py-0.5 font-mono font-black text-amber-900 dark:text-amber-200">
                        ⚽ {goals}
                      </span>
                    )}
                    {assists > 0 && (
                      <span className="inline-flex items-center gap-0.5 rounded-full border border-blue-400/40 bg-blue-500/15 px-1.5 py-0.5 font-mono font-black text-blue-900 dark:text-blue-200">
                        🎯 {assists}
                      </span>
                    )}
                    {rate !== null && (
                      <span
                        className={`inline-flex items-center rounded-full px-1.5 py-0.5 font-mono font-bold ${
                          rate >= 75
                            ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300'
                            : 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
                        }`}
                      >
                        {rate}%
                      </span>
                    )}
                    {player.transferStatus && (
                      <span className="rounded-md border border-amber-400/40 bg-amber-400/20 px-1 py-0.5 text-[9px] font-bold text-amber-900 dark:text-amber-200">
                        {player.transferStatus}
                      </span>
                    )}
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
                              <p className="truncate text-xs font-black uppercase text-foreground">{player.lastName}</p>
                              <p className="truncate text-[11px] font-medium text-muted-foreground">{player.firstName}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {goals > 0 && <span className="font-mono text-xs font-black text-amber-500">⚽ {goals}</span>}
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
