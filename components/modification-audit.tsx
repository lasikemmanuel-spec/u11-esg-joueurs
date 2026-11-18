'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, History, LogIn, RefreshCw, Search, ShieldCheck } from 'lucide-react'

type AuditEvent = {
  event: string
  username?: string
  ip: string
  userAgent?: string
  role?: string
  detail?: string
  timestamp: string
}

const eventLabels: Record<string, string> = {
  login_success: 'Connexion',
  login_failure: 'Échec de connexion',
  login_blocked: 'Connexion bloquée',
  logout: 'Déconnexion',
  unauthorized_access: 'Accès refusé',
  account_created: 'Compte créé',
  account_deleted: 'Compte supprimé',
  account_modified: 'Compte modifié',
  password_changed: 'Mot de passe modifié',
  contact_modified: 'Coordonnée modifiée',
  match_modified: 'Match modifié',
  callup_saved: 'Convocations enregistrées',
  training_attendance_saved: 'Présences enregistrées',
  lineup_saved: 'Composition enregistrée',
  live_match_modified: 'Match en direct modifié',
  directory_modified: 'Fiche éducateur modifiée',
  profile_photo_modified: 'Photo de profil modifiée',
  whatsapp_settings_modified: 'Configuration WhatsApp modifiée',
}

export function ModificationAudit() {
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(() => new Set())

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/educators/audit', { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Impossible de charger le journal.')
      setEvents(result.events as AuditEvent[])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible de charger le journal.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const filteredEvents = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('fr-FR')
    if (!needle) return events
    return events.filter((event) => [
      eventLabels[event.event] ?? event.event,
      event.username,
      event.role,
      event.detail,
      event.ip,
    ].some((value) => value?.toLocaleLowerCase('fr-FR').includes(needle)))
  }, [events, query])
  const groupedEvents = useMemo(() => {
    const matchingEvents = new Set(filteredEvents)
    const groups = new Map<string, {
      key: string
      username: string
      connectionCount: number
      totalEventCount: number
      events: AuditEvent[]
    }>()
    for (const event of events) {
      const username = event.username?.trim() || 'Utilisateur inconnu'
      const key = username.toLocaleLowerCase('fr-FR')
      const group = groups.get(key) ?? {
        key,
        username,
        connectionCount: 0,
        totalEventCount: 0,
        events: [],
      }
      group.totalEventCount += 1
      if (event.event === 'login_success') group.connectionCount += 1
      if (matchingEvents.has(event)) group.events.push(event)
      groups.set(key, group)
    }
    return [...groups.values()]
      .filter((group) => group.events.length > 0)
      .sort((a, b) =>
        b.connectionCount - a.connectionCount ||
        b.totalEventCount - a.totalEventCount ||
        a.username.localeCompare(b.username, 'fr-FR'),
      )
  }, [events, filteredEvents])

  return (
    <section aria-labelledby="modification-audit-title" className="rounded-2xl border border-accent/50 bg-card p-3 shadow-sm sm:p-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-[#172554] text-amber-300">
            <History aria-hidden="true" className="size-5" />
          </span>
          <div>
            <h2 id="modification-audit-title" className="text-base font-black text-primary sm:text-lg">Historique des modifications</h2>
            <p className="text-xs text-muted-foreground">Connexions par personne · touchez une bulle pour afficher ses logs.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-accent/50 px-3 text-xs font-bold text-primary disabled:opacity-50"
        >
          <RefreshCw aria-hidden="true" className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </button>
      </header>

      <div className="relative mt-4">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher un éducateur, une action ou un détail…"
          className="h-11 w-full rounded-xl border border-accent/50 bg-background pl-10 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {error && <p role="alert" className="mt-3 rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-sm font-medium text-destructive">{error}</p>}
      {loading ? (
        <p role="status" className="mt-3 text-sm text-muted-foreground">Chargement du journal…</p>
      ) : filteredEvents.length === 0 ? (
        <p className="mt-3 rounded-xl bg-muted p-4 text-center text-sm text-muted-foreground">
          {query ? 'Aucune modification ne correspond à la recherche.' : 'Aucune modification enregistrée.'}
        </p>
      ) : (
        <div className="mt-3 space-y-4">
          {groupedEvents.map((group, groupIndex) => {
            const isExpanded = expandedUsers.has(group.key)
            const logsId = `audit-logs-${groupIndex}`
            return (
              <section key={group.key}>
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  aria-controls={logsId}
                  onClick={() => setExpandedUsers((current) => {
                    const next = new Set(current)
                    if (next.has(group.key)) next.delete(group.key)
                    else next.add(group.key)
                    return next
                  })}
                  className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-border bg-muted/70 px-3 py-2 text-left transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-black text-foreground">{group.username}</span>
                    <span className="mt-0.5 block text-[11px] font-semibold text-muted-foreground">
                      {group.events.length} log{group.events.length === 1 ? '' : 's'}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-black text-primary">
                      <LogIn aria-hidden="true" className="size-3.5" />
                      {group.connectionCount} connexion{group.connectionCount === 1 ? '' : 's'}
                    </span>
                    <ChevronDown aria-hidden="true" className={`size-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </span>
                </button>
                {isExpanded && (
                  <ol id={logsId} className="mt-2 space-y-2">
                    {group.events.map((event, index) => (
                      <li key={`${event.timestamp}-${index}`} className="rounded-xl border border-border bg-background p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="flex min-w-0 items-start gap-2">
                            <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                            <div className="min-w-0">
                              <p className="text-sm font-black text-foreground">{eventLabels[event.event] ?? event.event}</p>
                              {event.role && (
                                <p className="mt-0.5 text-xs font-semibold text-muted-foreground">{event.role}</p>
                              )}
                            </div>
                          </div>
                          <time dateTime={event.timestamp} className="text-[11px] font-semibold text-muted-foreground">
                            {new Date(event.timestamp).toLocaleString('fr-FR', {
                              dateStyle: 'short',
                              timeStyle: 'medium',
                              timeZone: 'Europe/Paris',
                            })}
                          </time>
                        </div>
                        {event.detail && <p className="mt-2 break-words rounded-lg bg-muted px-2.5 py-2 text-xs font-medium text-foreground">{event.detail}</p>}
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            )
          })}
        </div>
      )}
    </section>
  )
}
