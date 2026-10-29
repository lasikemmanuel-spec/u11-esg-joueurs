import { DashboardTabs } from '@/components/dashboard-tabs'
import { ClubCrest } from '@/components/club-crest'
import { DataQualityPanel } from '@/components/data-quality-panel'
import { RefreshSheetButton } from '@/components/refresh-sheet-button'
import { ScrollToTopButton } from '@/components/scroll-to-top-button'
import { ThemeToggle } from '@/components/theme-toggle'
import { getRoster, type Roster } from '@/lib/players'
import { getStats, type StatsData } from '@/lib/stats'
import { getConvocations, type ConvocationsData } from '@/lib/convocations'
import { getMatchResults, type TeamMatchResults } from '@/lib/match-results'

export const dynamic = 'force-dynamic'

const fallbackRoster: Roster = {
  club: 'ES Genech',
  title: 'Liste des joueurs',
  players: [],
  fetchedAt: new Date().toISOString(),
}

const fallbackStats: StatsData = {
  players: [],
  teamTrainingRate: null,
}

const fallbackConvocations: ConvocationsData = {
  players: [],
  matchesPlayed: 0,
  presentCounts: {},
}

const fallbackMatchResults: TeamMatchResults = {
  E1: [],
  E2: [],
}

export default async function Page() {
  const [roster, stats, convocations, matchResults] = await Promise.all([
    getRoster().catch(() => fallbackRoster),
    getStats().catch(() => fallbackStats),
    getConvocations().catch(() => fallbackConvocations),
    getMatchResults().catch(() => fallbackMatchResults),
  ])

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
          <div className="flex flex-row items-center gap-3 md:flex-col md:items-end">
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <RefreshSheetButton />
            </div>
            <p className="text-xs text-primary-foreground/70">Synchronisé le {updatedAt}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-7xl flex-col gap-4 px-4 pt-6 pb-24 md:gap-6 md:px-6 md:pt-8 md:pb-24 xl:pb-8">
        <DashboardTabs
          players={stats.players}
          rosterPlayers={roster.players}
          convocations={convocations.players}
          matchesPlayed={convocations.matchesPlayed}
          presentCounts={convocations.presentCounts}
          matchResults={matchResults}
        />
        <DataQualityPanel players={roster.players} />
      </main>
      <ScrollToTopButton />
    </div>
  )
}
