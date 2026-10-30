'use client'

import { useState, useMemo, useEffect, useCallback, type FormEvent } from 'react'
import { Search, Copy, Check, Users, Award, LockKeyhole, LogOut, Phone, Save, ChevronDown, ChevronUp } from 'lucide-react'
import type { Player } from '@/lib/players'

type EducatorIdentity = { displayName: string; role: 'educator' | 'admin' }

const normalize = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr-FR')

const POSITION_ORDER = ['gard', 'déf', 'def', 'lat', 'cent', 'mil', 'ail', 'att', 'av']

const positionRank = (position: string | null) => {
  if (!position) return POSITION_ORDER.length
  const lower = position.toLowerCase()
  const index = POSITION_ORDER.findIndex((key) => lower.startsWith(key))
  return index === -1 ? POSITION_ORDER.length : index
}

export function EducatorRoster({ players }: { players: Player[] }) {
  const [query, setQuery] = useState('')
  const [expandedPositions, setExpandedPositions] = useState<Set<string>>(() => new Set())
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [educator, setEducator] = useState<EducatorIdentity | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [phones, setPhones] = useState<Record<number, string>>({})
  const [phoneDrafts, setPhoneDrafts] = useState<Record<number, string>>({})
  const [migrationRequired, setMigrationRequired] = useState(false)
  const [sessionChecked, setSessionChecked] = useState(false)
  const [requestPending, setRequestPending] = useState(false)
  const [authError, setAuthError] = useState('')
  const [notice, setNotice] = useState('')

  const loadPhoneContacts = useCallback(async () => {
    setRequestPending(true)
    setAuthError('')
    try {
      const response = await fetch('/api/educators/contacts', { cache: 'no-store' })
      const result = await response.json()
      if (response.status === 401) {
        setEducator(null)
        setPhones({})
        setPhoneDrafts({})
        return
      }
      if (response.status === 409 && result.migrationRequired) {
        setEducator(result.educator)
        setPhones({})
        setPhoneDrafts({})
        setMigrationRequired(true)
        return
      }
      if (!response.ok) throw new Error(result.error ?? 'Impossible de charger les coordonnées.')

      const nextPhones = Object.fromEntries(
        (result.phones as Array<{ number: number; phone: string }>).map(({ number, phone }) => [number, phone]),
      )
      setEducator(result.educator)
      setPhones(nextPhones)
      setPhoneDrafts(nextPhones)
      setMigrationRequired(false)
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Impossible de charger les coordonnées.')
    } finally {
      setRequestPending(false)
      setSessionChecked(true)
    }
  }, [])

  useEffect(() => {
    void loadPhoneContacts()
  }, [loadPhoneContacts])

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
      setPassword('')
      await loadPhoneContacts()
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Connexion impossible.')
    } finally {
      setRequestPending(false)
    }
  }

  const handleLogout = async () => {
    setRequestPending(true)
    try {
      const response = await fetch('/api/educators/session', { method: 'DELETE' })
      if (!response.ok) throw new Error('Déconnexion impossible.')
      setEducator(null)
      setPhones({})
      setPhoneDrafts({})
      setMigrationRequired(false)
      setAuthError('')
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Déconnexion impossible.')
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

  const handleSavePhone = async (number: number) => {
    setRequestPending(true)
    setAuthError('')
    setNotice('')
    try {
      const response = await fetch('/api/educators/contacts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number, phone: phoneDrafts[number] ?? '' }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Enregistrement impossible.')
      await loadPhoneContacts()
      setNotice('Téléphone enregistré.')
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Enregistrement impossible.')
    } finally {
      setRequestPending(false)
    }
  }

  const groups = useMemo(() => {
    const searchTerms = normalize(query.trim()).split(/\s+/).filter(Boolean)
    const grouped = new Map<string, Player[]>()

    for (const player of players) {
      const firstName = normalize(player.firstName)
      const lastName = normalize(player.lastName)
      const matchesQuery = searchTerms.every(
        (term) => firstName.includes(term) || lastName.includes(term),
      )
      if (!matchesQuery) continue

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

  const licensedCount = players.filter((p) => Boolean(p.licenseNumber)).length
  const filteredCount = groups.reduce((count, [, list]) => count + list.length, 0)
  const allGroupsExpanded = groups.length > 0 && groups.every(([position]) => expandedPositions.has(position))

  if (!sessionChecked) {
    return (
      <section aria-live="polite" className="rounded-2xl border border-accent/50 bg-card p-6 text-center text-sm text-muted-foreground">
        Vérification de la connexion…
      </section>
    )
  }

  if (!educator) {
    return (
      <section aria-labelledby="educator-login-title" className="mx-auto flex w-full max-w-md flex-col gap-4 rounded-2xl border border-accent/60 bg-gradient-to-br from-secondary/40 via-card to-card p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <LockKeyhole className="size-5" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">ES Genech · U11</p>
            <h2 id="educator-login-title" className="text-xl font-black text-primary">Espace éducateurs</h2>
          </div>
        </div>
        <form onSubmit={handleLogin} className="flex flex-col gap-3">
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
          {authError && <p role="alert" className="text-sm font-medium text-destructive">{authError}</p>}
          <button
            type="submit"
            disabled={requestPending}
            className="h-10 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            {requestPending ? 'Connexion…' : 'Se connecter'}
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
        <button type="button" onClick={handleLogout} className="self-start text-sm font-semibold text-muted-foreground underline">
          Se déconnecter
        </button>
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
      <div className="flex flex-wrap items-center justify-end gap-2 rounded-xl border border-accent/40 bg-card p-3">
        <div className="flex items-center gap-1.5 rounded-full border border-accent/40 bg-card px-3 py-1.5 text-xs font-semibold">
          <Users className="size-3.5 text-primary" />
          <span>
            <strong className="text-primary">{filteredCount}</strong> joueur{filteredCount !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-accent/40 bg-card px-3 py-1.5 text-xs font-semibold">
          <Award className="size-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>
            <strong className="text-emerald-600 dark:text-emerald-400">{licensedCount}</strong> licences
          </span>
        </div>
        <span className="text-xs text-muted-foreground">{educator.displayName}</span>
        <button
          type="button"
          onClick={handleLogout}
          disabled={requestPending}
          aria-label="Se déconnecter"
          title="Se déconnecter"
          className="inline-flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-accent/40"
        >
          <LogOut className="size-4" />
        </button>
      </div>

      {authError && <p role="alert" className="text-sm font-medium text-destructive">{authError}</p>}
      {notice && <p role="status" className="text-sm font-medium text-emerald-700 dark:text-emerald-300">{notice}</p>}

      <div className="flex items-center gap-2">
        {groups.length > 0 && (
          <button
            type="button"
            onClick={() => setExpandedPositions(allGroupsExpanded ? new Set() : new Set(groups.map(([position]) => position)))}
            aria-label={allGroupsExpanded ? 'Fermer tous les postes' : 'Ouvrir tous les postes'}
            title={allGroupsExpanded ? 'Fermer tous les postes' : 'Ouvrir tous les postes'}
            className="inline-flex h-8 shrink-0 items-center gap-1 self-start rounded-lg border border-accent/40 bg-card px-2 text-xs font-semibold text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:self-auto"
          >
            {allGroupsExpanded ? <ChevronUp aria-hidden="true" className="size-3.5" /> : <ChevronDown aria-hidden="true" className="size-3.5" />}
            <span>{allGroupsExpanded ? 'Tout −' : 'Tout +'}</span>
          </button>
        )}
        <div className="relative min-w-0 max-w-xl flex-1">
          <label htmlFor="educator-search" className="sr-only">
            Rechercher par nom ou prénom
          </label>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="educator-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher par nom, prénom ou les deux…"
            className="h-10 w-full rounded-xl border border-accent/40 bg-background pr-3 pl-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>

      {educator.role === 'admin' && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent/40 bg-card p-3">
          <p className="text-sm text-muted-foreground">
            Chiffrez et synchronisez les téléphones dans les onglets « Joueurs » et « Téléphones éducateurs ».
          </p>
          <button
            type="button"
            onClick={handlePhoneMigration}
            disabled={requestPending}
            className="min-h-10 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {requestPending ? 'Chiffrement en cours…' : 'Chiffrer et synchroniser'}
          </button>
        </section>
      )}

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

                  return (
                    <li key={player.number} className="flex min-w-0 items-center justify-between gap-2 px-3 py-2.5 transition-colors hover:bg-muted/40">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-foreground">
                          {player.firstName} <span className="font-black uppercase tracking-wide text-primary">{player.lastName}</span>
                        </p>
                        <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                          {licenseNumber ?? 'Licence non renseignée'}
                        </p>
                        {educator.role === 'admin' ? (
                          <div className="mt-1.5 flex max-w-sm items-center gap-1.5">
                            <label htmlFor={`phone-${player.number}`} className="sr-only">
                              Téléphone de {player.firstName} {player.lastName}
                            </label>
                            <input
                              id={`phone-${player.number}`}
                              type="tel"
                              autoComplete="off"
                              value={phoneDrafts[player.number] ?? ''}
                              onChange={(event) => setPhoneDrafts((current) => ({
                                ...current,
                                [player.number]: event.target.value,
                              }))}
                              placeholder="Téléphone"
                              maxLength={80}
                              className="h-8 min-w-0 flex-1 rounded-md border border-accent/40 bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            />
                            <button
                              type="button"
                              onClick={() => handleSavePhone(player.number)}
                              disabled={requestPending || (phoneDrafts[player.number] ?? '') === (phone ?? '')}
                              aria-label={`Enregistrer le téléphone de ${player.firstName} ${player.lastName}`}
                              title="Enregistrer le téléphone"
                              className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground disabled:opacity-40"
                            >
                              <Save className="size-3.5" />
                            </button>
                          </div>
                        ) : phone ? (
                          <a
                            href={`tel:${phone.replace(/[^\d+]/g, '')}`}
                            className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                          >
                            <Phone aria-hidden="true" className="size-3" />
                            {phone}
                          </a>
                        ) : (
                          <p className="mt-1 text-xs text-muted-foreground">Téléphone non renseigné</p>
                        )}
                      </div>
                      <div className="shrink-0">
                        {licenseNumber ? (
                          <button
                            type="button"
                            onClick={() => handleCopy(licenseNumber)}
                            className={`inline-flex size-8 items-center justify-center rounded-lg transition ${
                              isCopied
                                ? 'bg-emerald-600 text-white'
                                : 'bg-muted text-muted-foreground hover:bg-accent/40 hover:text-foreground'
                            }`}
                            title="Copier le numéro de licence"
                            aria-label={`Copier la licence de ${player.firstName} ${player.lastName}`}
                          >
                            {isCopied ? (
                              <Check className="size-4" />
                            ) : (
                              <Copy className="size-4" />
                            )}
                          </button>
                        ) : (
                          <span className="sr-only">Aucune licence à copier</span>
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
    </section>
  )
}
