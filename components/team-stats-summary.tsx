import { ireStatus, type StatsData } from '@/lib/stats'

const sum = (values: (number | null)[]) => values.reduce<number>((acc, v) => acc + (v ?? 0), 0)

export function TeamStatsSummary({ stats }: { stats: StatsData }) {
  const { players } = stats
  const called = players.filter((p) => p.callUpRate !== null)
  const avgCallUp = called.length ? Math.round(sum(called.map((p) => p.callUpRate)) / called.length) : null
  const counts = { fair: 0, under: 0, over: 0, none: 0 }
  for (const p of players) counts[ireStatus(p)]++

  const items = [
    { label: 'Présence moyenne', value: stats.teamTrainingRate !== null ? `${stats.teamTrainingRate}%` : '—' },
    { label: 'Convocation moyenne', value: avgCallUp !== null ? `${avgCallUp}%` : '—' },
    { label: 'Buts', value: sum(players.map((p) => p.goals)) },
    { label: 'Passes décisives', value: sum(players.map((p) => p.assists)) },
    { label: 'Minutes jouées', value: sum(players.map((p) => p.minutes)).toLocaleString('fr-FR') },
  ]

  return (
    <section aria-labelledby="team-stats-title" className="flex flex-col gap-4 rounded-xl border bg-card p-5">
      <h2 id="team-stats-title" className="font-semibold">Statistiques de l&apos;équipe</h2>
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((item) => (
          <div key={item.label} className="flex flex-col gap-1 rounded-lg bg-muted/60 p-3">
            <dt className="text-xs text-muted-foreground">{item.label}</dt>
            <dd className="font-mono text-2xl font-semibold">{item.value}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap gap-2 text-sm">
        <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-emerald-800">
          <span aria-hidden="true" className="size-2 rounded-full bg-emerald-600" />
          {counts.fair} justement convoqué{counts.fair > 1 ? 's' : ''}
        </span>
        <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-amber-900">
          <span aria-hidden="true" className="size-2 rounded-full bg-amber-500" />
          {counts.under} sous-convoqué{counts.under > 1 ? 's' : ''}
        </span>
        <span className="inline-flex items-center gap-2 rounded-full bg-red-100 px-3 py-1 text-red-800">
          <span aria-hidden="true" className="size-2 rounded-full bg-red-600" />
          {counts.over} sur-convoqué{counts.over > 1 ? 's' : ''}
        </span>
        {counts.none > 0 && (
          <span className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-muted-foreground">
            {counts.none} sans convocation
          </span>
        )}
      </div>
    </section>
  )
}
