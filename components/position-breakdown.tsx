import type { Player } from '@/lib/players'

const POSITION_ORDER = ['gard', 'déf', 'def', 'lat', 'cent', 'mil', 'ail', 'att', 'av']

const positionRank = (position: string) => {
  const lower = position.toLowerCase()
  const index = POSITION_ORDER.findIndex((key) => lower.startsWith(key))
  return index === -1 ? POSITION_ORDER.length : index
}

export function PositionBreakdown({ players }: { players: Player[] }) {
  const groups = new Map<string, Player[]>()
  for (const player of players) {
    const key = player.position ?? 'Non renseigné'
    groups.set(key, [...(groups.get(key) ?? []), player])
  }

  const sorted = [...groups.entries()].sort(([a], [b]) => {
    if (a === 'Non renseigné') return 1
    if (b === 'Non renseigné') return -1
    return positionRank(a) - positionRank(b) || a.localeCompare(b, 'fr')
  })

  return (
    <section
      aria-labelledby="positions-title"
      className="flex flex-col gap-4 rounded-xl border border-accent/60 bg-gradient-to-br from-secondary/30 via-card to-card p-5 shadow-sm"
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/70">ES Genech</p>
        <h2 id="positions-title" className="font-semibold text-primary">Effectif par poste</h2>
        <p className="text-sm text-muted-foreground">
          {sorted.length} poste{sorted.length > 1 ? 's' : ''} · {players.length} joueurs
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {sorted.map(([position, list]) => (
          <article key={position} className="flex flex-col gap-3 overflow-hidden rounded-lg border border-accent/50 bg-card shadow-sm">
            <header className="flex items-center justify-between gap-2 bg-primary px-4 py-3 text-primary-foreground">
              <h3 className="font-semibold">{position}</h3>
              <span className="rounded-full bg-accent px-2.5 py-0.5 font-mono text-xs font-bold text-accent-foreground">
                {list.length}
              </span>
            </header>
            <ul className="flex flex-col divide-y divide-accent/30 px-4 text-sm">
              {[...list]
                .sort((a, b) => a.lastName.localeCompare(b.lastName, 'fr'))
                .map((p) => (
                  <li key={p.number} className="flex items-center gap-3 py-2">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary font-mono text-xs font-semibold text-primary">{p.number}</span>
                    <span className="truncate">
                      <span className="font-semibold uppercase tracking-wide">{p.lastName}</span> {p.firstName}
                    </span>
                    {p.transferStatus && (
                      <span className="ml-auto shrink-0 rounded bg-accent px-1.5 py-0.5 text-xs font-medium text-accent-foreground">
                        {p.transferStatus}
                      </span>
                    )}
                  </li>
                ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  )
}
