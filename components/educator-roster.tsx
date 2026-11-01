'use client'

import { useState, useMemo, useEffect, useCallback, type FormEvent } from 'react'
import { Search, Copy, Check, Award, LockKeyhole, Phone, Save, ChevronDown, ChevronUp, Pencil, X, ContactRound, UsersRound, KeyRound } from 'lucide-react'
import type { Player, PublicPlayer } from '@/lib/players'
import { matchesSearch } from '@/lib/search'
import { ParentAvatar } from '@/components/parent-avatar'
import { EducatorDirectory } from '@/components/educator-directory'
import { EducatorAccountManagement } from '@/components/educator-account-management'

type EducatorIdentity = { username: string; displayName: string; role: 'educator' | 'admin' }

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

export function EducatorRoster({
  loginRequest = 0,
  forceLogin = false,
  onSessionStatusChange,
  onEducatorChange,
  onLoginSuccess,
}: {
  loginRequest?: number
  forceLogin?: boolean
  onSessionStatusChange?: (status: EducatorSessionStatus) => void
  onEducatorChange?: (educator: EducatorIdentity | null) => void
  onLoginSuccess?: () => void
}) {
  const [players, setPlayers] = useState<EducatorPlayer[]>([])
  const [query, setQuery] = useState('')
  const [directoryView, setDirectoryView] = useState<DirectoryView>('educators')
  const [expandedPositions, setExpandedPositions] = useState<Set<string>>(() => new Set())
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [educator, setEducator] = useState<EducatorIdentity | null>(null)
  const [loginOpen, setLoginOpen] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [phones, setPhones] = useState<Record<number, PlayerPhones>>({})
  const [visiblePhones, setVisiblePhones] = useState<Record<string, boolean>>({})
  const [isPhoneDevice, setIsPhoneDevice] = useState(false)
  const [phoneEditor, setPhoneEditor] = useState<PhoneEditor | null>(null)
  const [migrationRequired, setMigrationRequired] = useState(false)
  const [sessionChecked, setSessionChecked] = useState(false)
  const [requestPending, setRequestPending] = useState(false)
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
      setVisiblePhones({})
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
        setVisiblePhones({})
        setPhoneEditor(null)
        setPlayers([])
        return
      }
      if (response.status === 409 && result.migrationRequired) {
        onSessionStatusChange?.('authenticated')
        setEducator(result.educator)
        onEducatorChange?.(result.educator)
        setPhones({})
        setVisiblePhones({})
        setPhoneEditor(null)
        setMigrationRequired(true)
        await loadPrivatePlayers()
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
      await loadPrivatePlayers()
    } catch (error) {
      onSessionStatusChange?.('unavailable')
      setAuthError(error instanceof Error ? error.message : 'Impossible de charger les coordonnées.')
    } finally {
      setRequestPending(false)
      setSessionChecked(true)
    }
  }, [loadPrivatePlayers, onEducatorChange, onSessionStatusChange])

  useEffect(() => {
    void loadPhoneContacts()
    setIsPhoneDevice(/iPhone|iPod|Android.*Mobile|Windows Phone|IEMobile|BlackBerry|Opera Mini/i.test(navigator.userAgent))
  }, [loadPhoneContacts])

  useEffect(() => {
    if (loginRequest > 0) setLoginOpen(true)
  }, [loginRequest])

  useEffect(() => {
    if (forceLogin) setLoginOpen(true)
  }, [forceLogin])

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setRequestPending(true)
    setAuthError('')
    try {
      const response = await fetch('/api/educators/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Connexion impossible.')
      setEducator(result.educator)
      onEducatorChange?.(result.educator)
      setPassword('')
      setLoginOpen(false)
      window.dispatchEvent(new Event('educator-session-changed'))
      await loadPhoneContacts()
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
      const response = await fetch('/api/educators/contacts/migrate', { method: 'POST' })
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

  const matchingPlayerCount = groups.reduce((count, [, list]) => count + list.length, 0)
  const missingLicenseCount = players.filter((player) => !player.licenseNumber?.trim()).length
  const matchingPlayers = groups.flatMap(([, list]) => list)
  const allGroupsExpanded = groups.length > 0 && groups.every(([position]) => expandedPositions.has(position))
  const hasExpandedVisibleGroup = groups.some(([position]) => expandedPositions.has(position))

  if (!sessionChecked) {
    return (
      <section aria-live="polite" className="rounded-2xl border border-accent/50 bg-card p-6 text-center text-sm text-muted-foreground">
        Vérification de la connexion…
      </section>
    )
  }

  if (!educator) {
    return (
      <section aria-label="Annuaire éducateurs et joueurs" className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 rounded-xl border border-accent/50 bg-card p-3 shadow-sm sm:flex-row sm:items-end">
          <label htmlFor="directory-search-login" className="block min-w-0 flex-1 text-sm font-semibold text-primary">
            Recherche joueur / éducateur
            <span className="relative mt-1 block">
              <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="directory-search-login"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Nom, prénom ou n° de licence…"
                className="h-11 w-full rounded-lg border border-accent/50 bg-background pr-3 pl-10 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </span>
          </label>
          <button
            type="button"
            onClick={() => { setLoginOpen((open) => !open); setAuthError('') }}
            aria-expanded={loginOpen}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground"
          >
            <LockKeyhole aria-hidden="true" className="size-4" />
            {loginOpen ? 'Fermer' : 'Connexion'}
          </button>
        </div>
        {authError && <p role="alert" className="text-sm font-medium text-destructive">{authError}</p>}
        {loginOpen ? (
          <form onSubmit={handleLogin} className="mx-auto flex w-full max-w-md flex-col gap-3 rounded-2xl border border-accent/60 bg-card p-5 shadow-sm">
            <h2 id="educator-login-title" className="text-lg font-black text-primary">Connexion éducateur</h2>
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
        ) : (
          <p className="rounded-xl border border-accent/40 bg-card p-4 text-center text-sm text-muted-foreground">
            Connectez-vous pour afficher les résultats de recherche des joueurs et des éducateurs.
          </p>
        )}
      </section>
    )
  }

  if (migrationRequired) {
    return (
      <section aria-labelledby="phone-migration-title" className="mx-auto flex w-full max-w-xl flex-col gap-4 rounded-2xl border border-accent/60 bg-card p-5 shadow-sm">
        <div>
          <h2 id="phone-migration-title" className="text-lg font-black text-primary">Création de l’onglet téléphones</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            L’onglet « Téléphones éducateurs » sera créé si nécessaire. Les numéros seront chiffrés dans « Joueurs » et « Téléphones éducateurs » ; l’application les déchiffrera uniquement côté serveur pour les éducateurs connectés. L’historique de Google Sheets peut conserver les anciennes valeurs en clair.
          </p>
        </div>
        <EducatorDirectory canEdit={educator.role === 'admin'} showAddButton={false} />
        {educator.role === 'admin' ? (
          <button
            type="button"
            onClick={handlePhoneMigration}
            disabled={requestPending}
            className="min-h-10 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {requestPending ? 'Chiffrement en cours…' : 'Créer l’onglet et chiffrer les numéros'}
          </button>
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
      {authError && <p role="alert" className="text-sm font-medium text-destructive">{authError}</p>}
      {notice && <p role="status" className="text-sm font-medium text-emerald-700 dark:text-emerald-300">{notice}</p>}

      <div className="flex flex-col gap-3 rounded-xl border border-accent/50 bg-card p-3 shadow-sm">
        <label htmlFor="directory-search" className="block text-sm font-semibold text-primary">Recherche joueur / éducateur</label>
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
            { key: 'educators' as const, label: 'Éducateurs', Icon: ContactRound },
            { key: 'players' as const, label: 'Joueurs', Icon: UsersRound },
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
                onClick={() => setDirectoryView(key)}
                className={[
                  'inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  isActive ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-card hover:text-primary',
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
          {query.trim() && <h2 className="font-bold text-primary">Résultats éducateurs</h2>}
          <EducatorDirectory canEdit={educator.role === 'admin'} searchQuery={query} showAddButton={false} />
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
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {matchingPlayers.map((player) => {
                  const phone = phones[player.number]
                  const licenseNumber = player.licenseNumber
                  const parentContact = (parent: ParentKey, value: string) => {
                    if (!value) return null
                    const label = parent === 'father' ? 'Papa' : 'Maman'
                    const key = `${player.number}-${parent}`
                    return (
                      <div key={parent} className="flex flex-nowrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setVisiblePhones((current) => ({ ...current, [key]: !current[key] }))}
                          aria-expanded={Boolean(visiblePhones[key])}
                          aria-label={`${visiblePhones[key] ? 'Masquer' : 'Afficher'} le téléphone de ${label} pour ${player.firstName} ${player.lastName}`}
                          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-accent/50 bg-card px-2.5 text-sm font-bold text-primary shadow-sm transition hover:bg-primary/5 hover:shadow-md"
                        >
                          <ParentAvatar parent={parent} />
                          <Phone aria-hidden="true" className="size-4" />
                          <span>{label}</span>
                        </button>
                        {visiblePhones[key] && (
                          <div className="inline-flex shrink-0 flex-nowrap items-center gap-2 whitespace-nowrap">
                            <span className="text-sm font-semibold text-primary">{value}</span>
                            {isPhoneDevice && (
                              <a
                                href={`tel:${value.replace(/[^\d+]/g, '')}`}
                                aria-label={`Appeler ${label} pour ${player.firstName} ${player.lastName}`}
                                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-primary px-2.5 text-xs font-bold text-primary-foreground"
                              >
                                <Phone aria-hidden="true" className="size-3.5" />
                                Appeler
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  }

                  return (
                    <li key={player.number} className="rounded-xl border border-accent/50 bg-card p-3 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-foreground">
                            {player.firstName} <span className="font-black uppercase tracking-wide text-primary">{player.lastName}</span>
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">{player.position ?? 'Poste non renseigné'}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Licence FFF : <span className="font-mono">{licenseNumber ?? 'non renseignée'}</span>
                          </p>
                        </div>
                        {educator.role === 'admin' && (
                          <button
                            type="button"
                            onClick={() => openPhoneEditor(player)}
                            disabled={requestPending}
                            aria-label={`Gérer les téléphones des parents pour ${player.firstName} ${player.lastName}`}
                            className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-lg border border-accent/50 bg-background px-2 text-[11px] font-bold text-primary disabled:opacity-50"
                          >
                            <Pencil aria-hidden="true" className="size-3" />
                            Gérer
                          </button>
                        )}
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {parentContact('father', phone?.fatherPhone ?? '')}
                        {parentContact('mother', phone?.motherPhone ?? '')}
                        {phone?.legacyPhone && (
                          <button
                            type="button"
                            onClick={() => setVisiblePhones((current) => ({ ...current, [`${player.number}-legacy`]: !current[`${player.number}-legacy`] }))}
                            aria-expanded={Boolean(visiblePhones[`${player.number}-legacy`])}
                            aria-label={`Afficher ou masquer l’autre téléphone de ${player.firstName} ${player.lastName}`}
                            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-accent/50 bg-card px-2.5 text-sm font-bold text-primary"
                          >
                            <Phone aria-hidden="true" className="size-4" />
                            Autre contact
                          </button>
                        )}
                        {phone?.legacyPhone && visiblePhones[`${player.number}-legacy`] && (
                          <div className="inline-flex shrink-0 flex-nowrap items-center gap-2 whitespace-nowrap">
                            <span className="text-sm font-semibold text-primary">{phone.legacyPhone}</span>
                            {isPhoneDevice && (
                              <a
                                href={`tel:${phone.legacyPhone.replace(/[^\d+]/g, '')}`}
                                aria-label={`Appeler l’autre contact de ${player.firstName} ${player.lastName}`}
                                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-primary px-2.5 text-xs font-bold text-primary-foreground"
                              >
                                <Phone aria-hidden="true" className="size-3.5" />
                                Appeler
                              </a>
                            )}
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-card px-3 py-1.5 text-xs font-semibold">
          <Award className="size-3.5 text-amber-600 dark:text-amber-400" />
          <span>
            <strong className="text-amber-700 dark:text-amber-300">{missingLicenseCount}</strong>
            {' '}
            {missingLicenseCount === 1 ? 'joueur sans licence' : 'joueurs sans licence'}
          </span>
        </div>
        {groups.length > 0 && (
          <button
            type="button"
            onClick={() => setExpandedPositions(allGroupsExpanded ? new Set() : new Set(groups.map(([position]) => position)))}
            aria-label={allGroupsExpanded ? "Fermer tous les postes" : "Ouvrir tous les postes"}
            title={allGroupsExpanded ? "Fermer tous les postes" : "Ouvrir tous les postes"}
            className="inline-flex h-10 shrink-0 items-center gap-1 rounded-lg border border-accent/40 bg-card px-2 text-xs font-semibold text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {allGroupsExpanded ? <ChevronUp aria-hidden="true" className="size-3.5" /> : <ChevronDown aria-hidden="true" className="size-3.5" />}
            <span>{allGroupsExpanded ? "Tout −" : "Tout +"}</span>
          </button>
        )}

      </div>

      {groups.length === 0 ? (
        <p className="rounded-xl border border-accent/40 bg-card p-5 text-center text-sm text-muted-foreground">
          Aucun joueur ne correspond à votre recherche.
        </p>
      ) : (
        <div className="columns-1 gap-3 sm:columns-2 xl:columns-3">
          {groups.map(([position, list], groupIndex) => {
            const isExpanded = expandedPositions.has(position)
            const groupId = `educator-position-${groupIndex}`
            return (
            <section key={position} aria-label={`Poste : ${position}`} className="mb-3 scroll-mt-4 break-inside-avoid overflow-hidden rounded-xl border border-accent/50 bg-card shadow-sm">
              <h3>
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  aria-controls={isExpanded ? groupId : undefined}
                  onClick={(event) => {
                    const opening = !isExpanded
                    setExpandedPositions((current) => {
                      const next = new Set(current)
                      if (next.has(position)) next.delete(position)
                      else next.add(position)
                      return next
                    })
                    if (opening && window.matchMedia('(max-width: 639px)').matches) {
                      const target = event.currentTarget.closest('section')
                      window.requestAnimationFrame(() => target?.scrollIntoView({
                        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
                        block: 'start',
                      }))
                    }
                  }}
                  className="flex w-full items-center justify-between gap-2 bg-primary px-3 py-2.5 text-left text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <ChevronDown aria-hidden="true" className={`size-4 shrink-0 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                    <span className="truncate font-semibold">{position}</span>
                  </span>
                  <span className="rounded-full bg-accent px-2 py-0.5 font-mono text-xs font-bold text-accent-foreground">
                    {list.length}
                  </span>
                </button>
              </h3>
              {isExpanded && <ul id={groupId} className="divide-y divide-accent/25">
                {list.map((player) => {
                  const licenseNumber = player.licenseNumber
                  const isCopied = licenseNumber && copiedId === licenseNumber
                  const phone = phones[player.number]
                  const parentContact = (parent: ParentKey, value: string) => {
                    if (!value) return null
                    const label = parent === 'father' ? 'Papa' : 'Maman'
                    const key = player.number + '-' + parent
                    return (
                      <div key={parent} className="flex flex-nowrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setVisiblePhones((current) => ({ ...current, [key]: !current[key] }))}
                          aria-expanded={Boolean(visiblePhones[key])}
                          aria-label={`${visiblePhones[key] ? 'Masquer' : 'Afficher'} le téléphone de ${label} pour ${player.firstName} ${player.lastName}`}
                          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-accent/50 bg-card px-2.5 text-sm font-bold text-primary shadow-sm transition hover:bg-primary/5 hover:shadow-md"
                        >
                          <ParentAvatar parent={parent} />
                          <Phone aria-hidden="true" className="size-4" />
                          <span>{label}</span>
                        </button>
                        {visiblePhones[key] && (
                          <div className="inline-flex shrink-0 flex-nowrap items-center gap-2 whitespace-nowrap">
                            <span className="text-sm font-semibold text-primary">{value}</span>
                            {isPhoneDevice && (
                              <a
                                href={'tel:' + value.replace(/[^\d+]/g, '')}
                                aria-label={`Appeler ${label} pour ${player.firstName} ${player.lastName}`}
                                title={`Appeler ${label}`}
                                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-primary px-2.5 text-xs font-bold text-primary-foreground"
                              >
                                <Phone aria-hidden="true" className="size-3.5" />
                                Appeler
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  }

                  return (
                    <li key={player.number} className="flex min-w-0 items-center justify-between gap-2 px-3 py-2.5 transition-colors hover:bg-muted/40">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-foreground">
                          {player.firstName} <span className="font-black uppercase tracking-wide text-primary">{player.lastName}</span>
                        </p>
                        <div className="mt-1 flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                          <span className="truncate">Licence FFF : <span className="font-mono">{licenseNumber ?? 'non renseigné'}</span></span>
                          {licenseNumber && (
                            <button
                              type="button"
                              onClick={() => handleCopy(licenseNumber)}
                              className={`inline-flex size-6 shrink-0 items-center justify-center rounded-md transition ${
                                isCopied
                                  ? 'bg-emerald-600 text-white'
                                  : 'text-muted-foreground hover:bg-accent/40 hover:text-foreground'
                              }`}
                              title="Copier le numéro de licence"
                              aria-label={`Copier le numéro de licence de ${player.firstName} ${player.lastName}`}
                            >
                              {isCopied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                            </button>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {parentContact('father', phone?.fatherPhone ?? '')}
                          {parentContact('mother', phone?.motherPhone ?? '')}
                          {phone?.legacyPhone && (
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setVisiblePhones((current) => ({ ...current, [player.number + '-legacy']: !current[player.number + '-legacy'] }))}
                                aria-expanded={Boolean(visiblePhones[player.number + '-legacy'])}
                                aria-label="Afficher ou masquer l’ancien numéro de téléphone"
                                className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-accent/50 bg-card px-2.5 text-xs font-semibold text-muted-foreground"
                              >
                                <Phone aria-hidden="true" className="size-4" />
                                Autre contact
                              </button>
                              {visiblePhones[player.number + '-legacy'] && (
                                <div className="inline-flex shrink-0 flex-nowrap items-center gap-2 whitespace-nowrap">
                                  <span className="text-sm font-semibold text-primary">{phone.legacyPhone}</span>
                                  {isPhoneDevice && (
                                    <a
                                      href={'tel:' + phone.legacyPhone.replace(/[^\d+]/g, '')}
                                      aria-label="Appeler l’autre contact"
                                      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-primary px-2.5 text-xs font-bold text-primary-foreground"
                                    >
                                      <Phone aria-hidden="true" className="size-3.5" />
                                      Appeler
                                    </a>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                          {educator.role === 'admin' && (
                            <button
                              type="button"
                              onClick={() => openPhoneEditor(player)}
                              disabled={requestPending}
                              aria-label={`Ajouter ou modifier un téléphone parent pour ${player.firstName} ${player.lastName}`}
                              title="Gérer les téléphones des parents"
                              className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-accent/50 bg-card px-2 text-[11px] font-bold text-primary hover:bg-primary/5 disabled:opacity-50"
                            >
                              <Pencil aria-hidden="true" className="size-3" />
                              <span>Gérer</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>}

            </section>
          )})}
        </div>
      )}
            </>
          )}
        </div>
      )}

      {directoryView === 'accounts' && educator.role === 'admin' && (
        <EducatorAccountManagement currentUsername={educator.username} />
      )}

      {phoneEditor && educator.role === 'admin' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="parent-phone-dialog-title"
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
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
      {(directoryView === 'players' || Boolean(query.trim())) && !query.trim() && hasExpandedVisibleGroup && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 flex justify-center sm:hidden">
          <button
            type="button"
            onClick={() => setExpandedPositions(new Set())}
            aria-label="Replier tous les postes ouverts"
            title="Replier tous les postes ouverts"
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
