'use client'

import { useState, useMemo, useEffect, useLayoutEffect, useCallback, useRef, type FormEvent } from 'react'
import { Search, Copy, Check, CheckCircle2, Award, Save, ChevronDown, ChevronUp, ChevronRight, Pencil, Plus, X, ContactRound, UsersRound, KeyRound, LockKeyhole } from 'lucide-react'
import type { Player, PublicPlayer } from '@/lib/players'
import { matchesSearch } from '@/lib/search'
import { ParentAvatar } from '@/components/parent-avatar'
import { EducatorDirectory } from '@/components/educator-directory'
import { EducatorAccountManagement } from '@/components/educator-account-management'
import { EducatorAvatar } from '@/components/educator-avatar'
import { prepareEducatorPhoto } from '@/lib/prepare-educator-photo'

type EducatorIdentity = { username: string; displayName: string; role: 'educator' | 'admin' | 'reader' }

const POSITION_ORDER = ['gard', 'déf', 'def', 'lat', 'cent', 'mil', 'ail', 'att', 'av']

const positionRank = (position: string | null) => {
  if (!position) return POSITION_ORDER.length
  const lower = position.toLowerCase()
  const index = POSITION_ORDER.findIndex((key) => lower.startsWith(key))
  return index === -1 ? POSITION_ORDER.length : index
}

type PlayerPhones = { legacyPhone: string; fatherPhone: string; motherPhone: string }
type EducatorPlayer = PublicPlayer & Pick<Player, 'licenseNumber'>
type ParentKey = 'father' | 'mother'
type PhoneEditor = { number: number; name: string; parent: ParentKey | null; value: string }
type DirectoryView = 'educators' | 'players' | 'accounts'
type EducatorSessionStatus = 'checking' | 'unauthenticated' | 'authenticated' | 'unavailable'
type PhoneEncryptionDiagnostics = {
  keyFormatValid: boolean
  encryptedValues: number
  unreadableValues: number
  plaintextValues: number
  missingTabs: string[]
}

import { PhoneActionButtons } from '@/components/phone-action-buttons'

