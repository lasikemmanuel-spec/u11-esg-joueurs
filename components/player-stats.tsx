'use client'

import { ClubCrest } from '@/components/club-crest'
import { PlayerOffensiveRankings } from '@/components/player-offensive-rankings'
import { ireStatus, type IreStatus, type PlayerStats as Stats } from '@/lib/stats'
import type { Convocation, MatchStatus } from '@/lib/convocations'
import { ageOn, type Player } from '@/lib/players'

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
    { label: 'Présence le samedi', rate: convocation.presentRate, count: convocation.presentCount, barClass: 'bg-emerald-600' },
    { label: 'Absence le samedi', rate: convocation.absentRate, count: convocation.absentCount, barClass: 'bg-blue-950' },
    { label: 'Blessé', rate: convocation.injuredRate, count: convocation.injuredCount, barClass: 'bg-red-600' },
    { label: 'Non convoqué', rate: convocation.notCalledRate, count: convocation.notCalledCount, barClass: 'bg-lime-400' },
  ].filter((item) => item.rate !== null && item.rate > 0)
    .sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0))

  return (
    <div className="flex flex-col gap-3 border-t pt-4">
      <h4 className="text-sm font-semibold">Disponibilités du samedi</h4>
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
  const playerName = player ? `${player.firstName} ${player.lastName}`.trim() : stats.name
  const playerAge = player ? ageOn(player.birthDate) : null
  const presenceIndicator = stats.trainingRate === null || matchPresenceRate === null
    ? {
        title: 'Bilan de présence indisponible',
        message: 'Les données de présence à l’entraînement ou aux matchs sont manquantes.',
        className: 'border-border bg-muted text-foreground',
      }
    : stats.trainingRate > 75 && matchPresenceRate > 75
      ? {
          title: 'Bravo, belle assiduité !',
          message: `Entraînements : ${stats.trainingRate}% · Matchs : ${matchPresenceRate}%`,
          className: 'border-emerald-300 bg-emerald-100 text-emerald-950',
        }
      : {
          title: 'On continue les efforts !',
          message: `Entraînements : ${stats.trainingRate}% · Matchs : ${matchPresenceRate}%`,
          className: 'border-amber-300 bg-amber-100 text-amber-950',
        }
  const minutesPerMatch = stats.matchesCalled ? Math.round((stats.minutes ?? 0) / stats.matchesCalled) : null
  const tiles = [
    { label: 'Matchs convoqué', value: display(stats.matchesCalled) },
    { label: 'Titulaire', value: display(stats.starts) },
    { label: 'Remplaçant', value: display(stats.subs) },
    { label: 'Minutes jouées', value: display(stats.minutes) },
    { label: 'Minutes / match', value: display(minutesPerMatch) },
    { label: 'Buts', value: display(stats.goals) },
    { label: 'Passes décisives', value: display(stats.assists) },
    { label: 'Indice IRE', value: stats.ire !== null ? stats.ire.toFixed(2).replace('.', ',') : '—' },
  ]

  return (
    <div
      aria-live="polite"
      className="bg-accent p-[2px] drop-shadow-[0_8px_12px_rgba(0,0,0,0.18)]"
      style={{ clipPath: 'polygon(0 0, 100% 0, 100% 94%, 50% 100%, 0 94%)' }}
    >
      <article
        className="relative isolate flex flex-col gap-4 overflow-hidden bg-gradient-to-br from-secondary via-card to-accent/15 px-4 pt-4 pb-14"
        style={{ clipPath: 'polygon(0 0, 100% 0, 100% 94%, 50% 100%, 0 94%)' }}
      >
      <div aria-hidden="true" className="pointer-events-none absolute -top-16 -right-14 -z-10 size-48 rounded-full bg-accent/20 blur-3xl" />
      <header className="-mx-4 -mt-4 flex items-center justify-between gap-3 bg-gradient-to-r from-primary via-primary to-[oklch(0.32_0.06_272)] px-4 py-3 text-primary-foreground">
        <div className="flex items-center gap-3">
          <ClubCrest className="size-11 ring-2 ring-accent" />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-accent">ES Genech · U11</p>
            <p className="mt-0.5 text-xs font-medium text-primary-foreground/75">Fiche joueur</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={`rounded-md px-2 py-1 text-xs font-semibold ${status.className}`}>{status.label}</span>
        </div>
      </header>

      <div className="flex items-center gap-4 py-1">
        <div className="flex size-24 shrink-0 flex-col items-center justify-center rounded-2xl border-2 border-accent bg-primary px-2 text-center text-primary-foreground shadow-md">
          <span className="text-xs font-black uppercase tracking-[0.16em] text-accent">
            {player?.position ?? 'Joueur'}
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/65">Joueur</p>
          <h3 className="mt-1 break-words text-xl font-black uppercase leading-tight tracking-wide text-primary">
            {playerName}
          </h3>
          <div className="mt-2 h-1 w-14 rounded-full bg-accent" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-accent/40 bg-card/90 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-primary/65">Anniversaire</p>
          <p className="mt-1 font-mono text-sm font-bold text-primary">{player?.birthDate ?? 'Non renseigné'}</p>
        </div>
        <div className="rounded-lg border border-accent/40 bg-card/90 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-primary/65">Âge</p>
          <p className="mt-1 font-mono text-sm font-bold text-primary">{playerAge !== null ? `${playerAge} ans` : '—'}</p>
        </div>
      </div>

      <div
        role="status"
        className={`rounded-xl border px-3 py-2.5 ${presenceIndicator.className}`}
      >
        <p className="text-sm font-bold">{presenceIndicator.title}</p>
        <p className="mt-0.5 text-xs opacity-90">{presenceIndicator.message}</p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-sm">
            <span>Taux de présence entraînement</span>
            <span className="font-mono font-semibold">{stats.trainingRate !== null ? `${stats.trainingRate}%` : '—'}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary" style={{ width: `${Math.min(stats.trainingRate ?? 0, 100)}%` }} />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-sm">
            <span>Taux de convocation</span>
            <span className="font-mono font-semibold">{stats.callUpRate !== null ? `${stats.callUpRate}%` : '—'}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary" style={{ width: `${Math.min(stats.callUpRate ?? 0, 100)}%` }} />
          </div>
        </div>
      </div>

      {convocation && <SaturdaySection convocation={convocation} />}

      <dl className="grid grid-cols-2 gap-2">
        {tiles.map((t) => (
          <div key={t.label} className="flex min-h-16 flex-col justify-between gap-0.5 rounded-lg border border-accent/25 bg-card/80 p-2.5">
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-primary/65">{t.label}</dt>
            <dd className="font-mono text-lg font-bold text-primary">{t.value}</dd>
          </div>
        ))}
      </dl>
      <p className="border-t border-accent/30 pt-3 text-[11px] text-muted-foreground">
        IRE = taux de convocation ÷ taux de présence. Entre 0,90 et 1,10 inclus : justement convoqué.
      </p>
      </article>
    </div>
  )
}

export function PlayerStats({ players }: { players: Stats[] }) {
  return <PlayerOffensiveRankings players={players} />
}
