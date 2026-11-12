'use client'

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { BarChart3, CalendarDays, Dumbbell, Ellipsis, LogOut, Radio, Shirt, UsersRound, X, type LucideIcon } from 'lucide-react'
import { ClubCrest } from '@/components/club-crest'
import { MatchCallupBreakdown } from '@/components/match-callup-breakdown'
import { PlayerStats } from '@/components/player-stats'
import { PositionBreakdown } from '@/components/position-breakdown'
import { EducatorRoster } from '@/components/educator-roster'
import { MatchResultEntry } from '@/components/match-result-entry'
import { MatchDayHome } from '@/components/match-day-home'
import { EducatorAvatar } from '@/components/educator-avatar'
import { EducatorProfilePhotoEditor } from '@/components/educator-profile-photo-editor'
import { RefreshSheetButton } from '@/components/refresh-sheet-button'
import { ThemeToggle } from '@/components/theme-toggle'
import { LiveMatchConsole } from '@/components/live-match-console'
import { TrainingAttendanceManager } from '@/components/training-attendance-manager'
import type { Convocation } from '@/lib/convocations'
import type { PublicPlayer } from '@/lib/players'
import type { MatchSheetEntry, TeamMatchResults } from '@/lib/match-results'
import type { TrainingAttendanceSession } from '@/lib/training-attendance'
import type { CohesionDay } from '@/lib/cohesion'
import type { PlayerStats as PlayerStat } from '@/lib/stats'

type TabKey = 'roster' | 'educator' | 'training' | 'stats' | 'matches'
type StatsSection = 'players' | 'matches'
type MatchFocus = {
  date: string
  team: 'E1' | 'E2'
  slotColumn: number
  requestId: number
}
type EducatorAccess = 'checking' | 'unauthenticated' | 'authenticated' | 'unavailable'
type AccountRole = 'educator' | 'admin' | 'reader'
type EducatorIdentity = { username: string; displayName: string; role: AccountRole }
type ApplicationSession = 'checking' | 'unauthenticated' | 'authenticated' | 'unavailable'
type ActiveLiveMatch = {
  match: MatchSheetEntry
  phase: 'firstHalf' | 'halftime' | 'secondHalf' | 'finished'
}

const EMPTY_PLAYER_NUMBERS: number[] = []

function isMatchSheetEntry(value: unknown): value is MatchSheetEntry {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const entry = value as Record<string, unknown>
  return (entry.team === 'E1' || entry.team === 'E2') &&
    typeof entry.date === 'string' &&
    typeof entry.slotColumn === 'number' &&
    Number.isSafeInteger(entry.slotColumn) &&
    typeof entry.opponent === 'string' &&
    typeof entry.competition === 'string' &&
    typeof entry.homeAway === 'string' &&
    typeof entry.kickoffTime === 'string' &&
    typeof entry.resultLabel === 'string' &&
    (typeof entry.goalsFor === 'number' || entry.goalsFor === null) &&
    (typeof entry.goalsAgainst === 'number' || entry.goalsAgainst === null)
}

function isActiveLiveMatch(value: unknown): value is ActiveLiveMatch {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const liveMatch = value as Record<string, unknown>
  return isMatchSheetEntry(liveMatch.match) &&
    ['firstHalf', 'halftime', 'secondHalf', 'finished'].includes(String(liveMatch.phase))
}

