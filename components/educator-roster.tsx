'use client'

import { useState, useMemo } from 'react'
import { Search, Copy, Check, ShieldCheck, Filter, Users, Award } from 'lucide-react'
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

type SortField = 'number' | 'name' | 'position'

export function EducatorRoster({ players }: { players: Player[] }) {
  const [query, setQuery] = useState('')
  const [selectedPosition, setSelectedPosition] = useState('all')
  const [sortBy, setSortBy] = useState<SortField>('name')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const positions = useMemo(() => {
    const set = new Set(players.map((p) => p.position ?? 'Non renseigné'))
    return [...set].sort((a, b) => {
      if (a === 'Non renseigné') return 1
      if (b === 'Non renseigné') return -1
      return positionRank(a) - positionRank(b) || a.localeCompare(b, 'fr')
    })
  }, [players])

  const filtered = useMemo(() => {
    const q = normalize(query.trim())
    return players
      .filter((p) => {
        const matchesQuery =
          !q ||
          normalize(`${p.firstName} ${p.lastName}`).includes(q) ||
          normalize(p.lastName).includes(q) ||
          normalize(p.firstName).includes(q) ||
          (p.licenseNumber && p.licenseNumber.includes(q))
        const matchesPosition =
          selectedPosition === 'all' || (p.position ?? 'Non renseigné') === selectedPosition
        return matchesQuery && matchesPosition
      })
      .sort((a, b) => {
        if (sortBy === 'number') return a.number - b.number
        if (sortBy === 'position') {
          return positionRank(a.position) - positionRank(b.position) || a.lastName.localeCompare(b.lastName, 'fr')
        }
        return a.lastName.localeCompare(b.lastName, 'fr') || a.firstName.localeCompare(b.firstName, 'fr')
      })
  }, [players, query, selectedPosition, sortBy])

  const licensedCount = players.filter((p) => Boolean(p.licenseNumber)).length

  const handleCopy = (licenseNumber: string) => {
    navigator.clipboard.writeText(licenseNumber)
    setCopiedId(licenseNumber)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <section aria-labelledby="educator-roster-title" className="flex flex-col gap-5">
      {/* En-tête */}
      <div className="flex flex-col gap-3 rounded-2xl border border-accent/60 bg-gradient-to-br from-secondary/40 via-card to-card p-5 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-accent-foreground/80">
            <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
            <span>Consultation Éducateurs · ES Genech U11</span>
          </div>
          <h2 id="educator-roster-title" className="mt-1 text-2xl font-black text-primary">
            Effectif &amp; Licences FFF
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Liste complète avec nom, prénom, poste et numéro de licence pour la gestion des matchs et de la FMI.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-accent/40 bg-card px-3 py-2 text-xs font-semibold shadow-xs">
            <Users className="size-4 text-primary" />
            <span>
              <strong className="text-primary">{players.length}</strong> joueurs
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-accent/40 bg-card px-3 py-2 text-xs font-semibold shadow-xs">
            <Award className="size-4 text-emerald-600 dark:text-emerald-400" />
            <span>
              <strong className="text-emerald-600 dark:text-emerald-400">{licensedCount}</strong> licences
            </span>
          </div>
        </div>
      </div>

      {/* Barre de recherche et filtres */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-12">
        <div className="relative sm:col-span-1 lg:col-span-5">
          <label htmlFor="educator-search" className="sr-only">
            Rechercher par nom, prénom ou n° de licence
          </label>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="educator-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher nom, prénom, n° de licence…"
            className="h-10 w-full rounded-xl border border-accent/40 bg-background pr-3 pl-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="sm:col-span-1 lg:col-span-4">
          <label htmlFor="educator-position" className="sr-only">
            Filtrer par poste
          </label>
          <div className="relative">
            <Filter className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <select
              id="educator-position"
              value={selectedPosition}
              onChange={(e) => setSelectedPosition(e.target.value)}
              className="h-10 w-full rounded-xl border border-accent/40 bg-background pr-3 pl-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="all">Tous les postes ({players.length})</option>
              {positions.map((pos) => {
                const count = players.filter((p) => (p.position ?? 'Non renseigné') === pos).length
                return (
                  <option key={pos} value={pos}>
                    {pos} ({count})
                  </option>
                )
              })}
            </select>
          </div>
        </div>

        <div className="sm:col-span-2 lg:col-span-3 flex items-center justify-end gap-1.5">
          <span className="text-xs text-muted-foreground">Trier par :</span>
          <button
            type="button"
            onClick={() => setSortBy('name')}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
              sortBy === 'name'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'bg-muted text-muted-foreground hover:bg-background'
            }`}
          >
            Nom
          </button>
          <button
            type="button"
            onClick={() => setSortBy('number')}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
              sortBy === 'number'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'bg-muted text-muted-foreground hover:bg-background'
            }`}
          >
            N°
          </button>
          <button
            type="button"
            onClick={() => setSortBy('position')}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
              sortBy === 'position'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'bg-muted text-muted-foreground hover:bg-background'
            }`}
          >
            Poste
          </button>
        </div>
      </div>

      {/* Tableau des joueurs pour éducateurs */}
      <div className="overflow-hidden rounded-2xl border border-accent/60 bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-accent/40 bg-muted/60 text-xs font-bold uppercase tracking-wider text-primary">
              <tr>
                <th scope="col" className="w-16 px-4 py-3 text-center">
                  N°
                </th>
                <th scope="col" className="px-4 py-3">
                  Nom
                </th>
                <th scope="col" className="px-4 py-3">
                  Prénom
                </th>
                <th scope="col" className="px-4 py-3">
                  Poste
                </th>
                <th scope="col" className="px-4 py-3">
                  N° de Licence FFF
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-accent/20">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">
                    Aucun joueur ne correspond à vos critères de recherche.
                  </td>
                </tr>
              ) : (
                filtered.map((player) => {
                  const isCopied = player.licenseNumber && copiedId === player.licenseNumber

                  return (
                    <tr
                      key={player.number}
                      className="transition-colors hover:bg-muted/40"
                    >
                      <td className="px-4 py-3 text-center font-mono font-bold text-muted-foreground">
                        {player.number}
                      </td>
                      <td className="px-4 py-3 font-black uppercase tracking-wide text-primary">
                        {player.lastName}
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">
                        {player.firstName}
                      </td>
                      <td className="px-4 py-3">
                        {player.position ? (
                          <span className="inline-flex items-center rounded-md border border-accent/40 bg-accent/20 px-2 py-0.5 text-xs font-semibold text-accent-foreground">
                            {player.position}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Non renseigné</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {player.licenseNumber ? (
                          <span className="font-mono text-sm font-bold tracking-wider text-emerald-700 dark:text-emerald-400">
                            {player.licenseNumber}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">En attente / Non renseigné</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {player.licenseNumber ? (
                          <button
                            type="button"
                            onClick={() => handleCopy(player.licenseNumber!)}
                            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                              isCopied
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-muted text-muted-foreground hover:bg-accent/40 hover:text-foreground'
                            }`}
                            title="Copier le numéro de licence"
                          >
                            {isCopied ? (
                              <>
                                <Check className="size-3.5" />
                                <span>Copié !</span>
                              </>
                            ) : (
                              <>
                                <Copy className="size-3.5" />
                                <span>Copier</span>
                              </>
                            )}
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

