'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import {
  Ban,
  CalendarDays,
  CalendarPlus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ClipboardCheck,
  Clock3,
  MapPin,
  Pencil,
  Repeat,
  RefreshCw,
  Save,
  Trash2,
  UsersRound,
  X,
} from 'lucide-react'
import { ClubCrest } from '@/components/club-crest'
import { MatchWeather } from '@/components/match-weather'
import { MATCH_SEASON_END, MATCH_SEASON_START } from '@/lib/match-season'
import type { MatchSheetEntry } from '@/lib/match-results'
import { isCountedTrainingStatus } from '@/lib/training-attendance-metrics'
import type { PublicPlayer } from '@/lib/players'
import type { TrainingAttendanceSession } from '@/lib/training-attendance-shared'
import {
  getPlanningMonthCalendarDays,
  getPlanningMonthStarts,
  getPlanningPeriodRange,
  shiftPlanningPeriod,
  type PlanningPeriodView,
} from '@/lib/team-planning-calendar'
import { getScheduledMatchPlanningEvents, type PlanningCardEvent } from '@/lib/team-planning-match-events'
import {
  createCalendarFile,
  getPlanningTeamLabel,
  MAX_WEEKLY_RECURRENCE_EVENTS,
  PLANNING_EVENT_TYPES,
  planningEventOverlapsDateRange,
  type PlanningEvent,
  type PlanningEventFields,
} from '@/lib/team-planning-shared'

const MatchResultPlannerDialog = dynamic(
  () => import('@/components/match-result-planner-dialog').then((module) => module.MatchResultPlannerDialog),
  { loading: () => <p role="status" className="fixed inset-x-4 bottom-4 z-[110] rounded-xl bg-card p-4 text-sm text-muted-foreground shadow-xl">Chargement du formulaire…</p> },
)

const TYPE_LABELS: Record<PlanningEvent['type'], string> = {
  training: 'Entraînement',
  match: 'Match',
  tournament: 'Tournoi',
  meeting: 'Réunion',
  cohesion: 'Journée de cohésion',
}

const EVENT_COLORS: Record<PlanningEvent['type'], { card: string; badge: string }> = {
  training: {
    card: 'border-l-sky-600 bg-gradient-to-r from-sky-100/90 to-card dark:from-sky-950/45',
    badge: 'bg-sky-500/15 text-sky-800 dark:text-sky-200',
  },
  match: {
    card: 'border-l-amber-500 bg-gradient-to-r from-amber-100/90 to-card dark:from-amber-950/45',
    badge: 'bg-amber-500/20 text-amber-900 dark:text-amber-200',
  },
  tournament: {
    card: 'border-l-emerald-600 bg-gradient-to-r from-emerald-100/90 to-card dark:from-emerald-950/45',
    badge: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200',
  },
  meeting: {
    card: 'border-l-violet-600 bg-gradient-to-r from-violet-100/90 to-card dark:from-violet-950/45',
    badge: 'bg-violet-500/15 text-violet-800 dark:text-violet-200',
  },
  cohesion: {
    card: 'border-l-rose-600 bg-gradient-to-r from-rose-100/90 to-card dark:from-rose-950/45',
    badge: 'bg-rose-500/15 text-rose-800 dark:text-rose-200',
  },
}

const EVENT_MARKER_COLORS: Record<PlanningEvent['type'], string> = {
  training: 'bg-sky-600',
  match: 'bg-amber-700',
  tournament: 'bg-emerald-600',
  meeting: 'bg-violet-600',
  cohesion: 'bg-rose-600',
}

const EVENT_SHORT_LABELS: Record<PlanningEvent['type'], string> = {
  training: 'En',
  match: 'Ma',
  tournament: 'To',
  meeting: 'Ré',
  cohesion: 'Co',
}

const PLANNING_VIEWS: { id: PlanningPeriodView; label: string }[] = [
  { id: 'week', label: 'Semaine' },
  { id: 'month', label: 'Mois' },
  { id: 'year', label: 'Année' },
]

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const WEEKDAY_INITIALS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

type PlanningEventFilter = {
  id: string
  label: string
  accessibleLabel?: string
  emoji: string
  types: readonly PlanningEvent['type'][]
}

const EVENT_FILTERS: PlanningEventFilter[] = [
  { id: 'training', label: 'Entraînement', emoji: '🏃', types: ['training'] },
  { id: 'match', label: 'Match', emoji: '⚽', types: ['match'] },
  { id: 'tournament', label: 'Tournoi', emoji: '🏆', types: ['tournament'] },
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
  endDate: '',
  type: 'training',
  tournamentFormat: '',
  team: 'both',
  title: '',
  meetingTime: '',
  startTime: '',
  endTime: '',
  location: '',
  notes: '',
  status: 'confirmed',
}

const EVENT_FORM_INPUT_CLASS = 'h-10 min-w-0 w-full rounded-lg border border-[#d4af37]/60 bg-background px-3 text-sm font-normal text-foreground outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37]'
const PLAN_BUTTON_CLASS = 'group min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-amber-200/70 bg-gradient-to-r from-[#f4d45e] via-[#d4af37] to-[#f4d45e] px-3 text-xs font-black text-blue-950 shadow-md transition duration-200 hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#172554] active:translate-y-0 sm:gap-2 sm:px-4 sm:text-sm md:min-h-11 md:text-base'

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00`)
  date.setDate(date.getDate() + days)
  return toDateKey(date)
}

function getEventEndDate(
  date: string,
  type: PlanningEvent['type'],
  startTime: string,
  endTime: string,
) {
  return date && type !== 'tournament' && startTime && endTime && endTime <= startTime
    ? addDays(date, 1)
    : date
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

function formatPlanningPeriod(view: PlanningPeriodView, startDate: string, endDate: string) {
  if (view === 'week') return formatWeekRange(startDate, endDate)
  if (view === 'month') {
    return new Date(`${startDate}T12:00:00`).toLocaleDateString('fr-FR', {
      month: 'long',
      year: 'numeric',
    })
  }
  return `${startDate.slice(0, 4)}–${endDate.slice(0, 4)}`
}

function formatEventDateRange(startDate: string, endDate: string) {
  const format = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    ...(date.slice(0, 4) !== startDate.slice(0, 4) ? { year: 'numeric' } : {}),
  })
  return `Du ${format(startDate)} au ${format(endDate)}`
}

function getDateParts(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00`)
  return {
    weekday: date.toLocaleDateString('fr-FR', { weekday: 'short' }).replace(/\.$/, ''),
    day: date.toLocaleDateString('fr-FR', { day: 'numeric' }),
    month: date.toLocaleDateString('fr-FR', { month: 'short' }).replace(/\.$/, ''),
  }
}