export function DashboardTabs({
  players,
  rosterPlayers,
  convocations,
  matchesPlayed,
  convocationDates,
  presentCounts,
  matchResults,
  trainingAttendance,
  trainingAttendanceError,
  cohesionDays,
  matchDataErrors,
  updatedAt,
  children,
}: {
  players: PlayerStat[]
  rosterPlayers: PublicPlayer[]
  convocations: Convocation[]
  matchesPlayed: number
  convocationDates: string[]
  presentCounts: Record<string, number>
  matchResults: TeamMatchResults
  trainingAttendance: TrainingAttendanceSession[]
  trainingAttendanceError: boolean
  cohesionDays: CohesionDay[]
  matchDataErrors: string[]
  updatedAt: string
  children: ReactNode
}) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabKey>('matches')
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)
  const [statsSection, setStatsSection] = useState<StatsSection>('players')
  const [matchFocuses, setMatchFocuses] = useState<Partial<Record<'E1' | 'E2', MatchFocus>>>({})
  const [callupFocus, setCallupFocus] = useState<{ date: string; requestId: number } | null>(null)
  const [activeMatchTeam, setActiveMatchTeam] = useState<'E1' | 'E2' | null>(null)
  const [liveMatches, setLiveMatches] = useState<ActiveLiveMatch[]>([])
  const [liveMatchToOpen, setLiveMatchToOpen] = useState<MatchSheetEntry | null>(null)
  const [liveMatchError, setLiveMatchError] = useState('')
  const matchFocusSequence = useRef(0)
  const [returnToMatchesAfterLogin, setReturnToMatchesAfterLogin] = useState(false)
  const [educatorAccess, setEducatorAccess] = useState<EducatorAccess>('checking')
  const [educatorIdentity, setEducatorIdentity] = useState<EducatorIdentity | null>(null)
  const [applicationSession, setApplicationSession] = useState<ApplicationSession>('checking')
  const [loginUsername, setLoginUsername] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [loginError, setLoginError] = useState('')
  const [loginRetryAvailable, setLoginRetryAvailable] = useState(false)
  const [loginPending, setLoginPending] = useState(false)
  const [logoutPending, setLogoutPending] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const [profilePhotoOpen, setProfilePhotoOpen] = useState(false)
  const [profilePhotoRevision, setProfilePhotoRevision] = useState(0)

  useEffect(() => {
    if (!moreMenuOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMoreMenuOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [moreMenuOpen])

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

  useEffect(() => {
    if (educatorAccess !== 'authenticated') {
      setLiveMatches([])
      setLiveMatchError('')
      return
    }

    let active = true
    const loadLiveMatches = () => {
      fetch('/api/educators/live-match?active=1', { cache: 'no-store' })
        .then(async (response) => {
          const result = await response.json() as { error?: string; matches?: unknown }
          if (!response.ok) throw new Error(result.error ?? 'Impossible de charger les matchs en direct.')
          if (!Array.isArray(result.matches) || !result.matches.every(isActiveLiveMatch)) {
            throw new Error('La liste des matchs en direct reçue est invalide.')
          }
          if (active) {
            setLiveMatches(result.matches)
            setLiveMatchError('')
          }
        })
        .catch((error: unknown) => {
          if (!active) return
          setLiveMatchError(error instanceof Error ? error.message : 'Impossible de charger les matchs en direct.')
        })
    }

    loadLiveMatches()
    const interval = window.setInterval(loadLiveMatches, 30_000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [educatorAccess])

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoginPending(true)
    setLoginError('')
    setLoginRetryAvailable(false)
    let serviceUnavailable = false
    try {
      const response = await fetch('/api/educators/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword, rememberMe }),
      })
      const result = await response.json()
      serviceUnavailable = response.status >= 500
      if (!response.ok) throw new Error(result.error ?? 'Connexion impossible.')
      const identity = result.educator as EducatorIdentity
      setEducatorIdentity(identity)
      setEducatorAccess(identity.role === 'reader' ? 'unauthenticated' : 'authenticated')
      setApplicationSession('authenticated')
      setLoginPassword('')
      if (identity.role === 'reader' && (activeTab === 'educator' || activeTab === 'training')) setActiveTab('roster')
      window.dispatchEvent(new Event('educator-session-changed'))
      router.refresh()
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Connexion impossible.')
      setLoginRetryAvailable(serviceUnavailable || error instanceof TypeError)
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
      window.dispatchEvent(new Event('educator-session-changed'))
      router.refresh()
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
    { key: 'matches', label: 'Matchs' },
    { key: 'roster', label: 'Fiches joueurs' },
    { key: 'stats', label: 'Statistiques U11' },
    ...(educatorIdentity?.role === 'admin' || educatorIdentity?.role === 'educator'
      ? [{ key: 'educator' as const, label: 'Annuaire' }]
      : []),
    ...(educatorIdentity?.role === 'admin' || educatorIdentity?.role === 'educator'
      ? [{ key: 'training' as const, label: 'Entraînements' }]
      : []),
  ]
  const canAccessTraining = educatorIdentity?.role === 'admin' || educatorIdentity?.role === 'educator'
  const mobileMainTabs: Array<{ key: TabKey | 'more'; label: string; icon: LucideIcon }> = canAccessTraining
    ? [
        { key: 'matches', label: 'Matchs', icon: CalendarDays },
        { key: 'training', label: 'Entraînements', icon: Dumbbell },
        { key: 'roster', label: 'Joueurs', icon: Shirt },
        { key: 'more', label: 'Plus', icon: Ellipsis },
      ]
    : [
        { key: 'matches', label: 'Matchs', icon: CalendarDays },
        { key: 'stats', label: 'Stats', icon: BarChart3 },
        { key: 'roster', label: 'Joueurs', icon: Shirt },
      ]
  const moreMenuTabs = tabs.filter((tab) => !mobileMainTabs.some((mobileTab) => mobileTab.key === tab.key))
  const moreMenuIcons: Partial<Record<TabKey, LucideIcon>> = {
    stats: BarChart3,
    educator: UsersRound,
    training: Dumbbell,
  }
  const mainHeader = (
    <header className="relative z-20 border-b-2 border-[#d4af37] bg-gradient-to-r from-[#172554] via-[#1e3a8a] to-[#172554] text-white shadow-md">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:gap-4 sm:py-5 md:flex-row md:items-center md:justify-between md:px-6 md:py-5">
        <div className="flex items-center gap-3 sm:gap-4 md:gap-5">
          <ClubCrest className="size-14 shrink-0 rounded-full ring-2 ring-[#d4af37] shadow-lg sm:size-16 md:size-20" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <h1 className="text-xl font-black tracking-wider uppercase text-white sm:text-2xl md:text-3xl">ES Genech</h1>
            <p className="text-xs font-extrabold tracking-wide text-amber-300 sm:text-sm">Toujours ensemble, allez l’ESG</p>
            <p className="text-xs text-white/80 font-medium sm:text-sm">Groupe U11 · Saison 2026/2027</p>
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-2 md:items-end">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 md:justify-end">
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <ThemeToggle />
              <RefreshSheetButton compact />
            </div>
            {educatorIdentity && (
              <div className="flex min-w-0 items-center gap-1.5 rounded-xl border border-amber-400/30 bg-white/10 px-2 py-1 backdrop-blur-sm sm:gap-2 sm:px-2.5 sm:py-1.5">
                <button
                  type="button"
                  onClick={() => setProfilePhotoOpen(true)}
                  aria-label="Afficher ou changer ma photo de profil"
                  title="Ma photo de profil"
                  className="shrink-0 rounded-full ring-2 ring-amber-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white"
                >
                  <EducatorAvatar username={educatorIdentity.username} revision={profilePhotoRevision} size="size-10 sm:size-11" />
                </button>
                <span className="min-w-0 text-[11px] font-semibold leading-tight sm:text-xs">
                  <span className="block max-w-20 truncate text-sm font-bold text-white sm:max-w-none">
                    {educatorIdentity.displayName.trim().split(/\s+/)[0]}
                  </span>
                  <span className="block text-amber-300 font-semibold">
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
                  className="inline-flex size-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-white/10 text-xs font-semibold text-white hover:bg-white/20 disabled:opacity-50 sm:size-auto sm:min-h-9 sm:px-2.5"
                >
                  <LogOut aria-hidden="true" className="size-3.5" />
                  <span className="hidden sm:inline">Déconnexion</span>
                </button>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            {logoutError && <p role="alert" className="text-xs font-medium text-red-200">{logoutError}</p>}
            <p className="text-[11px] text-white/70">Synchronisé le {updatedAt}</p>
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
          <section className="mx-auto w-full max-w-md overflow-hidden rounded-2xl border border-amber-400/40 bg-card shadow-2xl">
            <div className="bg-gradient-to-r from-[#172554] via-[#1e3a8a] to-[#172554] p-5 text-center text-white border-b border-amber-400/30">
              <ClubCrest className="mx-auto size-16 ring-2 ring-amber-400/80 shadow-md" />
              <h2 className="mt-3 text-xl font-black text-white">Connexion à l’application</h2>
              <p className="mt-1 text-xs text-amber-300 font-bold">ES Genech · Groupe U11</p>
            </div>
            <div className="p-6">
              {applicationSession === 'checking' ? (
                <p role="status" className="mt-5 text-sm text-center text-muted-foreground">Vérification de la connexion…</p>
              ) : applicationSession === 'unavailable' ? (
                <p role="alert" className="mt-5 text-sm text-center font-medium text-destructive">
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
                  <label className="flex items-center gap-2 pt-1 text-xs text-muted-foreground select-none cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(event) => setRememberMe(event.target.checked)}
                      className="size-4 rounded border-accent/60 accent-primary"
                    />
                    <span>Rester connecté sur cet appareil (30 jours)</span>
                  </label>
                  {loginError && <p role="alert" className="text-sm font-medium text-destructive">{loginError}</p>}
                  {loginRetryAvailable && (
                    <p className="text-xs text-muted-foreground">
                      Tes identifiants sont conservés. Réessaie quand le service sera de nouveau disponible.
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={loginPending}
                    className="mt-2 min-h-11 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:brightness-105 active:scale-95 px-4 text-sm font-black text-blue-950 shadow-md transition-all disabled:opacity-50"
                  >
                    {loginPending ? 'Connexion…' : loginRetryAvailable ? 'Réessayer' : 'Se connecter'}
                  </button>
                </form>
              )}
            </div>
          </section>
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
                  'flex-1 rounded-full px-4 py-2.5 text-sm transition-all duration-200 xl:flex-none xl:text-left',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  isActive
                    ? 'bg-gradient-to-r from-[#172554] via-[#1e3a8a] to-[#172554] text-amber-300 font-extrabold shadow-md border border-amber-400/40'
                    : 'text-muted-foreground font-semibold hover:bg-background hover:text-foreground',
                ].join(' ')}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </nav>

      <div className="min-w-0 p-3 sm:p-4 md:p-5">
        {activeTab === 'stats' && (
          <div className="flex flex-col gap-4">
            <nav aria-label="Statistiques" className="flex gap-2 rounded-xl border border-accent/50 bg-muted/50 p-1.5">
              {([
                { key: 'players' as const, label: 'Joueurs' },
                { key: 'matches' as const, label: 'Matchs' },
              ]).map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={statsSection === key}
                  onClick={() => setStatsSection(key)}
                  className={[
                    'min-h-10 flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-all duration-200',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37] focus-visible:ring-offset-2',
                    statsSection === key
                      ? 'bg-gradient-to-r from-[#172554] via-[#1e3a8a] to-[#172554] text-amber-300 font-extrabold shadow-md border border-amber-400/40'
                      : 'text-muted-foreground hover:bg-card hover:text-[#172554]',
                  ].join(' ')}
                >
                  {label}
                </button>
              ))}
            </nav>
            {statsSection === 'players' ? (
              <PlayerStats players={players} />
            ) : (
              <MatchCallupBreakdown
                convocations={convocations}
                presentCounts={presentCounts}
                matchResults={matchResults}
                cohesionDays={cohesionDays}
                invitedCount={rosterPlayers.length}
                dataErrors={matchDataErrors}
              />
            )}
          </div>
        )}
        {activeTab === 'matches' && (
          <div className="flex flex-col gap-5">
            <MatchDayHome
              entries={matchResults.entries}
              convocations={convocations}
              convocationDates={convocationDates}
              canManageMatches={educatorAccess === 'authenticated'}
              onSelectMatch={(entry) => {
                const focus = {
                  date: entry.date,
                  team: entry.team,
                  slotColumn: entry.slotColumn,
                  requestId: ++matchFocusSequence.current,
                }
                setMatchFocuses((current) => ({ ...current, [entry.team]: focus }))
                setActiveMatchTeam(entry.team)
              }}
              onOpenCallups={(date) => {
                setCallupFocus({ date, requestId: Date.now() })
                document.getElementById('match-calendar')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
            />
            <div id="match-calendar" className="scroll-mt-4">
              <MatchResultEntry
                entries={matchResults.entries}
                matchesPlayed={matchesPlayed}
                players={rosterPlayers}
                playerStats={players}
                convocations={convocations}
                convocationDates={convocationDates}
                trainingAttendance={trainingAttendance}
                trainingAttendanceError={trainingAttendanceError}
                focusMatch={activeMatchTeam ? matchFocuses[activeMatchTeam] ?? null : null}
                focusCallups={callupFocus}
                onConnect={() => {
                  setReturnToMatchesAfterLogin(true)
                  setActiveTab('educator')
                }}
              />
            </div>
          </div>
        )}
        {activeTab === 'roster' && (
          <PositionBreakdown
            players={rosterPlayers}
            stats={players}
            convocations={convocations}
            matchesPlayed={matchesPlayed}
            matchResults={matchResults}
            trainingAttendance={trainingAttendance}
          />
        )}
        {activeTab === 'training' && educatorAccess === 'authenticated' && educatorIdentity && (
          <TrainingAttendanceManager players={rosterPlayers} sessions={trainingAttendance} loadError={trainingAttendanceError} />
        )}
        {activeTab === 'educator' && (
          <div className="flex flex-col gap-4">
            {educatorAccess === 'authenticated' ? (
              <EducatorRoster
                initialEducator={educatorIdentity}
                photoRevision={profilePhotoRevision}
                onSessionStatusChange={handleEducatorAccessChange}
                onEducatorChange={handleEducatorChange}
              />
            ) : (
              <EducatorRoster
                initialEducator={educatorIdentity}
                photoRevision={profilePhotoRevision}
                onSessionStatusChange={handleEducatorAccessChange}
                onEducatorChange={handleEducatorChange}
                onLoginSuccess={() => {
                  if (!returnToMatchesAfterLogin) return
                  setReturnToMatchesAfterLogin(false)
                  setActiveTab('matches')
                }}
              />
            )}
          </div>
        )}
      </div>

      {moreMenuOpen && (
        <button
          type="button"
          aria-label="Fermer le menu Plus"
          onClick={() => setMoreMenuOpen(false)}
          className="fixed inset-0 z-40 bg-[#07102a]/20 xl:hidden"
        />
      )}
      <nav
        aria-label="Navigation principale"
        className="fixed inset-x-0 bottom-0 z-50 overflow-visible border-t border-accent/60 bg-card/90 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-8px_28px_rgba(23,37,84,0.12)] backdrop-blur-xl xl:hidden"
      >
        {moreMenuOpen && moreMenuTabs.length > 0 && (
          <div
            id="mobile-more-menu"
            className="absolute right-3 bottom-[calc(100%+0.75rem)] z-10 w-56 rounded-2xl border border-[#d4af37]/40 bg-card/95 p-2 shadow-2xl backdrop-blur-xl"
          >
            {moreMenuTabs.map((tab) => {
              const Icon = moreMenuIcons[tab.key] ?? UsersRound
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.key)
                    setMoreMenuOpen(false)
                  }}
                  className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-bold text-foreground transition hover:bg-gradient-to-r hover:from-[#172554]/10 hover:via-[#1e3a8a]/10 hover:to-[#172554]/10 hover:text-[#172554] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37]"
                >
                  <Icon aria-hidden="true" className="size-5 text-[#d4af37]" />
                  {tab.label}
                </button>
              )
            })}
          </div>
        )}
        <div className={`mx-auto grid w-full max-w-lg gap-1 rounded-2xl bg-muted/90 p-1 ${mobileMainTabs.length === 4 ? 'grid-cols-4' : 'grid-cols-3'}`}>
          {mobileMainTabs.map((tab) => {
            const Icon = tab.icon
            const isMore = tab.key === 'more'
            const isActive = isMore
              ? moreMenuOpen || moreMenuTabs.some((menuTab) => menuTab.key === activeTab)
              : activeTab === tab.key

            return (
              <button
                key={tab.key}
                type="button"
                aria-pressed={isActive}
                aria-label={tab.label}
                aria-controls={isMore ? 'mobile-more-menu' : undefined}
                aria-expanded={isMore ? moreMenuOpen : undefined}
                onClick={() => {
                  if (tab.key === 'more') {
                    setMoreMenuOpen((open) => !open)
                    return
                  }
                  setMoreMenuOpen(false)
                  setActiveTab(tab.key)
                }}
                className={[
                  'flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[10px] leading-tight transition-all sm:text-[11px]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  isActive
                    ? 'border border-amber-400/45 bg-gradient-to-br from-[#172554] via-[#1e3a8a] to-[#172554] font-extrabold text-amber-300 shadow-md'
                    : 'font-semibold text-muted-foreground hover:bg-background hover:text-foreground',
                ].join(' ')}
              >
                <Icon aria-hidden="true" className="size-5 shrink-0" />
                <span className="max-w-full truncate whitespace-nowrap">{tab.label}</span>
              </button>
            )
          })}
        </div>
      </nav>

      {liveMatches.length > 0 && (
        <div className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-3 z-40 flex max-w-[calc(100vw-1.5rem)] flex-col items-end gap-2 xl:bottom-6">
          {liveMatches.map(({ match, phase }) => {
            const entry = match
            const isE1 = entry.team === 'E1'
            const phaseLabel = phase === 'finished'
              ? 'Récapitulatif à valider'
              : phase === 'halftime'
                ? 'Reprendre après la mi-temps'
                : 'Reprendre le direct'
            return (
              <button
                key={`live-${entry.team}-${entry.slotColumn}-${entry.date}`}
                type="button"
                onClick={() => setLiveMatchToOpen(entry)}
                aria-label={`${phaseLabel} · Équipe ${isE1 ? '1' : '2'} contre ${entry.opponent || 'adversaire'}`}
                className={[
                  'inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border px-3 py-2 text-left text-white shadow-xl transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white',
                  isE1
                    ? 'border-sky-300/70 bg-gradient-to-r from-[#172554] to-blue-900'
                    : 'border-amber-300/70 bg-gradient-to-r from-[#422006] to-amber-800',
                ].join(' ')}
              >
                <span className={[
                  'flex size-7 shrink-0 items-center justify-center rounded-full',
                  isE1 ? 'bg-sky-300/20 text-sky-200' : 'bg-amber-300/20 text-amber-200',
                ].join(' ')}>
                  <Radio aria-hidden="true" className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[10px] font-black uppercase tracking-wide">
                    Direct · Équipe {isE1 ? '1' : '2'}
                  </span>
                  <span className="block max-w-52 truncate text-[10px] font-semibold text-white/75">
                    {entry.opponent || 'Adversaire'} · {phaseLabel}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      )}
      {liveMatchError && educatorAccess === 'authenticated' && !liveMatchToOpen && (
        <p role="status" className="fixed right-3 bottom-[calc(9rem+env(safe-area-inset-bottom))] z-40 max-w-[calc(100vw-1.5rem)] rounded-lg bg-rose-950 px-3 py-2 text-xs font-semibold text-white shadow-lg xl:bottom-20">
          {liveMatchError}
        </p>
      )}
      {liveMatchToOpen && (
        <LiveMatchConsole
          match={liveMatchToOpen}
          players={rosterPlayers}
          starters={EMPTY_PLAYER_NUMBERS}
          substitutes={EMPTY_PLAYER_NUMBERS}
          onClose={() => setLiveMatchToOpen(null)}
          onFinalized={() => {
            setLiveMatches((current) => current.filter((entry) =>
              entry.match.team !== liveMatchToOpen.team ||
              entry.match.slotColumn !== liveMatchToOpen.slotColumn ||
              entry.match.date !== liveMatchToOpen.date,
            ))
            setLiveMatchToOpen(null)
            router.refresh()
          }}
        />
      )}

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
