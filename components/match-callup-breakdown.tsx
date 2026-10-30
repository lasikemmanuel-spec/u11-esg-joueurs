import type { Convocation } from '@/lib/convocations'
import type { MatchResult, TeamMatchResults } from '@/lib/match-results'
import { ClubCrest } from '@/components/club-crest'

const PRESENT_STATUSES = new Set(['present'])

function sortKey(date: string) {
  const dayFirst = date.match(/^(\d{1,2})[/. -](\d{1,2})[/. -](\d{4})$/)
  if (dayFirst) {
    const [, day, month, year] = dayFirst.map(Number)
    return new Date(year, month - 1, day).getTime()
  }

  const yearFirst = date.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (yearFirst) {
    const [, year, month, day] = yearFirst.map(Number)
    return new Date(year, month - 1, day).getTime()
  }

  return Number.NaN
}

function dateKey(date: string) {
  const dayFirst = date.match(/^(\d{1,2})[/. -](\d{1,2})[/. -](\d{4})$/)
  if (dayFirst) {
    const [, day, month, year] = dayFirst
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }

  const yearFirst = date.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (yearFirst) {
    const [, year, month, day] = yearFirst
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }

  return date.trim().toLocaleLowerCase('fr-FR')
}

function getMatchFormat(type: string | null) {
  const normalizedType = type
    ?.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr-FR') ?? ''

  if (/tournoi|plateau|festival/.test(normalizedType)) {
    return { label: 'Tournoi', size: 12 }
  }
  if (/championnat|district/.test(normalizedType)) {
    return { label: 'Championnat', size: 11 }
  }
  if (/amical/.test(normalizedType)) {
    return { label: 'Amical', size: 12 }
  }
  return null
}