export function EducatorRoster({
  initialEducator = null,
  photoRevision = 0,
  onSessionStatusChange,
  onEducatorChange,
  onLoginSuccess,
}: {
  initialEducator?: EducatorIdentity | null
  photoRevision?: number
  onSessionStatusChange?: (status: EducatorSessionStatus) => void
  onEducatorChange?: (educator: EducatorIdentity | null) => void
  onLoginSuccess?: () => void
}) {
  const [players, setPlayers] = useState<EducatorPlayer[]>([])
  const [query, setQuery] = useState('')
  const [directoryView, setDirectoryView] = useState<DirectoryView>('players')
  const [addProfileChooserOpen, setAddProfileChooserOpen] = useState(false)
  const [educatorAddRequest, setEducatorAddRequest] = useState(0)
  const [accountAddRequest, setAccountAddRequest] = useState(0)
  const [expandedPlayers, setExpandedPlayers] = useState<Set<number>>(() => new Set())
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null)
  const positionFiltersRef = useRef<HTMLElement | null>(null)
  const [hasMorePositions, setHasMorePositions] = useState(false)
  const shouldScrollToTopAfterCollapse = useRef(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [educator, setEducator] = useState<EducatorIdentity | null>(initialEducator)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [phones, setPhones] = useState<Record<number, PlayerPhones>>({})
  const [isPhoneDevice, setIsPhoneDevice] = useState(false)
  const [phoneEditor, setPhoneEditor] = useState<PhoneEditor | null>(null)
  const [migrationRequired, setMigrationRequired] = useState(false)
  const [migrationBackupConfirmed, setMigrationBackupConfirmed] = useState(false)
  const [sessionChecked, setSessionChecked] = useState(Boolean(initialEducator))
  const [requestPending, setRequestPending] = useState(false)
  const [diagnosticPending, setDiagnosticPending] = useState(false)
  const [diagnosticError, setDiagnosticError] = useState('')
  const [phoneDiagnostics, setPhoneDiagnostics] = useState<PhoneEncryptionDiagnostics | null>(null)
  const [authError, setAuthError] = useState('')
  const [notice, setNotice] = useState('')

  const loadPrivatePlayers = useCallback(async () => {
    const response = await fetch('/api/educators/players', { cache: 'no-store' })
    const result = await response.json()
    if (response.status === 401) {
      onSessionStatusChange?.('unauthenticated')
      setEducator(null)
      onEducatorChange?.(null)
      setPlayers([])
      setPhones({})
      setPhoneEditor(null)
      return
    }
    if (!response.ok) throw new Error(result.error ?? 'Impossible de charger les joueurs.')
    setPlayers(result.players as EducatorPlayer[])
  }, [onEducatorChange, onSessionStatusChange])

  const loadPhoneContacts = useCallback(async () => {
    setRequestPending(true)
    setAuthError('')
    try {
      const response = await fetch('/api/educators/contacts', { cache: 'no-store' })
      const result = await response.json()
      if (response.status === 401) {
        onSessionStatusChange?.('unauthenticated')
        setEducator(null)
        onEducatorChange?.(null)
        setPhones({})
        setPhoneEditor(null)
        setPlayers([])
        return
      }
      if (response.status === 409 && result.migrationRequired) {
        onSessionStatusChange?.('authenticated')
        setEducator(result.educator)
        onEducatorChange?.(result.educator)
        setPhones({})
        setPhoneEditor(null)
        setMigrationRequired(true)
        return
      }
      if (!response.ok) throw new Error(result.error ?? 'Impossible de charger les coordonnées.')

      const nextPhones = Object.fromEntries(
        (result.phones as Array<{ number: number } & PlayerPhones>).map(({ number, ...contacts }) => [number, contacts]),
      ) as Record<number, PlayerPhones>
      onSessionStatusChange?.('authenticated')
      setEducator(result.educator)
      onEducatorChange?.(result.educator)
      setPhones(nextPhones)
      setMigrationRequired(false)
    } catch (error) {
      onSessionStatusChange?.(initialEducator ? 'authenticated' : 'unavailable')
      const message = error instanceof Error ? error.message : 'Impossible de charger les coordonnées.'
      setAuthError(initialEducator
        ? `Votre session reste active, mais les téléphones ne sont pas disponibles. Les données des joueurs sont chargées séparément. (${message})`
        : message)
    } finally {
      setRequestPending(false)
      setSessionChecked(true)
    }
  }, [initialEducator, onEducatorChange, onSessionStatusChange])

  const runPhoneDiagnostics = async () => {
    setDiagnosticPending(true)
    setDiagnosticError('')
    setPhoneDiagnostics(null)
    try {
      const response = await fetch('/api/educators/contacts/diagnostics', { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Diagnostic impossible.')
      setPhoneDiagnostics(result as PhoneEncryptionDiagnostics)
    } catch (error) {
      setDiagnosticError(error instanceof Error ? error.message : 'Diagnostic impossible.')
    } finally {
      setDiagnosticPending(false)
    }
  }

  useEffect(() => {
    if (initialEducator) {
      setEducator(initialEducator)
      setSessionChecked(true)
    }
    void loadPhoneContacts()
    void loadPrivatePlayers().catch((error) => {
      const message = error instanceof Error ? error.message : 'Impossible de charger les données des joueurs.'
      setAuthError(message)
    })
    setIsPhoneDevice(/iPhone|iPod|Android.*Mobile|Windows Phone|IEMobile|BlackBerry|Opera Mini/i.test(navigator.userAgent))
  }, [initialEducator, loadPhoneContacts, loadPrivatePlayers])

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setRequestPending(true)
    setAuthError('')
    try {
      const response = await fetch('/api/educators/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, rememberMe: true }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Connexion impossible.')
      setEducator(result.educator)
      onEducatorChange?.(result.educator)
      setPassword('')
      window.dispatchEvent(new Event('educator-session-changed'))
      await loadPhoneContacts()
      void loadPrivatePlayers().catch((error) => {
        setAuthError(error instanceof Error ? error.message : 'Impossible de charger les données des joueurs.')
      })
      onLoginSuccess?.()
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Connexion impossible.')
    } finally {
      setRequestPending(false)
    }
  }

  const handlePhoneMigration = async () => {
    setRequestPending(true)
    setAuthError('')
    try {
      const response = await fetch('/api/educators/contacts/migrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupConfirmed: migrationBackupConfirmed }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Migration impossible.')
      setNotice(`Téléphones chiffrés et synchronisés dans les deux onglets. ${result.migratedCount} nouveau(x) numéro(s) importé(s).`)
      await loadPhoneContacts()
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Migration impossible.')
    } finally {
      setRequestPending(false)
    }
  }

  const openPhoneEditor = (player: EducatorPlayer) => {
    setPhoneEditor({
      number: player.number,
      name: [player.firstName, player.lastName].filter(Boolean).join(' '),
      parent: null,
      value: '',
    })
    setAuthError('')
  }

  const requestAddProfile = () => {
    if (educator?.role === 'admin') {
      setAddProfileChooserOpen(true)
      return
    }
    if (educator?.role === 'educator') {
      setQuery('')
      setDirectoryView('educators')
      setEducatorAddRequest((request) => request + 1)
    }
  }

  const chooseAddProfile = (type: 'educators' | 'accounts') => {
    setAddProfileChooserOpen(false)
    setQuery('')
    setDirectoryView(type)
    if (type === 'educators') setEducatorAddRequest((request) => request + 1)
    else setAccountAddRequest((request) => request + 1)
  }

  const acknowledgeEducatorAddRequest = useCallback(() => setEducatorAddRequest(0), [])
  const acknowledgeAccountAddRequest = useCallback(() => setAccountAddRequest(0), [])

  const selectPhoneParent = (parent: ParentKey) => {
    if (!phoneEditor) return
    const contacts = phones[phoneEditor.number]
    setPhoneEditor({
      ...phoneEditor,
      parent,
      value: parent === 'father' ? contacts?.fatherPhone ?? '' : contacts?.motherPhone ?? '',
    })
  }

  const handleSavePhone = async () => {
    if (!phoneEditor?.parent) return
    setRequestPending(true)
    setAuthError('')
    setNotice('')
    try {
      const response = await fetch('/api/educators/contacts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          number: phoneEditor.number,
          parent: phoneEditor.parent,
          phone: phoneEditor.value,
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Enregistrement impossible.')
      await loadPhoneContacts()
      setPhoneEditor(null)
      setNotice('Téléphone chiffré et synchronisé dans les deux onglets.')
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Enregistrement impossible.')
    } finally {
      setRequestPending(false)
    }
  }

  const groups = useMemo(() => {
    const grouped = new Map<string, EducatorPlayer[]>()

    for (const player of players) {
      if (!matchesSearch(query, [player.firstName, player.lastName, player.licenseNumber ?? ''])) continue

      const position = player.position ?? 'Non renseigné'
      grouped.set(position, [...(grouped.get(position) ?? []), player])
    }

    return [...grouped.entries()]
      .sort(([a], [b]) => {
        if (a === 'Non renseigné') return 1
        if (b === 'Non renseigné') return -1
        return positionRank(a) - positionRank(b) || a.localeCompare(b, 'fr')
      })
      .map(([position, list]) => [
        position,
        list.sort((a, b) => a.lastName.localeCompare(b.lastName, 'fr') || a.firstName.localeCompare(b.firstName, 'fr')),
      ] as const)
  }, [players, query])

  useEffect(() => {
    const nav = positionFiltersRef.current
    if (!nav) return

    const updateScrollCue = () => {
      setHasMorePositions(nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 1)
    }

    updateScrollCue()
    nav.addEventListener('scroll', updateScrollCue, { passive: true })
    window.addEventListener('resize', updateScrollCue, { passive: true })

    return () => {
      nav.removeEventListener('scroll', updateScrollCue)
      window.removeEventListener('resize', updateScrollCue)
    }
  }, [groups])

  const matchingPlayerCount = groups.reduce((count, [, list]) => count + list.length, 0)
  const missingLicenseCount = players.filter((player) => !player.licenseNumber?.trim()).length
  const matchingPlayers = groups.flatMap(([, list]) => list)
  const visiblePlayers = selectedPosition
    ? groups.find(([position]) => position === selectedPosition)?.[1] ?? []
    : matchingPlayers
  const allVisiblePlayersExpanded = visiblePlayers.length > 0
    && visiblePlayers.every((player) => expandedPlayers.has(player.number))
  const hasExpandedVisiblePlayer = visiblePlayers.some((player) => expandedPlayers.has(player.number))
  const collapseAllPlayers = () => {
    shouldScrollToTopAfterCollapse.current = true
    setExpandedPlayers(new Set())
  }

  useLayoutEffect(() => {
    if (!shouldScrollToTopAfterCollapse.current) return
    shouldScrollToTopAfterCollapse.current = false
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [expandedPlayers])

  if (!sessionChecked) {
    return (
      <section aria-live="polite" className="rounded-2xl border border-accent/50 bg-card p-6 text-center text-sm text-muted-foreground">
        Vérification de la connexion…
      </section>
    )
  }

  if (!educator) {
    return (
      <section aria-label="Connexion éducateur" className="flex flex-col items-center gap-4">
        {authError && <p role="alert" className="w-full max-w-md text-sm font-medium text-destructive">{authError}</p>}
        <form onSubmit={handleLogin} className="mx-auto flex w-full max-w-md flex-col gap-4 rounded-2xl border border-accent/60 bg-white p-6 shadow-sm">
          <div className="flex justify-center">
            <div className="flex size-36 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-accent/40">
              <EducatorAvatar username={username} revision={photoRevision} size="size-32" />
            </div>
          </div>
          <h2 id="educator-login-title" className="text-center text-lg font-black text-primary">Connexion éducateur</h2>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Identifiant
              <input
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
                className="h-10 rounded-xl border border-accent/40 bg-background px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Mot de passe
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                className="h-10 rounded-xl border border-accent/40 bg-background px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
            <button type="submit" disabled={requestPending} className="h-10 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition hover:opacity-90 disabled:opacity-60">
              {requestPending ? 'Connexion…' : 'Connexion'}
            </button>
        </form>
      </section>
    )
  }

  const canInspectPhoneEncryption = educator.role === 'admin' || educator.role === 'educator'
  const phoneEncryptionDiagnosticButton = canInspectPhoneEncryption && (
      <button
        type="button"
        onClick={() => void runPhoneDiagnostics()}
        disabled={diagnosticPending}
        aria-label="Vérifier le chiffrement des téléphones"
        title="Vérifier le chiffrement des téléphones"
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-accent/35 bg-background/70 text-xs font-medium text-muted-foreground transition hover:bg-accent/20 hover:text-primary disabled:opacity-50 sm:h-8 sm:w-auto sm:gap-1.5 sm:px-2.5"
      >
        <LockKeyhole aria-hidden="true" className="size-3.5 shrink-0" />
        <span className="sr-only sm:not-sr-only">{diagnosticPending ? 'Vérification…' : 'Vérifier le chiffrement'}</span>
      </button>
  )

  const phoneDiagnosticProblems = phoneDiagnostics ? [
    ...(!phoneDiagnostics.keyFormatValid ? ['La clé de chiffrement est absente ou invalide.'] : []),
    ...(phoneDiagnostics.unreadableValues > 0
      ? [`${phoneDiagnostics.unreadableValues} téléphone(s) chiffré(s) illisible(s) sur ${phoneDiagnostics.encryptedValues}.`]
      : []),
    ...(phoneDiagnostics.plaintextValues > 0
      ? [`${phoneDiagnostics.plaintextValues} téléphone(s) non chiffré(s) détecté(s).`]
      : []),
    ...(phoneDiagnostics.missingTabs.length > 0
      ? [`Onglets manquants : ${phoneDiagnostics.missingTabs.join(', ')}.`]
      : []),
  ] : []

  const phoneDiagnosticError = diagnosticError || phoneDiagnosticProblems.join(' ')
  const phoneEncryptionDiagnosticStatus = canInspectPhoneEncryption && (
    phoneDiagnosticError ? (
      <p role="alert" className="mt-1 text-xs text-destructive">{phoneDiagnosticError}</p>
    ) : phoneDiagnostics ? (
      <span
        role="status"
        aria-label="Chiffrement des téléphones vérifié"
        title="Chiffrement des téléphones vérifié"
        className="inline-flex shrink-0 items-center"
      >
        <CheckCircle2 aria-hidden="true" className="size-5 text-emerald-600" />
      </span>
    ) : null
  )

  const phoneEncryptionDiagnosticPanel = canInspectPhoneEncryption && (
    <div className="flex w-fit max-w-full flex-col items-start gap-2 self-start rounded-xl border border-accent/30 bg-white/60 p-2 dark:bg-card/70">
      {phoneEncryptionDiagnosticButton}
      {phoneEncryptionDiagnosticStatus}
    </div>
  )

  if (migrationRequired) {
    return (
      <section aria-labelledby="phone-migration-title" className="mx-auto flex w-full max-w-xl flex-col gap-4 rounded-2xl border border-accent/60 bg-card p-5 shadow-sm">
        <div>
          <h2 id="phone-migration-title" className="text-lg font-black text-primary">Création de l’onglet téléphones</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            L’onglet « Téléphones éducateurs » sera créé si nécessaire. Les numéros seront chiffrés dans « Joueurs » et « Téléphones éducateurs » ; l’application les déchiffrera uniquement côté serveur pour les éducateurs connectés. L’historique de Google Sheets peut conserver les anciennes valeurs en clair.
          </p>
          <p className="mt-2 text-sm font-medium text-primary">
            Avant de continuer, crée une copie du classeur avec Google Sheets : Fichier → Créer une copie.
          </p>
        </div>
        <EducatorDirectory
          canEdit={educator.role === 'admin'}
          currentEducator={educator}
          photoRevision={photoRevision}
        />
        {canInspectPhoneEncryption && phoneEncryptionDiagnosticPanel}
        {educator.role === 'admin' ? (
          <>
            <label className="flex items-start gap-2 rounded-lg border border-accent/40 bg-muted/50 p-3 text-sm">
              <input
                type="checkbox"
                checked={migrationBackupConfirmed}
                onChange={(event) => setMigrationBackupConfirmed(event.target.checked)}
                className="mt-0.5 size-4 accent-primary"
              />
              <span>J’ai créé une copie de sauvegarde du classeur dans Google Sheets.</span>
            </label>
            <button
              type="button"
              onClick={handlePhoneMigration}
              disabled={requestPending || !migrationBackupConfirmed}
              className="min-h-10 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60"
            >
              {requestPending ? 'Chiffrement en cours…' : 'Créer l’onglet et chiffrer les numéros'}
            </button>
          </>
        ) : (
          <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
            Demandez à un administrateur éducateur de créer l’onglet des téléphones.
          </p>
        )}
        {authError && <p role="alert" className="text-sm font-medium text-destructive">{authError}</p>}
      </section>
    )
  }

  const handleCopy = (licenseNumber: string) => {
    navigator.clipboard.writeText(licenseNumber)
    setCopiedId(licenseNumber)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <section aria-label="Liste des éducateurs" className="flex flex-col gap-4">
      {authError && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p role="alert" className="text-sm font-medium text-destructive">{authError}</p>
          {educator && (
            <button
              type="button"
              onClick={() => void loadPhoneContacts()}
              disabled={requestPending}
              className="min-h-9 rounded-lg border border-accent/50 px-3 text-sm font-semibold text-primary disabled:opacity-50"
            >
              {requestPending ? 'Chargement…' : 'Réessayer'}
            </button>
          )}
        </div>
      )}
      {notice && <p role="status" className="text-sm font-medium text-emerald-700 dark:text-emerald-300">{notice}</p>}

      <div className="flex flex-col gap-3 rounded-xl border border-accent/50 bg-card p-3 shadow-sm">
        <div className="flex flex-nowrap items-center justify-between gap-2">
          <label htmlFor="directory-search" className="min-w-0 text-xs font-semibold text-primary sm:text-sm">Recherche joueur / éducateur</label>
          <div className="flex shrink-0 items-center gap-1.5">
            {phoneEncryptionDiagnosticButton}
            {phoneDiagnostics && !phoneDiagnosticError && phoneEncryptionDiagnosticStatus}
            {educator.role !== 'reader' && directoryView !== 'players' && !query.trim() && (
              <button
                type="button"
                onClick={requestAddProfile}
                aria-label="Ajouter un profil"
                title="Ajouter un profil"
                className="inline-flex size-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-[#172554] via-[#1e3a8a] to-[#172554] text-sm font-bold text-amber-300 shadow-sm border border-amber-400/30 transition hover:brightness-110 sm:w-auto sm:px-3"
              >
                <Plus aria-hidden="true" className="size-4" />
                <span className="hidden sm:inline">Ajouter</span>
              </button>
            )}
          </div>
        </div>
        {phoneDiagnosticError && phoneEncryptionDiagnosticStatus}
        <div className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="directory-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nom, prénom ou n° de licence…"
            className="h-11 w-full rounded-lg border border-accent/50 bg-background pr-3 pl-10 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        {!query.trim() && <nav aria-label="Choisir un annuaire" className={`grid ${educator.role === 'admin' ? 'grid-cols-3' : 'grid-cols-2'} gap-2 rounded-lg bg-muted/70 p-1`}>
          {([
            { key: 'players' as const, label: 'Joueurs', Icon: UsersRound },
            { key: 'educators' as const, label: 'Éducateurs', Icon: ContactRound },
            ...(educator.role === 'admin'
              ? [{ key: 'accounts' as const, label: 'Comptes', Icon: KeyRound }]
              : []),
          ]).map(({ key, label, Icon }) => {
            const isActive = directoryView === key
            return (
              <button
                key={key}
                type="button"
                aria-pressed={isActive}
                onClick={() => {
                  setEducatorAddRequest(0)
                  setAccountAddRequest(0)
                  setDirectoryView(key)
                }}
                className={[
                  'inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-all duration-200',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37] focus-visible:ring-offset-2',
                  isActive
                    ? 'bg-gradient-to-r from-[#172554] via-[#1e3a8a] to-[#172554] text-amber-300 font-extrabold shadow-md border border-amber-400/40'
                    : 'text-muted-foreground hover:bg-card hover:text-[#172554]',
                ].join(' ')}
              >
                <Icon aria-hidden="true" className="size-4" />
                {label}
              </button>
            )
          })}
        </nav>}
      </div>

      {(directoryView === 'educators' || Boolean(query.trim())) && (
        <div className="flex flex-col gap-2">
          <EducatorDirectory
            canEdit={educator.role === 'admin'}
            canAdd={educator.role === 'admin' || educator.role === 'educator'}
            searchQuery={query}
            searchTitle={query.trim() ? 'Résultats éducateurs' : undefined}
            addRequest={educatorAddRequest}
            onAddRequestHandled={acknowledgeEducatorAddRequest}
            currentEducator={educator}
            photoRevision={photoRevision}
          />
        </div>
      )}

      {(directoryView === 'players' || Boolean(query.trim())) && (
        <div className="flex flex-col gap-4">
          {query.trim() && (
            <h2 className="font-bold text-primary">
              Résultats joueurs <span className="font-normal text-muted-foreground">({matchingPlayerCount})</span>
            </h2>
          )}
          {query.trim() ? (
            matchingPlayers.length === 0 ? (
              <p className="rounded-xl border border-accent/40 bg-card p-5 text-center text-sm text-muted-foreground">
                Aucun joueur ne correspond à votre recherche.
              </p>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2 sm:gap-3 xl:grid-cols-3">
                {matchingPlayers.map((player) => {
                  const phone = phones[player.number]
                  const licenseNumber = player.licenseNumber
                  const parentContact = (parent: ParentKey, value: string) => {
                    if (!value) return null
                    const label = parent === 'father' ? 'Papa' : 'Maman'
                    return (
                      <div key={parent} className="grid w-full grid-cols-[3.25rem_minmax(0,1fr)] items-center gap-1 md:grid-cols-[4.5rem_minmax(0,1fr)] md:gap-2">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                          <ParentAvatar parent={parent} />
                          {label}
                        </span>
                        <PhoneActionButtons
                          phone={value}
                          label={label}
                          playerName={`${player.firstName} ${player.lastName}`}
                        />
                      </div>
                    )
                  }

                  return (
                    <li
                      key={player.number}
                      className="rounded-2xl border-2 border-[#172554]/15 bg-card p-4 shadow-sm transition-all hover:border-[#172554]/40 hover:shadow-md sm:p-3.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            title={`N°${player.number}`}
                            className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[#172554] text-xs font-black text-amber-300 ring-2 ring-amber-400/50 shadow-sm"
                          >
                            {player.number}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="truncate text-base font-bold text-foreground">
                                {player.firstName} <span className="font-black uppercase tracking-wide text-primary">{player.lastName}</span>
                              </p>
                              {educator.role === 'admin' && (
                                <button
                                  type="button"
                                  onClick={() => openPhoneEditor(player)}
                                  disabled={requestPending}
                                  aria-label={`Modifier les téléphones de ${player.firstName} ${player.lastName}`}
                                  title="Modifier les numéros"
                                  className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-accent/40 bg-card text-muted-foreground transition hover:bg-accent/40 hover:text-foreground disabled:opacity-50 sm:size-7 sm:rounded-md"
                                >
                                  <Pencil aria-hidden="true" className="size-4 sm:size-3" />
                                </button>
                              )}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                              <span>Poste : <strong className="text-foreground">{player.position ?? 'Non renseigné'}</strong></span>
                              <span>·</span>
                              <span>Licence : <span className="font-mono font-medium">{licenseNumber ?? 'non renseignée'}</span></span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-col items-stretch gap-2 rounded-xl border border-accent/40 bg-muted/40 p-3 sm:mt-3 sm:p-2">
                        {parentContact('father', phone?.fatherPhone ?? '')}
                        {parentContact('mother', phone?.motherPhone ?? '')}
                        {phone?.legacyPhone && (
                          <div className="inline-flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold text-muted-foreground">Autre contact</span>
                              <PhoneActionButtons
                                phone={phone.legacyPhone}
                                label="l’autre contact"
                                playerName={`${player.firstName} ${player.lastName}`}
                              />
                          </div>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )
          ) : (
            <>
      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="relative w-full min-w-0 sm:flex-1">
          <nav ref={positionFiltersRef} aria-label="Filtrer les joueurs par poste" className="flex w-full min-w-0 gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            aria-pressed={selectedPosition === null}
            onClick={() => setSelectedPosition(null)}
            className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-bold transition ${
              selectedPosition === null
                ? 'border-[#172554] bg-[#172554] text-white shadow-sm'
                : 'border-accent/50 bg-card text-muted-foreground hover:border-primary/40 hover:text-primary'
            }`}
          >
            Tous <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-black text-blue-950">{matchingPlayerCount}</span>
          </button>
          {groups.map(([position, list]) => (
            <button
              key={position}
              type="button"
              aria-pressed={selectedPosition === position}
              onClick={() => setSelectedPosition(position)}
              className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-bold transition ${
                selectedPosition === position
                  ? 'border-[#172554] bg-[#172554] text-white shadow-sm'
                  : 'border-accent/50 bg-card text-muted-foreground hover:border-primary/40 hover:text-primary'
              }`}
            >
              {position} <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-black text-blue-950">{list.length}</span>
            </button>
          ))}
          </nav>
          {hasMorePositions && (
            <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 flex items-center bg-gradient-to-l from-background via-background/95 to-transparent pl-4 pr-1 text-muted-foreground">
              <ChevronRight className="size-4" />
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {visiblePlayers.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (allVisiblePlayersExpanded) collapseAllPlayers()
                else setExpandedPlayers(new Set(visiblePlayers.map((player) => player.number)))
              }}
              aria-label={allVisiblePlayersExpanded ? 'Replier toutes les fiches' : 'Déplier toutes les fiches'}
              title={allVisiblePlayersExpanded ? 'Replier toutes les fiches' : 'Déplier toutes les fiches'}
              className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border border-accent/50 bg-card px-3 text-xs font-bold text-primary shadow-sm transition hover:bg-primary/10"
            >
              {allVisiblePlayersExpanded ? <ChevronUp aria-hidden="true" className="size-3.5" /> : <ChevronDown aria-hidden="true" className="size-3.5" />}
              {allVisiblePlayersExpanded ? 'Tout replier' : 'Tout déplier'}
            </button>
          )}
          <div className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-accent/40 bg-card px-3 text-xs font-semibold">
            <Award aria-hidden="true" className="size-3.5 text-amber-600 dark:text-amber-400" />
            <span><strong className="text-amber-700 dark:text-amber-300">{missingLicenseCount}</strong> sans licence</span>
          </div>
        </div>
      </div>

      {groups.length === 0 ? (
        <p className="rounded-xl border border-accent/40 bg-card p-5 text-center text-sm text-muted-foreground">
          Aucun joueur ne correspond à votre recherche.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {visiblePlayers.map((player) => {
            const licenseNumber = player.licenseNumber
            const isCopied = licenseNumber && copiedId === licenseNumber
            const phone = phones[player.number]
            const position = player.position ?? 'Non renseigné'
            const hasParentContacts = Boolean(phone?.fatherPhone || phone?.motherPhone || phone?.legacyPhone)
            const isExpanded = expandedPlayers.has(player.number)
            const parentContact = (parent: ParentKey, value: string) => {
              if (!value) return null
              const label = parent === 'father' ? 'Papa' : 'Maman'
              return (
                <div key={parent} className="grid w-full grid-cols-[3.25rem_minmax(0,1fr)] items-center gap-1 md:grid-cols-[4.5rem_minmax(0,1fr)] md:gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                    <ParentAvatar parent={parent} />
                    {label}
                  </span>
                  <PhoneActionButtons
                    phone={value}
                    label={label}
                    playerName={`${player.firstName} ${player.lastName}`}
                  />
                </div>
              )
            }

            return (
              <article
                key={player.number}
                className="min-w-0 overflow-hidden rounded-2xl border-2 border-[#172554]/15 bg-card shadow-sm transition hover:border-[#172554]/35 hover:shadow-md"
              >
                <div className="flex items-center gap-2.5 bg-gradient-to-r from-[#172554] via-[#1e3a8a] to-[#172554] px-3 py-3 text-white">
                  <span
                    title={`N°${player.number}`}
                    className="flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-amber-400 bg-[#172554] text-sm font-black text-amber-300 shadow-md"
                  >
                    {player.number}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="whitespace-normal break-words text-sm font-black leading-tight sm:text-base">
                      {player.firstName} <span className="uppercase tracking-wide">{player.lastName}</span>
                    </h3>
                    <span className="mt-1 inline-flex max-w-full truncate rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-200 ring-1 ring-white/15">
                      {position}
                    </span>
                  </div>
                  {educator.role === 'admin' && (
                    <button
                      type="button"
                      onClick={() => openPhoneEditor(player)}
                      disabled={requestPending}
                      aria-label={`Modifier les téléphones de ${player.firstName} ${player.lastName}`}
                      title="Modifier les numéros"
                      className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/20 text-blue-100 transition hover:bg-white/10 disabled:opacity-50"
                    >
                      <Pencil aria-hidden="true" className="size-4" />
                    </button>
                  )}
                </div>
                <div className="flex min-h-11 items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground">
                  <span className="truncate">Licence FFF : <span className="font-mono font-semibold text-foreground">{licenseNumber ?? 'non renseignée'}</span></span>
                  {licenseNumber && (
                    <button
                      type="button"
                      onClick={() => handleCopy(licenseNumber)}
                      className={`inline-flex size-8 shrink-0 items-center justify-center rounded-lg transition ${
                        isCopied ? 'bg-emerald-600 text-white' : 'text-muted-foreground hover:bg-accent/40 hover:text-foreground'
                      }`}
                      title="Copier le numéro de licence"
                      aria-label={`Copier le numéro de licence de ${player.firstName} ${player.lastName}`}
                    >
                      {isCopied ? <Check aria-hidden="true" className="size-3.5" /> : <Copy aria-hidden="true" className="size-3.5" />}
                    </button>
                  )}
                </div>
                <details
                  open={isExpanded}
                  onToggle={(event) => {
                    const nextOpen = event.currentTarget.open
                    setExpandedPlayers((current) => {
                      if (current.has(player.number) === nextOpen) return current
                      const next = new Set(current)
                      if (nextOpen) next.add(player.number)
                      else next.delete(player.number)
                      return next
                    })
                  }}
                  className="group border-t border-accent/35"
                >
                  <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-2 px-3 text-xs font-bold text-primary outline-none transition hover:bg-accent/20 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                    <span>{isExpanded ? 'Masquer les contacts' : 'Voir les contacts'}</span>
                    <ChevronDown aria-hidden="true" className="size-4 shrink-0 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="grid gap-2 border-t border-accent/20 bg-muted/30 p-3">
                    {parentContact('father', phone?.fatherPhone ?? '')}
                    {parentContact('mother', phone?.motherPhone ?? '')}
                    {phone?.legacyPhone && (
                      <div className="inline-flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-muted-foreground">Autre contact</span>
                        <PhoneActionButtons
                          phone={phone.legacyPhone}
                          label="l’autre contact"
                          playerName={`${player.firstName} ${player.lastName}`}
                        />
                      </div>
                    )}
                    {!hasParentContacts && <p className="text-xs text-muted-foreground">Aucun téléphone renseigné.</p>}
                  </div>
                </details>
              </article>
            )
          })}
        </div>
      )}
            </>
          )}
        </div>
      )}

      {directoryView === 'accounts' && educator.role === 'admin' && (
        <EducatorAccountManagement
          currentUsername={educator.username}
          photoRevision={photoRevision}
          addRequest={accountAddRequest}
          onAddRequestHandled={acknowledgeAccountAddRequest}
        />
      )}

      {addProfileChooserOpen && educator.role === 'admin' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-profile-title"
          className="fixed inset-0 z-[60] grid place-items-center bg-[#172554]/60 p-4"
        >
          <section className="w-full max-w-sm rounded-2xl border border-accent/60 bg-card p-5 shadow-2xl">
            <header className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nouvelle fiche</p>
                <h2 id="add-profile-title" className="mt-1 text-lg font-black text-primary">Que souhaitez-vous ajouter ?</h2>
              </div>
              <button
                type="button"
                onClick={() => setAddProfileChooserOpen(false)}
                aria-label="Fermer"
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </header>
            <div className="mt-4 grid gap-2">
              <button
                type="button"
                onClick={() => chooseAddProfile('educators')}
                className="flex min-h-12 items-center gap-3 rounded-xl border border-accent/50 bg-background px-3 text-left font-semibold text-primary transition hover:bg-accent/20"
              >
                <ContactRound aria-hidden="true" className="size-5 shrink-0" />
                Fiche éducateur
              </button>
              <button
                type="button"
                onClick={() => chooseAddProfile('accounts')}
                className="flex min-h-12 items-center gap-3 rounded-xl border border-accent/50 bg-background px-3 text-left font-semibold text-primary transition hover:bg-accent/20"
              >
                <KeyRound aria-hidden="true" className="size-5 shrink-0" />
                Comptes (Admin/Éducateur/Lecteur)
              </button>
            </div>
          </section>
        </div>
      )}

      {phoneEditor && educator.role === 'admin' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="parent-phone-dialog-title"
          className="fixed inset-0 z-50 grid place-items-center bg-[#172554]/60 p-4"
        >
          <section className="w-full max-w-sm rounded-2xl border border-accent/60 bg-card p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fiche de {phoneEditor.name}</p>
                <h3 id="parent-phone-dialog-title" className="mt-1 text-lg font-black text-primary">
                  {phoneEditor.parent ? `Téléphone de ${phoneEditor.parent === 'father' ? 'Papa' : 'Maman'}` : 'Quel parent ?'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPhoneEditor(null)}
                aria-label="Fermer"
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-accent/40"
              >
                <X className="size-4" />
              </button>
            </div>

            {!phoneEditor.parent ? (
              <div className="mt-4 grid grid-cols-2 gap-3">
                {(['father', 'mother'] as const).map((parent) => (
                  <button
                    key={parent}
                    type="button"
                    onClick={() => selectPhoneParent(parent)}
                    className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border border-accent/50 bg-background px-3 py-3 text-sm font-bold text-primary hover:bg-primary/5"
                  >
                    <ParentAvatar parent={parent} />
                    {parent === 'father' ? 'Papa' : 'Maman'}
                  </button>
                ))}
              </div>
            ) : (
              <>
                <label className="mt-4 flex flex-col gap-1.5 text-sm font-semibold">
                  Numéro de téléphone
                  <input
                    autoFocus
                    type="tel"
                    inputMode="tel"
                    autoComplete="off"
                    maxLength={80}
                    value={phoneEditor.value}
                    onChange={(event) => setPhoneEditor((current) => current ? { ...current, value: event.target.value } : current)}
                    placeholder="Ex. 06 12 34 56 78"
                    className="h-11 rounded-xl border border-accent/50 bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </label>
                <p className="mt-2 text-xs text-muted-foreground">
                  Le numéro est chiffré et synchronisé dès que tu l’enregistres.
                </p>
                {authError && <p role="alert" className="mt-2 text-sm font-medium text-destructive">{authError}</p>}
                <div className="mt-4 flex flex-wrap justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setPhoneEditor((current) => current ? { ...current, parent: null, value: '' } : current)}
                    disabled={requestPending}
                    className="min-h-10 rounded-xl border border-accent/50 px-3 text-sm font-semibold text-primary disabled:opacity-50"
                  >
                    Changer de parent
                  </button>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPhoneEditor(null)}
                      disabled={requestPending}
                      className="min-h-10 rounded-xl px-3 text-sm font-semibold text-muted-foreground"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSavePhone()}
                      disabled={requestPending || !phoneEditor.value.trim()}
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50"
                    >
                      <Save className="size-4" />
                      {requestPending ? 'Enregistrement…' : 'Enregistrer'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      )}
      {(directoryView === 'players' || Boolean(query.trim())) && !query.trim() && hasExpandedVisiblePlayer && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 flex justify-center sm:hidden">
          <button
            type="button"
            onClick={collapseAllPlayers}
            aria-label="Replier toutes les fiches ouvertes"
            title="Replier toutes les fiches ouvertes"
            className="pointer-events-auto inline-flex min-h-10 items-center gap-1.5 rounded-full border border-accent bg-primary px-4 text-xs font-bold text-primary-foreground shadow-lg"
          >
            <ChevronUp aria-hidden="true" className="size-4" />
            Tout replier
          </button>
        </div>
      )}
    </section>
  )
}
