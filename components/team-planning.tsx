'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  Ban,
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  MapPin,
  Pencil,
  Plus,
  Repeat,
  RefreshCw,
  X,
} from 'lucide-react'
import { MatchWeather } from '@/components/match-weather'
import { MATCH_SEASON_END, MATCH_SEASON_START } from '@/lib/match-season'
import type { MatchSheetEntry } from '@/lib/match-results'
import { isCountedTrainingStatus } from '@/lib/training-attendance-metrics'
import type { PublicPlayer } from '@/lib/players'
import type { TrainingAttendanceSession } from '@/lib/training-attendance-shared'
import { getScheduledMatchPlanningEvents, type PlanningCardEvent } from '@/lib/team-planning-match-events'
import {
  createCalendarFile,
  MAX_WEEKLY_RECURRENCE_EVENTS,
  PLANNING_EVENT_TYPES,
  type PlanningEvent,
  type PlanningEventFields,
} from '@/lib/team-planning-shared'

type PlanningView = 'week' | 'upcoming'

const TYPE_LABELS: Record<PlanningEvent['type'], string> = {
  training: 'Entraînement',
  match: 'Match',
  tournament: 'Tournoi',
  meeting: 'Réunion',
  cohesion: 'Journée de cohésion',
}

type PlanningEventFilter = {
  id: string
  label: string
  accessibleLabel?: string
  emoji: string
  types: readonly PlanningEvent['type'][]
}

const EVENT_FILTERS: PlanningEventFilter[] = [
  { id: 'training', label: 'Entraînement', emoji: '🏃', types: ['training'] },
  { id: 'tournament', label: 'Tournoi', emoji: '🏆', types: ['tournament'] },
  { id: 'match', label: 'Matchs', emoji: '⚽', types: ['match'] },
  {
    id: 'meeting-cohesion',
    label: 'Vie du club',
    accessibleLabel: 'Réunions et journées de cohésion',
    emoji: '🤝',
    types: ['meeting', 'cohesion'],
  },
]

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

function formatWeekday(dateKey: string) {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long' })
}

function formatWeekRange(startDate: string, endDate: string) {
  const shortDate = (date: string, includeYear = false) => new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    ...(includeYear ? { year: 'numeric' } : {}),
  })
  return `${shortDate(startDate)} – ${shortDate(endDate, true)}`
}

