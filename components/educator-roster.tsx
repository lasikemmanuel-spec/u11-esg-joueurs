'use client'

import { useState, useMemo } from 'react'
import { Search, Copy, Check, ShieldCheck, Users, Award, ChevronDown } from 'lucide-react'
import type { Player } from '@/lib/players'

const normalize = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr-FR')

const POSITION_ORDER = ['gard', 'déf', 'def', 'lat', 'cent', 'mil', 'ail', 'att', 'av']

const positionRank = (position: string | null) => {
  if (!position) return POSITION_ORDER.length
  const lower = position.toLowerCase()
  const index = POSITION_ORDER.findIndex((key) => lower.startsWith(key))
  return index === -1 ? POSITION_ORDER.length : index
}

export function EducatorRoster({ players }: { players: Player[] }) {
  const [query, setQuery] = useState('')
  const [expandedPositions, setExpandedPositions] = useState<Set<string>>(() => new Set())
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const groups = useMemo(() => {
    const searchTerms = normalize(query.trim()).split(/\s+/).filter(Boolean)
    const grouped = new Map<string, Player[]>()

    for (const player of players) {
      const firstName = normalize(player.firstName)
      const lastName = normalize(player.lastName)
      const matchesQuery = searchTerms.every(
        (term) => firstName.includes(term) || lastName.includes(term),
      )
      if (!matchesQuery) continue

      const position = player.position ?? 'Non renseigné'
      grouped.set(position, [...(grouped.get(position) ?? []), player])
    }

    return [...grouped.entries()]
      .sort(([a], [b]) => {
        if (a === 'Non renseigné') return 1
        if (b === 'Non renseigné') return -1
        return positionRank(a) - positionRank(b) || a.localeCompare(b, 'fr')
      })
      .map(([position, list]) => [
        position,
        list.sort((a, b) => a.lastName.localeCompare(b.lastName, 'fr') || a.firstName.localeCompare(b.firstName, 'fr')),
      ] as const)
  }, [players, query])

  const licensedCount = players.filter((p) => Boolean(p.licenseNumber)).length
  const filteredCount = groups.reduce((count, [, list]) => count + list.length, 0)
  const allGroupsExpanded = groups.length > 0 && groups.every(([position]) => expandedPositions.has(position))

  const handleCopy = (licenseNumber: string) => {
    navigator.clipboard.writeText(licenseNumber)
    setCopiedId(licenseNumber)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <section aria-labelledby="educator-roster-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent/60 bg-gradient-to-br from-secondary/40 via-card to-card p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-accent-foreground/80">
              <span>Consultation Éducateurs · ES Genech U11</span>
            </div>
            <h2 id="educator-roster-title" className="mt-0.5 text-xl font-black text-primary">
              Effectif &amp; Licences FFF
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full border border-accent/40 bg-card px-3 py-1.5 text-xs font-semibold">
            <Users className="size-3.5 text-primary" />
            <span>
              <strong className="text-primary">{filteredCount}</strong> joueur{filteredCount !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-accent/40 bg-card px-3 py-1.5 text-xs font-semibold">
            <Award className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>
              <strong className="text-emerald-600 dark:text-emerald-400">{licensedCount}</strong> licences
            </span>
          </div>
        </div>
      </div>

      <div className="relative max-w-xl">
        <label htmlFor="educator-search" className="sr-only">
          Rechercher par nom ou prénom
        </label>
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          id="educator-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher par nom, prénom ou les deux…"
          className="h-10 w-full rounded-xl border border-accent/40 bg-background pr-3 pl-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {groups.length === 0 ? (
        <p className="rounded-xl border border-accent/40 bg-card p-5 text-center text-sm text-muted-foreground">
          Aucun joueur ne correspond à votre recherche.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setExpandedPositions(allGroupsExpanded ? new Set() : new Set(groups.map(([position]) => position)))}
              className="rounded-lg px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {allGroupsExpanded ? 'Tout replier' : 'Tout déplier'}
            </button>
          </div>
          <div className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {groups.map(([position, list], groupIndex) => {
            const isExpanded = expandedPositions.has(position)
            const groupId = `educator-position-${groupIndex}`
            return (
            <section key={position} aria-label={`Poste : ${position}`} className="overflow-hidden rounded-xl border border-accent/50 bg-card shadow-sm">
              <h3>
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  aria-controls={isExpanded ? groupId : undefined}
                  onClick={() => setExpandedPositions((current) => {
                    const next = new Set(current)
                    if (next.has(position)) next.delete(position)
                    else next.add(position)
                    return next
                  })}
                  className="flex w-full items-center justify-between gap-2 bg-primary px-3 py-2.5 text-left text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <ChevronDown aria-hidden="true" className={`size-4 shrink-0 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                    <span className="truncate font-semibold">{position}</span>
                  </span>
                  <span className="rounded-full bg-accent px-2 py-0.5 font-mono text-xs font-bold text-accent-foreground">
                  {list.length}
                  </span>
                </button>
              </h3>
              {isExpanded && <ul id={groupId} className="divide-y divide-accent/25">
                {list.map((player) => {
                  const licenseNumber = player.licenseNumber
                  const isCopied = licenseNumber && copiedId === licenseNumber

                  return (
                    <li key={player.number} className="flex min-w-0 items-center justify-between gap-2 px-3 py-2.5 transition-colors hover:bg-muted/40">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-foreground">
                          {player.firstName} <span className="font-black uppercase tracking-wide text-primary">{player.lastName}</span>
                        </p>
                        <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                          {licenseNumber ?? 'Licence non renseignée'}
                        </p>
                      </div>
                      <div className="shrink-0">
                        {licenseNumber ? (
                          <button
                            type="button"
                            onClick={() => handleCopy(licenseNumber)}
                            className={`inline-flex size-8 items-center justify-center rounded-lg transition ${
                              isCopied
                                ? 'bg-emerald-600 text-white'
                                : 'bg-muted text-muted-foreground hover:bg-accent/40 hover:text-foreground'
                            }`}
                            title="Copier le numéro de licence"
                            aria-label={`Copier la licence de ${player.firstName} ${player.lastName}`}
                          >
                            {isCopied ? (
                              <Check className="size-4" />
                            ) : (
                              <Copy className="size-4" />
                            )}
                          </button>
                        ) : (
                          <span className="sr-only">Aucune licence à copier</span>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>}
            </section>
          )})}
          </div>
        </div>
      )}
    </section>
  )
}
