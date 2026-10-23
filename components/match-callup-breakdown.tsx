import type { Convocation } from '@/lib/convocations'

const CALLED_STATUSES = new Set(['called', 'calledAbsent', 'present'])
const PRESENT_STATUSES = new Set(['present'])

function sortKey(date: string) {
  return date.localeCompare(date, 'fr', { numeric: true, sensitivity: 'base' })
}

export function MatchCallupBreakdown({ convocations }: { convocations: Convocation[] }) {
  const byDate = new Map<string, { equipe1: number; equipe2: number; presents: number; convoques: number }>()

  for (const player of convocations) {
    for (const match of player.matches) {
      if (!match.date) continue

      const current = byDate.get(match.date) ?? { equipe1: 0, equipe2: 0, presents: 0, convoques: 0 }

      if (match.team === 'E1') current.equipe1 += 1
      if (match.team === 'E2') current.equipe2 += 1
      if (CALLED_STATUSES.has(match.status)) current.convoques += 1
      if (PRESENT_STATUSES.has(match.status)) current.presents += 1

      byDate.set(match.date, current)
    }
  }

  const rows = [...byDate.entries()].sort(([a], [b]) => sortKey(a) - sortKey(b))

  if (rows.length === 0) {
    return (
      <section className="rounded-xl border bg-card p-5">
        <h2 className="font-semibold">Historique des matchs</h2>
        <p className="mt-2 text-sm text-muted-foreground">Aucune donnée de convocation disponible.</p>
      </section>
    )
  }

  const totalCalled = convocations.reduce((sum, player) => sum + (player.calledCount ?? 0), 0)
  const totalPresent = convocations.reduce((sum, player) => sum + (player.presentCount ?? 0), 0)

  const totalCalledPlayers = convocations.filter((player) => (player.calledCount ?? 0) > 0).length
  const totalPresentPlayers = convocations.filter((player) => (player.presentCount ?? 0) > 0).length
  const totalNonCalledPlayers = convocations.filter((player) => (player.calledCount ?? 0) === 0).length

  return (
    <section aria-labelledby="match-callups-title" className="flex flex-col gap-4 rounded-xl border bg-card p-5">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <h2 id="match-callups-title" className="font-semibold">Historique des matchs</h2>
        <span className="inline-flex w-fit rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
          {rows.length} match{rows.length > 1 ? 's' : ''}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-lg bg-muted/60 p-3">
          <p className="text-xs text-muted-foreground">Joueurs convoqués</p>
          <p className="mt-1 font-mono text-2xl font-semibold">{totalCalledPlayers}</p>
        </div>
        <div className="rounded-lg bg-muted/60 p-3">
          <p className=\"text-xs text-muted-foreground\">Joueurs présents</p>
          <p className="mt-1 font-mono text-2xl font-semibold">{totalPresentPlayers}</p>
        </div>
        <div className="rounded-lg bg-muted/60 p-3">
          <p className="text-xs text-muted-foreground">Joueurs non convoqués</p>
          <p className="mt-1 font-mono text-2xl font-semibold">{totalNonCalledPlayers}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg bg-muted/60 p-3">
          <p className="text-xs text-muted-foreground">Présents</p>
          <p className="mt-1 font-mono text-2xl font-semibold">{totalPresent}</p>
        </div>
        <div className="rounded-lg bg-muted/60 p-3">
          <p className="text-xs text-muted-foreground">Convoqués</p>
          <p className="mt-1 font-mono text-2xl font-semibold">{totalCalled}</p>
        </div>
        <div className="rounded-lg bg-muted/60 p-3">
          <p className="text-xs text-muted-foreground">Équipe 1</p>
          <p className="mt-1 font-mono text-2xl font-semibold">{rows.reduce((sum, [, values]) => sum + values.equipe1, 0)}</p>
        </div>
        <div className="rounded-lg bg-muted/60 p-3">
          <p className="text-xs text-muted-foreground">Équipe 2</p>
          <p className="mt-1 font-mono text-2xl font-semibold">{rows.reduce((sum, [, values]) => sum + values.equipe2, 0)}</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th scope="col" className="py-2.5 pr-4 font-medium">Samedi</th>
              <th scope="col" className="py-2.5 pr-4 font-medium">Équipe 1</th>
              <th scope="col" className="py-2.5 pr-4 font-medium">Équipe 2</th>
              <th scope="col" className="py-2.5 pr-4 font-medium">Présents</th>
              <th scope="col" className="py-2.5 font-medium">Convoqués</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([date, values]) => (
              <tr key={date} className="border-b last:border-0">
                <td className="py-2.5 pr-4 font-medium">{date}</td>
                <td className="py-2.5 pr-4 font-mono tabular-nums">{values.equipe1}</td>
                <td className="py-2.5 pr-4 font-mono tabular-nums">{values.equipe2}</td>
                <td className="py-2.5 pr-4 font-mono tabular-nums text-emerald-700">{values.presents}</td>
                <td className="py-2.5 font-mono tabular-nums text-blue-700">{values.convoques}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
