'use client'

import { useMemo, useState } from 'react'
import { ArrowDownUp, Search } from 'lucide-react'
import { ageOn, isDateSuspicious, type Player } from '@/lib/players'

type SortKey = 'number' | 'lastName' | 'firstName' | 'birthDate'

const toSortableDate = (date: string | null) =>
  date ? date.split('/').reverse().join('') : '99999999'

export function RosterTable({ players }: { players: Player[] }) {
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('number')
  const [ascending, setAscending] = useState(true)

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q
      ? players.filter((p) => `${p.firstName} ${p.lastName}`.toLowerCase().includes(q))
      : players
    return [...filtered].sort((a, b) => {
      let result: number
      if (sortKey === 'number') result = a.number - b.number
      else if (sortKey === 'birthDate') result = toSortableDate(a.birthDate).localeCompare(toSortableDate(b.birthDate))
      else result = a[sortKey].localeCompare(b[sortKey], 'fr')
      return ascending ? result : -result
    })
  }, [players, query, sortKey, ascending])

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setAscending((v) => !v)
    else {
      setSortKey(key)
      setAscending(true)
    }
  }

  const columns: { key: SortKey; label: string; className?: string }[] = [
    { key: 'number', label: 'N°', className: 'w-14' },
    { key: 'lastName', label: 'Nom' },
    { key: 'firstName', label: 'Prénom' },
    { key: 'birthDate', label: 'Naissance' },
  ]

  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="font-semibold">Effectif</h2>
          <p className="text-sm text-muted-foreground">
            {visible.length} joueur{visible.length > 1 ? 's' : ''} affiché{visible.length > 1 ? 's' : ''}
          </p>
        </div>
        <label className="relative md:w-72">
          <span className="sr-only">Rechercher un joueur</span>
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un joueur…"
            className="h-10 w-full rounded-lg border bg-background pr-3 pl-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              {columns.map((c) => (
                <th key={c.key} scope="col" className={`py-2.5 pr-3 font-medium ${c.className ?? ''}`} aria-sort={sortKey === c.key ? (ascending ? 'ascending' : 'descending') : 'none'}>
                  <button
                    type="button"
                    onClick={() => toggleSort(c.key)}
                    className="inline-flex items-center gap-1.5 rounded hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    {c.label}
                    <ArrowDownUp aria-hidden="true" className={sortKey === c.key ? 'size-3.5 text-primary' : 'size-3.5 opacity-40'} />
                  </button>
                </th>
              ))}
              <th scope="col" className="py-2.5 pr-3 font-medium">Âge</th>
              <th scope="col" className="py-2.5 pr-3 font-medium">Poste</th>
              <th scope="col" className="py-2.5 font-medium">Muté</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((p) => {
              const suspicious = isDateSuspicious(p)
              const age = suspicious ? null : ageOn(p.birthDate)
              return (
                <tr key={p.number} className="border-b last:border-0 hover:bg-muted/50">
                  <td className="py-3 pr-3 font-mono text-muted-foreground">{p.number}</td>
                  <td className="py-3 pr-3 font-semibold uppercase tracking-wide">{p.lastName}</td>
                  <td className="py-3 pr-3">{p.firstName}</td>
                  <td className="py-3 pr-3 font-mono">
                    {p.birthDate ? (
                      <span className={suspicious ? 'rounded bg-accent px-1.5 py-0.5 text-accent-foreground' : ''}>
                        {p.birthDate}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="py-3 pr-3 font-mono">{age !== null ? `${age} ans` : '—'}</td>
                  <td className="py-3 pr-3">{p.position ?? <span className="text-muted-foreground">—</span>}</td>
                  <td className="py-3">{p.transferStatus ?? <span className="text-muted-foreground">—</span>}</td>
                </tr>
              )
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={7} className="py-10 text-center text-muted-foreground">
                  Aucun joueur ne correspond à « {query} ».
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
