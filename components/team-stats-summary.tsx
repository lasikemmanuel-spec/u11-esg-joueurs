import { ireStatus, type StatsData } from '@/lib/stats-shared'
import { Activity, CalendarCheck2, Goal, Handshake, Timer, Users } from 'lucide-react'

const sum = (values: (number | null)[]) => values.reduce<number>((acc, v) => acc + (v ?? 0), 0)

export function TeamStatsSummary({ stats }: { stats: StatsData }) {
  const { players } = stats
  const called = players.filter((p) => p.callUpRate !== null)
  const avgCallUp = called.length ? Math.round(sum(called.map((p) => p.callUpRate)) / called.length) : null
  const counts = { fair: 0, under: 0, over: 0, none: 0 }
  for (const p of players) counts[ireStatus(p)]++

  const items = [
    {
      label: 'Présence entraînement',
      value: stats.teamTrainingRate !== null ? `${stats.teamTrainingRate}%` : '—',
      icon: Activity,
      color: 'text-sky-600 dark:text-sky-300',
    },
    {
      label: 'Taux de convocation',
      value: avgCallUp !== null ? `${avgCallUp}%` : '—',
      icon: CalendarCheck2,
      color: 'text-violet-600 dark:text-violet-300',
    },
    {
      label: 'Buts',
      value: sum(players.map((p) => p.goals)).toLocaleString('fr-FR'),
      icon: Goal,
      color: 'text-amber-600 dark:text-amber-300',
    },
    {
      label: 'Passes décisives',
      value: sum(players.map((p) => p.assists)).toLocaleString('fr-FR'),
      icon: Handshake,
      color: 'text-emerald-600 dark:text-emerald-300',
    },
    {
      label: 'Minutes jouées',
      value: sum(players.map((p) => p.minutes)).toLocaleString('fr-FR'),
      icon: Timer,
      color: 'text-rose-600 dark:text-rose-300',
    },
  ]
  const totalWithStatus = counts.fair + counts.under + counts.over + counts.none
  const balance = [
    { key: 'fair', label: 'Équilibré', count: counts.fair, color: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-300' },
    { key: 'under', label: 'Moins convoqué', count: counts.under, color: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-300' },
    { key: 'over', label: 'Plus convoqué', count: counts.over, color: 'bg-rose-500', text: 'text-rose-700 dark:text-rose-300' },
    { key: 'none', label: 'Sans données', count: counts.none, color: 'bg-slate-400', text: 'text-muted-foreground' },
  ]

  return (
    <section
      aria-labelledby="team-stats-title"
      className="overflow-hidden rounded-3xl border-2 border-[#d4af37]/50 bg-card shadow-lg shadow-[#172554]/10"
    >
      <header className="relative isolate overflow-hidden border-b border-[#d4af37]/50 bg-gradient-to-br from-[#101b40] via-[#1d397f] to-[#12224e] px-4 py-4 text-white sm:px-5">
        <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-16 -z-10 size-40 rounded-full bg-sky-300/10 blur-2xl" />
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-[#e0bd43]/50 bg-[#e0bd43]/15 text-[#f0cf68]">
              <Activity aria-hidden="true" className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">ES Genech · U11</p>
              <h2 id="team-stats-title" className="truncate text-lg font-black sm:text-xl">Bilan collectif</h2>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-1.5 text-xs font-bold text-white/85">
            <Users aria-hidden="true" className="size-3.5 text-amber-300" />
            {players.length} joueurs
          </span>
        </div>
      </header>

      <div className="flex flex-col gap-4 p-3.5 sm:gap-5 sm:p-5">
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {items.map(({ label, value, icon: Icon, color }, index) => (
            <div
              key={label}
              className={`flex min-h-[88px] flex-col justify-between rounded-2xl border border-border/70 bg-gradient-to-br from-muted/70 to-muted/30 p-3 ${
                index === items.length - 1 ? 'col-span-2 sm:col-span-1' : ''
              }`}
            >
              <dt className="flex items-center gap-1.5 text-[11px] font-semibold leading-tight text-muted-foreground">
                <Icon aria-hidden="true" className={`size-3.5 shrink-0 ${color}`} />
                {label}
              </dt>
              <dd className="font-mono text-2xl font-black tabular-nums tracking-tight text-foreground">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="rounded-2xl border border-border/70 bg-muted/30 p-3 sm:p-4">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <h3 className="text-xs font-extrabold text-foreground">Équilibre des convocations</h3>
            <span className="text-[10px] font-medium text-muted-foreground">IRE · {totalWithStatus} joueurs</span>
          </div>
          <div
            role="img"
            aria-label={balance.map(({ label, count }) => `${count} ${label.toLocaleLowerCase('fr-FR')}`).join(', ')}
            className="flex h-2.5 overflow-hidden rounded-full bg-muted"
          >
            {balance.map(({ key, count, color }) => (
              <span
                key={key}
                className={`${color} transition-[width]`}
                style={{ width: totalWithStatus > 0 ? `${(count / totalWithStatus) * 100}%` : '0%' }}
              />
            ))}
          </div>
          <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4">
            {balance.map(({ key, label, count, color, text }) => (
              <li key={key} className="flex min-w-0 items-center gap-1.5 text-[11px]">
                <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${color}`} />
                <span className={`truncate font-semibold ${text}`}>{label}</span>
                <span className="ml-auto font-mono font-black text-foreground">{count}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
