'use client'

import { useState, useMemo, useEffect, useLayoutEffect, useCallback, useRef, type FormEvent } from 'react'
import { Search, Copy, Check, Award, Phone, Save, ChevronDown, ChevronUp, Pencil, X, ContactRound, UsersRound, KeyRound } from 'lucide-react'
import type { Player, PublicPlayer } from '@/lib/players'
import { matchesSearch } from '@/lib/search'
import { ClubCrest } from '@/components/club-crest'
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

function getWhatsAppUrl(phone: string): string {
  let cleaned = phone.replace(/\D/g, '')
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    cleaned = '33' + cleaned.slice(1)
  }
  return `https://wa.me/${cleaned}`
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.456 5.711 1.457h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

function PhoneActionButtons({
  phone,
  label,
  playerName,
}: {
  phone: string
  label: string
  playerName: string
}) {
  const telNumber = phone.replace(/[^\d+]/g, '')
  const waUrl = getWhatsAppUrl(phone)

  return (
    <div className="inline-flex items-center gap-1.5">
      <a
        href={`tel:${telNumber}`}
        aria-label={`Appeler ${label} pour ${playerName}`}
        className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-lg bg-emerald-600 px-2 text-[11px] font-bold text-white shadow-sm transition hover:bg-emerald-700"
      >
        <Phone aria-hidden="true" className="size-3" />
        Appeler
      </a>
      <a
        href={`sms:${telNumber}`}
        aria-label={`Envoyer un SMS à ${label} pour ${playerName}`}
        className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-lg bg-sky-600 px-2 text-[11px] font-bold text-white shadow-sm transition hover:bg-sky-700"
      >
        💬 SMS
      </a>
      <a
        href={waUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Ouvrir WhatsApp avec ${label} pour ${playerName}`}
        className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-lg bg-[#25D366] px-2 text-[11px] font-bold text-white shadow-sm transition hover:bg-[#20bd5a]"
      >
        <WhatsAppIcon className="size-3 fill-current" />
        WhatsApp
      </a>
    </div>
  )
}

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
  const [directoryView, setDirectoryView] = useState<DirectoryView>('educators')
  const [expandedPositions, setExpandedPositions] = useState<Set<string>>(() => new Set())
  const shouldScrollToTopAfterCollapse = useRef(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [educator, setEducator] = useState<EducatorIdentity | null>(initialEducator)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [phones, setPhones] = useState<Record<number, PlayerPhones>>({})
  const [visiblePhones, setVisiblePhones] = useState<Record<string, boolean>>({})
  const [isPhoneDevice, setIsPhoneDevice] = useState(false)
  const [phoneEditor, setPhoneEditor] = useState<PhoneEditor | null>(null)
  const [migrationRequired, setMigrationRequired] = useState(false)
  const [sessionChecked, setSessionChecked] = useState(Boolean(initialEducator))
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
      onSessionStatusChange?.(initialEducator ? 'authenticated' : 'unavailable')
      const message = error instanceof Error ? error.message : 'Impossible de charger les coordonnées.'
      setAuthError(initialEducator
        ? `Votre session reste active, mais les données éducateurs ne sont pas disponibles. Réessayez sans vous reconnecter. (${message})`
        : message)
    } finally {
      setRequestPending(false)
      setSessionChecked(true)
    }
  }, [initialEducator, loadPrivatePlayers, onEducatorChange, onSessionStatusChange])

  useEffect(() => {
    if (initialEducator) {
      setEducator(initialEducator)
      setSessionChecked(true)
    }
    void loadPhoneContacts()
    setIsPhoneDevice(/iPhone|iPod|Android.*Mobile|Windows Phone|IEMobile|BlackBerry|Opera Mini/i.test(navigator.userAgent))
  }, [initialEducator, loadPhoneContacts])

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
  const collapseAllPositions = () => {
    shouldScrollToTopAfterCollapse.current = true
    setExpandedPositions(new Set())
  }

  useLayoutEffect(() => {
    if (!shouldScrollToTopAfterCollapse.current) return
    shouldScrollToTopAfterCollapse.current = false
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [expandedPositions])

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

  if (migrationRequired) {
    return (
      <section aria-labelledby="phone-migration-title" className="mx-auto flex w-full max-w-xl flex-col gap-4 rounded-2xl border border-accent/60 bg-card p-5 shadow-sm">
        <div>
          <h2 id="phone-migration-title" className="text-lg font-black text-primary">Création de l’onglet téléphones</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            L’onglet « Téléphones éducateurs » sera créé si nécessaire. Les numéros seront chiffrés dans « Joueurs » et « Téléphones éducateurs » ; l’application les déchiffrera uniquement côté serveur pour les éducateurs connectés. L’historique de Google Sheets peut conserver les anciennes valeurs en clair.
          </p>
        </div>
        <EducatorDirectory
          canEdit={educator.role === 'admin'}
          showAddButton={false}
          currentEducator={educator}
          photoRevision={photoRevision}
        />
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
          <EducatorDirectory
            canEdit={educator.role === 'admin'}
            searchQuery={query}
            searchTitle={query.trim() ? 'Résultats éducateurs' : undefined}
            showAddButton={false}
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
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {matchingPlayers.map((player) => {
                  const phone = phones[player.number]
                  const licenseNumber = player.licenseNumber
                  const parentContact = (parent: ParentKey, value: string) => {
                    if (!value) return null
                    const label = parent === 'father' ? 'Papa' : 'Maman'
                    const key = `${player.number}-${parent}`
                    const isOpen = Boolean(visiblePhones[key])
                    return (
                      <div key={parent} className="inline-flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setVisiblePhones((current) => ({ ...current, [key]: !current[key] }))}
                          aria-expanded={isOpen}
                          aria-label={`${isOpen ? 'Masquer' : 'Afficher'} le téléphone de ${label} pour ${player.firstName} ${player.lastName}`}
                          className={`inline-flex min-h-9 items-center gap-2 rounded-xl border px-2.5 text-xs font-bold transition shadow-sm ${
                            isOpen
                              ? 'border-primary/60 bg-primary/10 text-primary'
                              : 'border-accent/50 bg-card text-primary hover:bg-primary/5 hover:shadow-md'
                          }`}
                        >
                          <ParentAvatar parent={parent} />
                          <Phone aria-hidden="true" className="size-3.5" />
                          <span>{label}</span>
                        </button>
                        {isOpen && (
                          <span className="font-mono text-sm font-bold text-primary">{value}</span>
                        )}
                        {isOpen && (
                          <PhoneActionButtons
                            phone={value}
                            label={label}
                            playerName={`${player.firstName} ${player.lastName}`}
                          />
                        )}
                      </div>
                    )
                  }

                  return (
                    <li
                      key={player.number}
                      className="rounded-2xl border-2 border-[#172554]/15 bg-card p-3.5 shadow-sm transition-all hover:border-[#172554]/40 hover:shadow-md"
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
                                  className="inline-flex size-6 shrink-0 items-center justify-center rounded-md border border-accent/40 bg-card text-muted-foreground transition hover:bg-accent/40 hover:text-foreground disabled:opacity-50"
                                >
                                  <Pencil aria-hidden="true" className="size-3" />
                                </button>
                              )}
                            </div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                              <span>Poste : <strong className="text-foreground">{player.position ?? 'Non renseigné'}</strong></span>
                              <span>·</span>
                              <span>Licence : <span className="font-mono font-medium">{licenseNumber ?? 'non renseignée'}</span></span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-accent/40 bg-muted/40 p-2">
                        {parentContact('father', phone?.fatherPhone ?? '')}
                        {parentContact('mother', phone?.motherPhone ?? '')}
                        {phone?.legacyPhone && (
                          <div className="inline-flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setVisiblePhones((current) => ({ ...current, [`${player.number}-legacy`]: !current[`${player.number}-legacy`] }))}
                              aria-expanded={Boolean(visiblePhones[`${player.number}-legacy`])}
                              aria-label={`Afficher ou masquer l’autre téléphone de ${player.firstName} ${player.lastName}`}
                              className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-accent/50 bg-card px-2.5 text-xs font-semibold text-muted-foreground"
                            >
                              <Phone aria-hidden="true" className="size-3.5" />
                              Autre contact
                            </button>
                            {visiblePhones[`${player.number}-legacy`] && (
                              <span className="font-mono text-sm font-bold text-primary">{phone.legacyPhone}</span>
                            )}
                            {visiblePhones[`${player.number}-legacy`] && (
                              <PhoneActionButtons
                                phone={phone.legacyPhone}
                                label="l’autre contact"
                                playerName={`${player.firstName} ${player.lastName}`}
                              />
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
      <div className="flex flex-wrap items-center justify-start gap-2">
        {groups.length > 0 && (
          <button
            type="button"
            onClick={() => {
              if (allGroupsExpanded) collapseAllPositions()
              else setExpandedPositions(new Set(groups.map(([position]) => position)))
            }}
            aria-label={allGroupsExpanded ? "Fermer tous les postes" : "Ouvrir tous les postes"}
            title={allGroupsExpanded ? "Fermer tous les postes" : "Ouvrir tous les postes"}
            className="inline-flex h-10 shrink-0 items-center gap-1 rounded-lg border border-accent/40 bg-card px-2 text-xs font-semibold text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {allGroupsExpanded ? <ChevronUp aria-hidden="true" className="size-3.5" /> : <ChevronDown aria-hidden="true" className="size-3.5" />}
            <span>{allGroupsExpanded ? "Tout −" : "Tout +"}</span>
          </button>
        )}
        <div className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-card px-3 py-1.5 text-xs font-semibold">
          <Award className="size-3.5 text-amber-600 dark:text-amber-400" />
          <span>
            <strong className="text-amber-700 dark:text-amber-300">{missingLicenseCount}</strong>
            {' '}
            {missingLicenseCount === 1 ? 'joueur sans licence' : 'joueurs sans licence'}
          </span>
        </div>
      </div>

      {groups.length === 0 ? (
        <p className="rounded-xl border border-accent/40 bg-card p-5 text-center text-sm text-muted-foreground">
          Aucun joueur ne correspond à votre recherche.
        </p>
      ) : (
        <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {groups.map(([position, list], groupIndex) => {
            const isExpanded = expandedPositions.has(position)
            const groupId = `educator-position-${groupIndex}`
            return (
            <section key={position} aria-label={`Poste : ${position}`} className="scroll-mt-4 overflow-hidden rounded-xl border border-accent/50 bg-card shadow-sm">
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
                  className="flex w-full items-center justify-between gap-2.5 bg-gradient-to-r from-[#172554] via-[#1e3a8a] to-[#172554] px-3.5 py-3 text-left text-white shadow-sm transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <ChevronDown aria-hidden="true" className={`size-4 shrink-0 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                    <ClubCrest className="size-6 shrink-0 ring-2 ring-amber-400/80 shadow-md" />
                    <span className="truncate text-sm font-bold tracking-wide uppercase text-white">{position}</span>
                  </span>
                  <span className="inline-flex items-center rounded-full bg-amber-400 px-2.5 py-0.5 font-mono text-xs font-black text-blue-950 shadow-sm">
                    {list.length}
                  </span>
                </button>
              </h3>
              {isExpanded && <ul id={groupId} className="flex flex-col gap-3 p-3 bg-slate-100/60 dark:bg-slate-900/40">
                {list.map((player) => {
                  const licenseNumber = player.licenseNumber
                  const isCopied = licenseNumber && copiedId === licenseNumber
                  const phone = phones[player.number]
                  const parentContact = (parent: ParentKey, value: string) => {
                    if (!value) return null
                    const label = parent === 'father' ? 'Papa' : 'Maman'
                    const key = player.number + '-' + parent
                    const isOpen = Boolean(visiblePhones[key])
                    return (
                      <div key={parent} className="inline-flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setVisiblePhones((current) => ({ ...current, [key]: !current[key] }))}
                          aria-expanded={isOpen}
                          aria-label={`${isOpen ? 'Masquer' : 'Afficher'} le téléphone de ${label} pour ${player.firstName} ${player.lastName}`}
                          className={`inline-flex min-h-9 items-center gap-2 rounded-xl border px-2.5 text-xs font-bold transition shadow-sm ${
                            isOpen
                              ? 'border-primary/60 bg-primary/10 text-primary'
                              : 'border-accent/50 bg-card text-primary hover:bg-primary/5 hover:shadow-md'
                          }`}
                        >
                          <ParentAvatar parent={parent} />
                          <Phone aria-hidden="true" className="size-3.5" />
                          <span>{label}</span>
                        </button>
                        {isOpen && (
                          <span className="font-mono text-sm font-bold text-primary">{value}</span>
                        )}
                        {isOpen && (
                          <PhoneActionButtons
                            phone={value}
                            label={label}
                            playerName={`${player.firstName} ${player.lastName}`}
                          />
                        )}
                      </div>
                    )
                  }

                  return (
                    <li
                      key={player.number}
                      className="rounded-2xl border-2 border-[#172554]/15 bg-card p-3.5 shadow-sm transition-all hover:border-[#172554]/40 hover:shadow-md"
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
                                  aria-label={`Modifier les téléphones pour ${player.firstName} ${player.lastName}`}
                                  title="Modifier les numéros"
                                  className="inline-flex size-6 shrink-0 items-center justify-center rounded-md border border-accent/40 bg-card text-muted-foreground transition hover:bg-accent/40 hover:text-foreground disabled:opacity-50"
                                >
                                  <Pencil aria-hidden="true" className="size-3" />
                                </button>
                              )}
                            </div>
                            <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                              <span>Licence FFF : <span className="font-mono font-medium">{licenseNumber ?? 'non renseigné'}</span></span>
                              {licenseNumber && (
                                <button
                                  type="button"
                                  onClick={() => handleCopy(licenseNumber)}
                                  className={`inline-flex size-5 shrink-0 items-center justify-center rounded transition ${
                                    isCopied
                                      ? 'bg-emerald-600 text-white'
                                      : 'text-muted-foreground hover:bg-accent/40 hover:text-foreground'
                                  }`}
                                  title="Copier le numéro de licence"
                                  aria-label={`Copier le numéro de licence de ${player.firstName} ${player.lastName}`}
                                >
                                  {isCopied ? <Check className="size-3" /> : <Copy className="size-3" />}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-accent/40 bg-muted/40 p-2">
                        {parentContact('father', phone?.fatherPhone ?? '')}
                        {parentContact('mother', phone?.motherPhone ?? '')}
                        {phone?.legacyPhone && (
                          <div className="inline-flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setVisiblePhones((current) => ({ ...current, [player.number + '-legacy']: !current[player.number + '-legacy'] }))}
                              aria-expanded={Boolean(visiblePhones[player.number + '-legacy'])}
                              aria-label="Afficher ou masquer l’ancien numéro de téléphone"
                              className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-accent/50 bg-card px-2.5 text-xs font-semibold text-muted-foreground"
                            >
                              <Phone aria-hidden="true" className="size-3.5" />
                              Autre contact
                            </button>
                            {visiblePhones[player.number + '-legacy'] && (
                              <span className="font-mono text-sm font-bold text-primary">{phone.legacyPhone}</span>
                            )}
                            {visiblePhones[player.number + '-legacy'] && (
                              <PhoneActionButtons
                                phone={phone.legacyPhone}
                                label="l’autre contact"
                                playerName={`${player.firstName} ${player.lastName}`}
                              />
                            )}
                          </div>
                        )}
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
      {(directoryView === 'players' || Boolean(query.trim())) && !query.trim() && hasExpandedVisibleGroup && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 flex justify-center sm:hidden">
          <button
            type="button"
            onClick={collapseAllPositions}
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
