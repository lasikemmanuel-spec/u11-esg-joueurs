import { DashboardTabs } from '@/components/dashboard-tabs'
import { ClubCrest } from '@/components/club-crest'
import { DataQualityPanel } from '@/components/data-quality-panel'
import { ScrollToTopButton } from '@/components/scroll-to-top-button'
import Link from 'next/link'
import { headers } from 'next/headers'
import { getEducatorSession } from '@/lib/educator-auth'
import { getRoster, isDateSuspicious, type PublicPlayer, type Roster } from '@/lib/players'
import { getStats, type StatsData } from '@/lib/stats'
import { getConvocations, type ConvocationsData } from '@/lib/convocations'
import { getMatchResults, type TeamMatchResults } from '@/lib/match-results'
import { getCohesionDays, type CohesionDay } from '@/lib/cohesion'
import { getTrainingAttendance, type TrainingAttendanceSession } from '@/lib/training-attendance'

export const dynamic = 'force-dynamic'

const fallbackRoster: Roster = {
  club: 'ES Genech',
  title: 'Liste des joueurs',
  players: [],
  fetchedAt: '',
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
const fallbackTrainingAttendance: TrainingAttendanceSession[] = []

export default async function Page() {
  let educator: Awaited<ReturnType<typeof getEducatorSession>> = null
  try {
    educator = await getEducatorSession(
      new Request('https://localhost', { headers: await headers() }),
    )
  } catch (error) {
    console.error('Impossible de vérifier la session éducateur:', error)
  }
  const [rosterResult, statsResult, convocationsResult, matchResultsResult, cohesionResult, trainingAttendanceResult] = await Promise.all([
    educator ? getRoster().then((data) => ({ data, error: false })).catch((error) => {
      console.error('Impossible de charger l’effectif:', error)
      return { data: fallbackRoster, error: true }
    }) : { data: fallbackRoster, error: false },
    educator ? getStats().then((data) => ({ data, error: false })).catch((error) => {
      console.error('Impossible de charger les statistiques joueurs:', error)
      return { data: fallbackStats, error: true }
    }) : { data: fallbackStats, error: false },
    educator ? getConvocations().then((data) => ({ data, error: false })).catch((error) => {
      console.error('Impossible de charger les convocations:', error)
      return { data: fallbackConvocations, error: true }
    }) : { data: fallbackConvocations, error: false },
    educator ? getMatchResults().then((data) => ({ data, error: false })).catch((error) => {
      console.error('Impossible de charger les résultats des matchs:', error)
      return { data: fallbackMatchResults, error: true }
    }) : { data: fallbackMatchResults, error: false },
    educator ? getCohesionDays().then((data) => ({ data, error: false })).catch((error) => {
      console.error('Impossible de charger les journées de cohésion:', error)
      return { data: fallbackCohesionDays, error: true }
    }) : { data: fallbackCohesionDays, error: false },
    educator ? getTrainingAttendance().then((data) => ({ data, error: false })).catch((error) => {
      console.error('Impossible de charger les présences aux entraînements:', error)
      return { data: fallbackTrainingAttendance, error: true }
    }) : { data: fallbackTrainingAttendance, error: false },
  ])
  const roster = rosterResult.data
  const stats = statsResult.data
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
  const dataLoadErrors = [
    ...(rosterResult.error ? ['effectif'] : []),
    ...(statsResult.error ? ['statistiques'] : []),
    ...(convocationsResult.error ? ['convocations'] : []),
    ...(matchResultsResult.error ? ['résultats des matchs'] : []),
    ...(cohesionResult.error ? ['journées de cohésion'] : []),
    ...(trainingAttendanceResult.error ? ['présences aux entraînements'] : []),
  ]
  const dataQuality = {
    missingBirthDates: roster.players.filter((player) => !player.birthDate).length,
    suspiciousBirthDates: roster.players.filter((player) => isDateSuspicious(player)).length,
    noPosition: roster.players.filter((player) => !player.position).length,
    noTransfer: roster.players.filter((player) => !player.transferStatus).length,
  }

  const updatedAt = rosterResult.error || !roster.fetchedAt
    ? null
    : new Intl.DateTimeFormat('fr-FR', {
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
        teamTrainingRate={stats.teamTrainingRate}
        rosterPlayers={publicPlayers}
        convocations={convocations.players}
        matchesPlayed={convocations.matchesPlayed}
        convocationDates={convocations.matchDates}
        presentCounts={convocations.presentCounts}
        matchResults={matchResults}
        trainingAttendance={trainingAttendanceResult.data}
        trainingAttendanceError={trainingAttendanceResult.error}
        cohesionDays={cohesionResult.data}
        matchDataErrors={matchDataErrors}
        dataLoadErrors={dataLoadErrors}
        updatedAt={updatedAt}
      >
        {educator && <DataQualityPanel {...dataQuality} />}
      </DashboardTabs>
      <ScrollToTopButton />
      {educator && (
        <footer className="relative z-10 pb-6 pt-2 text-center">
          <Link
            href="/confidentialite"
            className="text-xs text-muted-foreground/60 underline underline-offset-2 hover:text-muted-foreground"
          >
            🔒 Politique de confidentialité &amp; RGPD
          </Link>
        </footer>
      )}
    </div>
  )
}