function getDateParts(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00`)
  return {
    weekday: date.toLocaleDateString('fr-FR', { weekday: 'short' }).replace(/\.$/, ''),
    day: date.toLocaleDateString('fr-FR', { day: 'numeric' }),
    month: date.toLocaleDateString('fr-FR', { month: 'short' }).replace(/\.$/, ''),
  }
}

function getWeekColor(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7))
  const weekIndex = Math.floor(date.getTime() / (7 * 24 * 60 * 60 * 1000))
  return Math.abs(weekIndex % 2) === 0 ? 'blue' : 'gold'
}

function getTrainingAttendanceGauge(
  session: TrainingAttendanceSession | undefined,
  players: PublicPlayer[],
) {
  if (!session || session.cancellation || players.length === 0) return null

  let present = 0
  let absent = 0
  for (const player of players) {
    const status = session.playerStatuses[player.number]?.trim() ?? ''
    if (!isCountedTrainingStatus(status)) continue
    if (status === 'P') present += 1
    else absent += 1
  }
  if (present + absent === 0) return null
  return { present, absent, total: players.length }
}

function sortEvents(events: PlanningCardEvent[]) {
  return [...events].sort((a, b) => `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`))
}

export function TeamPlanning({
  canManage,
  matches,
  players,
  trainingAttendance,
  onOpenTraining,
}: {
  canManage: boolean
  matches: MatchSheetEntry[]
  players: PublicPlayer[]
  trainingAttendance: TrainingAttendanceSession[]
  onOpenTraining: (date: string) => void
}) {
  const [events, setEvents] = useState<PlanningEvent[]>([])
  const [view, setView] = useState<PlanningView>('week')
  const [selectedTypes, setSelectedTypes] = useState<PlanningEvent['type'][]>(() => [...PLANNING_EVENT_TYPES])
  const [weekStart, setWeekStart] = useState(() => getMonday())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [notice, setNotice] = useState('')
  const [actionError, setActionError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<PlanningEvent | null>(null)
  const [editingSeries, setEditingSeries] = useState(false)
  const [draft, setDraft] = useState<PlanningEventFields>(EMPTY_DRAFT)
  const [repeatWeekly, setRepeatWeekly] = useState(false)
  const [repeatUntil, setRepeatUntil] = useState('')
  const [pendingSeriesId, setPendingSeriesId] = useState('')

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

  const today = toDateKey(new Date())
  const allEvents = useMemo(
    () => [
      ...events,
      ...getScheduledMatchPlanningEvents(matches, events, today),
    ],
    [events, matches, today],
  )
  const periodEvents = useMemo(() => {
    const weekEnd = addDays(weekStart, 6)
    return allEvents.filter((event) => view === 'week'
      ? event.date >= weekStart && event.date <= weekEnd
      : event.date >= today)
  }, [allEvents, today, view, weekStart])
  const visibleEvents = useMemo(
    () => sortEvents(periodEvents.filter((event) => selectedTypes.includes(event.type))),
    [periodEvents, selectedTypes],
  )

  const toggleEventTypes = (types: readonly PlanningEvent['type'][]) => {
    setSelectedTypes((current) => {
      const shouldSelect = !types.every((type) => current.includes(type))
      return shouldSelect
        ? [...new Set([...current, ...types])]
        : current.filter((type) => !types.includes(type))
    })
  }

  const resetForm = () => {
    const date = toDateKey(new Date())
    setDraft({ ...EMPTY_DRAFT, date })
    setEditingEvent(null)
    setEditingSeries(false)
    setRepeatWeekly(false)
    setRepeatUntil(addDays(date, 28))
    setFormOpen(false)
    setSaveError('')
    setActionError('')
  }

  const openNewEventForm = () => {
    const date = toDateKey(new Date())
    setDraft({ ...EMPTY_DRAFT, date })
    setEditingEvent(null)
    setEditingSeries(false)
    setRepeatWeekly(false)
    setRepeatUntil(addDays(date, 28))
    setSaveError('')
    setActionError('')
    setNotice('')
    setFormOpen(true)
  }

  const editEvent = (event: PlanningEvent, series = false) => {
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
    setEditingSeries(series && Boolean(event.recurrenceGroupId))
    setRepeatWeekly(false)
    setSaveError('')
    setActionError('')
    setNotice('')
    setFormOpen(true)
  }

  const updateDraft = <K extends keyof PlanningEventFields>(key: K, value: PlanningEventFields[K]) => {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  const replaceEvents = (savedEvents: PlanningEvent[]) => {
    const savedIds = new Set(savedEvents.map((event) => event.id))
    setEvents((current) => sortEvents([
      ...current.filter((item) => !savedIds.has(item.id)),
      ...savedEvents,
    ]))
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
          ? editingSeries
            ? {
                ...draft,
                scope: 'series',
                seriesId: editingEvent.recurrenceGroupId,
              }
            : {
                ...draft,
                id: editingEvent.id,
                recurrenceGroupId: editingEvent.recurrenceGroupId ?? null,
                recurrenceEndDate: editingEvent.recurrenceEndDate ?? null,
              }
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
      replaceEvents(savedEvents)
      setActionError('')
      setNotice(
        editingSeries
          ? 'Série modifiée.'
          : editingEvent
            ? 'Événement modifié.'
            : repeatWeekly
              ? `${savedEvents.length} événements hebdomadaires ajoutés jusqu’au ${formatDate(repeatUntil)}. Chaque occurrence reste modifiable séparément.`
              : 'Événement ajouté au planning.',
      )
      setFormOpen(false)
      setEditingEvent(null)
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'Impossible d’enregistrer cet événement.')
    } finally {
      setSaving(false)
    }
  }

  const cancelSeries = async (event: PlanningEvent) => {
    if (!event.recurrenceGroupId) return
    if (!window.confirm(`Annuler toutes les occurrences de « ${event.title} » ?`)) return

    setPendingSeriesId(event.recurrenceGroupId)
    setActionError('')
    setNotice('')
    try {
      const response = await fetch('/api/team-planning', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...event,
          scope: 'series',
          seriesId: event.recurrenceGroupId,
          status: 'cancelled',
        }),
      })
      const result = await response.json() as { events?: PlanningEvent[]; event?: PlanningEvent; error?: string }
      const savedEvents = result.events ?? (result.event ? [result.event] : [])
      if (!response.ok || savedEvents.length === 0) {
        throw new Error(result.error ?? 'Impossible d’annuler cette série.')
      }
      replaceEvents(savedEvents)
      setNotice(`Série annulée : ${savedEvents.length} événement(s).`)
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Impossible d’annuler cette série.')
    } finally {
      setPendingSeriesId('')
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
    <section className="flex flex-col gap-3 sm:gap-5">
      <header className="flex flex-col gap-1">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-black text-foreground">
            <CalendarDays aria-hidden="true" className="size-6 text-primary" />
            Planning
          </h2>
        </div>
      </header>

      <div className="flex flex-nowrap gap-1 overflow-x-auto overscroll-x-contain py-0.5 sm:flex-wrap sm:overflow-visible" role="group" aria-label="Filtrer les événements">
        {EVENT_FILTERS.map((filter) => {
          const selected = filter.types.every((type) => selectedTypes.includes(type))
          return (
            <button
              key={filter.id}
              type="button"
              aria-label={`Afficher ou masquer ${filter.accessibleLabel ?? filter.label}`}
              aria-pressed={selected}
              onClick={() => toggleEventTypes(filter.types)}
              className={`inline-flex min-h-9 shrink-0 items-center justify-center gap-0.5 whitespace-nowrap rounded-xl border px-1 text-[10px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                selected
                  ? 'border-blue-300 bg-gradient-to-r from-blue-50 to-sky-100 text-[#1e3a8a] shadow-sm ring-1 ring-[#d4af37]/40 dark:border-blue-700 dark:from-blue-950/70 dark:to-slate-900 dark:text-sky-100'
                  : 'border-border/70 bg-background/50 text-muted-foreground hover:border-blue-300 hover:bg-blue-50/70 dark:hover:bg-blue-950/30'
              }`}
            >
              <span aria-hidden="true" className="text-xs leading-none">{filter.emoji}</span>
              {filter.label}
            </button>
          )
        })}
        {selectedTypes.length !== PLANNING_EVENT_TYPES.length && (
          <button
            type="button"
            onClick={() => setSelectedTypes([...PLANNING_EVENT_TYPES])}
            className="min-h-9 px-1.5 text-[11px] font-bold text-primary underline-offset-2 hover:underline"
          >
            Tout
          </button>
        )}
      </div>

      <div className="flex min-w-0 flex-nowrap items-center gap-1.5 rounded-2xl border border-border/70 bg-muted/30 p-1.5 shadow-sm">
        {canManage && (
          <button
            type="button"
            onClick={openNewEventForm}
            aria-label="Ajouter un événement au planning"
            title="Ajouter un événement"
            className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 text-xs font-bold text-primary-foreground shadow-sm transition hover:opacity-90 sm:text-sm"
          >
            <Plus aria-hidden="true" className="size-4" />
            <span>Ajouter</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => void loadEvents()}
          disabled={loading}
          aria-label="Actualiser le planning"
          title="Actualiser le planning"
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background/70 text-muted-foreground transition hover:bg-background hover:text-foreground disabled:opacity-50"
        >
          <RefreshCw aria-hidden="true" className={`size-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
        <div className="ml-auto inline-flex shrink-0 rounded-xl bg-muted/70 p-1" role="group" aria-label="Affichage du planning">
          <button
            type="button"
            aria-pressed={view === 'week'}
            onClick={() => setView('week')}
            className={`min-h-9 whitespace-nowrap rounded-lg px-2.5 text-xs font-bold transition sm:px-3 sm:text-sm ${view === 'week' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-background hover:text-foreground'}`}
          >
            Semaine
          </button>
          <button
            type="button"
            aria-pressed={view === 'upcoming'}
            onClick={() => setView('upcoming')}
            className={`min-h-9 whitespace-nowrap rounded-lg px-2.5 text-xs font-bold transition sm:px-3 sm:text-sm ${view === 'upcoming' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-background hover:text-foreground'}`}
          >
            À venir
          </button>
        </div>
      </div>

      {notice && <p role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm">{notice}</p>}
      {actionError && <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">{actionError}</p>}
      {loadError && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <span>{loadError}</span>
          <button type="button" onClick={() => void loadEvents()} className="font-bold underline underline-offset-2">Réessayer</button>
        </div>
      )}

      {canManage && formOpen && (
        <form onSubmit={handleSubmit} className="grid gap-4 rounded-2xl border border-accent/40 bg-card p-4 shadow-sm sm:grid-cols-2">
          <h3 className="text-lg font-bold sm:col-span-2">
            {editingSeries ? 'Modifier toute la série' : editingEvent ? 'Modifier l’événement' : 'Nouvel événement'}
          </h3>
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
              <option value="meeting">Réunion</option>
              <option value="cohesion">Journée de cohésion</option>
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
              disabled={editingSeries}
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
            {editingSeries && (
              <span className="text-xs font-normal text-muted-foreground">
                Le jour et la date de chaque occurrence restent inchangés.
              </span>
            )}
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
                {draft.date ? `Répéter chaque ${formatWeekday(draft.date)}` : 'Répéter chaque semaine'}
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
              {saving
                ? 'Enregistrement…'
                : editingSeries
                  ? 'Enregistrer toute la série'
                  : editingEvent
                    ? 'Enregistrer les modifications'
                    : 'Ajouter au planning'}
            </button>
          </div>
        </form>
      )}

      {view === 'week' && (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            aria-label="Semaine précédente"
            onClick={() => setWeekStart((current) => addDays(current, -7))}
            className="inline-flex size-9 items-center justify-center rounded-lg border border-border hover:bg-muted"
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
          </button>
          <p className="min-w-36 text-center text-sm font-bold capitalize">
            {formatWeekRange(weekStart, addDays(weekStart, 6))}
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

      {loading ? (
        <p role="status" className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Chargement du planning…</p>
      ) : loadError ? null : visibleEvents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center">
          <CalendarDays aria-hidden="true" className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-2 font-semibold">
            {periodEvents.length === 0
              ? 'Aucun événement pour cette période.'
              : 'Aucun événement avec les filtres sélectionnés.'}
          </p>
          {periodEvents.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedTypes([...PLANNING_EVENT_TYPES])}
              className="mt-3 text-sm font-bold text-primary underline underline-offset-4"
            >
              Tout afficher
            </button>
          )}
          {canManage && !formOpen && (
            <button type="button" onClick={openNewEventForm} className="mt-3 text-sm font-bold text-primary underline underline-offset-4">
              Ajouter un événement
            </button>
          )}
        </div>
      ) : (
        <ul className="grid gap-2 sm:gap-3">
          {visibleEvents.map((event) => {
            const dateParts = getDateParts(event.date)
            const weekColor = getWeekColor(event.date)
            const weatherDetails = event.date >= today && event.status !== 'cancelled'
              ? event.weather ?? (event.type === 'training'
                ? { eventTime: event.startTime, homeAway: 'Domicile', opponent: '', venue: event.location }
                : null)
              : null
            const attendance = event.type === 'training'
              ? getTrainingAttendanceGauge(
                  trainingAttendance.find((session) => session.date === event.date),
                  players,
                )
              : null
            const accentClass = weekColor === 'blue'
              ? 'border-l-[#1e3a8a] bg-gradient-to-r from-blue-50/70 to-card dark:from-blue-950/30'
              : 'border-l-[#d4af37] bg-gradient-to-r from-amber-50/70 to-card dark:from-amber-950/30'
            const iconButtonClass = 'inline-flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

            return (
              <li
                key={event.id}
                className={`rounded-2xl border border-l-[3px] p-3 shadow-sm transition hover:shadow-md ${event.status === 'cancelled' ? 'opacity-75' : ''} ${accentClass}`}
              >
                <div className="flex min-w-0 items-start gap-3">
                  <time
                    dateTime={event.date}
                    aria-label={formatDate(event.date)}
                    className="flex w-12 shrink-0 flex-col items-center rounded-xl bg-muted/60 px-1.5 py-2 text-center leading-none"
                  >
                    <span className="text-[10px] font-bold uppercase text-muted-foreground">{dateParts.weekday}</span>
                    <span className="mt-1 text-xl font-black tabular-nums text-foreground">{dateParts.day}</span>
                    <span className="mt-1 text-[10px] font-semibold capitalize text-muted-foreground">{dateParts.month}</span>
                  </time>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                        {TYPE_LABELS[event.type]}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${event.team === 'E1' ? 'bg-[#1e3a8a]/10 text-[#1e3a8a] dark:text-sky-200' : event.team === 'E2' ? 'bg-[#d4af37]/20 text-[#725200] dark:text-amber-200' : 'bg-muted text-muted-foreground'}`}>
                        {event.team === 'both' ? 'E1 + E2' : event.team}
                      </span>
                      {event.status !== 'confirmed' && (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${event.status === 'postponed' ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300' : 'bg-destructive/10 text-destructive'}`}>
                          {STATUS_LABELS[event.status]}
                        </span>
                      )}
                      {event.recurrenceGroupId && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                          <Repeat aria-hidden="true" className="size-3" />
                          Chaque {formatWeekday(event.date)}
                        </span>
                      )}
                    </div>

                    <h3 className={`mt-1 truncate text-base font-black leading-snug ${event.status === 'cancelled' ? 'line-through' : ''}`}>
                      {event.title}
                    </h3>
                    <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {(event.startTime || event.endTime || event.meetingTime) && (
                        <span className="inline-flex items-center gap-1 whitespace-nowrap">
                          <Clock3 aria-hidden="true" className="size-3.5 shrink-0" />
                          {event.startTime && event.endTime
                            ? `${event.startTime}–${event.endTime}`
                            : event.startTime || event.endTime}
                          {event.meetingTime && ` · RDV ${event.meetingTime}`}
                        </span>
                      )}
                      <span className="inline-flex min-w-0 items-center gap-1">
                        <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
                        <span className="truncate">{event.location}</span>
                      </span>
                      {weatherDetails && (
                        <MatchWeather
                          date={event.date}
                          eventTime={weatherDetails.eventTime}
                          homeAway={weatherDetails.homeAway}
                          opponent={weatherDetails.opponent}
                          today={today}
                          venue={weatherDetails.venue}
                          tone="light"
                        />
                      )}
                    </div>
                    {event.notes && (
                      <p title={event.notes} className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                        {event.notes}
                      </p>
                    )}
                    {attendance && (
                      <div
                        role="img"
                        aria-label={`${attendance.present} présents, ${attendance.absent} absents sur ${attendance.total} joueurs`}
                        className="mt-2 max-w-sm"
                      >
                        <div className="flex items-center justify-between gap-3 text-[10px] font-bold">
                          <span className="text-[#1e3a8a] dark:text-sky-200">{attendance.present} présents</span>
                          <span className="text-[#725200] dark:text-amber-200">{attendance.absent} absents</span>
                        </div>
                        <div aria-hidden="true" className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-muted">
                          <span
                            className="bg-[#1e3a8a] transition-[width]"
                            style={{ width: `${attendance.present / attendance.total * 100}%` }}
                          />
                          <span
                            className="bg-[#d4af37] transition-[width]"
                            style={{ width: `${attendance.absent / attendance.total * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2">
                  {canManage &&
                    event.type === 'training' &&
                    event.status !== 'cancelled' &&
                    event.date >= MATCH_SEASON_START &&
                    event.date <= MATCH_SEASON_END ? (
                    <button
                      type="button"
                      onClick={() => onOpenTraining(event.date)}
                      title="Ouvrir la feuille de présence à cette date"
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground transition hover:opacity-90"
                    >
                      <ClipboardCheck aria-hidden="true" className="size-4" />
                      Présence joueurs
                    </button>
                  ) : <span aria-hidden="true" />}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => downloadCalendarFile(event)}
                      aria-label={`Ajouter ${event.title} au calendrier avec un rappel 24 h avant`}
                      title="Ajouter au calendrier · rappel 24 h avant"
                      className={iconButtonClass}
                    >
                      <CalendarPlus aria-hidden="true" className="size-4" />
                    </button>
                    {canManage && event.source !== 'match-sheet' && (
                      <button
                        type="button"
                        onClick={() => editEvent(event)}
                        aria-label={`Modifier ${event.title}`}
                        title="Modifier cet événement"
                        className={iconButtonClass}
                      >
                        <Pencil aria-hidden="true" className="size-4" />
                      </button>
                    )}
                    {canManage && event.recurrenceGroupId && (
                      <>
                        <button
                          type="button"
                          onClick={() => editEvent(event, true)}
                          aria-label={`Modifier toute la série ${event.title}`}
                          title="Modifier toute la série"
                          className={`${iconButtonClass} border-primary/30 text-primary`}
                        >
                          <Repeat aria-hidden="true" className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void cancelSeries(event)}
                          disabled={pendingSeriesId === event.recurrenceGroupId}
                          aria-label={`Annuler la série ${event.title}`}
                          title="Annuler toute la série"
                          className={`${iconButtonClass} border-destructive/30 text-destructive hover:bg-destructive/5 disabled:opacity-50`}
                        >
                          {pendingSeriesId === event.recurrenceGroupId
                            ? <RefreshCw aria-hidden="true" className="size-4 animate-spin" />
                            : <Ban aria-hidden="true" className="size-4" />}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
