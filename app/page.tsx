import { DashboardTabs } from '@/components/dashboard-tabs'
import { ClubCrest } from '@/components/club-crest'
import { DataQualityPanel } from '@/components/data-quality-panel'
import { ScrollToTopButton } from '@/components/scroll-to-top-button'
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
  matchDates: [],
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
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 flex items-center justify-center">
        <ClubCrest className="size-[min(72vw,28rem)] opacity-[0.32]" />
      </div>

      <DashboardTabs
        players={stats.players}
        rosterPlayers={publicPlayers}
        convocations={convocations.players}
        matchesPlayed={convocations.matchesPlayed}
        convocationDates={convocations.matchDates}
        presentCounts={convocations.presentCounts}
        matchResults={matchResults}
        cohesionDays={cohesionResult.data}
        matchDataErrors={matchDataErrors}
        updatedAt={updatedAt}
      >
        <DataQualityPanel players={roster.players} />
      </DashboardTabs>
      <ScrollToTopButton />
    </div>
  )
}
