'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDownUp, Search } from 'lucide-react'
import { ireStatus, type IreStatus, type PlayerStats as Stats } from '@/lib/stats'
import type { Convocation, MatchStatus } from '@/lib/convocations'

const MATCH_STYLES: Record<MatchStatus, { label: string; className: string }> = {
  called: { label: 'Convoqué', className: 'bg-primary text-primary-foreground' },
  calledAbsent: { label: 'Convoqué absent', className: 'bg-amber-500 text-white' },
  present: { label: 'Présent', className: 'bg-emerald-600 text-white' },
  absent: { label: 'Absent', className: 'bg-muted-foreground/25 text-foreground' },
  injured: { label: 'Blessé', className: 'bg-red-600 text-white' },
  notCalled: { label: 'Non convoqué', className: 'border border-dashed text-muted-foreground' },
  unknown: { label: '?', className: 'bg-muted text-muted-foreground' },
}

function RateRow({
  label,
  rate,
  count,
  barClass,
}: {
  label: string
  rate: number | null
  count: number | null
  barClass: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span>{label}</span>
        <span className="flex items-baseline gap-2">
          {count !== null && <span className="text-xs text-muted-foreground">{count} match{count > 1 ? 's' : ''}</span>}
          <span className="font-mono font-semibold">{rate !== null ? `${rate}%` : '—'}</span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${barClass}`} style={{ width: `${Math.min(rate ?? 0, 100)}%` }} />
      </div>
    </div>
  )
}

function SaturdaySection({ convocation }: { convocation: Convocation }) {
  return (
    <div className="flex flex-col gap-3 border-t pt-4">
      <h4 className="text-sm font-semibold">Disponibilités du samedi</h4>
      <RateRow label="Présence le samedi" rate={convocation.presentRate} count={convocation.presentCount} barClass="bg-primary" />
      <RateRow label="Absence le samedi" rate={convocation.absentRate} count={convocation.absentCount} barClass="bg-amber-500" />
      <RateRow label="Blessé" rate={convocation.injuredRate} count={convocation.injuredCount} barClass="bg-red-600" />
      <RateRow label="Non convoqué" rate={convocation.notCalledRate} count={convocation.notCalledCount} barClass="bg-muted-foreground" />

      {convocation.matches.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">Historique des matchs</p>
          <ol className="flex flex-wrap gap-1.5">
            {convocation.matches.map((m) => {
              const style = MATCH_STYLES[m.status]
              return (
                <li
                  key={m.date}
                  title={`${m.date} : ${m.raw}`}
                  className={`flex min-w-12 flex-col items-center rounded-md px-1.5 py-1 text-[11px] leading-tight ${style.className}`}
                >
                  <span className="font-mono">{m.date}</span>
                  <span className="font-semibold">{m.status === 'called' ? (m.team ?? 'Conv.') : style.label.split(' ')[0]}</span>
                  <span className="sr-only">{style.label}</span>
                </li>
              )
            })}
          </ol>
          <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {(['called', 'present', 'absent', 'injured', 'notCalled'] as const).map((s) => (
              <li key={s} className="flex items-center gap-1">
                <span aria-hidden="true" className={`size-2.5 rounded-sm ${MATCH_STYLES[s].className}`} />
                {MATCH_STYLES[s].label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

type SortKey = keyof Omit<Stats, 'name'> | 'name'

const IRE_STYLES: Record<IreStatus, { label: string; className: string }> = {
  fair: { label: 'Juste', className: 'bg-emerald-100 text-emerald-800' },
  under: { label: 'Sous-convoqué', className: 'bg-amber-100 text-amber-900' },
  over: { label: 'Sur-convoqué', className: 'bg-red-100 text-red-800' },
  none: { label: 'Non convoqué', className: 'bg-muted text-muted-foreground' },
}

const columns: { key: SortKey; label: string }[] = [
  { key: 'number', label: 'N°' },
  { key: 'name', label: 'Joueur' },
  { key: 'trainingRate', label: 'Présence' },
  { key: 'callUpRate', label: 'Taux conv.' },
  { key: 'matchesCalled', label: 'Conv.' },
  { key: 'minutes', label: 'Min.' },
  { key: 'ire', label: 'IRE' },
]

const display = (v: number | null) => (v === null ? '—' : v)

function RateBar({ value, label }: { value: number | null; label: string }) {
  if (value === null) return <span className="text-muted-foreground">—</span>
  return (
    <div className="flex items-center gap-2">
      <div
        role="meter"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1.5 w-10 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={value >= 80 ? 'h-full bg-primary' : value >= 50 ? 'h-full bg-amber-500' : 'h-full bg-red-600'}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
      <span className="w-10 font-mono tabular-nums">{value}%</span>
    </div>
  )
}

function IreBadge({ stats }: { stats: Stats }) {
  const status = ireStatus(stats)
  const style = IRE_STYLES[status]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ${style.className}`}>
      <span className="font-mono">{stats.ire !== null && status !== 'none' ? stats.ire.toFixed(2).replace('.', ',') : '—'}</span>
      <span className="sr-only">{style.label}</span>
    </span>
  )
}

