import { DashboardTabs } from '@/components/dashboard-tabs'
import { ExternalLink } from 'lucide-react'
import { ClubCrest } from '@/components/club-crest'
import { DataQualityPanel } from '@/components/data-quality-panel'
import { PositionBreakdown } from '@/components/position-breakdown'
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
      <header className="border-b-2 border-accent bg-gradient-to-b from-[oklch(0.32_0.06_272)] to-primary text-primary-foreground">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 md:flex-row md:items-center md:justify-between md:px-6 md:py-8">
          <div className="flex items-center gap-4 md:gap-5">
            <ClubCrest className="size-16 md:size-24" />
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-extrabold tracking-wide uppercase md:text-4xl">ES Genech</h1>
              <p className="text-sm text-accent md:text-base">{'Toujours ensemble, allez l’ESG'}</p>
              <p className="text-sm text-accent/80">{roster.title}</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 md:items-end">
            <a
              href={SHEET_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-fit items-center gap-2 rounded-xl border border-primary-foreground/25 bg-primary-foreground/10 px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-foreground/15"
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
        <DashboardTabs players={stats.players} convocations={convocations.players} />
        <PositionBreakdown players={roster.players} />
        <DataQualityPanel players={roster.players} />
      </main>
    </div>
  )
}
