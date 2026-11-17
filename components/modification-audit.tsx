'use client'

import { useEffect, useMemo, useState } from 'react'
import { History, RefreshCw, Search, ShieldCheck } from 'lucide-react'

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

  return (
    <section aria-labelledby="modification-audit-title" className="rounded-2xl border border-accent/50 bg-card p-3 shadow-sm sm:p-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-[#172554] text-amber-300">
            <History aria-hidden="true" className="size-5" />
          </span>
          <div>
            <h2 id="modification-audit-title" className="text-base font-black text-primary sm:text-lg">Historique des modifications</h2>
            <p className="text-xs text-muted-foreground">Dernières actions enregistrées et chiffrées.</p>
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
        <ol className="mt-3 space-y-2">
          {filteredEvents.map((event, index) => (
            <li key={`${event.timestamp}-${index}`} className="rounded-xl border border-border bg-background p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-2">
                  <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <div className="min-w-0">
                    <p className="text-sm font-black text-foreground">{eventLabels[event.event] ?? event.event}</p>
                    <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
                      {event.username ?? 'Utilisateur inconnu'}{event.role ? ` · ${event.role}` : ''}
                    </p>
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
}
