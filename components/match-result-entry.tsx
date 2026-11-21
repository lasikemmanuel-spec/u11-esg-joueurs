'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { CalendarDays, CalendarPlus, Check, ChevronDown, Clock3, Map as GoogleMapIcon, MapPin, Navigation, Pencil, Plus, Sparkles, Trash2, UsersRound } from 'lucide-react'
import { CallupScheduleEntry } from '@/components/callup-schedule-entry'
import { MatchLineupEntry, useMatchLineups } from '@/components/match-lineup-planner'
import { MatchFamilyMessage } from '@/components/match-family-message'
import { MatchWeather } from '@/components/match-day-home'
import { ClubCrest } from '@/components/club-crest'
import { LiveMatchHistory } from '@/components/live-match-history'
import type { MatchSheetEntry } from '@/lib/match-results'
import type { Convocation } from '@/lib/convocations'
import { MATCH_RESULT_STATUSES } from '@/lib/match-result-options'
import type { MatchResultDraft } from '@/components/match-result-form'
import type { PublicPlayer } from '@/lib/players'
import type { PlayerStats } from '@/lib/stats'
import type { TrainingAttendanceSession } from '@/lib/training-attendance'
import {
  clampToMatchSeason,
  MATCH_SEASON_END,
  MATCH_SEASON_MONTHS,
  MATCH_SEASON_START,
} from '@/lib/match-season'

type MatchEntryStatus = {
  enabled: boolean
  role: 'educator' | 'admin' | 'reader' | null
  displayName: string | null
}

const MatchResultForm = dynamic(() => import('@/components/match-result-form').then((module) => module.MatchResultForm), {
  loading: () => <p role="status" className="fixed inset-x-4 bottom-4 z-[110] rounded-xl bg-card p-4 text-sm text-muted-foreground shadow-xl">Chargement du formulaire…</p>,
})

function localToday() {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  return now.toISOString().slice(0, 10)
}

function dateInputValue(value: string) {
  const iso = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (iso) return iso[1] + '-' + iso[2].padStart(2, '0') + '-' + iso[3].padStart(2, '0')
  const dayFirst = value.match(/^(\d{1,2})[/. -](\d{1,2})[/. -](\d{4})$/)
  if (dayFirst) return dayFirst[3] + '-' + dayFirst[2].padStart(2, '0') + '-' + dayFirst[1].padStart(2, '0')
  return ''
}

function createDraft(): MatchResultDraft {
  return {
    team: 'E1',
    date: clampToMatchSeason(localToday()),
    opponent: '',
    competition: 'Championnat',
    homeAway: 'Domicile',
    kickoffTime: '',
    meetingTime: '',
    venueAddress: '',
    resultLabel: '',
    goalsFor: '',
    goalsAgainst: '',
  }
}

function getEditableResult(entry: MatchSheetEntry) {
  if (MATCH_RESULT_STATUSES.includes(entry.resultLabel as (typeof MATCH_RESULT_STATUSES)[number])) return entry.resultLabel
  if (entry.goalsFor === null || entry.goalsAgainst === null) return ''
  if (entry.goalsFor > entry.goalsAgainst) return 'Gagné'
  if (entry.goalsFor < entry.goalsAgainst) return 'Perdu'
  return 'Nul'
}