function PlayerCard({ stats, convocation }: { stats: Stats; convocation?: Convocation }) {
  const status = IRE_STYLES[ireStatus(stats)]
  const minutesPerMatch = stats.matchesCalled ? Math.round((stats.minutes ?? 0) / stats.matchesCalled) : null
  const tiles = [
    { label: 'Matchs convoqué', value: display(stats.matchesCalled) },
    { label: 'Titulaire', value: display(stats.starts) },
    { label: 'Remplaçant', value: display(stats.subs) },
    { label: 'Minutes jouées', value: display(stats.minutes) },
    { label: 'Minutes / match', value: display(minutesPerMatch) },
    { label: 'Buts', value: display(stats.goals) },
    { label: 'Passes décisives', value: display(stats.assists) },
    { label: 'Indice IRE', value: stats.ire !== null ? stats.ire.toFixed(2).replace('.', ',') : '—' },
  ]

  return (
    <div className="flex flex-col gap-5 rounded-xl border bg-card p-5" aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary font-mono text-lg font-semibold text-primary-foreground">
            {stats.number}
          </span>
          <div>
            <h3 className="text-lg font-semibold">{stats.name}</h3>
            <p className="text-sm text-muted-foreground">Fiche joueur</p>
          </div>
        </div>
        <span className={`rounded-md px-2 py-1 text-xs font-medium ${status.className}`}>{status.label}</span>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-sm">
            <span>Taux de présence entraînement</span>
            <span className="font-mono font-semibold">{stats.trainingRate !== null ? `${stats.trainingRate}%` : '—'}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary" style={{ width: `${Math.min(stats.trainingRate ?? 0, 100)}%` }} />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-sm">
            <span>Taux de convocation</span>
            <span className="font-mono font-semibold">{stats.callUpRate !== null ? `${stats.callUpRate}%` : '—'}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary" style={{ width: `${Math.min(stats.callUpRate ?? 0, 100)}%` }} />
          </div>
        </div>
      </div>

      {convocation && <SaturdaySection convocation={convocation} />}

      <dl className="grid grid-cols-2 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className="flex flex-col gap-0.5 rounded-lg bg-muted/60 p-3">
            <dt className="text-xs text-muted-foreground">{t.label}</dt>
            <dd className="font-mono text-xl font-semibold">{t.value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-muted-foreground">
        IRE = taux de convocation ÷ taux de présence. Entre 1,00 et 1,10 : justement convoqué.
      </p>
    </div>
  )
}

export function PlayerStats({ players, convocations }: { players: Stats[]; convocations: Convocation[] }) {
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('number')
  const [ascending, setAscending] = useState(true)
  const [selected, setSelected] = useState<number | null>(players[0]?.number ?? null)
  const playerCardRef = useRef<HTMLDivElement>(null)
  const previousSelected = useRef(selected)

  useEffect(() => {
    const selectionChanged = previousSelected.current !== selected
    previousSelected.current = selected

    if (!selectionChanged || selected === null || window.matchMedia('(min-width: 1280px)').matches) return

    const frame = window.requestAnimationFrame(() => {
      playerCardRef.current?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'start',
      })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [selected])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q ? players.filter((p) => p.name.toLowerCase().includes(q) || String(p.number) === q) : players
    return [...filtered].sort((a, b) => {
      const result =
        sortKey === 'name'
          ? a.name.localeCompare(b.name, 'fr')
          : (a[sortKey] ?? -Infinity) - (b[sortKey] ?? -Infinity)
      return ascending ? result : -result
    })
  }, [players, query, sortKey, ascending])

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setAscending((v) => !v)
    else {
      setSortKey(key)
      setAscending(key === 'number' || key === 'name')
    }
  }

  const current = players.find((p) => p.number === selected)

  return (
    <section aria-labelledby="player-stats-title" className="grid gap-4 md:gap-6 xl:grid-cols-[1fr_320px]">
      <div className="flex min-w-0 flex-col gap-4 rounded-xl border bg-card p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 id="player-stats-title" className="font-semibold">Statistiques des joueurs</h2>
            <p className="text-sm text-muted-foreground">Touchez un joueur pour afficher sa fiche. Triez avec les en-têtes.</p>
          </div>
          <label className="relative md:w-64">
            <span className="sr-only">Rechercher un joueur</span>
            <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nom ou numéro…"
              className="h-10 w-full rounded-lg border bg-background pr-3 pl-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                {columns.map((c) => (
                  <th
                    key={c.key}
                    scope="col"
                    className="py-2.5 pr-2 font-medium whitespace-nowrap"
                    aria-sort={sortKey === c.key ? (ascending ? 'ascending' : 'descending') : 'none'}
                  >
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
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => {
                const isSelected = p.number === selected
                return (
                  <tr
                    key={p.number}
                    onClick={() => setSelected(p.number)}
                    aria-selected={isSelected}
                    className={`cursor-pointer border-b last:border-0 ${isSelected ? 'bg-primary/10' : 'hover:bg-muted/50'}`}
                  >
                    <td className="py-2.5 pr-2 font-mono text-muted-foreground">{p.number}</td>
                    <td className="py-2.5 pr-2 font-medium whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setSelected(p.number)}
                        className="rounded text-left hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      >
                        {p.name}
                      </button>
                    </td>
                    <td className="py-2.5 pr-2"><RateBar value={p.trainingRate} label={`Présence de ${p.name}`} /></td>
                    <td className="py-2.5 pr-2"><RateBar value={p.callUpRate} label={`Convocation de ${p.name}`} /></td>
                    <td className="py-2.5 pr-2 font-mono tabular-nums">{display(p.matchesCalled)}</td>
                    <td className="py-2.5 pr-2 font-mono tabular-nums">{display(p.minutes)}</td>
                    <td className="py-2.5"><IreBadge stats={p} /></td>
                  </tr>
                )
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="py-10 text-center text-muted-foreground">
                    Aucun joueur ne correspond à « {query} ».
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div ref={playerCardRef} className="scroll-mt-4 xl:sticky xl:top-6 xl:self-start">
        {current ? (
          <PlayerCard stats={current} convocation={convocations.find((c) => c.number === current.number)} />
        ) : (
          <div className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">Sélectionnez un joueur.</div>
        )}
      </div>
    </section>
  )
}
