import { DashboardTabs } from '@/components/dashboard-tabs'
import { ClubCrest } from '@/components/club-crest'
import { DataQualityPanel } from '@/components/data-quality-panel'
import { RefreshSheetButton } from '@/components/refresh-sheet-button'
import { ScrollToTopButton } from '@/components/scroll-to-top-button'
import { ThemeToggle } from '@/components/theme-toggle'
import { getRoster, type PublicPlayer, type Roster } from '@/lib/players'
import { getStats, type StatsData } from '@/lib/stats'
import { getConvocations, type ConvocationsData } from '@/lib/convocations'
import { getMatchResults, type TeamMatchResults } from '@/lib/match-results'
import { getCohesionDays, type CohesionDay } from '@/lib/cohesion'

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
  matchTypes: {
    E1: [],
    E2: [],
  },
  entries: [],
}

const fallbackCohesionDays: CohesionDay[] = []

export default async function Page() {
  const [roster, stats, convocationsResult, matchResultsResult, cohesionResult] = await Promise.all([
    getRoster().catch((error) => {
      console.error('Impossible de charger l’effectif:', error)
      return fallbackRoster
    }),
    getStats().catch((error) => {
      console.error('Impossible de charger les statistiques joueurs:', error)
      return fallbackStats
    }),
    getConvocations().then((data) => ({ data, error: false })).catch((error) => {
      console.error('Impossible de charger les convocations:', error)
      return { data: fallbackConvocations, error: true }
    }),
    getMatchResults().then((data) => ({ data, error: false })).catch((error) => {
      console.error('Impossible de charger les résultats des matchs:', error)
      return { data: fallbackMatchResults, error: true }
    }),
    getCohesionDays().then((data) => ({ data, error: false })).catch((error) => {
      console.error('Impossible de charger les journées de cohésion:', error)
      return { data: fallbackCohesionDays, error: true }
    }),
  ])
  const convocations = convocationsResult.data
  const matchResults = matchResultsResult.data
  const publicPlayers: PublicPlayer[] = roster.players.map(
    ({ number, lastName, firstName, position, transferStatus }) => ({
      number,
      lastName,
      firstName,
      position,
      transferStatus,
    }),
  )
  const matchDataErrors = [
    ...(convocationsResult.error ? ['convocations'] : []),
    ...(matchResultsResult.error ? ['scores'] : []),
    ...(cohesionResult.error ? ['cohesion'] : []),
  ]

  const updatedAt = new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Paris',
  }).format(new Date(roster.fetchedAt))

  return (
    <div className="relative isolate min-h-dvh bg-muted/40">
      <header className="relative z-20 border-b-2 border-accent bg-gradient-to-b from-[oklch(0.32_0.06_272)] to-primary text-primary-foreground">
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

      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-[58vh] z-30 flex -translate-y-1/2 justify-center">
        <ClubCrest className="size-[min(78vw,32rem)] opacity-[0.18]" />
      </div>

      <main className="relative z-20 mx-auto flex max-w-7xl flex-col gap-4 px-4 pt-6 pb-24 md:gap-6 md:px-6 md:pt-8 md:pb-24 xl:pb-8">
        <DashboardTabs
          players={stats.players}
          rosterPlayers={publicPlayers}
          convocations={convocations.players}
          matchesPlayed={convocations.matchesPlayed}
          presentCounts={convocations.presentCounts}
          matchResults={matchResults}
          cohesionDays={cohesionResult.data}
          matchDataErrors={matchDataErrors}
        />
        <DataQualityPanel players={roster.players} />
      </main>
      <ScrollToTopButton />
    </div>
  )
}