function getTrainingAttendanceCount(
  session: TrainingAttendanceSession | undefined,
  players: PublicPlayer[],
) {
  if (!session || session.cancellation || players.length === 0) return null

  let present = 0
  let countedPlayers = 0
  for (const player of players) {
    const status = session.playerStatuses[player.number]?.trim() ?? ''
    if (!isCountedTrainingStatus(status)) continue
    countedPlayers += 1
    if (status === 'P') present += 1
  }
  if (countedPlayers === 0) return null
  return { present, total: players.length }
}

function sortEvents(events: PlanningCardEvent[]) {
  return [...events].sort((a, b) => `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`))
}

function isSecretSantaEvent(event: PlanningCardEvent) {
  return /secret\s+santa/i.test(`${event.title} ${event.notes}`)
}

function getEventsOnDate(events: PlanningCardEvent[], dateKey: string) {
  return events.filter((event) => {
    const isOvernightEvent = event.type !== 'tournament' &&
      event.endDate === addDays(event.date, 1)
    return isOvernightEvent
      ? event.date === dateKey
      : event.date <= dateKey && event.endDate >= dateKey
  })
}

function formatMonthName(dateKey: string) {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
  })
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
  const router = useRouter()
  const [events, setEvents] = useState<PlanningEvent[]>([])
  const [view, setView] = useState<PlanningPeriodView>('year')
  const [selectedTypes, setSelectedTypes] = useState<PlanningEvent['type'][]>(() => [...PLANNING_EVENT_TYPES])
  const [periodAnchorDate, setPeriodAnchorDate] = useState(() => toDateKey(new Date()))
  const [selectedYearDate, setSelectedYearDate] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [notice, setNotice] = useState('')
  const [actionError, setActionError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [formMinimized, setFormMinimized] = useState(false)
  const [matchPlannerOpen, setMatchPlannerOpen] = useState(false)
  const [matchPlannerSeed, setMatchPlannerSeed] = useState<{
    date: string
    team: 'E1' | 'E2'
  }>(() => ({ date: toDateKey(new Date()), team: 'E1' }))
  const [editingEvent, setEditingEvent] = useState<PlanningEvent | null>(null)
  const [editingSeries, setEditingSeries] = useState(false)
  const [draft, setDraft] = useState<PlanningEventFields>(EMPTY_DRAFT)
  const [repeatWeekly, setRepeatWeekly] = useState(false)
  const [repeatUntil, setRepeatUntil] = useState('')
  const [pendingSeriesId, setPendingSeriesId] = useState('')
  const [pendingDeleteId, setPendingDeleteId] = useState('')

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
    const range = getPlanningPeriodRange(view, periodAnchorDate)
    return allEvents.filter((event) =>
      planningEventOverlapsDateRange(event.date, event.endDate, range.startDate, range.endDate),
    )
  }, [allEvents, today, view, periodAnchorDate])
  const visibleEvents = useMemo(
    () => sortEvents(periodEvents.filter((event) => selectedTypes.includes(event.type))),
    [periodEvents, selectedTypes],
  )
  const selectedYearDateEvents = selectedYearDate
    ? getEventsOnDate(visibleEvents, selectedYearDate)
    : []
  const periodRange = getPlanningPeriodRange(view, periodAnchorDate)
  const monthCalendarDays = view === 'month'
    ? getPlanningMonthCalendarDays(periodRange.startDate)
    : []
  const yearMonthStarts = view === 'year'
    ? getPlanningMonthStarts(periodRange.startDate, periodRange.endDate)
    : []
  const currentMonthStart = `${today.slice(0, 7)}-01`
  const currentMonthIndex = yearMonthStarts.indexOf(currentMonthStart)
  const orderedYearMonthStarts = currentMonthIndex > 0
    ? [...yearMonthStarts.slice(currentMonthIndex), ...yearMonthStarts.slice(0, currentMonthIndex)]
    : yearMonthStarts

  const toggleEventTypes = (types: readonly PlanningEvent['type'][]) => {
    setSelectedTypes((current) => {
      const shouldSelect = !types.every((type) => current.includes(type))
      return shouldSelect
        ? [...new Set([...current, ...types])]
        : current.filter((type) => !types.includes(type))
    })
  }

  const resetForm = useCallback(() => {
    const date = toDateKey(new Date())
    setDraft({ ...EMPTY_DRAFT, date, endDate: date })
    setEditingEvent(null)
    setEditingSeries(false)
    setRepeatWeekly(false)
    setRepeatUntil(addDays(date, 28))
    setFormOpen(false)
    setFormMinimized(false)
    setSaveError('')
    setActionError('')
  }, [])

  useEffect(() => {
    if (!formOpen) return
    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) resetForm()
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [formOpen, resetForm, saving])

  useEffect(() => {
    if (view !== 'year' || !selectedYearDate) return
    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedYearDate(null)
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [selectedYearDate, view])

  const openNewEventForm = () => {
    setMatchPlannerOpen(false)
    const date = toDateKey(new Date())
    setDraft({ ...EMPTY_DRAFT, date, endDate: date })
    setEditingEvent(null)
    setEditingSeries(false)
    setRepeatWeekly(false)
    setRepeatUntil(addDays(date, 28))
    setSaveError('')
    setActionError('')
    setNotice('')
    setFormMinimized(false)
    setFormOpen(true)
  }

  const openMatchPlanner = (date = toDateKey(new Date()), team: 'E1' | 'E2' = 'E1') => {
    setFormOpen(false)
    setFormMinimized(false)
    setMatchPlannerSeed({ date, team })
    setMatchPlannerOpen(true)
    setNotice('')
    setActionError('')
  }

  const closeMatchPlanner = useCallback(() => setMatchPlannerOpen(false), [])

  const handleMatchPlannerSaved = useCallback((sheetTitle: string, date: string) => {
    setMatchPlannerOpen(false)
    setPeriodAnchorDate(date)
    setNotice(`Match ajouté à « ${sheetTitle} ».`)
    router.refresh()
  }, [router])

  const editEvent = (event: PlanningEvent, series = false) => {
    setSelectedYearDate(null)
    const fields: PlanningEventFields = {
      date: event.date,
      endDate: event.endDate,
      type: event.type,
      tournamentFormat: event.tournamentFormat,
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
    setFormMinimized(false)
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
      setFormMinimized(false)
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

  const deleteFutureEvents = async (event: PlanningCardEvent) => {
    const confirmation = event.recurrenceGroupId
      ? `Supprimer uniquement la séance « ${event.title} » du ${formatDate(event.date)} ? Les autres dates de la série seront conservées.`
      : `Supprimer « ${event.title} » du ${formatDate(event.date)} ?`
    if (!window.confirm(confirmation)) return

    setPendingDeleteId(event.id)
    setActionError('')
    setNotice('')
    try {
      const response = await fetch('/api/team-planning', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'event', id: event.id }),
      })
      const result = await response.json() as { deletedEvent?: PlanningEvent; error?: string }
      if (!response.ok || !result.deletedEvent) {
        throw new Error(result.error ?? 'Impossible de supprimer les événements futurs.')
      }
      setEvents((current) => current.filter((item) => item.id !== result.deletedEvent?.id))
      setNotice('Événement supprimé du planning.')
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Impossible de supprimer les événements futurs.')
    } finally {
      setPendingDeleteId('')
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
    <section className="mx-auto flex w-full flex-col gap-3 sm:gap-5 md:max-w-2xl 2xl:max-w-3xl">
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex min-w-0 items-center gap-2 text-xl font-black text-foreground md:text-2xl">
            <CalendarDays aria-hidden="true" className="size-6 text-primary md:size-7" />
            Planning
          </h2>
          {canManage && (
            <button
              type="button"
              onClick={openNewEventForm}
              aria-label="Planifier un événement au planning"
              title="Planifier un événement"
              className={`${PLAN_BUTTON_CLASS} inline-flex sm:hidden`}
            >
              <CalendarPlus aria-hidden="true" className="size-4 transition-transform duration-200 group-hover:rotate-[-8deg]" />
              <span>Planifier</span>
              <span aria-hidden="true" className="transition-transform duration-200 group-hover:animate-bounce">⚽</span>
            </button>
          )}
        </div>
      </header>

      <div className="flex min-w-0 flex-nowrap items-center gap-1.5 overflow-x-auto overscroll-x-contain py-0.5">
        <div className="flex shrink-0 items-center gap-1" role="group" aria-label="Filtrer les événements">
          {EVENT_FILTERS.map((filter) => {
            const selected = filter.types.every((type) => selectedTypes.includes(type))
            return (
              <button
                key={filter.id}
                type="button"
                aria-label={`Afficher ou masquer ${filter.accessibleLabel ?? filter.label}`}
                aria-pressed={selected}
                onClick={() => toggleEventTypes(filter.types)}
                className={`inline-flex min-h-9 shrink-0 items-center justify-center gap-0.5 whitespace-nowrap rounded-xl border px-1 text-[10px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-10 md:gap-1 md:px-2 md:text-xs ${
                  selected
                    ? 'border-blue-300 bg-gradient-to-r from-blue-50 to-sky-100 text-[#1e3a8a] shadow-sm ring-1 ring-[#d4af37]/40 dark:border-blue-700 dark:from-blue-950/70 dark:to-slate-900 dark:text-sky-100'
                    : 'border-border/70 bg-background/50 text-muted-foreground hover:border-blue-300 hover:bg-blue-50/70 dark:hover:bg-blue-950/30'
                }`}
              >
                <span aria-hidden="true" className="text-xs leading-none md:text-sm">{filter.emoji}</span>
                {filter.label}
              </button>
            )
          })}
          {selectedTypes.length !== PLANNING_EVENT_TYPES.length && (
            <button
              type="button"
              onClick={() => setSelectedTypes([...PLANNING_EVENT_TYPES])}
              className="min-h-9 shrink-0 px-1.5 text-[11px] font-bold text-primary underline-offset-2 hover:underline md:text-xs"
            >
              Tout
            </button>
          )}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1.5 pl-1">
          {canManage && (
            <button
              type="button"
              onClick={openNewEventForm}
              aria-label="Planifier un événement au planning"
              title="Planifier un événement"
              className={`${PLAN_BUTTON_CLASS} hidden sm:inline-flex`}
            >
              <CalendarPlus aria-hidden="true" className="size-4 transition-transform duration-200 group-hover:rotate-[-8deg] sm:size-[18px]" />
              <span>Planifier</span>
              <span aria-hidden="true" className="transition-transform duration-200 group-hover:animate-bounce">⚽</span>
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
        </div>
      </div>

      <div
        className="flex min-w-0 gap-1 overflow-x-auto overscroll-x-contain rounded-2xl border border-border/70 bg-muted/30 p-1.5 shadow-sm"
        role="group"
        aria-label="Affichage du planning"
      >
        {PLANNING_VIEWS.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={view === option.id}
            onClick={() => {
              setView(option.id)
              setSelectedYearDate(null)
            }}
            className={`min-h-10 shrink-0 flex-1 whitespace-nowrap rounded-xl px-2.5 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-4 sm:text-sm md:min-h-11 md:text-base ${
              view === option.id
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-background hover:text-foreground'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div
        className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-border/60 bg-card/70 px-3 py-2 text-[11px] font-semibold text-muted-foreground sm:gap-x-4 sm:text-xs"
        aria-label="Légende des couleurs des événements"
      >
        <span className="font-bold text-foreground">Légende</span>
        {PLANNING_EVENT_TYPES.map((type) => (
          <span key={type} className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span aria-hidden="true" className={`size-2.5 rounded-sm ${EVENT_MARKER_COLORS[type]}`} />
            {TYPE_LABELS[type]}
          </span>
        ))}
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
        <div
          className={[
            'fixed inset-0 z-[100] flex justify-center bg-[#08132f]/65 backdrop-blur-sm transition-all duration-300',
            formMinimized ? 'pointer-events-none items-end' : 'items-end p-0 sm:items-center sm:p-4',
          ].join(' ')}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving && !formMinimized) resetForm()
          }}
        >
          {formMinimized && (
            <button
              type="button"
              onClick={() => setFormMinimized(false)}
              className="pointer-events-auto mb-24 mr-4 ml-auto inline-flex items-center gap-2 rounded-2xl border-2 border-[#d4af37] bg-gradient-to-r from-[#172554] via-[#1e3a8a] to-[#172554] px-4 py-3 text-sm font-black text-[#d4af37] shadow-2xl ring-2 ring-[#d4af37]/30 transition hover:-translate-y-1 hover:shadow-[#d4af37]/30 sm:hidden"
              aria-label="Rouvrir le formulaire"
            >
              <ChevronUp aria-hidden="true" className="size-5 text-[#d4af37]" />
              <span>{editingEvent ? 'Modifier l’événement' : 'Nouvel événement'}</span>
            </button>
          )}

          <form
            onSubmit={handleSubmit}
            role="dialog"
            aria-modal="true"
            aria-labelledby="planning-event-form-title"
            className={[
              'flex max-h-[94dvh] w-full max-w-2xl flex-col overflow-hidden border border-[#d4af37]/60 bg-card shadow-2xl transition-all duration-300 sm:rounded-3xl',
              formMinimized ? 'hidden rounded-t-3xl sm:flex' : 'rounded-t-3xl',
            ].join(' ')}
          >
            <header className="flex shrink-0 items-center justify-between gap-3 bg-gradient-to-r from-[#172554] via-[#1e3a8a] to-[#172554] px-4 py-3 text-white">
              <div className="flex min-w-0 items-center gap-2.5">
                <ClubCrest className="size-9 shrink-0 ring-2 ring-[#d4af37]" />
                <div className="min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-widest text-[#d4af37]">ES Genech · U11</p>
                  <h3 id="planning-event-form-title" className="truncate text-sm font-black sm:text-base">
                    {editingSeries ? 'Modifier toute la série' : editingEvent ? 'Modifier l’événement' : 'Nouvel événement'}
                  </h3>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setFormMinimized(true)}
                  aria-label="Réduire le formulaire"
                  title="Réduire"
                  className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 transition hover:bg-white/20 disabled:opacity-50 sm:hidden"
                >
                  <ChevronDown aria-hidden="true" className="size-5" />
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={resetForm}
                  aria-label="Fermer la fenêtre"
                  className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 transition hover:bg-white/20 disabled:opacity-50"
                >
                  <X aria-hidden="true" className="size-5" />
                </button>
              </div>
            </header>

            <div className="grid min-h-0 grid-cols-1 gap-3 overflow-y-auto p-4 text-[#172554] dark:text-amber-200 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-semibold">
            Type
            <select
              value={draft.type}
              onChange={(event) => {
                const type = event.target.value as PlanningEventFields['type']
                if (type === 'match' && !editingEvent) {
                  openMatchPlanner(draft.date, draft.team === 'E2' ? 'E2' : 'E1')
                  return
                }
                updateDraft('type', type)
                updateDraft('tournamentFormat', type === 'tournament' ? draft.tournamentFormat : '')
                updateDraft('endDate', type === 'tournament'
                  ? draft.endDate || draft.date
                  : getEventEndDate(draft.date, type, draft.startTime, draft.endTime))
              }}
              className={EVENT_FORM_INPUT_CLASS}
            >
              <option value="training">Entraînement</option>
              <option value="match">Match</option>
              <option value="tournament">Tournoi</option>
              <option value="meeting">Réunion</option>
              <option value="cohesion">Journée de cohésion</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Titre
            <input
              required
              maxLength={100}
              value={draft.title}
              onChange={(event) => updateDraft('title', event.target.value)}
              placeholder="Ex. Match contre l’ES..."
              className={EVENT_FORM_INPUT_CLASS}
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Équipe
            <select
              value={draft.team}
              onChange={(event) => updateDraft('team', event.target.value as PlanningEventFields['team'])}
              className={EVENT_FORM_INPUT_CLASS}
            >
              <option value="E1">E1</option>
              <option value="E2">E2</option>
              <option value="both">Groupe U11 (E1+E2)</option>
              <option value="educators">Éducateurs</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            {draft.type === 'tournament' ? 'Date de début' : 'Date'}
            <input
              required
              type="date"
              value={draft.date}
              disabled={editingSeries}
              onChange={(event) => {
                const date = event.target.value
                const endDate = date && draft.type === 'tournament' && draft.endDate >= date
                  ? draft.endDate
                  : getEventEndDate(date, draft.type, draft.startTime, draft.endTime)
                updateDraft('date', date)
                updateDraft('endDate', endDate)
                if (date) {
                  const minDate = addDays(date, 7)
                  const maxDate = addDays(date, MAX_WEEKLY_RECURRENCE_EVENTS * 7 - 1)
                  setRepeatUntil((current) =>
                    current < minDate || current > maxDate ? addDays(date, 28) : current,
                  )
                }
              }}
              className={EVENT_FORM_INPUT_CLASS}
            />
            {editingSeries && (
              <span className="text-xs font-normal text-muted-foreground">
                Le jour et la date de chaque occurrence restent inchangés.
              </span>
            )}
          </label>
          {draft.type === 'tournament' && (
            <label className="grid gap-1 text-sm font-semibold">
              Format du tournoi
              <select
                required
                value={draft.tournamentFormat}
                onChange={(event) => updateDraft('tournamentFormat', event.target.value as PlanningEventFields['tournamentFormat'])}
                className={EVENT_FORM_INPUT_CLASS}
              >
                <option value="">Choisir un format</option>
                <option value="futsal">Futsal</option>
                <option value="football8">Foot à 8 extérieur</option>
              </select>
            </label>
          )}
          {draft.type === 'tournament' && (
            <label className="grid gap-1 text-sm font-semibold">
              Date de fin
              <input
                required
                type="date"
                min={draft.date || undefined}
                value={draft.endDate}
                onChange={(event) => updateDraft('endDate', event.target.value)}
                className={EVENT_FORM_INPUT_CLASS}
              />
            </label>
          )}
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
                    className={EVENT_FORM_INPUT_CLASS}
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
              className={EVENT_FORM_INPUT_CLASS}
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Début
            <input
              required
              type="time"
              value={draft.startTime}
              onChange={(event) => {
                const startTime = event.target.value
                updateDraft('startTime', startTime)
                if (draft.type !== 'tournament') {
                  updateDraft('endDate', getEventEndDate(draft.date, draft.type, startTime, draft.endTime))
                }
              }}
              className={EVENT_FORM_INPUT_CLASS}
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Fin
            <input
              required
              type="time"
              value={draft.endTime}
              onChange={(event) => {
                const endTime = event.target.value
                updateDraft('endTime', endTime)
                if (draft.type !== 'tournament') {
                  updateDraft('endDate', getEventEndDate(draft.date, draft.type, draft.startTime, endTime))
                }
              }}
              className={EVENT_FORM_INPUT_CLASS}
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
              className={EVENT_FORM_INPUT_CLASS}
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Statut
            <select
              value={draft.status}
              onChange={(event) => updateDraft('status', event.target.value as PlanningEventFields['status'])}
              className={EVENT_FORM_INPUT_CLASS}
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
              className="min-h-20 w-full rounded-lg border border-[#d4af37]/60 bg-background px-3 py-2 text-sm font-normal text-foreground outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37]"
            />
          </label>
              {saveError && <p role="alert" className="text-xs font-semibold text-destructive sm:col-span-2">{saveError}</p>}
            </div>
            <footer className="flex shrink-0 gap-2 border-t border-[#172554]/10 dark:border-amber-400/20 bg-background/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={resetForm}
                disabled={saving}
                className="min-h-11 flex-1 rounded-xl border border-[#172554]/15 dark:border-amber-400/30 px-4 text-sm font-bold text-[#172554] dark:text-amber-200 disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex min-h-11 flex-[1.5] items-center justify-center gap-2 rounded-xl bg-[#172554] px-4 text-sm font-black text-white shadow-md transition hover:bg-blue-900 disabled:opacity-50"
              >
                <Save aria-hidden="true" className="size-4 text-[#d4af37]" />
                {saving
                  ? 'Enregistrement…'
                  : editingSeries
                    ? 'Enregistrer toute la série'
                    : editingEvent
                      ? 'Enregistrer'
                      : 'Ajouter au planning'}
              </button>
            </footer>
          </form>
        </div>
      )}

      {canManage && matchPlannerOpen && (
        <MatchResultPlannerDialog
          initialDate={matchPlannerSeed.date}
          initialTeam={matchPlannerSeed.team}
          onClose={closeMatchPlanner}
          onSaved={handleMatchPlannerSaved}
        />
      )}

      {periodRange && (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            aria-label="Période précédente"
            onClick={() => {
              setPeriodAnchorDate((current) => shiftPlanningPeriod(view, current, -1))
              setSelectedYearDate(null)
            }}
            className="inline-flex size-9 items-center justify-center rounded-lg border border-border hover:bg-muted md:size-10"
          >
            <ChevronLeft aria-hidden="true" className="size-4 md:size-5" />
          </button>
          <p className="min-w-36 text-center text-sm font-bold capitalize md:text-base">
            {formatPlanningPeriod(view, periodRange.startDate, periodRange.endDate)}
          </p>
          <button
            type="button"
            aria-label="Période suivante"
            onClick={() => {
              setPeriodAnchorDate((current) => shiftPlanningPeriod(view, current, 1))
              setSelectedYearDate(null)
            }}
            className="inline-flex size-9 items-center justify-center rounded-lg border border-border hover:bg-muted md:size-10"
          >
            <ChevronRight aria-hidden="true" className="size-4 md:size-5" />
          </button>
        </div>
      )}

      {!loading && !loadError && view === 'month' && periodRange && (
        <section
          aria-label={`Calendrier du mois de ${formatMonthName(periodRange.startDate)}`}
          className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
        >
          <div className="grid grid-cols-7 border-b border-border bg-muted/40">
            {WEEKDAY_LABELS.map((weekday) => (
              <span key={weekday} className="py-2 text-center text-[10px] font-bold uppercase text-muted-foreground sm:text-xs">
                {weekday}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {monthCalendarDays.map((dateKey) => {
              const isInMonth = dateKey.slice(0, 7) === periodRange.startDate.slice(0, 7)
              const dateEvents = isInMonth ? getEventsOnDate(visibleEvents, dateKey) : []
              const day = new Date(`${dateKey}T12:00:00`).getDate()
              return (
                <div
                  key={dateKey}
                  className={`min-h-[4.25rem] border-b border-r border-border/70 p-1 sm:min-h-24 sm:p-1.5 ${isInMonth ? '' : 'bg-muted/20 text-muted-foreground/50'}`}
                >
                  <div className="flex justify-center sm:justify-start">
                    <time
                      dateTime={dateKey}
                      className={`flex size-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums sm:size-7 sm:text-sm ${dateKey === today ? 'bg-primary font-black text-primary-foreground' : ''}`}
                    >
                      {day}
                    </time>
                  </div>
                  <div className="mt-1 hidden space-y-0.5 sm:block">
                    {dateEvents.slice(0, 2).map((event) => (
                      <div
                        key={event.id}
                        title={event.title}
                        className={`truncate rounded px-1 py-0.5 text-[10px] font-semibold ${EVENT_COLORS[event.type].badge}`}
                      >
                        {event.title}
                      </div>
                    ))}
                    {dateEvents.length > 2 && (
                      <span className="block px-1 text-[9px] font-semibold text-muted-foreground">
                        +{dateEvents.length - 2} autres
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-col gap-0.5 sm:hidden">
                    {dateEvents.slice(0, 2).map((event) => (
                      <span
                        key={event.id}
                        title={`${TYPE_LABELS[event.type]} : ${event.title}`}
                        className={`block truncate rounded px-0.5 py-0.5 text-center text-[8px] font-bold leading-tight ${EVENT_COLORS[event.type].badge}`}
                      >
                        {EVENT_SHORT_LABELS[event.type]}
                      </span>
                    ))}
                    {dateEvents.length > 2 && (
                      <span className="text-center text-[8px] font-bold leading-tight text-muted-foreground">
                        +{dateEvents.length - 2}
                      </span>
                    )}
                  </div>
                  {dateEvents.length > 0 && (
                    <span className="sr-only">
                      {dateEvents.length} événement{dateEvents.length === 1 ? '' : 's'} : {dateEvents.map((event) => event.title).join(', ')}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {!loading && !loadError && view === 'year' && periodRange && (
        <>
          {selectedYearDate && (
            <div
              className="fixed inset-0 z-[120] flex items-center justify-center bg-[#08132f]/65 p-4 backdrop-blur-sm"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) setSelectedYearDate(null)
              }}
            >
              <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="annual-date-events-title"
                className={`flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-2xl border border-[#d4af37]/60 bg-card shadow-2xl sm:rounded-3xl ${selectedYearDateEvents.length <= 1 ? 'max-w-lg' : 'max-w-xl'}`}
              >
                <header className="flex shrink-0 items-center justify-between gap-3 bg-gradient-to-r from-[#172554] via-[#1e3a8a] to-[#172554] px-4 py-3 text-white">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <ClubCrest className="size-9 shrink-0 ring-2 ring-[#d4af37]" />
                    <div className="min-w-0">
                      <p className="text-[9px] font-black uppercase tracking-widest text-[#d4af37]">ES Genech · U11</p>
                      <h3 id="annual-date-events-title" className="truncate text-sm font-black capitalize sm:text-base">
                        Événements du {formatDate(selectedYearDate, {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </h3>
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="Fermer les événements"
                    onClick={() => setSelectedYearDate(null)}
                    className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 transition hover:bg-white/20"
                  >
                    <X aria-hidden="true" className="size-5" />
                  </button>
                </header>
                <div className="min-h-0 overflow-y-auto p-4">
                  <p className="mb-3 text-xs text-muted-foreground">
                    {selectedYearDateEvents.length} événement{selectedYearDateEvents.length === 1 ? '' : 's'}
                  </p>
                  {selectedYearDateEvents.length === 0 ? (
                    <p className="rounded-lg bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                      Aucun événement à cette date avec les filtres sélectionnés.
                    </p>
                  ) : (
                    <ul className={`grid gap-2 ${selectedYearDateEvents.length > 1 ? 'sm:grid-cols-2' : 'grid-cols-1'}`}>
                      {selectedYearDateEvents.map((event) => (
                        <li
                          key={event.id}
                          className={`relative overflow-hidden rounded-xl border border-border/70 border-l-[3px] p-3 shadow-sm ${EVENT_COLORS[event.type].card} ${isSecretSantaEvent(event) ? 'planning-christmas-card' : ''}`}
                        >
                          {isSecretSantaEvent(event) && (
                            <>
                              <span aria-hidden="true" className="planning-christmas-flake planning-christmas-flake-one">❄</span>
                              <span aria-hidden="true" className="planning-christmas-flake planning-christmas-flake-two">❄</span>
                              <span aria-hidden="true" className="planning-christmas-flake planning-christmas-flake-three">❄</span>
                            </>
                          )}
                          <div className="relative z-10 flex items-start justify-between gap-2">
                          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${EVENT_COLORS[event.type].badge}`}>
                              {TYPE_LABELS[event.type]}
                            </span>
                            {event.type === 'tournament' && event.tournamentFormat && (
                              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                                {event.tournamentFormat === 'futsal' ? 'Futsal' : 'Foot à 8 extérieur'}
                              </span>
                            )}
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                              {getPlanningTeamLabel(event.team)}
                            </span>
                          </div>
                          {canManage && event.source !== 'match-sheet' && (
                            <div className="flex shrink-0 items-center gap-1">
                              <button
                                type="button"
                                onClick={() => editEvent(event)}
                                aria-label={`Modifier ${event.title}`}
                                title="Modifier"
                                className="inline-flex size-9 items-center justify-center rounded-lg border border-border bg-background/70 text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                <Pencil aria-hidden="true" className="size-3.5" />
                              </button>
                              {event.date >= today && (
                                <button
                                  type="button"
                                  onClick={() => void deleteFutureEvents(event)}
                                  disabled={pendingDeleteId === event.id}
                                  aria-label={`Supprimer ${event.title}`}
                                  title={event.recurrenceGroupId
                                    ? 'Supprimer uniquement cette occurrence'
                                    : 'Supprimer cet événement futur'}
                                  className="inline-flex size-9 items-center justify-center rounded-lg border border-destructive/30 bg-background/70 text-destructive transition hover:bg-destructive/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                                >
                                  {pendingDeleteId === event.id
                                    ? <RefreshCw aria-hidden="true" className="size-3.5 animate-spin" />
                                    : <Trash2 aria-hidden="true" className="size-3.5" />}
                                </button>
                              )}
                            </div>
                          )}
                          </div>
                          {event.notes && (
                            <p className="relative z-10 mt-2 w-fit max-w-full break-words rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">
                              {event.notes}
                            </p>
                          )}
                          <h4 className="relative z-10 mt-1 font-black text-foreground">
                            {isSecretSantaEvent(event) && <span aria-hidden="true" className="planning-christmas-santa mr-1.5 inline-block">🎅</span>}
                            {event.title}
                          </h4>
                          <div className="relative z-10 mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            {(event.startTime || event.endTime || event.meetingTime) && (
                              <span>
                                {event.startTime && event.endTime
                                  ? `${event.startTime}–${event.endTime}`
                                  : event.startTime || event.endTime}
                                {event.meetingTime && ` · RDV ${event.meetingTime}`}
                              </span>
                            )}
                            <span className="inline-flex items-center gap-1">
                              <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
                              {event.location}
                            </span>
                            {event.endDate > event.date && (
                              <span>{formatEventDateRange(event.date, event.endDate)}</span>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            </div>
          )}

          <section aria-label={`Calendrier de la saison ${periodRange.startDate.slice(0, 4)}–${periodRange.endDate.slice(0, 4)}`}>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
              {orderedYearMonthStarts.map((monthStart) => {
                const monthRange = getPlanningPeriodRange('month', monthStart)
                const monthEvents = visibleEvents.filter((event) =>
                  planningEventOverlapsDateRange(
                    event.date,
                    event.endDate,
                    monthRange.startDate,
                    monthRange.endDate,
                  ),
                )
                const monthDays = getPlanningMonthCalendarDays(monthStart)
                const monthName = formatMonthName(monthStart).split(' ')[0]
                return (
                  <article
                    key={monthStart}
                    className={`rounded-2xl border bg-card p-2 shadow-sm sm:p-3 ${monthStart === currentMonthStart ? 'border-primary ring-2 ring-primary/20' : 'border-border'}`}
                  >
                    <header className="flex items-baseline justify-between gap-1">
                      <button
                        type="button"
                        aria-label={`Afficher le calendrier de ${formatMonthName(monthStart)}`}
                        onClick={() => {
                          setPeriodAnchorDate(monthStart)
                          setSelectedYearDate(null)
                          setView('month')
                        }}
                        className="truncate text-sm font-black capitalize text-foreground hover:text-primary focus-visible:outline-none focus-visible:underline sm:text-base"
                      >
                        {monthName}
                      </button>
                      <span className="shrink-0 text-[9px] font-semibold text-muted-foreground sm:text-[10px]">
                        {monthEvents.length} évén.
                      </span>
                    </header>
                    <div className="mt-2 grid grid-cols-7 gap-x-0.5 text-center">
                      {WEEKDAY_INITIALS.map((weekday, index) => (
                        <span key={`${monthStart}-weekday-${index}`} aria-hidden="true" className="text-[8px] font-bold text-muted-foreground sm:text-[9px]">
                          {weekday}
                        </span>
                      ))}
                      {monthDays.map((dateKey) => {
                        const isInMonth = dateKey.slice(0, 7) === monthStart.slice(0, 7)
                        const dateEvents = isInMonth ? getEventsOnDate(monthEvents, dateKey) : []
                        const day = new Date(`${dateKey}T12:00:00`).getDate()
                        if (!isInMonth) {
                          return (
                            <span key={dateKey} aria-hidden="true" className="flex aspect-square items-center justify-center text-[9px] text-muted-foreground/30 sm:text-[10px]">
                              {day}
                            </span>
                          )
                        }
                        const dateLabel = formatDate(dateKey, { weekday: 'long', day: 'numeric', month: 'long' })
                        const eventLabel = dateEvents.length > 0
                          ? `, ${dateEvents.length} événement${dateEvents.length === 1 ? '' : 's'} : ${dateEvents.map((event) => event.title).join(', ')}`
                          : ', aucun événement'
                        const isSelected = selectedYearDate === dateKey
                        return (
                          <button
                            key={dateKey}
                            type="button"
                            aria-label={`${dateLabel}${eventLabel}`}
                            aria-pressed={isSelected}
                            title={dateEvents.map((event) => event.title).join(', ') || dateLabel}
                            onClick={() => setSelectedYearDate(dateKey)}
                            className={`flex aspect-square items-center justify-center rounded-md text-[9px] tabular-nums transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-[10px] ${dateEvents.length > 0 ? `font-bold text-white ${EVENT_MARKER_COLORS[dateEvents[0].type]}` : dateKey === today ? 'bg-primary/10 font-black text-primary' : 'text-foreground'} ${isSelected ? 'ring-2 ring-primary ring-offset-1' : 'hover:bg-muted'}`}
                          >
                            {day}
                          </button>
                        )
                      })}
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        </>
      )}

      {loading ? (
        <p role="status" className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Chargement du planning…</p>
      ) : loadError || view === 'year' ? null : visibleEvents.length === 0 ? (
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
            <button type="button" onClick={openNewEventForm} className="group mt-3 inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-amber-200/70 bg-gradient-to-r from-[#f4d45e] via-[#d4af37] to-[#f4d45e] px-4 text-sm font-black text-blue-950 shadow-md transition duration-200 hover:-translate-y-0.5 hover:shadow-lg">
              Planifier un événement <span aria-hidden="true" className="transition-transform duration-200 group-hover:animate-bounce">⚽</span>
            </button>
          )}
        </div>
      ) : (
        <ul className="grid gap-2 sm:gap-3">
          {visibleEvents.map((event) => {
            const dateParts = getDateParts(event.date)
            const eventColors = EVENT_COLORS[event.type]
            const weatherDetails = event.date >= today && event.status !== 'cancelled'
              ? event.weather ?? (event.type === 'training'
                ? { eventTime: event.startTime, homeAway: 'Domicile', opponent: '', venue: event.location }
                : null)
              : null
            const attendance = event.type === 'training'
              ? getTrainingAttendanceCount(
                  trainingAttendance.find((session) => session.date === event.date),
                  players,
                )
              : null
            const showTrainingAction = canManage &&
              event.type === 'training' &&
              event.status !== 'cancelled' &&
              event.date >= MATCH_SEASON_START &&
              event.date <= MATCH_SEASON_END
            const iconButtonClass = 'inline-flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

            return (
              <li
                key={event.id}
                className={`rounded-2xl border border-l-[3px] p-3 shadow-sm transition hover:shadow-md md:p-4 ${event.status === 'cancelled' ? 'opacity-75' : ''} ${eventColors.card}`}
              >
                <div className="flex min-w-0 items-start gap-3 md:gap-4">
                  <time
                    dateTime={event.date}
                    aria-label={formatDate(event.date)}
                    className="flex w-12 shrink-0 flex-col items-center rounded-xl bg-muted/60 px-1.5 py-2 text-center leading-none md:w-14 md:py-2.5"
                  >
                    <span className="text-[10px] font-bold uppercase text-muted-foreground md:text-xs">{dateParts.weekday}</span>
                    <span className="mt-1 text-xl font-black tabular-nums text-foreground md:text-2xl">{dateParts.day}</span>
                    <span className="mt-1 text-[10px] font-semibold capitalize text-muted-foreground md:text-xs">{dateParts.month}</span>
                  </time>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold md:text-xs ${eventColors.badge}`}>
                        {TYPE_LABELS[event.type]}
                      </span>
                      {event.type === 'tournament' && event.tournamentFormat && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary md:text-xs">
                          {event.tournamentFormat === 'futsal' ? 'Futsal' : 'Foot à 8 extérieur'}
                        </span>
                      )}
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold md:text-xs ${event.team === 'E1' ? 'bg-[#1e3a8a]/10 text-[#1e3a8a] dark:text-sky-200' : event.team === 'E2' ? 'bg-[#d4af37]/20 text-[#725200] dark:text-amber-200' : 'bg-muted text-muted-foreground'}`}>
                        {getPlanningTeamLabel(event.team)}
                      </span>
                      {attendance && !showTrainingAction && (
                        <span
                          title={`${attendance.present} joueurs présents sur ${attendance.total}`}
                          className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-200 md:text-xs"
                        >
                          <UsersRound aria-hidden="true" className="size-3 md:size-3.5" />
                          {attendance.present} présents
                        </span>
                      )}
                      {event.source === 'match-sheet' && event.notes && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground md:text-xs">
                          {event.notes}
                        </span>
                      )}
                      {event.status !== 'confirmed' && (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold md:text-xs ${event.status === 'postponed' ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300' : 'bg-destructive/10 text-destructive'}`}>
                          {STATUS_LABELS[event.status]}
                        </span>
                      )}
                      {event.recurrenceGroupId && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary md:text-xs">
                          <Repeat aria-hidden="true" className="size-3 md:size-3.5" />
                          Chaque {formatWeekday(event.date)}
                        </span>
                      )}
                    </div>

                    <h3 className={`mt-1 truncate text-base font-black leading-snug md:text-lg ${event.status === 'cancelled' ? 'line-through' : ''}`}>
                      {event.title}
                    </h3>
                    <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground md:text-sm">
                      {(event.startTime || event.endTime || event.meetingTime) && (
                        <span className="inline-flex items-center gap-1 whitespace-nowrap">
                          <Clock3 aria-hidden="true" className="size-3.5 shrink-0 md:size-4" />
                          {event.startTime && event.endTime
                            ? `${event.startTime}–${event.endTime}`
                            : event.startTime || event.endTime}
                          {event.meetingTime && ` · RDV ${event.meetingTime}`}
                        </span>
                      )}
                      {event.endDate > event.date && (
                        <span className="inline-flex items-center gap-1 whitespace-nowrap">
                          <CalendarDays aria-hidden="true" className="size-3.5 shrink-0 md:size-4" />
                          {formatEventDateRange(event.date, event.endDate)}
                        </span>
                      )}
                      <span className="inline-flex min-w-0 items-center gap-1">
                        <MapPin aria-hidden="true" className="size-3.5 shrink-0 md:size-4" />
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
                      <button
                        type="button"
                        onClick={() => downloadCalendarFile(event)}
                        aria-label={`Ajouter ${event.title} au calendrier avec un rappel 24 h avant`}
                        title="Ajouter au calendrier · rappel 24 h avant"
                        className={iconButtonClass}
                      >
                        <CalendarPlus aria-hidden="true" className="size-4" />
                      </button>
                    </div>
                    {event.notes && event.source !== 'match-sheet' && (
                      <p title={event.notes} className="mt-1 line-clamp-1 text-xs text-muted-foreground md:text-sm">
                        {event.notes}
                      </p>
                    )}
                  </div>
                </div>

                {canManage && event.source !== 'match-sheet' && (
                  <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2">
                    {showTrainingAction ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onOpenTraining(event.date)}
                          title="Ouvrir la feuille de présence à cette date"
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground transition hover:opacity-90 md:min-h-10 md:px-4 md:text-sm"
                        >
                          <ClipboardCheck aria-hidden="true" className="size-4 md:size-5" />
                          Présence joueurs
                        </button>
                        {attendance && (
                          <span
                            title={`${attendance.present} joueurs présents sur ${attendance.total}`}
                            className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-200 md:text-xs"
                          >
                            <UsersRound aria-hidden="true" className="size-3 md:size-3.5" />
                            {attendance.present} présents
                          </span>
                        )}
                      </div>
                    ) : <span aria-hidden="true" />}
                    <div className="flex items-center gap-1">
                      {event.date >= today && (
                        <button
                          type="button"
                          onClick={() => void deleteFutureEvents(event)}
                          disabled={pendingDeleteId === event.id}
                          aria-label={event.recurrenceGroupId
                            ? `Supprimer ${event.title} à partir du ${formatDate(event.date)}`
                            : `Supprimer ${event.title}`}
                          title={event.recurrenceGroupId
                            ? 'Supprimer uniquement cette occurrence'
                            : 'Supprimer cet événement futur'}
                          className={`${iconButtonClass} border-destructive/30 text-destructive hover:bg-destructive/5 disabled:opacity-50`}
                        >
                          {pendingDeleteId === event.id
                            ? <RefreshCw aria-hidden="true" className="size-4 animate-spin" />
                            : <Trash2 aria-hidden="true" className="size-4" />}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => editEvent(event)}
                        aria-label={`Modifier ${event.title}`}
                        title="Modifier cet événement"
                        className={iconButtonClass}
                      >
                        <Pencil aria-hidden="true" className="size-4" />
                      </button>
                      {event.recurrenceGroupId && (
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
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
