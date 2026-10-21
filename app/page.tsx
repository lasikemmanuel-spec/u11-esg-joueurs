import { ExternalLink } from 'lucide-react'
import { DataQualityPanel } from '@/components/data-quality-panel'
import { RosterTable } from '@/components/roster-table'
import { PlayerStats } from '@/components/player-stats'
import { TeamStatsSummary } from '@/components/team-stats-summary'
import { getRoster, SHEET_URL } from '@/lib/players'
import { getStats } from '@/lib/stats'
import { getConvocations } from '@/lib/convocations'

export default async function Page() {
  const [roster, stats, convocations] = await Promise.all([getRoster(), getStats(), getConvocations()])
  const updatedAt = new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Paris',
  }).format(new Date(roster.fetchedAt))

  return (
    <div className="min-h-dvh bg-muted/40">
      <header className="bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 md:flex-row md:items-end md:justify-between md:px-6 md:py-10">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium tracking-wide text-primary-foreground/70 uppercase">{roster.club}</p>
            <h1 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">{roster.title}</h1>
          </div>
          <div className="flex flex-col gap-2 md:items-end">
            <a
              href={SHEET_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-fit items-center gap-2 rounded-lg bg-primary-foreground px-3.5 py-2 text-sm font-medium text-primary hover:bg-primary-foreground/90"
            >
              Ouvrir le Google Sheet
              <ExternalLink aria-hidden="true" className="size-4" />
            </a>
            <p className="text-xs text-primary-foreground/70">Synchronisé le {updatedAt}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 md:gap-6 md:px-6 md:py-8">
        <TeamStatsSummary stats={stats} />
        <PlayerStats players={stats.players} convocations={convocations.players} />
        <DataQualityPanel players={roster.players} />
        <RosterTable players={roster.players} />
      </main>
    </div>
  )
}
