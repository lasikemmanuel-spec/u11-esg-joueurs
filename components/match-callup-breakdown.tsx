import type { Convocation } from '@/lib/convocations'
import type { MatchResult, TeamMatchResults } from '@/lib/match-results'
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
  matchResults,
}: {
  convocations: Convocation[]
  presentCounts: Record<string, number>
  players: PlayerStats[]
  matchResults: TeamMatchResults
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
  const resultTeams: { key: keyof TeamMatchResults; label: string; tone: string }[] = [
    { key: 'E1', label: 'Équipe 1', tone: 'emerald' },
    { key: 'E2', label: 'Équipe 2', tone: 'violet' },
  ]

  function summarize(results: MatchResult[]) {
    return results.reduce(
      (summary, match) => {
        summary[match.outcome] += 1
        summary.goalsFor += match.goalsFor
        summary.goalsAgainst += match.goalsAgainst
        return summary
      },
      { win: 0, draw: 0, loss: 0, goalsFor: 0, goalsAgainst: 0 },
    )
  }

  const groupResults = [...matchResults.E1, ...matchResults.E2]
  const groupSummary = summarize(groupResults)
  const groupGoalDifference = groupSummary.goalsFor - groupSummary.goalsAgainst

  const outcomeLabel = (outcome: MatchResult['outcome']) => {
    if (outcome === 'win') return 'Victoire'
    if (outcome === 'draw') return 'Nul'
    return 'Défaite'
  }

  return (
    <div className="flex flex-col gap-5">
      <section aria-labelledby="team-results-title" className="flex flex-col gap-4">
        <div>
          <h2 id="team-results-title" className="font-semibold">Bilan des équipes</h2>
          <p className="mt-1 text-xs text-muted-foreground">Résultats et scores enregistrés dans les feuilles de match.</p>
        </div>
        <article aria-labelledby="group-results-title" className="overflow-hidden rounded-xl border border-accent/70 bg-gradient-to-br from-secondary via-card to-accent/10 shadow-sm">
          <header className="flex flex-wrap items-center justify-between gap-3 bg-primary px-5 py-4 text-primary-foreground">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Bilan général</p>
              <h3 id="group-results-title" className="mt-1 text-lg font-bold">Groupe U11 · E1 + E2</h3>
            </div>
            <span className="rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground">
              {groupResults.length} match{groupResults.length === 1 ? '' : 's'}
            </span>
          </header>
          {groupResults.length > 0 ? (
            <>
              <dl className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  { label: 'Victoires', value: groupSummary.win },
                  { label: 'Nuls', value: groupSummary.draw },
                  { label: 'Défaites', value: groupSummary.loss },
                  { label: 'Buts marqués', value: groupSummary.goalsFor },
                  { label: 'Buts encaissés', value: groupSummary.goalsAgainst },
                  { label: 'Différence', value: `${groupGoalDifference > 0 ? '+' : ''}${groupGoalDifference}` },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg border border-accent/40 bg-card/90 px-3 py-3 shadow-sm">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-primary/70">{item.label}</dt>
                    <dd className="mt-1 font-mono text-2xl font-bold text-primary">{item.value}</dd>
                  </div>
                ))}
              </dl>
              <p className="border-t border-accent/40 px-4 py-3 text-xs text-muted-foreground">
                Total combiné des résultats enregistrés pour les deux équipes.
              </p>
            </>
          ) : (
            <p className="px-5 py-6 text-sm text-muted-foreground">Aucun score renseigné pour le groupe U11.</p>
          )}
        </article>
        <div className="grid gap-4 xl:grid-cols-2">
          {resultTeams.map(({ key, label, tone }) => {
            const results = matchResults[key]
            const summary = summarize(results)
            const goalDifference = summary.goalsFor - summary.goalsAgainst
            const styles = tone === 'emerald'
              ? {
                  panel: 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-card',
                  badge: 'bg-emerald-100 text-emerald-800',
                  win: 'text-emerald-700',
                  draw: 'text-amber-700',
                  loss: 'text-rose-700',
                }
              : {
                  panel: 'border-violet-200 bg-gradient-to-br from-violet-50 to-card',
                  badge: 'bg-violet-100 text-violet-800',
                  win: 'text-emerald-700',
                  draw: 'text-amber-700',
                  loss: 'text-rose-700',
                }

            return (
              <article key={key} className={`overflow-hidden rounded-xl border shadow-sm ${styles.panel}`}>
                <header className="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Saison</p>
                    <h3 className="mt-1 text-lg font-bold">{label}</h3>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${styles.badge}`}>
                    {results.length} match{results.length === 1 ? '' : 's'}
                  </span>
                </header>

                {results.length > 0 ? (
                  <>
                    <div className="grid grid-cols-3 gap-2 px-4 pt-4 text-center">
                      <div className="rounded-lg bg-background/80 px-2 py-3">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Victoires</p>
                        <p className={`mt-1 font-mono text-2xl font-bold ${styles.win}`}>{summary.win}</p>
                      </div>
                      <div className="rounded-lg bg-background/80 px-2 py-3">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Nuls</p>
                        <p className={`mt-1 font-mono text-2xl font-bold ${styles.draw}`}>{summary.draw}</p>
                      </div>
                      <div className="rounded-lg bg-background/80 px-2 py-3">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Défaites</p>
                        <p className={`mt-1 font-mono text-2xl font-bold ${styles.loss}`}>{summary.loss}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-center gap-6 px-4 py-4">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Buts marqués</p>
                        <p className="font-mono text-xl font-bold">{summary.goalsFor}</p>
                      </div>
                      <span aria-hidden="true" className="text-muted-foreground">—</span>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Buts encaissés</p>
                        <p className="font-mono text-xl font-bold">{summary.goalsAgainst}</p>
                      </div>
                      <span className="rounded-full bg-background/80 px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                        Diff. {goalDifference > 0 ? '+' : ''}{goalDifference}
                      </span>
                    </div>
                    <div className="border-t border-border/60 bg-background/50 px-4 py-3">
                      <p className="mb-2 text-xs font-semibold text-muted-foreground">Derniers résultats</p>
                      <ol className="flex flex-col gap-2">
                        {[...results].reverse().slice(0, 4).map((match) => {
                          const badge = match.outcome === 'win'
                            ? 'bg-emerald-100 text-emerald-800'
                            : match.outcome === 'draw'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'

                          return (
                            <li key={`${key}-${match.date}`} className="flex items-center gap-2 text-xs">
                              <span className="w-[4.5rem] shrink-0 font-mono text-muted-foreground">{match.date.slice(0, 5)}</span>
                              <span className="min-w-0 flex-1 truncate">{match.opponent ?? 'Adversaire'}</span>
                              <span className="font-mono font-semibold">{match.goalsFor}–{match.goalsAgainst}</span>
                              <span className={`w-[4.5rem] rounded-full px-2 py-1 text-center font-medium ${badge}`}>
                                {outcomeLabel(match.outcome)}
                              </span>
                            </li>
                          )
                        })}
                      </ol>
                    </div>
                  </>
                ) : (
                  <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                    Aucun score renseigné pour cette équipe.
                  </p>
                )}
              </article>
            )
          })}
        </div>
      </section>

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
