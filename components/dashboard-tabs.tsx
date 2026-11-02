'use client'

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { CalendarDays, ContactRound, LogOut, X } from 'lucide-react'
import { ClubCrest } from '@/components/club-crest'
import { MatchCallupBreakdown } from '@/components/match-callup-breakdown'
import { PlayerStats } from '@/components/player-stats'
import { PositionBreakdown } from '@/components/position-breakdown'
import { EducatorRoster } from '@/components/educator-roster'
import { MatchResultEntry } from '@/components/match-result-entry'
import { EducatorAvatar } from '@/components/educator-avatar'
import { EducatorProfilePhotoEditor } from '@/components/educator-profile-photo-editor'
import { RefreshSheetButton } from '@/components/refresh-sheet-button'
import { ThemeToggle } from '@/components/theme-toggle'
import type { Convocation } from '@/lib/convocations'
import type { PublicPlayer } from '@/lib/players'
import type { TeamMatchResults } from '@/lib/match-results'
import type { CohesionDay } from '@/lib/cohesion'
import type { PlayerStats as PlayerStat } from '@/lib/stats'

type TabKey = 'roster' | 'educator' | 'players' | 'matches'
type EducatorSection = 'matches' | 'directory'
type EducatorAccess = 'checking' | 'unauthenticated' | 'authenticated' | 'unavailable'
type AccountRole = 'educator' | 'admin' | 'reader'
type EducatorIdentity = { username: string; displayName: string; role: AccountRole }
type ApplicationSession = 'checking' | 'unauthenticated' | 'authenticated' | 'unavailable'

