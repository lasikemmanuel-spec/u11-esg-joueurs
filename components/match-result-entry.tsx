'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, CalendarPlus, Check, ChevronDown, ChevronUp, Clock3, Map, Navigation, Pencil, Plus, Save, Sparkles, Trash2, UsersRound, X } from 'lucide-react'
import { CallupScheduleEntry } from '@/components/callup-schedule-entry'
import { MatchLineupEntry, useMatchLineups } from '@/components/match-lineup-planner'
import { LiveMatchConsole } from '@/components/live-match-console'
import { MatchFamilyMessage } from '@/components/match-family-message'
import { ClubCrest } from '@/components/club-crest'
import type { MatchSheetEntry } from '@/lib/match-results'
import type { Convocation } from '@/lib/convocations'
import { MATCH_RESULT_STATUSES } from '@/lib/match-result-options'
import type { PublicPlayer } from '@/lib/players'
import type { PlayerStats } from '@/lib/stats'
import type { TrainingAttendanceSession } from '@/lib/training-attendance'
import type { MatchLineup } from '@/lib/match-lineups'
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

type Draft = {
  team: 'E1' | 'E2'
  date: string
  opponent: string
  competition: string
  homeAway: string
  kickoffTime: string
  meetingTime: string
  venueAddress: string
  resultLabel: string
  goalsFor: string
  goalsAgainst: string
}

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

