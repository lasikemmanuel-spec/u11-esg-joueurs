'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  X,
} from 'lucide-react'
import {
  createCalendarFile,
  MAX_WEEKLY_RECURRENCE_EVENTS,
  type PlanningEvent,
  type PlanningEventFields,
} from '@/lib/team-planning-shared'

type PlanningView = 'week' | 'upcoming'

const TYPE_LABELS: Record<PlanningEvent['type'], string> = {
  training: 'Entraînement',
  match: 'Match',
  tournament: 'Tournoi',
}

const STATUS_LABELS: Record<PlanningEvent['status'], string> = {
  confirmed: 'Confirmé',
  postponed: 'Reporté',
  cancelled: 'Annulé',
}

const EMPTY_DRAFT: PlanningEventFields = {
  date: '',
  type: 'training',
  team: 'both',
  title: '',
  meetingTime: '',
  startTime: '',
  endTime: '',
  location: '',
  notes: '',
  status: 'confirmed',
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00`)
  date.setDate(date.getDate() + days)
  return toDateKey(date)
}

function getMonday(date = new Date()) {
  const monday = new Date(date)
  monday.setHours(12, 0, 0, 0)
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  return toDateKey(monday)
}

function formatDate(dateKey: string, options: Intl.DateTimeFormatOptions = {}) {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...options,
  })
}

function sortEvents(events: PlanningEvent[]) {
  return [...events].sort((a, b) => `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`))
}

export function TeamPlanning({ canManage }: { canManage: boolean }) {
  const [events, setEvents] = useState<PlanningEvent[]>([])
  const [view, setView] = useState<PlanningView>('week')
  const [weekStart, setWeekStart] = useState(() => getMonday())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [notice, setNotice] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<PlanningEvent | null>(null)
  const [draft, setDraft] = useState<PlanningEventFields>(EMPTY_DRAFT)
  const [repeatWeekly, setRepeatWeekly] = useState(false)
  const [repeatUntil, setRepeatUntil] = useState('')

  const loadEvents = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const response = await fetch('/api/team-planning', { cache: 'no-store' })
      const result = await response.json() as { events?: PlanningEvent[]; error?: string }
      if (!response.ok) throw new Error(result.error ?? 'Impossible de charger le planning.')
      setEvents(result.events ?? [])
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Impossible de charger le planning.'
      setLoadError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadEvents()
  }, [loadEvents])

  const visibleEvents = useMemo(() => {
    const today = toDateKey(new Date())
    const weekEnd = addDays(weekStart, 6)
    return sortEvents(events.filter((event) => view === 'week'
      ? event.date >= weekStart && event.date <= weekEnd
      : event.date >= today))
  }, [events, view, weekStart])

  const resetForm = () => {
    const date = toDateKey(new Date())
    setDraft({ ...EMPTY_DRAFT, date })
    setEditingEvent(null)
    setRepeatWeekly(false)
    setRepeatUntil(addDays(date, 28))
    setFormOpen(false)
    setSaveError('')
  }

  const openNewEventForm = () => {
    const date = toDateKey(new Date())
    setDraft({ ...EMPTY_DRAFT, date })
    setEditingEvent(null)
    setRepeatWeekly(false)
    setRepeatUntil(addDays(date, 28))
    setSaveError('')
    setNotice('')
    setFormOpen(true)
  }

  const editEvent = (event: PlanningEvent) => {
    const fields: PlanningEventFields = {
      date: event.date,
      type: event.type,
      team: event.team,
      title: event.title,
      meetingTime: event.meetingTime,
      startTime: event.startTime,
      endTime: event.endTime,
      location: event.location,
      notes: event.notes,
      status: event.status,
    }
    setDraft(fields)
    setEditingEvent(event)
    setRepeatWeekly(false)
    setSaveError('')
    setNotice('')
    setFormOpen(true)
  }

  const updateDraft = <K extends keyof PlanningEventFields>(key: K, value: PlanningEventFields[K]) => {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setSaveError('')
    setNotice('')
    try {
      const response = await fetch('/api/team-planning', {
        method: editingEvent ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingEvent
          ? { ...draft, id: editingEvent.id }
          : {
              ...draft,
              recurrence: repeatWeekly ? { frequency: 'weekly', endDate: repeatUntil } : null,
            }),
      })
      const result = await response.json() as { event?: PlanningEvent; events?: PlanningEvent[]; error?: string }
      const savedEvents = result.events ?? (result.event ? [result.event] : [])
      if (!response.ok || savedEvents.length === 0) {
        throw new Error(result.error ?? 'Impossible d’enregistrer cet événement.')
      }
      const savedIds = new Set(savedEvents.map((event) => event.id))
      setEvents((current) => sortEvents([
        ...current.filter((item) => !savedIds.has(item.id)),
        ...savedEvents,
      ]))
      setNotice(editingEvent
        ? 'Événement modifié.'
        : repeatWeekly
          ? `${savedEvents.length} événements hebdomadaires ajoutés jusqu’au ${formatDate(repeatUntil)}. Chaque occurrence reste modifiable séparément.`
          : 'Événement ajouté au planning.')
      setFormOpen(false)
      setEditingEvent(null)
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'Impossible d’enregistrer cet événement.')
    } finally {
      setSaving(false)
    }
  }

  const downloadCalendarFile = (event: PlanningEvent) => {
    const file = new Blob([createCalendarFile(event)], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(file)
    const link = document.createElement('a')
    link.href = url
    link.download = `esg-${event.date}-${event.id}.ics`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <section className="flex flex-col gap-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-black text-foreground">
            <CalendarDays aria-hidden="true" className="size-6 text-primary" />
            Planning de l’équipe
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Matchs, entraînements et tournois à venir.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void loadEvents()}
            disabled={loading}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-border px-3 text-sm font-semibold hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw aria-hidden="true" className={`size-4 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
          {canManage && (
            <button
              type="button"
              onClick={openNewEventForm}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground hover:opacity-90"
            >
              <Plus aria-hidden="true" className="size-4" />
              Ajouter un événement
            </button>
          )}
        </div>
      </header>

      {notice && <p role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm">{notice}</p>}
      {loadError && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <span>{loadError}</span>
          <button type="button" onClick={() => void loadEvents()} className="font-bold underline underline-offset-2">Réessayer</button>
        </div>
      )}

      {canManage && formOpen && (
        <form onSubmit={handleSubmit} className="grid gap-4 rounded-2xl border border-accent/40 bg-card p-4 shadow-sm sm:grid-cols-2">
          <h3 className="text-lg font-bold sm:col-span-2">{editingEvent ? 'Modifier l’événement' : 'Nouvel événement'}</h3>
          <label className="grid gap-1 text-sm font-semibold">
            Titre
            <input
              required
              maxLength={100}
              value={draft.title}
              onChange={(event) => updateDraft('title', event.target.value)}
              placeholder="Ex. Match contre l’ES..."
              className="h-10 rounded-lg border border-border bg-background px-3 font-normal"
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Type
            <select
              value={draft.type}
              onChange={(event) => updateDraft('type', event.target.value as PlanningEventFields['type'])}
              className="h-10 rounded-lg border border-border bg-background px-3 font-normal"
            >
              <option value="training">Entraînement</option>
              <option value="match">Match</option>
              <option value="tournament">Tournoi</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Équipe
            <select
              value={draft.team}
              onChange={(event) => updateDraft('team', event.target.value as PlanningEventFields['team'])}
              className="h-10 rounded-lg border border-border bg-background px-3 font-normal"
            >
              <option value="both">E1 et E2</option>
              <option value="E1">E1</option>
              <option value="E2">E2</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Date
            <input
              required
              type="date"
              value={draft.date}
              onChange={(event) => {
                const date = event.target.value
                updateDraft('date', date)
                if (date) {
                  const minDate = addDays(date, 7)
                  const maxDate = addDays(date, MAX_WEEKLY_RECURRENCE_EVENTS * 7 - 1)
                  setRepeatUntil((current) =>
                    current < minDate || current > maxDate ? addDays(date, 28) : current,
                  )
                }
              }}
              className="h-10 rounded-lg border border-border bg-background px-3 font-normal"
            />
          </label>
          {!editingEvent && (
            <fieldset className="grid gap-3 rounded-xl border border-border bg-muted/20 p-3 sm:col-span-2">
              <legend className="px-1 text-sm font-bold">Récurrence</legend>
              <label className="flex min-h-8 items-center gap-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={repeatWeekly}
                  onChange={(event) => {
                    const checked = event.target.checked
                    setRepeatWeekly(checked)
                    if (checked && draft.date && repeatUntil < addDays(draft.date, 7)) {
                      setRepeatUntil(addDays(draft.date, 28))
                    }
                  }}
                  className="size-4 accent-primary"
                />
                Répéter chaque semaine
              </label>
              {repeatWeekly && (
                <div className="grid gap-1">
                  <label htmlFor="planning-recurrence-end" className="text-sm font-semibold">
                    Jusqu’au (inclus)
                  </label>
                  <input
                    id="planning-recurrence-end"
                    required
                    type="date"
                    min={draft.date ? addDays(draft.date, 7) : undefined}
                    max={draft.date
                      ? addDays(draft.date, MAX_WEEKLY_RECURRENCE_EVENTS * 7 - 1)
                      : undefined}
                    value={repeatUntil}
                    onChange={(event) => setRepeatUntil(event.target.value)}
                    className="h-10 rounded-lg border border-border bg-background px-3 font-normal"
                  />
                  <p className="text-xs text-muted-foreground">
                    Le même jour et les mêmes horaires seront repris chaque semaine. Chaque occurrence reste modifiable séparément (52 maximum).
                  </p>
                </div>
              )}
            </fieldset>
          )}
          <label className="grid gap-1 text-sm font-semibold">
            Heure de rendez-vous <span className="font-normal text-muted-foreground">(facultative)</span>
            <input
              type="time"
              value={draft.meetingTime}
              onChange={(event) => updateDraft('meetingTime', event.target.value)}
              className="h-10 rounded-lg border border-border bg-background px-3 font-normal"
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Début
            <input
              required
              type="time"
              value={draft.startTime}
              onChange={(event) => updateDraft('startTime', event.target.value)}
              className="h-10 rounded-lg border border-border bg-background px-3 font-normal"
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Fin
            <input
              required
              type="time"
              min={draft.startTime || undefined}
              value={draft.endTime}
              onChange={(event) => updateDraft('endTime', event.target.value)}
              className="h-10 rounded-lg border border-border bg-background px-3 font-normal"
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold sm:col-span-2">
            Lieu
            <input
              required
              maxLength={160}
              value={draft.location}
              onChange={(event) => updateDraft('location', event.target.value)}
              placeholder="Stade, adresse…"
              className="h-10 rounded-lg border border-border bg-background px-3 font-normal"
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Statut
            <select
              value={draft.status}
              onChange={(event) => updateDraft('status', event.target.value as PlanningEventFields['status'])}
              className="h-10 rounded-lg border border-border bg-background px-3 font-normal"
            >
              <option value="confirmed">Confirmé</option>
              <option value="postponed">Reporté</option>
              <option value="cancelled">Annulé</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold sm:col-span-2">
            Consignes <span className="font-normal text-muted-foreground">(facultatives)</span>
            <textarea
              maxLength={600}
              rows={3}
              value={draft.notes}
              onChange={(event) => updateDraft('notes', event.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 font-normal"
            />
          </label>
          {saveError && <p role="alert" className="text-sm font-medium text-destructive sm:col-span-2">{saveError}</p>}
          <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
            <button
              type="button"
              onClick={resetForm}
              disabled={saving}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-4 text-sm font-semibold hover:bg-muted disabled:opacity-50"
            >
              <X aria-hidden="true" className="size-4" />
              Fermer
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {saving ? 'Enregistrement…' : editingEvent ? 'Enregistrer les modifications' : 'Ajouter au planning'}
            </button>
          </div>
        </form>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-border bg-muted/60 p-1" role="group" aria-label="Affichage du planning">
          <button
            type="button"
            aria-pressed={view === 'week'}
            onClick={() => setView('week')}
            className={`min-h-9 rounded-lg px-3 text-sm font-bold ${view === 'week' ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}
          >
            Semaine
          </button>
          <button
            type="button"
            aria-pressed={view === 'upcoming'}
            onClick={() => setView('upcoming')}
            className={`min-h-9 rounded-lg px-3 text-sm font-bold ${view === 'upcoming' ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}
          >
            À venir
          </button>
        </div>
        {view === 'week' && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Semaine précédente"
              onClick={() => setWeekStart((current) => addDays(current, -7))}
              className="inline-flex size-9 items-center justify-center rounded-lg border border-border hover:bg-muted"
            >
              <ChevronLeft aria-hidden="true" className="size-4" />
            </button>
            <p className="min-w-36 text-center text-sm font-bold capitalize">
              {formatDate(weekStart, { weekday: undefined })} – {formatDate(addDays(weekStart, 6))}
            </p>
            <button
              type="button"
              aria-label="Semaine suivante"
              onClick={() => setWeekStart((current) => addDays(current, 7))}
              className="inline-flex size-9 items-center justify-center rounded-lg border border-border hover:bg-muted"
            >
              <ChevronRight aria-hidden="true" className="size-4" />
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <p role="status" className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Chargement du planning…</p>
      ) : loadError ? null : visibleEvents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center">
          <CalendarDays aria-hidden="true" className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-2 font-semibold">Aucun événement pour cette période.</p>
          {canManage && !formOpen && (
            <button type="button" onClick={openNewEventForm} className="mt-3 text-sm font-bold text-primary underline underline-offset-4">
              Ajouter un événement
            </button>
          )}
        </div>
      ) : (
        <ul className="grid gap-3">
          {visibleEvents.map((event) => (
            <li key={event.id} className={`rounded-xl border bg-card p-4 shadow-sm ${event.status === 'cancelled' ? 'border-destructive/40 opacity-80' : 'border-border'}`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">{TYPE_LABELS[event.type]}</span>
                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">{event.team === 'both' ? 'E1 et E2' : event.team}</span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${event.status === 'confirmed' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : event.status === 'postponed' ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300' : 'bg-destructive/10 text-destructive'}`}>
                      {STATUS_LABELS[event.status]}
                    </span>
                  </div>
                  <h3 className={`mt-2 text-lg font-black ${event.status === 'cancelled' ? 'line-through' : ''}`}>{event.title}</h3>
                  <p className="mt-1 text-sm font-semibold capitalize">{formatDate(event.date)}</p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock3 aria-hidden="true" className="size-4" />
                      {event.startTime}–{event.endTime}
                      {event.meetingTime && ` · rendez-vous ${event.meetingTime}`}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin aria-hidden="true" className="size-4" />
                      {event.location}
                    </span>
                  </div>
                  {event.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{event.notes}</p>}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                  <button
                    type="button"
                    onClick={() => downloadCalendarFile(event)}
                    className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm font-semibold hover:bg-muted"
                  >
                    <CalendarPlus aria-hidden="true" className="size-4" />
                    <span className="sm:hidden">Calendrier</span>
                    <span className="hidden sm:inline">Ajouter à mon calendrier</span>
                  </button>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => editEvent(event)}
                      aria-label={`Modifier ${event.title}`}
                      className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm font-semibold hover:bg-muted"
                    >
                      <Pencil aria-hidden="true" className="size-4" />
                      Modifier
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
