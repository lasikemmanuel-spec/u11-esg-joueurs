'use client'

import { useState } from 'react'
import { CalendarDays, ContactRound, LogOut } from 'lucide-react'
import { MatchCallupBreakdown } from '@/components/match-callup-breakdown'
import { PlayerStats } from '@/components/player-stats'
import { PositionBreakdown } from '@/components/position-breakdown'
import { EducatorRoster } from '@/components/educator-roster'
import { MatchResultEntry } from '@/components/match-result-entry'
import { DashboardTitle } from '@/components/dashboard-title'
import type { Convocation } from '@/lib/convocations'
import type { PublicPlayer } from '@/lib/players'
import type { TeamMatchResults } from '@/lib/match-results'
import type { CohesionDay } from '@/lib/cohesion'
import type { PlayerStats as PlayerStat } from '@/lib/stats'

type TabKey = 'roster' | 'educator' | 'players' | 'matches'
type EducatorSection = 'matches' | 'directory'
type EducatorAccess = 'checking' | 'unauthenticated' | 'authenticated' | 'unavailable'
type EducatorIdentity = { username: string; displayName: string; role: 'educator' | 'admin' }

export function DashboardTabs({
  players,
  rosterPlayers,
  convocations,
  matchesPlayed,
  presentCounts,
  matchResults,
  cohesionDays,
  matchDataErrors,
}: {
  players: PlayerStat[]
  rosterPlayers: PublicPlayer[]
  convocations: Convocation[]
  matchesPlayed: number
  presentCounts: Record<string, number>
  matchResults: TeamMatchResults
  cohesionDays: CohesionDay[]
  matchDataErrors: string[]
}) {
  const [activeTab, setActiveTab] = useState<TabKey>('roster')
  const [educatorSection, setEducatorSection] = useState<EducatorSection>('matches')
  const [returnToMatchesAfterLogin, setReturnToMatchesAfterLogin] = useState(false)
  const [educatorAccess, setEducatorAccess] = useState<EducatorAccess>('checking')
  const [educatorIdentity, setEducatorIdentity] = useState<EducatorIdentity | null>(null)
  const [logoutPending, setLogoutPending] = useState(false)
  const [logoutError, setLogoutError] = useState('')

  const handleEducatorLogout = async () => {
    setLogoutPending(true)
    setLogoutError('')
    try {
      const response = await fetch('/api/educators/session', { method: 'DELETE' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Déconnexion impossible.')
      setEducatorIdentity(null)
      setEducatorAccess('unauthenticated')
      setReturnToMatchesAfterLogin(false)
      setEducatorSection('matches')
      window.dispatchEvent(new Event('educator-session-changed'))
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : 'Déconnexion impossible.')
    } finally {
      setLogoutPending(false)
    }
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'roster', label: 'Effectifs' },
    { key: 'players', label: 'Stats Joueurs' },
    { key: 'matches', label: 'Stats Matchs' },
    { key: 'educator', label: 'Éducateurs' },
  ]
  const activeTitle = {
    roster: { title: 'Effectifs', subtitle: 'Joueurs regroupés par poste.' },
    players: { title: 'Stats Joueurs', subtitle: 'Top 5 buteurs, passeurs, entraînements et matchs joués.' },
    matches: { title: 'Stats Matchs', subtitle: 'Résultats, scores et convocations.' },
    educator: { title: 'Éducateurs', subtitle: 'Annuaire, calendrier et informations du groupe.' },
  }[activeTab]

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm xl:grid xl:grid-cols-[220px_minmax(0,1fr)]">
      <nav aria-label="Statistiques" className="hidden border-b border-border bg-card p-2 xl:block xl:border-r xl:border-b-0 xl:p-3">
        <div className="mx-auto flex max-w-3xl gap-2 rounded-full bg-muted p-1 xl:flex-col xl:rounded-xl">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key

            return (
              <button
                key={tab.key}
                type="button"
                aria-pressed={isActive}
                onClick={() => setActiveTab(tab.key)}
                className={[
                  'flex-1 rounded-full px-4 py-2.5 text-sm font-semibold transition-all duration-200 xl:flex-none xl:text-left',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-background hover:text-foreground',
                ].join(' ')}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </nav>

      <div className={`min-w-0 p-4 md:p-5 ${activeTab === 'players' || activeTab === 'matches' ? 'pt-2 sm:pt-4 md:pt-5' : ''}`}>
        <div className={`mb-4 ${activeTab === 'players' || activeTab === 'matches' ? 'hidden sm:block' : ''}`}>
          <DashboardTitle
            {...activeTitle}
            eyebrow={activeTab === 'educator' ? 'ESG Genech · Éducateurs' : undefined}
            action={activeTab === 'educator' && educatorIdentity && (
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-right text-xs font-semibold text-white">
                  {educatorIdentity.displayName.trim().split(/\s+/)[0]} : connecté
                </span>
                <button
                  type="button"
                  onClick={() => void handleEducatorLogout()}
                  disabled={logoutPending}
                  aria-label="Se déconnecter"
                  title="Se déconnecter"
                  className="inline-flex size-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-50"
                >
                  <LogOut aria-hidden="true" className="size-4" />
                </button>
              </div>
            )}
          />
        </div>
        {activeTab === 'players' && (
          <PlayerStats players={players} />
        )}
        {activeTab === 'matches' && (
          <MatchCallupBreakdown
            convocations={convocations}
            presentCounts={presentCounts}
            matchResults={matchResults}
            cohesionDays={cohesionDays}
            invitedCount={rosterPlayers.length}
            dataErrors={matchDataErrors}
          />
        )}
        {activeTab === 'roster' && (
          <PositionBreakdown
            players={rosterPlayers}
            stats={players}
            convocations={convocations}
            matchesPlayed={matchesPlayed}
          />
        )}
        {activeTab === 'educator' && (
          <div className="flex flex-col gap-4">
            {logoutError && <p role="alert" className="text-sm font-medium text-destructive">{logoutError}</p>}
            {educatorAccess === 'authenticated' ? (
              <>
                <nav aria-label="Rubriques éducateurs" className="grid grid-cols-2 gap-2 rounded-xl border border-accent/50 bg-muted/50 p-1.5">
                  {([
                    { key: 'matches' as const, label: 'Matchs', Icon: CalendarDays },
                    { key: 'directory' as const, label: 'Annuaire & licences', Icon: ContactRound },
                  ]).map(({ key, label, Icon }) => {
                    const isActive = educatorSection === key
                    return (
                      <button
                        key={key}
                        type="button"
                        aria-pressed={isActive}
                        onClick={() => {
                          setReturnToMatchesAfterLogin(false)
                          setEducatorSection(key)
                        }}
                        className={[
                          'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                          isActive
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-muted-foreground hover:bg-card hover:text-primary',
                        ].join(' ')}
                      >
                        <Icon aria-hidden="true" className="size-4 shrink-0" />
                        <span>{label}</span>
                      </button>
                    )
                  })}
                </nav>
                {educatorSection === 'matches' ? (
                  <MatchResultEntry
                    entries={matchResults.entries}
                    onConnect={() => {
                      setReturnToMatchesAfterLogin(true)
                      setEducatorSection('directory')
                    }}
                  />
                ) : (
                  <EducatorRoster
                    onSessionStatusChange={setEducatorAccess}
                    onEducatorChange={setEducatorIdentity}
                  />
                )}
              </>
            ) : (
              <EducatorRoster
                onSessionStatusChange={setEducatorAccess}
                onEducatorChange={setEducatorIdentity}
                onLoginSuccess={() => {
                  if (!returnToMatchesAfterLogin) return
                  setReturnToMatchesAfterLogin(false)
                  setEducatorSection('matches')
                }}
              />
            )}
          </div>
        )}
      </div>

      <nav
        aria-label="Navigation des statistiques"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-accent/60 bg-card/95 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(0,0,0,0.12)] backdrop-blur xl:hidden"
      >
        <div className="mx-auto flex max-w-lg gap-2 rounded-xl bg-muted p-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key

            return (
              <button
                key={tab.key}
                type="button"
                aria-pressed={isActive}
                onClick={() => setActiveTab(tab.key)}
                className={[
                  'min-h-11 flex-1 rounded-lg px-2 py-2 text-xs font-semibold transition-colors sm:text-sm',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-background hover:text-foreground',
                ].join(' ')}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </nav>
    </section>
  )
}