export function MatchCallupBreakdown({
  convocations,
  presentCounts,
  matchResults,
  dataErrors,
}: {
  convocations: Convocation[]
  presentCounts: Record<string, number>
  matchResults: TeamMatchResults
  dataErrors: string[]
}) {
  const byDate = new Map<string, { equipe1: number; equipe2: number; presents: number }>()

  for (const player of convocations) {
    for (const match of player.matches) {
      if (!match.date) continue

      const current = byDate.get(match.date) ?? { equipe1: 0, equipe2: 0, presents: 0 }

      if (match.team === 'E1') current.equipe1 += 1
      if (match.team === 'E2') current.equipe2 += 1
      if (PRESENT_STATUSES.has(match.status)) current.presents += 1

      byDate.set(match.date, current)
    }
  }

  for (const [date, count] of Object.entries(presentCounts)) {
    const current = byDate.get(date)
    if (current) current.presents = count
  }

  const typeByTeamAndDate = {
    E1: new Map<string, string>(),
    E2: new Map<string, string>(),
  }
  for (const team of ['E1', 'E2'] as const) {
    for (const match of matchResults.matchTypes[team]) {
      typeByTeamAndDate[team].set(dateKey(match.date), match.type)
    }
  }

  const rows = [...byDate.entries()].map(([date, values]) => {
    return {
      date,
      values,
      formats: {
        E1: getMatchFormat(typeByTeamAndDate.E1.get(dateKey(date)) ?? null),
        E2: getMatchFormat(typeByTeamAndDate.E2.get(dateKey(date)) ?? null),
      },
    }
  }).sort(({ date: a }, { date: b }) => {
    const timeA = sortKey(a)
    const timeB = sortKey(b)
    return Number.isNaN(timeA) || Number.isNaN(timeB)
      ? a.localeCompare(b, 'fr', { numeric: true, sensitivity: 'base' })
      : timeA - timeB
  })

  const resultTeams: { key: 'E1' | 'E2'; label: string }[] = [
    { key: 'E1', label: 'Équipe 1' },
    { key: 'E2', label: 'Équipe 2' },
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
      {dataErrors.length > 0 && (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Certaines données des matchs n’ont pas pu être chargées :
          {' '}
          {dataErrors.map((source) => source === 'convocations' ? 'convocations' : 'scores').join(' et ')}.
          Vérifiez que le compte de service GCP peut lire les onglets correspondants du classeur.
        </p>
      )}
      <section aria-label="Bilan des équipes" className="flex flex-col gap-4">
        <article aria-labelledby="group-results-title" className="overflow-hidden rounded-xl border border-accent/70 bg-gradient-to-br from-secondary via-card to-accent/10 shadow-sm">
          <header className="flex flex-wrap items-center justify-between gap-3 bg-primary px-5 py-4 text-primary-foreground">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Bilan général</p>
              <h3 id="group-results-title" className="mt-1 text-lg font-bold">Groupe U11</h3>
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
          {resultTeams.map(({ key, label }) => {
            const results = matchResults[key]
            const summary = summarize(results)
            const goalDifference = summary.goalsFor - summary.goalsAgainst
            const styles = {
              panel: 'border-accent/60 bg-gradient-to-br from-secondary via-card to-accent/10',
              badge: 'bg-accent text-accent-foreground',
              win: 'text-emerald-700',
              draw: 'text-amber-700',
              loss: 'text-rose-700',
            }

            return (
              <article key={key} className={`overflow-hidden rounded-xl border shadow-sm ${styles.panel}`}>
                <header className="flex items-center justify-between gap-3 border-b border-accent/50 bg-primary px-5 py-4 text-primary-foreground">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Saison</p>
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

      <section aria-labelledby="match-callups-title" className="flex flex-col gap-4 rounded-xl border bg-card p-3 sm:p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2.5">
            <ClubCrest className="size-9 ring-2 ring-accent/70 sm:size-11" />
            <div>
              <h2 id="match-callups-title" className="font-semibold">Historique des matchs</h2>
              <p className="mt-1 text-xs text-muted-foreground">Présents par match.</p>
            </div>
          </div>
          {rows.length > 0 && (
            <span className="inline-flex w-fit rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              {rows.length} match{rows.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {rows.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-accent/50">
            <table className="w-full table-fixed border-collapse text-center">
              <caption className="sr-only">Nombre de joueurs par équipe et pourcentage de l’effectif théorique pour chaque match</caption>
              <thead className="bg-primary text-primary-foreground">
                <tr>
                  <th scope="col" className="w-[28%] px-1.5 py-2 text-left text-[9px] font-bold uppercase tracking-wide text-accent sm:px-3 sm:text-xs">
                    Match
                  </th>
                  <th scope="col" className="w-[24%] px-0.5 py-2 text-[9px] font-bold uppercase tracking-wide sm:px-2 sm:text-xs">
                    Éq. 1
                  </th>
                  <th scope="col" className="w-[24%] px-0.5 py-2 text-[9px] font-bold uppercase tracking-wide sm:px-2 sm:text-xs">
                    Éq. 2
                  </th>
                  <th scope="col" className="w-[24%] px-0.5 py-2 text-[8px] font-bold uppercase leading-tight tracking-wide sm:px-2 sm:text-xs">
                    Présents<br className="sm:hidden" /> · TP
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map(({ date, values, formats }, index) => (
                  <tr key={date} className={`${index % 2 === 0 ? 'bg-card' : 'bg-secondary/25'} transition-colors hover:bg-accent/10`}>
                    <th scope="row" className="px-1.5 py-2 text-left sm:px-3">
                      <time className="block whitespace-nowrap font-mono text-[10px] font-bold text-primary sm:text-xs">{date}</time>
                    </th>
                    {([
                      { key: 'E1', count: values.equipe1, format: formats.E1 },
                      { key: 'E2', count: values.equipe2, format: formats.E2 },
                    ] as const).map(({ key, count, format }) => (
                      <td key={key} className="border-l border-border/70 px-0.5 py-1.5 sm:px-2">
                        <span className="block font-mono text-sm font-black text-primary sm:text-base">{count}</span>
                        <span className="block truncate text-[8px] font-semibold uppercase leading-tight text-muted-foreground sm:text-[10px]">
                          {format?.label ?? 'Type n.c.'}
                        </span>
                        <span className="block whitespace-nowrap text-[8px] font-semibold leading-tight text-muted-foreground sm:text-[10px]">
                          {format ? `${count}/${format.size} · ${Math.round(count / format.size * 100)}%` : 'format n.c.'}
                        </span>
                      </td>
                    ))}
                    <td className="border-l border-emerald-200/70 bg-emerald-50/60 px-0.5 py-1.5 dark:border-emerald-900/50 dark:bg-emerald-950/20 sm:px-2">
                      <span className="font-mono text-sm font-black text-emerald-800 dark:text-emerald-200 sm:text-base">{values.presents}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Aucune donnée de convocation disponible.</p>
        )}
      </section>

    </div>
  )
}
