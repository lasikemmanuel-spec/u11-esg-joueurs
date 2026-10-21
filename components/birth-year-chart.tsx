import type { Player } from '@/lib/players'

export function BirthYearChart({ players }: { players: Player[] }) {
  const counts = new Map<string, number>()
  for (const p of players) {
    const key = p.birthYear ? String(p.birthYear) : 'Non renseignée'
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const entries = [...counts.entries()].sort(([a], [b]) => {
    if (a === 'Non renseignée') return 1
    if (b === 'Non renseignée') return -1
    return Number(a) - Number(b)
  })
  const max = Math.max(...entries.map(([, c]) => c), 1)

  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-5">
      <div>
        <h2 className="font-semibold">Répartition par année de naissance</h2>
        <p className="text-sm text-muted-foreground">Nombre de joueurs par millésime</p>
      </div>
      <ul className="flex flex-col gap-3">
        {entries.map(([year, count]) => (
          <li key={year} className="flex items-center gap-3">
            <span className="w-28 shrink-0 font-mono text-sm text-muted-foreground">{year}</span>
            <div className="h-7 flex-1 overflow-hidden rounded-md bg-muted">
              <div
                className={
                  year === 'Non renseignée' ? 'h-full rounded-md bg-accent' : 'h-full rounded-md bg-primary'
                }
                style={{ width: `${(count / max) * 100}%` }}
              />
            </div>
            <span className="w-8 shrink-0 text-right font-mono text-sm font-semibold">{count}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
