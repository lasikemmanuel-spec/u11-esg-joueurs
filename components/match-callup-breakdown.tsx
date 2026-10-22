import type { Convocation } from '@/lib/convocations'

const CALLED_STATUSES = new Set(['called', 'calledAbsent'])

function sortKey(date: string) {
  return date.localeCompare(date, 'fr', { numeric: true, sensitivity: 'base' })
}

export function MatchCallupBreakdown({ convocations }: { convocations: Convocation[] }) {
  const byDate = new Map<string, { equipe1: number; equipe2: number }>()

  for (const player of convocations) {
    for (const match of player.matches) {
      if (!CALLED_STATUSES.has(match.status) || !match.team) continue

      const current = byDate.get(match.date) ?? { equipe1: 0, equipe2: 0 }
      if (match.team === 'E1') current.equipe1 += 1
      if (match.team === 'E2') current.equipe2 += 1
      byDate.set(match.date, current)
    }
  }

  const rows = [...byDate.entries()].sort(([a], [b]) => sortKey(a) - sortKey(b))

  if (rows.length === 0) {
    return (
      <section className="rounded-xl border bg-card p-5">
        <h2 className="font-semibold">Convoqués par samedi</h2>
        <p className="mt-2 text-sm text-muted-foreground">Aucune donnée de convocation disponible.</p>
      </section>
    )
  }

  return (
    <section aria-labelledby="match-callups-title" className="flex flex-col gap-4 rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 id="match-callups-title" className="font-semibold">Convoqués par samedi</h2>
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
          {rows.length} samedi{rows.length > 1 ? 's' : ''}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th scope="col" className="py-2.5 pr-4 font-medium">Samedi</th>
              <th scope="col" className="py-2.5 pr-4 font-medium">Équipe 1</th>
              <th scope="col" className="py-2.5 font-medium">Équipe 2</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([date, values]) => (
              <tr key={date} className="border-b last:border-0">
                <td className="py-2.5 pr-4 font-medium">{date}</td>
                <td className="py-2.5 pr-4 font-mono tabular-nums">{values.equipe1}</td>
                <td className="py-2.5 font-mono tabular-nums">{values.equipe2}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