export function MatchResultEntry({
  entries,
  matchesPlayed,
  players,
  playerStats,
  convocations,
  convocationDates,
  trainingAttendance,
  trainingAttendanceError,
  focusMatch,
  focusCallups,
  onConnect,
}: {
  entries: MatchSheetEntry[]
  matchesPlayed: number
  players: PublicPlayer[]
  playerStats: PlayerStats[]
  convocations: Convocation[]
  convocationDates: string[]
  trainingAttendance: TrainingAttendanceSession[]
  trainingAttendanceError: boolean
  focusMatch: {
    date: string
    team: 'E1' | 'E2'
    slotColumn: number
    requestId: number
  } | null
  focusCallups: { date: string; requestId: number } | null
  onConnect: () => void
}) {
  const router = useRouter()
  const [status, setStatus] = useState<MatchEntryStatus | null>(null)
  const [draft, setDraft] = useState<MatchResultDraft>(createDraft)
  const [month, setMonth] = useState(clampToMatchSeason(localToday()).slice(0, 7))
  const [editingSlot, setEditingSlot] = useState<number | null>(null)
  const [openCallupDate, setOpenCallupDate] = useState('')
  const [expandedDayDate, setExpandedDayDate] = useState<string | null>(null)
  const [expandedMatchKeys, setExpandedMatchKeys] = useState<Set<string>>(() => new Set())
  const [open, setOpen] = useState(false)
  const [formMinimized, setFormMinimized] = useState(false)
  const [pending, setPending] = useState(false)
  const [pendingDeletion, setPendingDeletion] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!focusMatch) return
    const date = dateInputValue(focusMatch.date)
    if (!date) return
    setMonth(date.slice(0, 7))
    setExpandedDayDate(date)
    setExpandedMatchKeys((current) => {
      const next = new Set(current)
      next.add(`${focusMatch.team}-${focusMatch.slotColumn}`)
      return next
    })
  }, [focusMatch])

  const refreshStatus = useCallback(() => {
    fetch('/api/match-results', { cache: 'no-store' })
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok) throw new Error(result.error ?? 'Impossible de vérifier les droits.')
        setStatus(result as MatchEntryStatus)
      })
      .catch(() => setStatus({ enabled: false, role: null, displayName: null }))
  }, [])

  useEffect(() => {
    refreshStatus()
    const onSessionChange = () => refreshStatus()
    window.addEventListener('educator-session-changed', onSessionChange)
    return () => window.removeEventListener('educator-session-changed', onSessionChange)
  }, [refreshStatus])

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pending) {
        setOpen(false)
        setEditingSlot(null)
        setFormMinimized(false)
      }
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [open, pending])

  const monthEntries = useMemo(
    () => entries.filter((entry) => dateInputValue(entry.date).slice(0, 7) === month),
    [entries, month],
  )
  const dayEntries = useMemo(() => {
    const grouped = new Map<string, MatchSheetEntry[]>()
    for (const entry of monthEntries) {
      const date = dateInputValue(entry.date)
      if (!date) continue
      grouped.set(date, [...(grouped.get(date) ?? []), entry])
    }
    return [...grouped.entries()]
      .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
      .map(([date, matches]) => ({ date, matches }))
  }, [monthEntries])

  useEffect(() => {
    if (!focusMatch) return
    const date = dateInputValue(focusMatch.date)
    const matchKey = `${focusMatch.team}-${focusMatch.slotColumn}`
    if (
      !date ||
      month !== date.slice(0, 7) ||
      expandedDayDate !== date ||
      !dayEntries.some((day) => day.date === date)
    ) return

    const matchCardId = `match-card-${date}-${focusMatch.team}-${focusMatch.slotColumn}`
    const frame = window.requestAnimationFrame(() => {
      const target = document.getElementById(matchCardId)
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [dayEntries, expandedDayDate, focusMatch, month])
  useEffect(() => {
    if (!focusCallups) return
    const date = dateInputValue(focusCallups.date)
    if (!date) return
    setMonth(date.slice(0, 7))
    setExpandedDayDate(date)
    setOpenCallupDate(date)
  }, [focusCallups])
  useEffect(() => {
    if (!focusCallups) return
    const date = dateInputValue(focusCallups.date)
    if (!date || month !== date.slice(0, 7) || expandedDayDate !== date || openCallupDate !== date || !dayEntries.some((day) => day.date === date)) return
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(`callup-panel-${date}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [dayEntries, expandedDayDate, focusCallups, month, openCallupDate])
  const completedConvocationDates = useMemo(() => new Set(
    convocationDates
      .map(dateInputValue)
      .filter(Boolean)
      .filter((date) => players.length > 0 && players.every((player) =>
        convocations
          .find((convocation) => convocation.number === player.number)
          ?.matches.some((match) => dateInputValue(match.date) === date && match.raw.trim().length > 0),
      )),
  ), [convocationDates, convocations, players])
  const canManage = Boolean(status?.enabled && (status.role === 'educator' || status.role === 'admin'))
  const matchLineups = useMatchLineups(canManage)

  const startNew = () => {
    setEditingSlot(null)
    setDraft(createDraft())
    setError('')
    setNotice('')
    setFormMinimized(false)
    setOpen(true)
  }

  const closeForm = () => {
    setOpen(false)
    setEditingSlot(null)
    setFormMinimized(false)
  }

  const startEdit = (entry: MatchSheetEntry) => {
    setEditingSlot(entry.slotColumn)
    setDraft({
      team: entry.team,
      date: dateInputValue(entry.date),
      opponent: entry.opponent,
      competition: entry.competition || 'Championnat',
      homeAway: entry.homeAway || 'Domicile',
      kickoffTime: entry.kickoffTime,
      meetingTime: entry.meetingTime ?? '',
      venueAddress: entry.venueAddress ?? '',
      resultLabel: getEditableResult(entry),
      goalsFor: entry.goalsFor === null ? '' : String(entry.goalsFor),
      goalsAgainst: entry.goalsAgainst === null ? '' : String(entry.goalsAgainst),
    })
    setError('')
    setNotice('')
    setFormMinimized(false)
    setOpen(true)
  }

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (draft.date < MATCH_SEASON_START || draft.date > MATCH_SEASON_END) {
      setError('La date du match doit être comprise entre le 1er septembre 2026 et le 30 juin 2027.')
      return
    }

    const oneScoreMissing = Boolean(draft.goalsFor) !== Boolean(draft.goalsAgainst)
    if (oneScoreMissing) {
      setError('Saisis les deux scores ou laisse les deux champs vides pour planifier le match.')
      return
    }
    const hasScore = Boolean(draft.goalsFor && draft.goalsAgainst)
    if (hasScore && !draft.resultLabel) {
      setError('Choisis le résultat à inscrire dans le Sheet : Gagné, Nul ou Perdu.')
      return
    }
    if (!hasScore && draft.resultLabel && draft.resultLabel !== 'Annulé') {
      setError('Un résultat Gagné, Nul ou Perdu nécessite les deux scores.')
      return
    }

    setPending(true)
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/match-results', {
        method: editingSlot === null ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...draft,
          slotColumn: editingSlot ?? undefined,
          goalsFor: draft.goalsFor ? Number(draft.goalsFor) : null,
          goalsAgainst: draft.goalsAgainst ? Number(draft.goalsAgainst) : null,
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Impossible d’enregistrer le match.')
      setNotice(editingSlot === null
        ? 'Match ajouté à « ' + result.sheetTitle + ' ».'
        : 'Match mis à jour dans « ' + result.sheetTitle + ' ».')
      setMonth(draft.date.slice(0, 7))
      setOpen(false)
      setEditingSlot(null)
      setFormMinimized(false)
      router.refresh()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Impossible d’enregistrer le match.')
    } finally {
      setPending(false)
    }
  }

  const removeMatch = async (date: string, entry?: MatchSheetEntry) => {
    const targetKey = entry ? `${entry.team}-${entry.slotColumn}` : `day-${date}`
    const dateLabel = new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR')
    const confirmation = entry
      ? `Supprimer le match contre ${entry.opponent || 'cet adversaire'} du ${dateLabel} ? Son résultat et sa composition seront effacés. Les convocations de cette date seront conservées.`
      : `Supprimer les ${dayEntries.find((day) => day.date === date)?.matches.length ?? 0} matchs du ${dateLabel} ? Les résultats et compositions seront effacés. Les convocations de cette date seront conservées.`
    if (!window.confirm(confirmation)) return

    setPendingDeletion(targetKey)
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/match-results', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry
          ? { scope: 'match', date, team: entry.team, slotColumn: entry.slotColumn }
          : { scope: 'day', date }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Impossible de supprimer le match.')
      setNotice(entry ? 'Match supprimé du calendrier.' : 'Journée supprimée du calendrier.')
      if (!entry && openCallupDate === date) setOpenCallupDate('')
      router.refresh()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Impossible de supprimer le match.')
    } finally {
      setPendingDeletion(null)
    }
  }

  if (!status) return null

  return (
    <section aria-labelledby="match-entry-title" className="overflow-hidden rounded-2xl border border-[#d4af37]/30 bg-card shadow-md">
      {/* Bandeau ESG */}
      <header className="relative overflow-hidden bg-gradient-to-r from-[#172554] via-[#1e3a8a] to-[#172554] px-4 py-3 sm:px-5 sm:py-4">
        <Sparkles aria-hidden="true" className="absolute -right-3 -top-5 size-24 rotate-12 text-[#d4af37]/15" />
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <ClubCrest className="size-9 shrink-0 ring-2 ring-[#d4af37] sm:size-11" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#d4af37]">ES Genech · U11</p>
              <h2 id="match-entry-title" className="text-sm font-black text-white sm:text-base">Calendrier &amp; résultats</h2>
            </div>
          </div>
          <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto sm:shrink-0">
            <label className="relative flex min-h-10 min-w-0 flex-1 items-center rounded-xl border-2 border-[#d4af37] bg-white/10 shadow-sm transition hover:bg-white/15 focus-within:ring-2 focus-within:ring-[#d4af37]/60 sm:min-h-11 sm:flex-none">
              <CalendarDays aria-hidden="true" className="pointer-events-none absolute left-3 size-4 text-[#d4af37]" />
              <select
                aria-label="Mois"
                value={month}
                onChange={(event) => {
                  setMonth(event.target.value)
                  setExpandedDayDate(null)
                }}
                className="h-9 min-w-0 w-full appearance-none bg-transparent py-1 pl-9 pr-8 text-xs font-black text-white outline-none sm:h-10 sm:min-w-40 sm:w-auto sm:pr-9 sm:text-sm"
              >
                {MATCH_SEASON_MONTHS.map(({ value, label }) => (
                  <option key={value} value={value} className="bg-[#172554] text-white">{label}</option>
                ))}
              </select>
              <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 size-4 text-[#d4af37]" />
            </label>
            {canManage && (
              <>
                <LiveMatchHistory players={players} compact />
                <button
                  type="button"
                  disabled={pending || pendingDeletion !== null}
                  onClick={startNew}
                  className="group inline-flex min-h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-amber-200/70 bg-gradient-to-r from-[#f4d45e] via-[#d4af37] to-[#f4d45e] px-2.5 text-[11px] font-black text-blue-950 shadow-md transition duration-200 hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#172554] active:translate-y-0 sm:min-h-11 sm:gap-2 sm:px-5 sm:text-sm"
                >
                  <CalendarPlus aria-hidden="true" className="size-4 transition-transform duration-200 group-hover:rotate-[-8deg] sm:size-[18px]" />
                  <span className="sm:hidden">Planifier</span>
                  <span className="hidden sm:inline">Planifier un match</span>
                  <Sparkles aria-hidden="true" className="hidden size-3.5 text-blue-950/70 transition-transform duration-200 group-hover:scale-125 sm:inline sm:size-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </header>
      <div className="p-3 sm:p-4">

      {!status.enabled ? (
        <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
          La saisie est désactivée dans cet aperçu. Elle sera disponible sur le site officiel après connexion.
        </p>
      ) : status.role === null ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2">
          <p className="text-sm text-muted-foreground">Connecte-toi dans l’espace éducateurs ci-dessous pour ajouter ou modifier les matchs.</p>
          <button
            type="button"
            onClick={onConnect}
            className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-lg bg-primary px-3 text-sm font-bold text-primary-foreground"
          >
            Connexion
          </button>
        </div>
      ) : null}

      {notice && <p role="status" className="mt-3 text-sm font-semibold text-emerald-700 dark:text-emerald-300">{notice}</p>}
      {error && <p role="alert" className="mt-3 text-sm font-semibold text-destructive">{error}</p>}

      {open && canManage && (
        <MatchResultForm
          draft={draft}
          editingSlot={editingSlot}
          formMinimized={formMinimized}
          pending={pending}
          pendingDeletion={pendingDeletion !== null}
          error={error}
          onSubmit={save}
          onDraftChange={setDraft}
          onClose={closeForm}
          onMinimize={() => setFormMinimized(true)}
          onRestore={() => setFormMinimized(false)}
        />
      )}

      {canManage && matchLineups.error && (
        <p role="alert" className="mt-3 text-sm font-medium text-destructive">{matchLineups.error}</p>
      )}
      <div className="mt-4 flex flex-col gap-2">
        {dayEntries.length === 0 ? (
          <p className="rounded-lg bg-muted px-3 py-4 text-center text-sm text-muted-foreground">
            Aucun match enregistré pour ce mois.
          </p>
        ) : dayEntries.map(({ date, matches }) => {
          const isSaturday = new Date(`${date}T12:00:00`).getDay() === 6
          const canScheduleCallup = canManage && isSaturday && matches.some((entry) => entry.resultLabel !== 'Annulé')
          const hasConvocations = completedConvocationDates.has(date)
          const hasStartedConvocation = convocationDates.some((savedDate) => dateInputValue(savedDate) === date)
          const isExpanded = expandedDayDate === date
          const dayContentId = `match-day-${date}`
          return (
            <article key={date} className="overflow-visible rounded-2xl border border-[#172554]/15 bg-background shadow-sm">
              <header className={`flex flex-col gap-2 border-b border-[#d4af37]/50 bg-gradient-to-r from-[#172554] via-[#1e3a8a] to-[#172554] px-4 py-3 ${isExpanded ? 'rounded-t-2xl' : 'rounded-2xl'}`}>
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  aria-controls={dayContentId}
                  onClick={() => setExpandedDayDate((current) => {
                    return current === date ? null : date
                  })}
                  className="flex w-full min-w-0 items-center gap-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#d4af37]"
                >
                  <ChevronDown aria-hidden="true" className={`size-4 shrink-0 text-[#d4af37] transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                  <ClubCrest className="size-8 shrink-0 rounded-full ring-2 ring-[#d4af37]/80 shadow-sm" />
                  <span className="min-w-0">
                    <span className="block text-sm font-black capitalize text-white sm:text-base">
                      {new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </span>
                  </span>
                </button>
                <div className="flex w-full min-w-0 flex-nowrap items-center gap-1.5 sm:gap-2">
                  <span className="inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-full border border-white/15 bg-white/10 py-1 pl-1 pr-2.5 text-[11px] font-semibold text-white/85">
                    <span className="inline-flex size-6 items-center justify-center rounded-full bg-[#d4af37] text-[10px] font-black text-blue-950">
                      {matches.length}
                    </span>
                    rencontre{matches.length === 1 ? '' : 's'}
                  </span>
                  {canScheduleCallup && (
                    <button
                      type="button"
                      aria-expanded={openCallupDate === date}
                      onClick={() => setOpenCallupDate((current) => current === date ? '' : date)}
                      className="inline-flex min-h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full border border-[#ffe27a]/80 bg-[#d4af37] px-2 text-[11px] font-extrabold text-blue-950 shadow-sm transition hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#172554] sm:min-h-10 sm:flex-none sm:gap-2 sm:rounded-xl sm:px-3.5 sm:text-xs"
                    >
                      {hasConvocations ? <Check aria-hidden="true" className="size-4" /> : <UsersRound aria-hidden="true" className="size-4" />}
                      <span className="truncate">Convocations</span>
                    </button>
                  )}
                  {canManage &&
                    !hasStartedConvocation &&
                    openCallupDate !== date &&
                    date >= localToday() &&
                    matches.every((entry) =>
                      !entry.resultLabel && entry.goalsFor === null && entry.goalsAgainst === null,
                    ) && (
                      <button
                        type="button"
                        disabled={pending || pendingDeletion !== null}
                        onClick={() => removeMatch(date)}
                        aria-label="Supprimer la journée"
                        title="Supprimer la journée"
                        className="ml-auto inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/70 transition hover:border-red-200/40 hover:bg-red-500/15 hover:text-white disabled:opacity-50 sm:size-10 sm:rounded-xl"
                      >
                        <Trash2 aria-hidden="true" className="size-3.5" />
                        <span className="sr-only">{pendingDeletion === `day-${date}` ? 'Suppression…' : 'Supprimer la journée'}</span>
                      </button>
                    )}
                </div>
              </header>
              {isExpanded && <div id={dayContentId} className="grid gap-3 p-3 sm:grid-cols-2">
                {matches.map((entry) => {
                  const isE1 = entry.team === 'E1'
                  const isPlayed = entry.goalsFor !== null && entry.goalsAgainst !== null && entry.resultLabel !== 'Annulé'
                  const isCancelled = entry.resultLabel === 'Annulé'
                  const dateIsUpcoming = date >= localToday()
                  const showWeather = !isPlayed && !isCancelled && dateIsUpcoming
                  const canEditMatch = canManage && !isCancelled && dateIsUpcoming
                  const canDeleteMatch = canManage &&
                    dateIsUpcoming &&
                    !hasStartedConvocation &&
                    !entry.resultLabel &&
                    entry.goalsFor === null &&
                    entry.goalsAgainst === null
                  const result = isPlayed ? getEditableResult(entry) : null
                  const scoreLabel = isCancelled
                    ? 'Annulé'
                    : !isPlayed
                      ? 'À jouer'
                      : entry.goalsFor + ' – ' + entry.goalsAgainst
                  const resultLabel = isPlayed && result ? result : null
                  const matchKey = entry.team + '-' + entry.slotColumn
                  const savedLineup = matchLineups.lineups.find((lineup) =>
                    lineup.team === entry.team &&
                    lineup.slotColumn === entry.slotColumn &&
                    lineup.date === date,
                  )
                  const matchPanelId = `match-details-${date}-${entry.team}-${entry.slotColumn}`
                  const isMatchExpanded = expandedMatchKeys.has(matchKey)
                  const scoreBg = result === 'Gagné'
                    ? 'bg-emerald-500 text-white'
                    : result === 'Perdu'
                      ? 'bg-red-500 text-white'
                      : result === 'Nul'
                        ? 'bg-amber-400 text-blue-950'
                        : isCancelled
                          ? 'bg-muted text-muted-foreground'
                          : isE1
                            ? 'bg-[#172554] text-white'
                            : 'bg-amber-400 text-blue-950'
                  const homeAwayIcon = entry.homeAway === 'Domicile' ? '🏠' : entry.homeAway === 'Extérieur' ? '✈️' : '⚖️'
                  const calledPlayerNames = convocations.flatMap((player) => {
                    const callup = player.matches.find((item) =>
                      dateInputValue(item.date) === date &&
                      (item.team === entry.team || item.team === 'E1+E2') &&
                      (item.status === 'called' || item.status === 'calledAbsent' || item.status === 'present'),
                    )
                    return callup ? [player.name] : []
                  })
                  return (
                    <div
                      key={entry.team + '-' + entry.slotColumn}
                      id={`match-card-${date}-${entry.team}-${entry.slotColumn}`}
                      className={[
                        'relative flex min-w-0 flex-col overflow-hidden rounded-2xl border shadow-md transition-shadow hover:shadow-lg',
                        isE1
                          ? 'border-[#172554]/25 bg-gradient-to-b from-white to-[#eef2ff]'
                          : 'border-amber-400/45 bg-gradient-to-b from-white to-amber-50',
                      ].join(' ')}
                    >
                      <div
                        className={[
                          'flex min-w-0 flex-col gap-2 border-b-2 px-3 py-3 sm:px-4',
                          isE1
                            ? 'border-[#d4af37] bg-gradient-to-br from-[#172554] via-[#1e3a8a] to-[#172554] text-white'
                            : 'border-[#172554]/15 bg-gradient-to-br from-amber-300 via-amber-400 to-[#e0bd43] text-blue-950',
                        ].join(' ')}
                      >
                        <button
                          type="button"
                          aria-expanded={isMatchExpanded}
                          aria-controls={matchPanelId}
                          onClick={() => setExpandedMatchKeys((current) => {
                            const next = new Set(current)
                            if (next.has(matchKey)) next.delete(matchKey)
                            else next.add(matchKey)
                            return next
                          })}
                          className="group flex min-w-0 flex-1 flex-col items-stretch gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#d4af37]"
                        >
                          <span className="flex min-w-0 items-center gap-2.5">
                            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/15">
                              <ChevronDown
                                aria-hidden="true"
                                className={`size-4 transition-transform ${isMatchExpanded ? '' : '-rotate-90'}`}
                              />
                            </span>
                            <ClubCrest className={['size-9 shrink-0 rounded-full ring-2', isE1 ? 'ring-[#d4af37]' : 'ring-white/80'].join(' ')} />
                            <span className="min-w-0 flex-1">
                              <span className="block text-[10px] font-black uppercase tracking-[0.16em] opacity-80 sm:text-xs md:text-sm">
                                ES Genech {isE1 ? '1' : '2'}
                              </span>
                              <span className="mt-0.5 block whitespace-normal break-words text-lg font-black leading-tight sm:text-xl md:text-2xl">
                                {entry.opponent || 'Adversaire à préciser'}
                              </span>
                            </span>
                            {(isPlayed || isCancelled) && (
                              <span className={['shrink-0 rounded-xl px-2.5 py-1.5 font-mono text-sm font-black shadow-sm', scoreBg].join(' ')}>
                                {scoreLabel}
                              </span>
                            )}
                          </span>
                          <span className="flex min-w-0 flex-nowrap items-center gap-0.5 pl-7 text-[10px] font-bold sm:gap-1 sm:pl-10 sm:text-xs md:gap-1.5 md:text-[13px]">
                            <span className={`inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 sm:px-2 sm:py-1 md:px-2 ${isE1 ? 'bg-white/15 text-sky-100' : 'bg-white/45 text-blue-950'}`}>
                              {entry.competition || 'Type non renseigné'}
                            </span>
                            <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 sm:px-2 sm:py-1 md:px-2 ${isE1 ? 'bg-white/10 text-white/90' : 'bg-white/35 text-blue-950'}`}>
                              <span aria-hidden="true">{homeAwayIcon}</span>
                              {entry.homeAway || 'Lieu ?'}
                            </span>
                            {entry.kickoffTime && (
                              <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 sm:px-2 sm:py-1 md:px-2 ${isE1 ? 'bg-white/10 text-white/90' : 'bg-white/35 text-blue-950'}`}>
                                <Clock3 aria-hidden="true" className="size-3" />
                                {entry.kickoffTime}
                              </span>
                            )}
                          </span>
                        </button>
                        {(showWeather || canEditMatch || canDeleteMatch) && (
                          <div className={`flex min-w-0 items-center gap-2 pl-7 sm:pl-10 ${showWeather ? 'justify-between' : 'justify-end'}`}>
                            {showWeather && (
                              <span className="min-w-0 flex-1">
                                <MatchWeather
                                  date={date}
                                  homeAway={entry.homeAway}
                                  opponent={entry.opponent}
                                  today={localToday()}
                                  tone={isE1 ? 'dark' : 'light'}
                                />
                              </span>
                            )}
                            {(canEditMatch || canDeleteMatch) && (
                              <div className="flex shrink-0 items-center gap-1.5">
                                {canEditMatch && (
                                  <button
                                    type="button"
                                    disabled={pending || pendingDeletion !== null}
                                    onClick={() => startEdit(entry)}
                                    aria-label={'Modifier le match contre ' + (entry.opponent || 'cet adversaire')}
                                    title="Modifier le match"
                                    className={[
                                      'inline-flex min-h-8 items-center justify-center gap-1 rounded-lg border px-2 text-[10px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37] disabled:opacity-50',
                                      isE1
                                        ? 'border-white/20 bg-white/10 text-white hover:bg-white/20'
                                        : 'border-blue-950/15 bg-blue-950/10 text-blue-950 hover:bg-blue-950/20',
                                    ].join(' ')}
                                  >
                                    <Pencil aria-hidden="true" className="size-3.5" />
                                    <span>Modifier</span>
                                  </button>
                                )}
                                {canDeleteMatch && (
                                  <button
                                    type="button"
                                    disabled={pending || pendingDeletion !== null}
                                    onClick={() => removeMatch(date, entry)}
                                    aria-label={'Supprimer le match contre ' + (entry.opponent || 'cet adversaire')}
                                    className={[
                                      'inline-flex size-7 items-center justify-center rounded-md opacity-85 transition hover:bg-red-500/30 hover:text-red-100 disabled:opacity-50',
                                      isE1 ? 'bg-white/15' : 'bg-blue-950/15',
                                    ].join(' ')}
                                  >
                                    <Trash2 aria-hidden="true" className="size-3.5" />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      {isMatchExpanded && (
                        <div id={matchPanelId}>
                          <div className="space-y-3 border-b border-[#172554]/10 bg-gradient-to-b from-white/80 to-[#eef2ff]/70 px-3 py-3 sm:px-4">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#172554]/65">
                              Infos pratiques
                            </p>
                            <div className="flex flex-wrap items-center gap-2">
                              {entry.meetingTime && (
                                <span className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-[#d4af37]/60 bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-950">
                                  <Clock3 aria-hidden="true" className="size-3.5" />
                                  <span>RDV stade</span>
                                  <span className="font-black tabular-nums">{entry.meetingTime}</span>
                                </span>
                              )}
                              {entry.venueAddress?.trim() && (() => {
                                const address = entry.venueAddress.trim()
                                const query = encodeURIComponent(address).replace(/%20/g, '+')
                                return (
                                  <div className="flex min-w-0 basis-full flex-col gap-2 rounded-xl border border-[#172554]/10 bg-white/70 px-2.5 py-1.5 sm:flex-1 sm:flex-row sm:items-center">
                                    <div className="flex min-w-0 items-center gap-2 sm:flex-1">
                                      <MapPin aria-hidden="true" className="size-4 shrink-0 text-[#172554]" />
                                      <span className="min-w-0 flex-1 break-words text-xs font-semibold text-[#172554]">{address}</span>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-1">
                                      <a
                                        href={`https://maps.google.com/?q=${query}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        aria-label="Ouvrir l’adresse dans Google Maps"
                                        title="Google Maps"
                                        className="grid size-8 place-items-center rounded-lg bg-[#4285F4] text-white shadow-sm transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#172554]"
                                      >
                                        <GoogleMapIcon aria-hidden="true" className="size-4" />
                                      </a>
                                      <a
                                        href={`https://waze.com/ul?q=${query}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        aria-label="Ouvrir l’adresse dans Waze"
                                        title="Waze"
                                        className="grid size-8 place-items-center rounded-lg bg-[#33CCFF] text-[#10213f] shadow-sm transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#172554]"
                                      >
                                        <Navigation aria-hidden="true" className="size-4" />
                                      </a>
                                      <a
                                        href={`https://maps.apple.com/?q=${query}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        aria-label="Ouvrir l’adresse dans Plans"
                                        title="Plans"
                                        className="grid size-8 place-items-center rounded-lg bg-[#172554] text-white shadow-sm transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37]"
                                      >
                                        <MapPin aria-hidden="true" className="size-4" />
                                      </a>
                                    </div>
                                  </div>
                                )
                              })()}
                              {canManage && (
                                <MatchFamilyMessage match={entry} date={date} calledPlayerNames={calledPlayerNames} />
                              )}
                            </div>
                          </div>
                          {canManage && (
                            <div className="px-3 pb-3">
                              {matchLineups.loading ? (
                                <p className="py-2 text-xs text-muted-foreground">Chargement de la feuille…</p>
                              ) : (
                                <MatchLineupEntry
                                  match={entry}
                                  matchEntries={entries}
                                  players={players}
                                  playerStats={playerStats}
                                  matchesPlayed={matchesPlayed}
                                  trainingAttendance={trainingAttendance}
                                  convocations={convocations}
                                  lineups={matchLineups.lineups}
                                  pendingKeys={matchLineups.pendingKeys}
                                  savedKey={matchLineups.savedKey}
                                  saveLineup={matchLineups.saveLineup}
                                />
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>}
              {openCallupDate === date && canScheduleCallup && (
                <div id={`callup-panel-${date}`} className="scroll-mt-4 p-2 pt-0 sm:p-3 sm:pt-0">
                  <CallupScheduleEntry
                    key={date}
                    players={players}
                    playerStats={playerStats}
                    convocations={convocations}
                    convocationDates={convocationDates}
                    scheduledMatchDates={entries.map((entry) => entry.date)}
                    initialDate={date}
                    trainingAttendance={trainingAttendance}
                    trainingAttendanceError={trainingAttendanceError}
                    matchEntries={entries}
                    matchesPlayed={matchesPlayed}
                    onClose={() => setOpenCallupDate('')}
                  />
                </div>
              )}
            </article>
          )
        })}
      </div>

      </div>
    </section>
  )
}