export function DashboardTabs({
  players,
  rosterPlayers,
  convocations,
  matchesPlayed,
  presentCounts,
  matchResults,
  cohesionDays,
  matchDataErrors,
  updatedAt,
  children,
}: {
  players: PlayerStat[]
  rosterPlayers: PublicPlayer[]
  convocations: Convocation[]
  matchesPlayed: number
  presentCounts: Record<string, number>
  matchResults: TeamMatchResults
  cohesionDays: CohesionDay[]
  matchDataErrors: string[]
  updatedAt: string
  children: ReactNode
}) {
  const [activeTab, setActiveTab] = useState<TabKey>('roster')
  const [educatorSection, setEducatorSection] = useState<EducatorSection>('matches')
  const [returnToMatchesAfterLogin, setReturnToMatchesAfterLogin] = useState(false)
  const [educatorAccess, setEducatorAccess] = useState<EducatorAccess>('checking')
  const [educatorIdentity, setEducatorIdentity] = useState<EducatorIdentity | null>(null)
  const [applicationSession, setApplicationSession] = useState<ApplicationSession>('checking')
  const [loginUsername, setLoginUsername] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginPending, setLoginPending] = useState(false)
  const [logoutPending, setLogoutPending] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const [profilePhotoOpen, setProfilePhotoOpen] = useState(false)
  const [profilePhotoRevision, setProfilePhotoRevision] = useState(0)

  useEffect(() => {
    let active = true
    fetch('/api/educators/session', { cache: 'no-store' })
      .then(async (response) => {
        const result = await response.json()
        if (response.status === 401) {
          if (active) {
            setEducatorAccess('unauthenticated')
            setApplicationSession('unauthenticated')
          }
          return
        }
        if (!response.ok) throw new Error(result.error ?? 'Impossible de vérifier la connexion.')
        if (!active) return
        const identity = result.educator as EducatorIdentity
        setEducatorIdentity(identity)
        setEducatorAccess(identity.role === 'reader' ? 'unauthenticated' : 'authenticated')
        setApplicationSession('authenticated')
      })
      .catch(() => {
        if (active) {
          setEducatorAccess('unavailable')
          setApplicationSession('unavailable')
        }
      })
    return () => { active = false }
  }, [])

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoginPending(true)
    setLoginError('')
    try {
      const response = await fetch('/api/educators/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Connexion impossible.')
      const identity = result.educator as EducatorIdentity
      setEducatorIdentity(identity)
      setEducatorAccess(identity.role === 'reader' ? 'unauthenticated' : 'authenticated')
      setApplicationSession('authenticated')
      setLoginPassword('')
      if (identity.role === 'reader' && activeTab === 'educator') setActiveTab('roster')
      window.dispatchEvent(new Event('educator-session-changed'))
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Connexion impossible.')
    } finally {
      setLoginPending(false)
    }
  }

  const handleEducatorLogout = async () => {
    setLogoutPending(true)
    setLogoutError('')
    try {
      const response = await fetch('/api/educators/session', { method: 'DELETE' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Déconnexion impossible.')
      setEducatorIdentity(null)
      setApplicationSession('unauthenticated')
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

  const handleEducatorChange = useCallback((identity: EducatorIdentity | null) => {
    setEducatorIdentity((current) => {
      if (
        current?.username === identity?.username &&
        current?.displayName === identity?.displayName &&
        current?.role === identity?.role
      ) return current
      return identity
    })
    if (!identity) setApplicationSession('unauthenticated')
  }, [])

  const handleEducatorAccessChange = useCallback((status: EducatorAccess) => {
    setEducatorAccess(status)
    if (status === 'unauthenticated') setApplicationSession('unauthenticated')
  }, [])

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'roster', label: 'Effectifs' },
    { key: 'players', label: 'Stats Joueurs' },
    { key: 'matches', label: 'Stats Matchs' },
    ...(educatorIdentity?.role === 'admin' || educatorIdentity?.role === 'educator'
      ? [{ key: 'educator' as const, label: 'Éducateurs' }]
      : []),
  ]
  const mainHeader = (
    <header className="relative z-20 border-b-2 border-accent bg-gradient-to-b from-[oklch(0.32_0.06_272)] to-primary text-primary-foreground">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:gap-4 sm:py-5 md:flex-row md:items-center md:justify-between md:px-6 md:py-6">
        <div className="flex items-center gap-3 sm:gap-4 md:gap-5">
          <ClubCrest className="size-14 shrink-0 sm:size-16 md:size-24" />
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="text-xl font-extrabold tracking-wide uppercase sm:text-2xl md:text-4xl">ES Genech</h1>
            <p className="text-xs text-accent sm:text-sm md:text-base">Toujours ensemble, allez l’ESG</p>
            <p className="text-sm text-white sm:text-base">Groupe U11 - Saison 2026/2027</p>
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-2 md:items-end">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 md:justify-end">
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <ThemeToggle />
              <RefreshSheetButton compact />
            </div>
            {educatorIdentity && (
              <div className="flex min-w-0 items-center gap-1.5 rounded-xl border border-primary-foreground/20 bg-primary-foreground/5 px-1.5 py-1 sm:gap-2 sm:px-2 sm:py-1.5">
                <button
                  type="button"
                  onClick={() => setProfilePhotoOpen(true)}
                  aria-label="Afficher ou changer ma photo de profil"
                  title="Ma photo de profil"
                  className="shrink-0 rounded-full ring-2 ring-accent/70 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white"
                >
                  <EducatorAvatar username={educatorIdentity.username} revision={profilePhotoRevision} size="size-10 sm:size-11" />
                </button>
                <span className="min-w-0 text-[11px] font-semibold leading-tight sm:text-xs">
                  <span className="block max-w-20 truncate text-sm sm:max-w-none">
                    {educatorIdentity.displayName.trim().split(/\s+/)[0]}
                  </span>
                  <span className="block text-primary-foreground/70">
                    {educatorIdentity.role === 'admin' ? 'Admin' :
                      educatorIdentity.role === 'educator' ? 'Éducateur' : 'Lecteur'}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => void handleEducatorLogout()}
                  disabled={logoutPending}
                  aria-label="Se déconnecter"
                  title="Se déconnecter"
                  className="inline-flex size-10 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-white/10 text-sm font-semibold text-white hover:bg-white/20 disabled:opacity-50 sm:size-auto sm:min-h-10 sm:px-3"
                >
                  <LogOut aria-hidden="true" className="size-4" />
                  <span className="hidden sm:inline">Déconnexion</span>
                </button>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            {logoutError && <p role="alert" className="text-xs font-medium text-red-200">{logoutError}</p>}
            <p className="text-xs text-primary-foreground/70">Synchronisé le {updatedAt}</p>
          </div>
        </div>
      </div>
    </header>
  )

  if (applicationSession !== 'authenticated') {
    return (
      <>
        {mainHeader}
        <main className="relative z-20 mx-auto flex max-w-7xl flex-col gap-4 px-4 pt-6 pb-24 md:gap-6 md:px-6 md:pt-8 md:pb-24 xl:pb-8">
          <section className="mx-auto w-full max-w-md rounded-2xl border border-accent/50 bg-card p-6 shadow-lg">
            <h2 className="text-xl font-black text-primary">Connexion à l’application</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Connectez-vous pour accéder aux rubriques selon votre rôle. La session reste active 8 heures.
            </p>
            {applicationSession === 'checking' ? (
              <p role="status" className="mt-5 text-sm text-muted-foreground">Vérification de la connexion…</p>
            ) : applicationSession === 'unavailable' ? (
              <p role="alert" className="mt-5 text-sm font-medium text-destructive">
                La connexion n’est pas disponible actuellement. Réessayez dans quelques instants.
              </p>
            ) : (
              <form onSubmit={handleLogin} className="mt-5 grid gap-3">
                <label className="grid gap-1 text-sm font-semibold">
                  Identifiant ou adresse e-mail
                  <input
                    required
                    autoComplete="username"
                    value={loginUsername}
                    onChange={(event) => setLoginUsername(event.target.value)}
                    className="h-11 rounded-lg border border-accent/50 bg-background px-3 font-normal"
                  />
                </label>
                <label className="grid gap-1 text-sm font-semibold">
                  Mot de passe
                  <input
                    required
                    type="password"
                    autoComplete="current-password"
                    value={loginPassword}
                    onChange={(event) => setLoginPassword(event.target.value)}
                    className="h-11 rounded-lg border border-accent/50 bg-background px-3 font-normal"
                  />
                </label>
                {loginError && <p role="alert" className="text-sm font-medium text-destructive">{loginError}</p>}
                <button
                  type="submit"
                  disabled={loginPending}
                  className="mt-1 min-h-11 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50"
                >
                  {loginPending ? 'Connexion…' : 'Se connecter'}
                </button>
              </form>
            )}
          </section>
          {children}
        </main>
      </>
    )
  }

  return (
    <>
    {mainHeader}
    <main className="relative z-20 mx-auto flex max-w-7xl flex-col gap-4 px-4 pt-6 pb-24 md:gap-6 md:px-6 md:pt-8 md:pb-24 xl:pb-8">
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

      <div className="min-w-0 p-3 sm:p-4 md:p-5">
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
                    initialEducator={educatorIdentity}
                    photoRevision={profilePhotoRevision}
                    onSessionStatusChange={handleEducatorAccessChange}
                    onEducatorChange={handleEducatorChange}
                  />
                )}
              </>
            ) : (
              <EducatorRoster
                initialEducator={educatorIdentity}
                photoRevision={profilePhotoRevision}
                onSessionStatusChange={handleEducatorAccessChange}
                onEducatorChange={handleEducatorChange}
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

      {profilePhotoOpen && educatorIdentity && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="profile-photo-dialog-title"
          className="fixed inset-0 z-[70] grid place-items-center bg-[#172554]/60 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setProfilePhotoOpen(false)
          }}
        >
          <section className="w-full max-w-md rounded-2xl border border-accent/60 bg-card p-5 shadow-2xl">
            <header className="mb-4 flex items-center justify-between gap-3">
              <h2 id="profile-photo-dialog-title" className="text-lg font-black text-primary">Ma photo de profil</h2>
              <button
                type="button"
                onClick={() => setProfilePhotoOpen(false)}
                aria-label="Fermer"
                className="inline-flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </header>
            <EducatorProfilePhotoEditor
              username={educatorIdentity.username}
              revision={profilePhotoRevision}
              onPhotoChange={() => setProfilePhotoRevision((revision) => revision + 1)}
            />
          </section>
        </div>
      )}
    </section>
    {children}
    </main>
    </>
  )
}
