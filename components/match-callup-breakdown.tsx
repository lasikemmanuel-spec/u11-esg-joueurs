import type { Convocation } from '@/lib/convocations'
import type { PlayerStats } from '@/lib/stats'

const CALLED_STATUSES = new Set(['called', 'calledAbsent', 'present'])
const PRESENT_STATUSES = new Set(['present'])

function sortKey(date: string) {
  return date.localeCompare(date, 'fr', { numeric: true, sensitivity: 'base' })
}

export function MatchCallupBreakdown({
  convocations,
  presentCounts,
  players,
}: {
  convocations: Convocation[]
  presentCounts: Record<string, number>
  players: PlayerStats[]
}) {
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

  for (const [date, count] of Object.entries(presentCounts)) {
    const current = byDate.get(date)
    if (current) current.presents = count
  }

  const rows = [...byDate.entries()].sort(([a], [b]) => sortKey(a) - sortKey(b))

  const topScorers = [...players]
    .filter((player) => player.goals !== null && player.goals > 0)
    .sort((a, b) => (b.goals ?? 0) - (a.goals ?? 0) || a.name.localeCompare(b.name, 'fr'))
    .slice(0, 5)
  const topAssisters = [...players]
    .filter((player) => player.assists !== null && player.assists > 0)
    .sort((a, b) => (b.assists ?? 0) - (a.assists ?? 0) || a.name.localeCompare(b.name, 'fr'))
    .slice(0, 5)
  const maxGoals = topScorers[0]?.goals ?? 0
  const maxAssists = topAssisters[0]?.assists ?? 0

  return (
    <div className="flex flex-col gap-5">
      <section aria-labelledby="match-callups-title" className="flex flex-col gap-4 rounded-xl border bg-card p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 id="match-callups-title" className="font-semibold">Historique des matchs</h2>
            <p className="mt-1 text-xs text-muted-foreground">Présents et convocations pour chaque match.</p>
          </div>
          {rows.length > 0 && (
            <span className="inline-flex w-fit rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              {rows.length} match{rows.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {rows.length > 0 ? (
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
        ) : (
          <p className="text-sm text-muted-foreground">Aucune donnée de convocation disponible.</p>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-labelledby="top-scorers-title" className="overflow-hidden rounded-xl border bg-gradient-to-br from-amber-50 via-card to-card shadow-sm">
          <div className="border-b border-amber-200/70 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Classement offensif</p>
            <h2 id="top-scorers-title" className="mt-1 text-lg font-bold text-foreground">Top 5 buteurs</h2>
          </div>
          {topScorers.length > 0 ? (
            <ol className="divide-y divide-amber-100 px-4">
              {topScorers.map((player, index) => (
                <li key={player.number} className="flex items-center gap-3 py-3">
                  <span className={[
                    'flex size-8 shrink-0 items-center justify-center rounded-full font-mono text-sm font-bold',
                    index === 0 ? 'bg-amber-400 text-amber-950' : 'bg-amber-100 text-amber-800',
                  ].join(' ')}>
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{player.name}</p>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-amber-100">
                      <div className="h-full rounded-full bg-amber-500" style={{ width: `${((player.goals ?? 0) / maxGoals) * 100}%` }} />
                    </div>
                  </div>
                  <span className="shrink-0 rounded-lg bg-amber-100 px-2.5 py-1 font-mono text-sm font-bold text-amber-900">
                    {player.goals} <span className="font-sans text-xs font-medium">but{player.goals === 1 ? '' : 's'}</span>
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="px-5 py-6 text-sm text-muted-foreground">Aucun but renseigné pour le moment.</p>
          )}
        </section>
        <section aria-labelledby="top-assisters-title" className="overflow-hidden rounded-xl border bg-gradient-to-br from-sky-50 via-card to-card shadow-sm">
          <div className="border-b border-sky-200/70 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Classement collectif</p>
            <h2 id="top-assisters-title" className="mt-1 text-lg font-bold text-foreground">Top 5 passeurs</h2>
          </div>
          {topAssisters.length > 0 ? (
            <ol className="divide-y divide-sky-100 px-4">
              {topAssisters.map((player, index) => (
                <li key={player.number} className="flex items-center gap-3 py-3">
                  <span className={[
                    'flex size-8 shrink-0 items-center justify-center rounded-full font-mono text-sm font-bold',
                    index === 0 ? 'bg-sky-500 text-white' : 'bg-sky-100 text-sky-800',
                  ].join(' ')}>
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{player.name}</p>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-sky-100">
                      <div className="h-full rounded-full bg-sky-500" style={{ width: `${((player.assists ?? 0) / maxAssists) * 100}%` }} />
                    </div>
                  </div>
                  <span className="shrink-0 rounded-lg bg-sky-100 px-2.5 py-1 font-mono text-sm font-bold text-sky-900">
                    {player.assists} <span className="font-sans text-xs font-medium">passe{player.assists === 1 ? '' : 's'}</span>
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="px-5 py-6 text-sm text-muted-foreground">Aucune passe décisive renseignée pour le moment.</p>
          )}
        </section>
      </div>
    </div>
  )
}