function createDraft(): Draft {
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

const inputClass = 'h-10 min-w-0 w-full max-w-full rounded-lg border border-accent/50 bg-background px-3 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring'
const dateTimeInputClass = 'h-9 min-w-0 w-full max-w-full appearance-none rounded-lg border border-[#d4af37]/60 bg-white dark:bg-slate-900 px-2 text-sm font-bold text-[#172554] dark:text-amber-200 outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37] [color-scheme:light] dark:[color-scheme:dark]'

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
  const [draft, setDraft] = useState<Draft>(createDraft)
  const [month, setMonth] = useState(clampToMatchSeason(localToday()).slice(0, 7))
  const [editingSlot, setEditingSlot] = useState<number | null>(null)
  const [openCallupDate, setOpenCallupDate] = useState('')
  const [expandedDayDate, setExpandedDayDate] = useState<string | null>(null)
  const [expandedMatchKeys, setExpandedMatchKeys] = useState<Set<string>>(() => new Set())
  const [open, setOpen] = useState(false)
  const [formMinimized, setFormMinimized] = useState(false)
  const [pending, setPending] = useState(false)
  const [pendingDeletion, setPendingDeletion] = useState<string | null>(null)
  const [lineupToStartLive, setLineupToStartLive] = useState<{
    match: MatchSheetEntry
    lineup: MatchLineup
  } | null>(null)
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
        <div
          className={[
            'fixed inset-0 z-[100] flex justify-center bg-[#08132f]/65 backdrop-blur-sm transition-all duration-300',
            formMinimized
              ? 'items-end pointer-events-none'
              : 'items-end sm:items-center p-0 sm:p-4',
          ].join(' ')}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !pending && !formMinimized) {
              setOpen(false)
              setEditingSlot(null)
            }
          }}
        >
          {/* Bouton flottant quand minimisé (mobile uniquement) */}
          {formMinimized && (
            <button
              type="button"
              onClick={() => setFormMinimized(false)}
              className="pointer-events-auto mb-24 mr-4 ml-auto inline-flex items-center gap-2 rounded-2xl border-2 border-[#d4af37] bg-gradient-to-r from-[#172554] via-[#1e3a8a] to-[#172554] px-4 py-3 text-sm font-black text-[#d4af37] shadow-2xl ring-2 ring-[#d4af37]/30 transition hover:-translate-y-1 hover:shadow-[#d4af37]/30 sm:hidden"
              aria-label="Rouvrir le formulaire"
            >
              <ChevronUp aria-hidden="true" className="size-5 text-[#d4af37]" />
              <span>{editingSlot === null ? 'Planifier un match' : 'Modifier ce match'}</span>
              <Sparkles aria-hidden="true" className="size-4 opacity-70" />
            </button>
          )}

          <form
            onSubmit={save}
            role="dialog"
            aria-modal="true"
            aria-labelledby="match-form-title"
            className={[
              'flex max-h-[94dvh] w-full max-w-2xl flex-col overflow-hidden border border-[#d4af37]/60 bg-card shadow-2xl transition-all duration-300 sm:rounded-3xl',
              formMinimized ? 'hidden sm:flex rounded-t-3xl' : 'rounded-t-3xl',
            ].join(' ')}
          >
            <header className="flex shrink-0 items-center justify-between gap-3 bg-gradient-to-r from-[#172554] via-[#1e3a8a] to-[#172554] px-4 py-3 text-white">
              <div className="flex min-w-0 items-center gap-2.5">
                <ClubCrest className="size-9 shrink-0 ring-2 ring-[#d4af37]" />
                <div className="min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-widest text-[#d4af37]">ES Genech · U11</p>
                  <h3 id="match-form-title" className="truncate text-sm font-black sm:text-base">
                    {editingSlot === null ? 'Planifier un match' : 'Modifier ce match'}
                  </h3>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Bouton minimiser (mobile uniquement) */}
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setFormMinimized(true)}
                  aria-label="Réduire le formulaire"
                  title="Réduire"
                  className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 transition hover:bg-white/20 disabled:opacity-50 sm:hidden"
                >
                  <ChevronDown aria-hidden="true" className="size-5" />
                </button>
                {/* Bouton fermer */}
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => { setOpen(false); setEditingSlot(null); setFormMinimized(false) }}
                  aria-label="Fermer la fenêtre"
                  className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 transition hover:bg-white/20 disabled:opacity-50"
                >
                  <X aria-hidden="true" className="size-5" />
                </button>
              </div>
            </header>
            <div className="grid min-h-0 grid-cols-2 gap-3 overflow-y-auto p-4">
              <label className="flex min-w-0 flex-col gap-1 text-xs font-bold text-[#172554] dark:text-amber-200">
                Équipe
                <select disabled={editingSlot !== null} value={draft.team} onChange={(event) => setDraft({ ...draft, team: event.target.value as Draft['team'] })} className={inputClass}>
                  <option value="E1">ES Genech 1</option>
                  <option value="E2">ES Genech 2</option>
                </select>
              </label>
              <label className="flex min-w-0 flex-col gap-1 text-xs font-bold text-[#172554] dark:text-amber-200">
                <span className="flex items-center gap-1"><CalendarDays aria-hidden="true" className="size-3.5 text-[#b58b00] dark:text-amber-400" /> Date</span>
                <input
                  type="date"
                  required
                  min={MATCH_SEASON_START}
                  max={MATCH_SEASON_END}
                  value={draft.date}
                  onChange={(event) => setDraft({ ...draft, date: event.target.value })}
                  className={dateTimeInputClass}
                />
              </label>
              <label className="col-span-2 flex min-w-0 flex-col gap-1 text-xs font-bold text-[#172554] dark:text-amber-200">
                Adversaire
                <input required maxLength={80} value={draft.opponent} onChange={(event) => setDraft({ ...draft, opponent: event.target.value })} className={inputClass} />
              </label>
              <label className="flex min-w-0 flex-col gap-1 text-xs font-bold text-[#172554] dark:text-amber-200">
                Type de match
                <select value={draft.competition} onChange={(event) => setDraft({ ...draft, competition: event.target.value })} className={inputClass}>
                  <option>Championnat</option><option>Amical</option><option>Tournoi</option><option>Futsal</option><option>Plateau</option><option>Autre</option>
                </select>
              </label>
              <label className="flex min-w-0 flex-col gap-1 text-xs font-bold text-[#172554] dark:text-amber-200">
                Lieu
                <select value={draft.homeAway} onChange={(event) => setDraft({ ...draft, homeAway: event.target.value })} className={inputClass}>
                  <option value="Domicile">Domicile</option><option value="Extérieur">Extérieur</option><option value="Terrain neutre">Terrain neutre</option>
                </select>
              </label>
              <label className="flex min-w-0 flex-col gap-1 text-xs font-bold text-[#172554] dark:text-amber-200">
                <span className="flex items-center gap-1"><Clock3 aria-hidden="true" className="size-3.5 text-[#b58b00] dark:text-amber-400" /> Heure</span>
                <input
                  type="time"
                  value={draft.kickoffTime}
                  onChange={(event) => setDraft({ ...draft, kickoffTime: event.target.value })}
                  className={dateTimeInputClass}
                />
              </label>
              <label className="flex min-w-0 flex-col gap-1 text-xs font-bold text-[#172554] dark:text-amber-200">
                <span className="flex items-center gap-1"><Clock3 aria-hidden="true" className="size-3.5 text-[#b58b00] dark:text-amber-400" /> Rendez-vous au stade</span>
                <input type="time" value={draft.meetingTime} onChange={(event) => setDraft({ ...draft, meetingTime: event.target.value })} className={dateTimeInputClass} />
              </label>
              {draft.homeAway === 'Extérieur' && (
                <label className="col-span-2 flex min-w-0 flex-col gap-1 text-xs font-bold text-[#172554] dark:text-amber-200">
                  Adresse du stade extérieur
                  <input maxLength={180} value={draft.venueAddress} onChange={(event) => setDraft({ ...draft, venueAddress: event.target.value })} placeholder="Rue, code postal, ville" className={inputClass} />
                </label>
              )}
              <fieldset className="col-span-2 flex min-w-0 items-end gap-3">
                <legend className="mb-1 text-xs font-bold text-[#172554] dark:text-amber-200">Score</legend>
                <label className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-xl border border-[#172554]/15 dark:border-amber-400/30 bg-[#172554]/5 dark:bg-[#172554]/40 px-3 py-2 text-xs font-semibold text-[#172554] dark:text-amber-200">
                  ESG
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{1,2}"
                    maxLength={2}
                    value={draft.goalsFor}
                    onChange={(event) => setDraft({ ...draft, goalsFor: event.target.value.replace(/\D/g, '').slice(0, 2) })}
                    aria-label="Buts ESG"
                    className="h-10 w-14 rounded-lg border border-[#d4af37]/60 bg-white dark:bg-slate-900 text-center font-mono text-lg font-black text-[#172554] dark:text-amber-200 outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37]"
                  />
                </label>
                <span className="pb-3 font-black text-[#d4af37]">–</span>
                <label className="flex min-w-0 flex-1 items-center justify-between gap-1.5 rounded-xl border border-amber-400/30 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-2 text-[11px] font-semibold text-[#172554] dark:text-amber-200 sm:gap-2 sm:px-3 sm:text-xs">
                  Adversaire
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{1,2}"
                    maxLength={2}
                    value={draft.goalsAgainst}
                    onChange={(event) => setDraft({ ...draft, goalsAgainst: event.target.value.replace(/\D/g, '').slice(0, 2) })}
                    aria-label="Buts adversaire"
                    className="h-10 w-14 rounded-lg border border-[#d4af37]/60 bg-white dark:bg-slate-900 text-center font-mono text-lg font-black text-[#172554] dark:text-amber-200 outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37]"
                  />
                </label>
              </fieldset>
              <label className="col-span-2 flex min-w-0 flex-col gap-1 text-xs font-bold text-[#172554] dark:text-amber-200">
                Résultat
                <select value={draft.resultLabel} onChange={(event) => setDraft({ ...draft, resultLabel: event.target.value })} className={inputClass}>
                  <option value="">À jouer / aucun résultat</option>
                  {MATCH_RESULT_STATUSES.map((label) => <option key={label} value={label}>{label}</option>)}
                </select>
              </label>
              <div className="col-span-2 space-y-2">
                {error && <p role="alert" className="text-xs font-semibold text-destructive">{error}</p>}
                <p className="text-[11px] text-muted-foreground">Pour planifier : laisse le score et le résultat vides.</p>
              </div>
            </div>
            <footer className="flex shrink-0 gap-2 border-t border-[#172554]/10 dark:border-amber-400/20 bg-background/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                disabled={pending}
                onClick={() => { setOpen(false); setEditingSlot(null); setFormMinimized(false) }}
                className="min-h-11 flex-1 rounded-xl border border-[#172554]/15 dark:border-amber-400/30 px-4 text-sm font-bold text-[#172554] dark:text-amber-200 disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={pending || pendingDeletion !== null}
                className="inline-flex min-h-11 flex-[1.5] items-center justify-center gap-2 rounded-xl bg-[#172554] px-4 text-sm font-black text-white shadow-md transition hover:bg-blue-900 disabled:opacity-50"
              >
                <Save aria-hidden="true" className="size-4 text-[#d4af37]" />
                {pending ? 'Enregistrement…' : editingSlot === null ? 'Planifier' : 'Enregistrer'}
              </button>
            </footer>
          </form>
        </div>
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
                <div className="flex w-full min-w-0 flex-wrap items-center gap-1.5 sm:gap-2">
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
                      className={[
                        'inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-full border border-[#ffe27a]/80 bg-[#d4af37] px-3 text-[11px] font-extrabold text-blue-950 shadow-sm transition hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#172554] sm:min-h-10 sm:gap-2 sm:rounded-xl sm:px-3.5 sm:text-xs',
                      ].join(' ')}
                    >
                      {hasConvocations ? <Check aria-hidden="true" className="size-4" /> : <UsersRound aria-hidden="true" className="size-4" />}
                      <span className="sm:hidden">Convocations</span>
                      <span className="hidden sm:inline">{hasConvocations ? 'Voir les convocations' : 'Saisir les convocations'}</span>
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
                        className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 text-[11px] font-semibold text-white/65 transition hover:border-red-200/40 hover:bg-red-500/15 hover:text-white disabled:opacity-50 sm:gap-2 sm:rounded-xl sm:px-3 sm:text-xs"
                      >
                        <Trash2 aria-hidden="true" className="size-3.5" />
                        <span className="hidden sm:inline">{pendingDeletion === `day-${date}` ? 'Suppression…' : 'Supprimer la journée'}</span>
                      </button>
                    )}
                </div>
              </header>
              {isExpanded && <div id={dayContentId} className="grid gap-3 p-3 sm:grid-cols-2">
                {matches.map((entry) => {
                  const isE1 = entry.team === 'E1'
                  const isPlayed = entry.goalsFor !== null && entry.goalsAgainst !== null && entry.resultLabel !== 'Annulé'
                  const isCancelled = entry.resultLabel === 'Annulé'
                  const result = isPlayed ? getEditableResult(entry) : null
                  const scoreLabel = isCancelled
                    ? 'Annulé'
                    : !isPlayed
                      ? 'À jouer'
                      : entry.goalsFor + ' – ' + entry.goalsAgainst
                  const resultLabel = isPlayed && result ? result : null
                  const matchKey = entry.team + '-' + entry.slotColumn
                  const lineupSaveKey = `${date}-${entry.team}-${entry.slotColumn}`
                  const savedLineup = matchLineups.lineups.find((lineup) =>
                    lineup.team === entry.team &&
                    lineup.slotColumn === entry.slotColumn &&
                    lineup.date === date,
                  )
                  const canStartLive = canManage &&
                    Boolean(savedLineup?.starters.length) &&
                    !entry.resultLabel &&
                    entry.goalsFor === null &&
                    entry.goalsAgainst === null
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
                        'relative flex min-w-0 flex-col overflow-hidden rounded-2xl border shadow-sm',
                        isE1
                          ? 'border-[#172554]/25 bg-gradient-to-b from-[#172554]/8 to-[#172554]/3'
                          : 'border-amber-400/35 bg-gradient-to-b from-amber-400/8 to-amber-400/3',
                      ].join(' ')}
                    >
                      <div
                        className={[
                          'flex min-w-0 flex-col gap-2 px-3 py-2',
                          isE1
                            ? 'bg-[#172554] text-white'
                            : 'bg-amber-400 text-blue-950',
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
                          className="flex min-w-0 flex-1 flex-col items-stretch gap-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#d4af37]"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <ChevronDown
                              aria-hidden="true"
                              className={`size-4 shrink-0 transition-transform ${isMatchExpanded ? '' : '-rotate-90'}`}
                            />
                            <ClubCrest className={['size-6 shrink-0 rounded-full ring-2', isE1 ? 'ring-white/40' : 'ring-blue-950/30'].join(' ')} />
                            <span className="min-w-0 flex-1 text-[9px] font-black uppercase tracking-widest opacity-80">
                              ES Genech {isE1 ? '1' : '2'}
                            </span>
                            {(isPlayed || isCancelled) && (
                              <span className={['shrink-0 rounded-lg px-2 py-1 font-mono text-xs font-black', scoreBg].join(' ')}>
                                {scoreLabel}
                              </span>
                            )}
                          </span>
                          <span className="block whitespace-normal break-words pl-6 text-base font-black leading-snug sm:pl-8 sm:text-lg">
                            {entry.opponent || 'Adversaire à préciser'}
                          </span>
                          <span className="ml-6 flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
                            <span className={`inline-flex w-fit max-w-full rounded-full px-2 py-0.5 ${isE1 ? 'bg-white/15 text-sky-100' : 'bg-blue-950/10 text-blue-950'}`}>
                              {entry.competition || 'Type non renseigné'}
                            </span>
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${isE1 ? 'bg-white/10 text-white/90' : 'bg-blue-950/10 text-blue-950'}`}>
                              <span aria-hidden="true">{homeAwayIcon}</span>
                              {entry.homeAway || 'Lieu ?'}
                            </span>
                            {entry.kickoffTime && (
                              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${isE1 ? 'bg-white/10 text-white/90' : 'bg-blue-950/10 text-blue-950'}`}>
                                <Clock3 aria-hidden="true" className="size-3" />
                                {entry.kickoffTime}
                              </span>
                            )}
                          </span>
                        </button>
                        {canManage && (
                          <div className="flex w-full shrink-0 items-center justify-end gap-1 lg:w-auto">
                            {canStartLive && savedLineup && (
                              <button
                                type="button"
                                disabled={matchLineups.pendingKeys.has(lineupSaveKey)}
                                onClick={() => setLineupToStartLive({
                                  match: { ...entry, date },
                                  lineup: savedLineup,
                                })}
                                aria-label={`Lancer le direct, ES Genech ${isE1 ? '1' : '2'} contre ${entry.opponent || 'adversaire'}`}
                                title="Lancer le match en direct"
                                className="group inline-flex min-h-11 items-center gap-2 rounded-2xl border-2 border-emerald-200 bg-gradient-to-r from-lime-300 via-emerald-400 to-emerald-500 px-3 text-emerald-950 shadow-lg ring-2 ring-emerald-300/50 transition hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-wait disabled:opacity-60 sm:hidden"
                              >
                                <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-lg shadow-inner motion-safe:animate-bounce">⚽</span>
                                <span className="flex flex-col items-start leading-none">
                                  <span className="text-[11px] font-black normal-case tracking-normal">Coup d’envoi !</span>
                                  <span className="mt-1 inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-[0.16em]">
                                    <span aria-hidden="true" className="size-1.5 rounded-full bg-rose-600 motion-safe:animate-pulse" />
                                    Direct
                                  </span>
                                </span>
                              </button>
                            )}
                            {entry.resultLabel !== 'Annulé' && dateInputValue(entry.date) >= localToday() && (
                              <button
                                type="button"
                                disabled={pending || pendingDeletion !== null}
                                onClick={() => startEdit(entry)}
                                aria-label={'Modifier le match contre ' + (entry.opponent || 'cet adversaire')}
                                className={[
                                  'inline-flex size-7 items-center justify-center rounded-md opacity-80 hover:opacity-100 disabled:opacity-50',
                                  isE1 ? 'bg-white/15 hover:bg-white/25' : 'bg-blue-950/15 hover:bg-blue-950/25',
                                ].join(' ')}
                              >
                                <Pencil aria-hidden="true" className="size-3" />
                              </button>
                            )}
                            {dateInputValue(entry.date) >= localToday() &&
                              !entry.resultLabel &&
                              entry.goalsFor === null &&
                              entry.goalsAgainst === null && (
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
                      {isMatchExpanded && (
                        <div id={matchPanelId}>
                          <div className="flex flex-wrap items-center gap-2 border-b border-border/70 px-3 py-2">
                            {entry.meetingTime && (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-black text-amber-950 dark:bg-amber-300/20 dark:text-amber-100">
                                <Clock3 aria-hidden="true" className="size-3.5" /> Rendez-vous au stade · {entry.meetingTime}
                              </span>
                            )}
                            {entry.homeAway === 'Extérieur' && entry.venueAddress?.trim() && (() => {
                              const query = encodeURIComponent(entry.venueAddress.trim()).replace(/%20/g, '+')
                              return (
                                <>
                                  <a href={`https://maps.google.com/?q=${query}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[#4285F4] px-3 text-xs font-black text-white">
                                    <Map aria-hidden="true" className="size-4" /> Google Maps
                                  </a>
                                  <a href={`https://waze.com/ul?q=${query}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[#33CCFF] px-3 text-xs font-black text-[#10213f]">
                                    <Navigation aria-hidden="true" className="size-4" /> Waze
                                  </a>
                                </>
                              )
                            })()}
                            {canManage && (
                              <MatchFamilyMessage match={entry} date={date} calledPlayerNames={calledPlayerNames} />
                            )}
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

      {lineupToStartLive && (
        <LiveMatchConsole
          match={lineupToStartLive.match}
          players={players}
          starters={lineupToStartLive.lineup.starters}
          substitutes={lineupToStartLive.lineup.substitutes}
          onClose={() => setLineupToStartLive(null)}
          onFinalized={() => {
            setLineupToStartLive(null)
            router.refresh()
          }}
        />
      )}
      </div>
    </section>
  )
}
