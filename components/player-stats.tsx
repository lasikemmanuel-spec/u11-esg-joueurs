'use client'

import { ClubCrest } from '@/components/club-crest'
import { PlayerOffensiveRankings } from '@/components/player-offensive-rankings'
import { ireStatus, type IreStatus, type PlayerStats as Stats } from '@/lib/stats'
import type { Convocation, MatchStatus } from '@/lib/convocations'
import type { Player } from '@/lib/players'

const MATCH_STYLES: Record<MatchStatus, { label: string; className: string }> = {
  called: { label: 'Convoqué', className: 'bg-emerald-600 text-white' },
  calledAbsent: { label: 'Convoqué absent', className: 'bg-amber-500 text-white' },
  present: { label: 'Présent', className: 'bg-emerald-600 text-white' },
  absent: { label: 'Absent', className: 'bg-blue-950 text-white' },
  injured: { label: 'Blessé', className: 'bg-red-600 text-white' },
  notCalled: { label: 'Non convoqué', className: 'border border-lime-500 bg-lime-400 text-lime-950' },
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
  const availability = [
    { label: 'Absence le samedi', rate: convocation.absentRate, count: convocation.absentCount, barClass: 'bg-blue-950' },
    { label: 'Blessé', rate: convocation.injuredRate, count: convocation.injuredCount, barClass: 'bg-red-600' },
    { label: 'Non convoqué', rate: convocation.notCalledRate, count: convocation.notCalledCount, barClass: 'bg-lime-400' },
  ].filter((item) => item.rate !== null && item.rate > 0)
    .sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0))

  return (
    <div className="flex flex-col gap-3 border-t pt-4">
      <h4 className="text-sm font-semibold">Disponibilité match</h4>
      {availability.map((item) => <RateRow key={item.label} {...item} />)}

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
                  <span className="whitespace-nowrap font-semibold">
                    {m.status === 'called'
                      ? (m.team ?? 'Conv.')
                      : m.status === 'calledAbsent'
                        ? 'Conv. abs.'
                        : m.status === 'notCalled'
                          ? 'Non conv.'
                        : style.label.split(' ')[0]}
                  </span>
                  <span className="sr-only">{style.label}</span>
                </li>
              )
            })}
          </ol>
          <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {(['called', 'calledAbsent', 'absent', 'injured', 'notCalled'] as const).map((s) => (
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

const IRE_STYLES: Record<IreStatus, { label: string; className: string }> = {
  fair: { label: 'Juste', className: 'bg-emerald-100 text-emerald-800' },
  under: { label: 'Sous-convoqué', className: 'bg-amber-100 text-amber-900' },
  over: { label: 'Sur-convoqué', className: 'bg-red-100 text-red-800' },
  none: { label: 'Non convoqué', className: 'bg-muted text-muted-foreground' },
}

const display = (v: number | null) => (v === null ? '—' : v)

export function PlayerCard({
  stats,
  convocation,
  player,
}: {
  stats: Stats
  convocation?: Convocation
  player?: Player
}) {
  const status = IRE_STYLES[ireStatus(stats)]
  const matchPresenceRate = convocation?.presentRate ?? null
  const saturdayCallUpRate = convocation?.callUpRate ?? null
  const playerName = player ? `${player.firstName} ${player.lastName}`.trim() : stats.name
  const encouragement = stats.trainingRate === null || matchPresenceRate === null
    ? {
        title: 'Bilan de présence indisponible',
        message: 'Les données de présence à l’entraînement ou aux matchs sont manquantes.',
      }
    : stats.trainingRate > 75 && matchPresenceRate > 75
      ? {
          title: 'Bravo, belle assiduité !',
          message: 'Une belle régularité aux entraînements et aux matchs.',
        }
      : {
          title: 'On continue les efforts !',
          message: 'Chaque présence compte, continue comme ça !',
        }
  const minutesPerMatch = stats.matchesCalled ? Math.round((stats.minutes ?? 0) / stats.matchesCalled) : null
  const tiles = [
    { label: 'Titulaire', value: display(stats.starts) },
    { label: 'Remplaçant', value: display(stats.subs) },
    { label: 'Minutes jouées', value: display(stats.minutes) },
    { label: 'Minutes / match', value: display(minutesPerMatch) },
    { label: 'Buts', value: display(stats.goals) },
    { label: 'Passes décisives', value: display(stats.assists) },
  ]

  return (
    <article
      aria-live="polite"
      className="relative isolate flex flex-col gap-3 overflow-hidden rounded-2xl border-2 border-[oklch(0.8_0.08_85)] bg-card p-3 shadow-lg sm:p-4"
    >
      <div aria-hidden="true" className="pointer-events-none absolute -top-16 -right-16 -z-10 size-40 rounded-full bg-[oklch(0.8_0.08_85)]/20 blur-3xl" />
      <header className="-mx-3 -mt-3 flex items-center justify-between gap-3 border-b-4 border-[oklch(0.8_0.08_85)] bg-[oklch(0.24_0.07_272)] px-3 py-3 text-white sm:-mx-4 sm:-mt-4 sm:px-4">
        <div className="flex items-center gap-3">
          <ClubCrest className="size-11 ring-2 ring-[oklch(0.8_0.08_85)]" />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[oklch(0.8_0.08_85)]">ES Genech · U11</p>
            <p className="mt-0.5 text-xs font-medium text-white/75">Fiche joueur</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={`rounded-md px-2 py-1 text-xs font-semibold ${status.className}`}>{status.label}</span>
        </div>
      </header>

      <div className="flex items-center gap-3 rounded-xl bg-secondary/60 p-3">
        <div className="flex size-14 shrink-0 flex-col items-center justify-center rounded-xl border border-[oklch(0.8_0.08_85)] bg-[oklch(0.24_0.07_272)] px-1 text-center text-white shadow-sm">
          <span className="text-[9px] font-bold uppercase tracking-wider text-[oklch(0.8_0.08_85)]">Poste</span>
          <span className="mt-0.5 text-xs font-black uppercase leading-tight">
            {player?.position ?? 'Joueur'}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Joueur</p>
          <h3 className="mt-0.5 break-words text-lg font-black uppercase leading-tight tracking-wide text-primary">
            {playerName}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">{player?.birthDate ?? 'Date de naissance non renseignée'}</p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-2">
        <div className="min-w-0 rounded-xl border border-accent/50 border-t-2 border-t-[oklch(0.8_0.08_85)] bg-card px-2 py-2.5 text-center shadow-sm">
          <dt className="text-[9px] font-bold uppercase leading-tight tracking-wide text-muted-foreground sm:text-[10px]">
            Présence entraînement
          </dt>
          <dd className="mt-1 font-mono text-xl font-black text-primary">
            {stats.trainingRate !== null ? `${stats.trainingRate}%` : '—'}
          </dd>
        </div>
        <div className="min-w-0 rounded-xl border border-accent/50 border-t-2 border-t-[oklch(0.8_0.08_85)] bg-card px-2 py-2.5 text-center shadow-sm">
          <dt className="text-[9px] font-bold uppercase leading-tight tracking-wide text-muted-foreground sm:text-[10px]">
            Présence samedi
          </dt>
          <dd className="mt-1 font-mono text-xl font-black text-primary">
            {matchPresenceRate !== null ? `${matchPresenceRate}%` : '—'}
          </dd>
        </div>
        <div className="min-w-0 rounded-xl border border-accent/50 border-t-2 border-t-[oklch(0.8_0.08_85)] bg-card px-2 py-2.5 text-center shadow-sm">
          <dt className="text-[9px] font-bold uppercase leading-tight tracking-wide text-muted-foreground sm:text-[10px]">
            Convocation samedi
          </dt>
          <dd className="mt-1 font-mono text-xl font-black text-primary">
            {saturdayCallUpRate !== null ? `${saturdayCallUpRate}%` : '—'}
          </dd>
        </div>
        <div className="min-w-0 rounded-xl border border-accent/50 border-t-2 border-t-[oklch(0.8_0.08_85)] bg-card px-2 py-2.5 text-center shadow-sm">
          <dt className="text-[9px] font-bold uppercase leading-tight tracking-wide text-muted-foreground sm:text-[10px]">
            IRE
          </dt>
          <dd className="mt-1 font-mono text-xl font-black text-primary">
            {stats.ire !== null ? stats.ire.toFixed(2).replace('.', ',') : '—'}
          </dd>
        </div>
      </dl>

      <div role="status" className="flex items-center gap-3 rounded-xl border border-[oklch(0.8_0.08_85)]/70 bg-[oklch(0.24_0.07_272)] px-3 py-2.5 text-white shadow-sm">
        <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[oklch(0.8_0.08_85)] text-sm font-black text-[oklch(0.24_0.07_272)]">★</span>
        <div>
          <p className="text-sm font-bold">{encouragement.title}</p>
          <p className="mt-0.5 text-xs text-white/75">{encouragement.message}</p>
        </div>
      </div>

      {convocation && <SaturdaySection convocation={convocation} />}

      <dl className="grid grid-cols-2 gap-2">
        {tiles.map((t) => (
          <div key={t.label} className="flex min-h-14 flex-col justify-between gap-0.5 rounded-lg border border-accent/40 bg-secondary/40 p-2.5">
            <dt className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{t.label}</dt>
            <dd className="font-mono text-lg font-black text-primary">{t.value}</dd>
          </div>
        ))}
      </dl>
      <p className="rounded-lg border-l-4 border-[oklch(0.8_0.08_85)] bg-secondary/50 px-3 py-2 text-[10px] leading-relaxed text-muted-foreground">
        IRE = taux de convocation ÷ taux de présence. Entre 0,90 et 1,10 inclus : justement convoqué.
      </p>
    </article>
  )
}

export function PlayerStats({ players }: { players: Stats[] }) {
  return <PlayerOffensiveRankings players={players} />
}
